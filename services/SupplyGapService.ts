/**
 * Stage 11: Supply Gap & Market Validation Intelligence Service
 * Computes privacy-coarsened demand signals, zero-result hotspots,
 * and conversion funnel bottlenecks.
 */

import { TRUST_RULES } from '../config/trustRules';
import {
  SearchAnalyticsEvent,
  ZeroResultEvent,
  FunnelEvent,
  FunnelStage,
  SupplyGapMetric,
  ConversionFunnelReport,
} from '../types/analytics';
import { coarsenLocation, normalizeSearchQuery } from '../utils/geoPrivacy';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

class SupplyGapServiceClass {
  private searchEvents: SearchAnalyticsEvent[] = [];
  private zeroResultEvents: ZeroResultEvent[] = [];
  private funnelEvents: FunnelEvent[] = [];
  // Tracks session's last search query and timestamp for refinement detection
  private sessionLastSearch: Map<string, { query: string; timestamp: number }> = new Map();

  public async persistSearchEvent(event: SearchAnalyticsEvent): Promise<void> {
    if (!isSupabaseConfigured()) return;
    const { error } = await supabase.rpc('track_search_event', {
      p_session_id: event.sessionId,
      p_event_id: event.id,
      p_query: event.normalizedQuery,
      p_result_count: event.resultsCount,
      p_ward_name: event.wardName || null,
      p_metadata: {
        cuisine_category: event.cuisineCategory || null,
        is_refinement: event.isRefinement,
        previous_query: event.previousQuery || null,
      },
    });
    if (error) throw error;
  }

  /**
   * Records a customer search with privacy coarsening (zero GPS retained).
   */
  public recordSearch(params: {
    query: string;
    sessionId: string;
    userId?: string;
    rawLatitude?: number | null;
    rawLongitude?: number | null;
    cuisineCategory?: string;
    resultsCount: number;
  }): SearchAnalyticsEvent {
    const {
      query,
      sessionId,
      userId,
      rawLatitude,
      rawLongitude,
      cuisineCategory,
      resultsCount,
    } = params;

    const normalized = normalizeSearchQuery(query);
    const coarsened = coarsenLocation(rawLatitude, rawLongitude);
    const now = Date.now();

    // Check for rapid refinement (< 30s from previous search in same session)
    let isRefinement = false;
    let previousQuery: string | undefined;
    const lastSearch = this.sessionLastSearch.get(sessionId);
    if (lastSearch && now - lastSearch.timestamp < 30 * 1000) {
      if (lastSearch.query !== normalized) {
        isRefinement = true;
        previousQuery = lastSearch.query;
      }
    }

    this.sessionLastSearch.set(sessionId, { query: normalized, timestamp: now });

    const isZeroResult = resultsCount === 0;

    const event: SearchAnalyticsEvent = {
      id: `srch_${now}_${Math.random().toString(36).substring(2, 7)}`,
      query,
      normalizedQuery: normalized,
      cuisineCategory,
      wardName: coarsened.wardName,
      resultsCount,
      isZeroResult,
      isRefinement,
      previousQuery,
      sessionId,
      userId,
      createdAt: new Date(now).toISOString(),
    };

    this.searchEvents.push(event);

    if (isZeroResult) {
      const zeroEvent: ZeroResultEvent = {
        id: `zr_${now}_${Math.random().toString(36).substring(2, 7)}`,
        query: normalized,
        wardName: coarsened.wardName,
        categoryHint: cuisineCategory,
        occurredAt: event.createdAt,
        refinementQuery: isRefinement ? previousQuery : undefined,
      };
      this.zeroResultEvents.push(zeroEvent);
    }

    // Automatically record SEARCH_EXECUTED in funnel
    this.recordFunnelStep({
      stage: 'SEARCH_EXECUTED',
      sessionId,
      userId,
      wardName: coarsened.wardName,
      metadata: { query: normalized, resultsCount },
    });

    return event;
  }

