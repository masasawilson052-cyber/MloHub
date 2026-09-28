/**
 * ============================================================================
 * MLOHUB DISCOVERY ANALYTICS SERVICE
 * ============================================================================
 * Lightweight, privacy-preserving event tracker for food discovery events.
 * Strips precise GPS coordinates to preserve user privacy.
 */

export type DiscoveryEventType =
  | 'SEARCH_STARTED'
  | 'SEARCH_COMPLETED'
  | 'SEARCH_NO_RESULTS'
  | 'FILTER_APPLIED'
  | 'SORT_CHANGED'
  | 'DISH_IMPRESSION'
  | 'DISH_CLICKED'
  | 'RESTAURANT_OPENED'
  | 'DIRECTIONS_CLICKED'
  | 'CALL_CLICKED'
  | 'ORDER_STARTED';

export interface DiscoveryEventPayload {
  eventType: DiscoveryEventType;
  query?: string;
  neighborhood?: string;
  filterName?: string;
  filterValue?: any;
  sortMode?: string;
  menuItemId?: string;
  dishName?: string;
  restaurantId?: string;
  resultCount?: number;
  metadata?: Record<string, any>;
  timestamp: string;
}

export class AnalyticsService {
  private static eventsQueue: DiscoveryEventPayload[] = [];
  private static maxQueueSize = 100;