  /**
   * Records a discovery conversion funnel progression event.
   */
  public recordFunnelStep(params: {
    stage: FunnelStage;
    sessionId: string;
    userId?: string;
    dishId?: string;
    restaurantId?: string;
    branchId?: string;
    wardName?: string;
    metadata?: Record<string, any>;
  }): FunnelEvent {
    const event: FunnelEvent = {
      id: `fnl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      stage: params.stage,
      sessionId: params.sessionId,
      userId: params.userId,
      dishId: params.dishId,
      restaurantId: params.restaurantId,
      branchId: params.branchId,
      wardName: params.wardName,
      metadata: params.metadata,
      createdAt: new Date().toISOString(),
    };

    this.funnelEvents.push(event);
    return event;
  }

  /**
   * Computes Market Supply Gap Index:
   * Supply Gap = (Search Demand Score * (1 + Zero Result Rate)) / (Verified Serving Restaurants + 1)
   */
  public computeSupplyGaps(
    verifiedRestaurantCountsByWardAndCategory?: Record<string, number>
  ): SupplyGapMetric[] {
    // If no events recorded yet, provide realistic Dar es Salaam demo fixtures clearly tagged
    if (this.searchEvents.length === 0) {
      return this.getDemoSupplyGaps();
    }

    // Aggregate queries by ward and normalized query
    const groups: Map<
      string,
      {
        query: string;
        ward: string;
        searchCount: number;
        zeroResultCount: number;
      }
    > = new Map();

    for (const evt of this.searchEvents) {
      const key = `${evt.wardName}::${evt.normalizedQuery}`;
      const existing = groups.get(key) || {
        query: evt.normalizedQuery,
        ward: evt.wardName,
        searchCount: 0,
        zeroResultCount: 0,
      };
      existing.searchCount += 1;
      if (evt.isZeroResult) {
        existing.zeroResultCount += 1;
      }
      groups.set(key, existing);
    }

    const metrics: SupplyGapMetric[] = [];

    groups.forEach((group, key) => {
      const zeroRate =
        group.searchCount > 0 ? group.zeroResultCount / group.searchCount : 0;
      const lookupKey = `${group.ward}::${group.query}`;
      const verifiedSupply =
        verifiedRestaurantCountsByWardAndCategory?.[lookupKey] ?? 0;

      // Deterministic Supply Gap Index formula
      const rawGap =
        (group.searchCount * (1.0 + zeroRate * TRUST_RULES.SUPPLY_GAP.ZERO_RESULT_WEIGHT)) /
        (verifiedSupply + 1);

      const supplyGapIndex = Number(rawGap.toFixed(1));

      let urgencyLevel: SupplyGapMetric['urgencyLevel'] = 'LOW';
      if (supplyGapIndex >= TRUST_RULES.SUPPLY_GAP.HIGH_GAP_THRESHOLD) {
        urgencyLevel = 'CRITICAL';
      } else if (supplyGapIndex >= TRUST_RULES.SUPPLY_GAP.MEDIUM_GAP_THRESHOLD) {
        urgencyLevel = 'HIGH';
      } else if (supplyGapIndex >= 4.0) {
        urgencyLevel = 'MODERATE';
      }

      metrics.push({
        id: `gap_${Math.random().toString(36).substring(2, 9)}`,
        categoryOrDish: group.query.toUpperCase(),
        wardName: group.ward,
        searchDemandScore: group.searchCount,
        zeroResultCount: group.zeroResultCount,
        zeroResultRate: Number(zeroRate.toFixed(2)),
        verifiedServingRestaurants: verifiedSupply,
        supplyGapIndex,
        urgencyLevel,
        recommendedAction:
          urgencyLevel === 'CRITICAL' || urgencyLevel === 'HIGH'
            ? `Recruit or verify restaurants serving ${group.query} in ${group.ward}`
            : `Monitor search trends in ${group.ward}`,
        isFixtureData: false,
        computedAt: new Date().toISOString(),
      });
    });

    return metrics.sort((a, b) => b.supplyGapIndex - a.supplyGapIndex);
  }

  /**
   * Generates Conversion Funnel Analysis across discovery stages.
   */
  public getFunnelReport(): ConversionFunnelReport {
    if (this.funnelEvents.length === 0) {
      return {
        periodDays: 7,
        totalSearches: 1420,
        dishImpressions: 4890,
        dishClicks: 1840,
        restaurantViews: 1120,
        cartAdditions: 490,
        ordersCompleted: 312,
        searchToClickRate: 0.38,
        clickToOrderRate: 0.17,
        funnelDropoffStage: 'Dish Click -> Restaurant View (39% drop)',
        isFixtureData: true,
      };
    }

    const counts: Record<FunnelStage, number> = {
      SEARCH_EXECUTED: 0,
      DISH_IMPRESSION: 0,
      DISH_CLICKED: 0,
      RESTAURANT_VIEWED: 0,
      ADD_TO_CART: 0,
      CHECKOUT_INITIATED: 0,
      ORDER_COMPLETED: 0,
    };

    for (const evt of this.funnelEvents) {
      counts[evt.stage] = (counts[evt.stage] || 0) + 1;
    }

    const searchToClick =
      counts.SEARCH_EXECUTED > 0
        ? Number((counts.DISH_CLICKED / counts.SEARCH_EXECUTED).toFixed(2))
        : 0;

    const clickToOrder =
      counts.DISH_CLICKED > 0
        ? Number((counts.ORDER_COMPLETED / counts.DISH_CLICKED).toFixed(2))
        : 0;

    return {
      periodDays: 7,
      totalSearches: counts.SEARCH_EXECUTED,
      dishImpressions: counts.DISH_IMPRESSION,
      dishClicks: counts.DISH_CLICKED,
      restaurantViews: counts.RESTAURANT_VIEWED,
      cartAdditions: counts.ADD_TO_CART,
      ordersCompleted: counts.ORDER_COMPLETED,
      searchToClickRate: searchToClick,
      clickToOrderRate: clickToOrder,
      funnelDropoffStage: 'Impression to Click Drop-off',
      isFixtureData: false,
    };
  }

  /**
   * Investor demo fixtures for Dar es Salaam supply gaps, tagged as DEMO DATA.
   */
  public getDemoSupplyGaps(): SupplyGapMetric[] {
    return [
      {
        id: 'gap_demo_1',
        categoryOrDish: 'SWAHILI BREAKFAST (VITUMBUA / SUPU YA MBUZI)',
        wardName: 'Masaki / Oysterbay',
        searchDemandScore: 284,
        zeroResultCount: 219,
        zeroResultRate: 0.77,
        verifiedServingRestaurants: 1,
        supplyGapIndex: 247.3,
        urgencyLevel: 'CRITICAL',
        recommendedAction: 'Recruit morning local breakfast vendors near Haile Selassie Rd',
        isFixtureData: true,
        computedAt: new Date().toISOString(),
      },
      {
        id: 'gap_demo_2',
        categoryOrDish: 'SAMAKI WA KUPAKA',
        wardName: 'Sinza / Kijitonyama',
        searchDemandScore: 195,
        zeroResultCount: 142,
        zeroResultRate: 0.73,
        verifiedServingRestaurants: 2,
        supplyGapIndex: 160.2,
        urgencyLevel: 'CRITICAL',
        recommendedAction: 'Verify coastal seafood kitchens in Sinza / Mori',
        isFixtureData: true,
        computedAt: new Date().toISOString(),
      },
      {
        id: 'gap_demo_3',
        categoryOrDish: 'HALAL SHAWARMA / WRAPS (LATE NIGHT)',
        wardName: 'Kariakoo',
        searchDemandScore: 178,
        zeroResultCount: 104,
        zeroResultRate: 0.58,
        verifiedServingRestaurants: 2,
        supplyGapIndex: 128.5,
        urgencyLevel: 'HIGH',
        recommendedAction: 'Onboard evening fast-casual vendors operating post-8PM in Kariakoo',
        isFixtureData: true,
        computedAt: new Date().toISOString(),
      },
      {
        id: 'gap_demo_4',
        categoryOrDish: 'ZANZIBAR MIX (UROJO)',
        wardName: 'Mikocheni',
        searchDemandScore: 140,
        zeroResultCount: 88,
        zeroResultRate: 0.63,
        verifiedServingRestaurants: 1,
        supplyGapIndex: 158.2,
        urgencyLevel: 'HIGH',
        recommendedAction: 'Audit afternoon snack vendors in Mikocheni B',
        isFixtureData: true,
        computedAt: new Date().toISOString(),
      },
      {
        id: 'gap_demo_5',
        categoryOrDish: 'AUTHENTIC CHINESE NOODLES',
        wardName: 'City Centre / Posta',
        searchDemandScore: 82,
        zeroResultCount: 21,
        zeroResultRate: 0.26,
        verifiedServingRestaurants: 3,
        supplyGapIndex: 31.2,
        urgencyLevel: 'MODERATE',
        recommendedAction: 'Update menu verification for Samora Ave specialty restaurants',
        isFixtureData: true,
        computedAt: new Date().toISOString(),
      },
    ];
  }

  /**
   * Reset store (used for test isolation).
   */
  public resetState(): void {
    this.searchEvents = [];
    this.zeroResultEvents = [];
    this.funnelEvents = [];
    this.sessionLastSearch.clear();
  }
}

export const SupplyGapService = new SupplyGapServiceClass();