  /**
   * Tracks an analytics event safely without recording precise coordinates.
   */
  public static trackEvent(
    type: DiscoveryEventType,
    payload: Omit<DiscoveryEventPayload, 'eventType' | 'timestamp'>
  ): void {
    // Sanitize any accidental latitude/longitude leak
    const sanitizedMetadata = { ...(payload.metadata || {}) };
    delete sanitizedMetadata.lat;
    delete sanitizedMetadata.latitude;
    delete sanitizedMetadata.lng;
    delete sanitizedMetadata.longitude;
    delete sanitizedMetadata.coords;

    const event: DiscoveryEventPayload = {
      eventType: type,
      query: payload.query,
      neighborhood: payload.neighborhood,
      filterName: payload.filterName,
      filterValue: payload.filterValue,
      sortMode: payload.sortMode,
      menuItemId: payload.menuItemId,
      dishName: payload.dishName,
      restaurantId: payload.restaurantId,
      resultCount: payload.resultCount,
      metadata: sanitizedMetadata,
      timestamp: new Date().toISOString(),
    };

    this.eventsQueue.push(event);
    if (this.eventsQueue.length > this.maxQueueSize) {
      this.eventsQueue.shift();
    }

    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      // In development, trace subtle breadcrumbs
      // console.log(`[Analytics] ${type}:`, payload.query || payload.dishName || payload.filterName || '');
    }
  }

  /**
   * Returns recent in-memory event buffer for diagnostic tests.
   */
  public static getEventQueue(): DiscoveryEventPayload[] {
    return [...this.eventsQueue];
  }

  /**
   * Clears the event buffer.
   */
  public static clearQueue(): void {
    this.eventsQueue = [];
  }

  public static readonly ZERO_DATA_LABEL = 'Not enough data';

  /**
   * Formats a numeric metric or returns "Not enough data" when null/undefined.
   */
  public static formatMetric(
    value: number | null | undefined,
    formatter?: (val: number) => string
  ): string {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return this.ZERO_DATA_LABEL;
    }
    return formatter ? formatter(value) : String(value);
  }

  /**
   * Computes operational, commercial, discovery, menu, and branch analytics
   * strictly from real records without fabricating numbers when rows are absent.
   */
  public static computeRestaurantAnalytics(params: {
    restaurantId: string;
    orders: any[];
    payments?: any[];
    menuItems?: any[];
    branches?: any[];
    financialSummary?: {
      grossFoodSales?: number;
      restaurantPayable?: number;
    } | null;
    discoveryEvents?: DiscoveryEventPayload[];
    fromDate?: string | Date | null;
    toDate?: string | Date | null;
  }): RestaurantAnalyticsReport {
    const fromMs = params.fromDate ? new Date(params.fromDate).getTime() : null;
    const toMs = params.toDate ? new Date(params.toDate).getTime() : null;

    const filterByDate = (iso?: string) => {
      if (!iso) return true;
      const ms = new Date(iso).getTime();
      if (Number.isNaN(ms)) return true;
      if (fromMs !== null && !Number.isNaN(fromMs) && ms < fromMs) return false;
      if (toMs !== null && !Number.isNaN(toMs) && ms > toMs) return false;
      return true;
    };

    const filteredOrders = (params.orders || []).filter((o) => filterByDate(o.createdAt));
    const filteredPayments = (params.payments || []).filter((p) => filterByDate(p.createdAt));
    const menuItems = params.menuItems || [];
    const branches = params.branches || [];
    const events = (params.discoveryEvents ?? this.eventsQueue).filter(
      (e) => (!e.restaurantId || e.restaurantId === params.restaurantId) && filterByDate(e.timestamp)
    );

    const hasOrders = filteredOrders.length > 0;
    const totalOrders = hasOrders ? filteredOrders.length : null;

    // 1. Operational Metrics
    let acceptanceRatePct: number | null = null;
    let cancellationRatePct: number | null = null;
    let avgPrepTimeMinutes: number | null = null;
    let avgAcceptanceTimeMinutes: number | null = null;
    let lateOrderRatePct: number | null = null;

    if (hasOrders) {
      const acceptedOrBeyond = filteredOrders.filter((o) =>
        ['ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED'].includes(o.status)
      );
      const cancelledOrRejected = filteredOrders.filter((o) =>
        ['CANCELLED', 'REJECTED'].includes(o.status)
      );

      acceptanceRatePct = Math.round((acceptedOrBeyond.length / filteredOrders.length) * 100);
      cancellationRatePct = Math.round((cancelledOrRejected.length / filteredOrders.length) * 100);

      const prepMinutesList = filteredOrders
        .map((o) => o.estimatedPrepMinutes)
        .filter((m): m is number => typeof m === 'number' && m > 0);

      if (prepMinutesList.length > 0) {
        avgPrepTimeMinutes = Math.round(
          prepMinutesList.reduce((sum, m) => sum + m, 0) / prepMinutesList.length
        );
      }

      const acceptanceMinutesList = filteredOrders
        .map((o) => {
          if (o.acceptedAt && o.createdAt) {
            const diff = (new Date(o.acceptedAt).getTime() - new Date(o.createdAt).getTime()) / 60000;
            return diff >= 0 ? diff : null;
          }
          return null;
        })
        .filter((m): m is number => m !== null);

      if (acceptanceMinutesList.length > 0) {
        avgAcceptanceTimeMinutes = Math.round(
          acceptanceMinutesList.reduce((sum, m) => sum + m, 0) / acceptanceMinutesList.length
        );
      }

      const lateOrders = filteredOrders.filter((o) => {
        if (typeof o.estimatedPrepMinutes === 'number' && o.estimatedPrepMinutes > 45) return true;
        if (o.readyAt && o.acceptedAt) {
          const actualPrep = (new Date(o.readyAt).getTime() - new Date(o.acceptedAt).getTime()) / 60000;
          const promised = o.estimatedPrepMinutes || 30;
          return actualPrep > promised;
        }
        return false;
      });
      lateOrderRatePct = Math.round((lateOrders.length / filteredOrders.length) * 100);
    }

    const soldOutItemRatePct =
      menuItems.length > 0
        ? Math.round((menuItems.filter((m) => !m.isAvailable).length / menuItems.length) * 100)
        : null;

    const menuFreshnessPercentage =
      menuItems.length > 0
        ? Math.round(
            (menuItems.filter((m) => {
              if (!m.updatedAt) return true;
              const diffDays = (Date.now() - new Date(m.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
              return diffDays <= 7;
            }).length /
              menuItems.length) *
              100
          )
        : 0;

    // 2. Commercial Metrics
    const successPayments = filteredPayments.filter((p) => p.status === 'SUCCESS');
    const completedOrders = filteredOrders.filter(
      (o) => o.status === 'COMPLETED' || o.status === 'DELIVERED' || o.paymentStatus === 'SUCCESS'
    );

    let grossFoodSalesTzs: number | null = null;
    let netSalesTzs: number | null = null;
    let averageOrderValueTzs: number | null = null;

    if (
      params.financialSummary &&
      typeof params.financialSummary.grossFoodSales === 'number' &&
      params.financialSummary.grossFoodSales > 0
    ) {
      grossFoodSalesTzs = params.financialSummary.grossFoodSales;
      netSalesTzs = params.financialSummary.restaurantPayable ?? params.financialSummary.grossFoodSales;
    } else if (successPayments.length > 0) {
      grossFoodSalesTzs = successPayments.reduce((s, p) => s + (Number(p.amountTzs) || 0), 0);
      netSalesTzs = successPayments.reduce(
        (s, p) =>
          s + (Number(p.netRestaurantPayoutTzs) || (Number(p.amountTzs) || 0) - (Number(p.platformCommissionTzs) || 0)),
        0
      );
    } else if (completedOrders.length > 0) {
      grossFoodSalesTzs = completedOrders.reduce((s, o) => s + (Number(o.subtotalTzs || o.totalTzs) || 0), 0);
      netSalesTzs = grossFoodSalesTzs;
    }

    if (completedOrders.length > 0) {
      const totalOrderVal = completedOrders.reduce((s, o) => s + (Number(o.totalTzs) || 0), 0);
      averageOrderValueTzs = Math.round(totalOrderVal / completedOrders.length);
    }

    let deliverySharePct: number | null = null;
    let pickupSharePct: number | null = null;
    let dineInSharePct: number | null = null;
    let deliveryOrdersCount = 0;
    let pickupOrdersCount = 0;
    let dineInOrdersCount = 0;

    if (hasOrders) {
      filteredOrders.forEach((o) => {
        const mode = String(o.fulfillmentType || o.fulfillmentMode || 'DELIVERY').toUpperCase();
        if (mode === 'PICKUP' || mode === 'TAKEAWAY') {
          pickupOrdersCount += 1;
        } else if (mode === 'DINE_IN' || mode === 'DINE-IN') {
          dineInOrdersCount += 1;
        } else {
          deliveryOrdersCount += 1;
        }
      });
      deliverySharePct = Math.round((deliveryOrdersCount / filteredOrders.length) * 100);
      pickupSharePct = Math.round((pickupOrdersCount / filteredOrders.length) * 100);
      dineInSharePct = Math.max(0, 100 - deliverySharePct - pickupSharePct);
    }

    // 3. Discovery & Conversion
    const impressionEvents = events.filter(
      (e) => e.eventType === 'DISH_IMPRESSION' || e.eventType === 'SEARCH_COMPLETED'
    );
    const viewEvents = events.filter(
      (e) => e.eventType === 'RESTAURANT_OPENED' || e.eventType === 'DISH_CLICKED'
    );
    const zeroResultEvents = events.filter((e) => e.eventType === 'SEARCH_NO_RESULTS');

    const searchImpressions = impressionEvents.length > 0 ? impressionEvents.length : null;
    const restaurantViews = viewEvents.length > 0 ? viewEvents.length : null;
    const conversionRatePct =
      restaurantViews !== null && restaurantViews > 0 && hasOrders
        ? Math.min(100, Math.round((filteredOrders.length / restaurantViews) * 100))
        : null;

    // 4. Menu Performance
    const dishCounts = new Map<string, { ordersCount: number; revenueTzs: number }>();
    filteredOrders.forEach((o) => {
      if (o.status === 'CANCELLED' || o.status === 'REJECTED') return;
      (o.items || []).forEach((item: any) => {
        const dishName = item.itemNameSnapshot || item.name || 'Dish';
        const prev = dishCounts.get(dishName) || { ordersCount: 0, revenueTzs: 0 };
        const qty = Number(item.quantity) || 1;
        const price = Number(item.unitPriceTzs || item.priceTzs || 0);
        dishCounts.set(dishName, {
          ordersCount: prev.ordersCount + qty,
          revenueTzs: prev.revenueTzs + qty * price,
        });
      });
    });

    const topOrderedDishes = Array.from(dishCounts.entries())
      .map(([name, stats]) => ({
        name,
        ordersCount: stats.ordersCount,
        revenueTzs: stats.revenueTzs,
      }))
      .sort((a, b) => b.ordersCount - a.ordersCount)
      .slice(0, 5);

    const dishViewsMap = new Map<string, number>();
    events.forEach((e) => {
      if ((e.eventType === 'DISH_IMPRESSION' || e.eventType === 'DISH_CLICKED') && e.dishName) {
        dishViewsMap.set(e.dishName, (dishViewsMap.get(e.dishName) || 0) + 1);
      }
    });

    const lowConvertingDishes = Array.from(dishViewsMap.entries())
      .map(([name, viewsCount]) => {
        const ordersCount = dishCounts.get(name)?.ordersCount || 0;
        const conversionPct = viewsCount > 0 ? Math.round((ordersCount / viewsCount) * 100) : 0;
        return { name, viewsCount, ordersCount, conversionPct };
      })
      .filter((d) => d.viewsCount >= 2 && d.conversionPct < 25)
      .sort((a, b) => a.conversionPct - b.conversionPct)
      .slice(0, 5);

    const unavailableItemDemand = menuItems
      .filter((m) => !m.isAvailable)
      .map((m) => ({
        dishName: m.name,
        reason: 'Marked 86 / out of stock',
        missedDemandCount: dishViewsMap.get(m.name) || 0,
      }));

    const lostOpportunities = [
      ...unavailableItemDemand.map((u) => ({
        dishName: u.dishName,
        reason: u.reason,
      })),
      ...zeroResultEvents
        .filter((e) => e.query)
        .slice(0, 3)
        .map((e) => ({
          dishName: e.query || 'Search query',
          reason: 'Zero matching dishes in search',
        })),
    ];

    // 5. Branch Performance
    const branchPerformance = branches.map((b) => {
      const branchOrders = filteredOrders.filter((o) => o.branchId === b.id);
      if (branchOrders.length === 0) {
        return {
          branchId: b.id,
          branchName: b.name,
          ordersCount: 0,
          salesTzs: null,
          avgPrepMinutes: null,
          cancellationRatePct: null,
        };
      }
      const validSalesOrders = branchOrders.filter(
        (o) => o.status !== 'CANCELLED' && o.status !== 'REJECTED'
      );
      const salesTzs = validSalesOrders.reduce((s, o) => s + (Number(o.totalTzs) || 0), 0);
      const prepList = branchOrders
        .map((o) => o.estimatedPrepMinutes)
        .filter((m): m is number => typeof m === 'number' && m > 0);
      const avgPrepMinutes =
        prepList.length > 0
          ? Math.round(prepList.reduce((s, m) => s + m, 0) / prepList.length)
          : null;
      const cancelled = branchOrders.filter(
        (o) => o.status === 'CANCELLED' || o.status === 'REJECTED'
      ).length;
      const branchCancelPct = Math.round((cancelled / branchOrders.length) * 100);

      return {
        branchId: b.id,
        branchName: b.name,
        ordersCount: branchOrders.length,
        salesTzs,
        avgPrepMinutes,
        cancellationRatePct: branchCancelPct,
      };
    });

    return {
      hasOrderData: hasOrders,
      hasDiscoveryData: events.length > 0,
      menuFreshnessPercentage,
      averageOrderValueTzs: averageOrderValueTzs ?? 0,
      operational: {
        totalOrders,
        acceptanceRatePct,
        cancellationRatePct,
        avgPrepTimeMinutes,
        avgAcceptanceTimeMinutes,
        lateOrderRatePct,
        soldOutItemRatePct,
      },
      commercial: {
        grossFoodSalesTzs,
        netSalesTzs,
        averageOrderValueTzs,
        deliveryOrdersCount,
        pickupOrdersCount,
        dineInOrdersCount,
        deliverySharePct,
        pickupSharePct,
        dineInSharePct,
      },
      discovery: {
        searchImpressions,
        restaurantViews,
        conversionRatePct,
      },
      topOrderedDishes,
      lowConvertingDishes,
      unavailableItemDemand,
      lostOpportunities,
      branchPerformance,
    };
  }
}

export interface RestaurantAnalyticsReport {
  hasOrderData: boolean;
  hasDiscoveryData: boolean;
  menuFreshnessPercentage: number;
  averageOrderValueTzs: number;
  operational: {
    totalOrders: number | null;
    acceptanceRatePct: number | null;
    cancellationRatePct: number | null;
    avgPrepTimeMinutes: number | null;
    avgAcceptanceTimeMinutes: number | null;
    lateOrderRatePct: number | null;
    soldOutItemRatePct: number | null;
  };
  commercial: {
    grossFoodSalesTzs: number | null;
    netSalesTzs: number | null;
    averageOrderValueTzs: number | null;
    deliveryOrdersCount: number;
    pickupOrdersCount: number;
    dineInOrdersCount: number;
    deliverySharePct: number | null;
    pickupSharePct: number | null;
    dineInSharePct: number | null;
  };
  discovery: {
    searchImpressions: number | null;
    restaurantViews: number | null;
    conversionRatePct: number | null;
  };
  topOrderedDishes: { name: string; ordersCount: number; revenueTzs?: number }[];
  lowConvertingDishes: {
    name: string;
    viewsCount: number;
    ordersCount: number;
    conversionPct: number;
  }[];
  unavailableItemDemand: {
    dishName: string;
    reason: string;
    missedDemandCount?: number;
  }[];
  lostOpportunities: { dishName: string; reason: string }[];
  branchPerformance: {
    branchId: string;
    branchName: string;
    ordersCount: number;
    salesTzs: number | null;
    avgPrepMinutes: number | null;
    cancellationRatePct: number | null;
  }[];
}

