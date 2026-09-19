/**
 * Stage 11: Trust & Data Quality Service
 * Authoritative deterministic calculations for multi-dimensional trust,
 * Bayesian fulfillment smoothing, decay schedules, and anti-sabotage reporting.
 */

import { TRUST_RULES } from '../config/trustRules';
import {
  TrustFreshnessCategory,
  TrustTier,
  DishTrustAssessment,
  RestaurantTrustAssessment,
  CustomerDiscrepancyReport,
  CustomerReportEvidenceState,
  ReportCategory,
} from '../types/trust';
import { RealtimeService } from './RealtimeService';

class TrustServiceClass {
  // In-memory store for active discrepancy reports (backed by DB in production)
  private discrepancyReports: CustomerDiscrepancyReport[] = [];
  // User submission history for anti-sabotage rate limiting: `userId:itemId` -> timestamp
  private userItemReportHistory: Map<string, number> = new Map();
  private userDailyReportCount: Map<string, { count: number; date: string }> = new Map();

  /**
   * Categorizes freshness based on milliseconds elapsed since last verification.
   */
  public evaluateFreshness(lastVerifiedAt?: string | null): TrustFreshnessCategory {
    if (!lastVerifiedAt) return 'UNKNOWN';

    const verifiedTime = new Date(lastVerifiedAt).getTime();
    if (isNaN(verifiedTime)) return 'UNKNOWN';

    const ageMs = Math.max(0, Date.now() - verifiedTime);

    if (ageMs <= TRUST_RULES.FRESHNESS_THRESHOLDS_MS.FRESH) {
      return 'FRESH';
    }
    if (ageMs <= TRUST_RULES.FRESHNESS_THRESHOLDS_MS.RECENT) {
      return 'RECENT';
    }
    if (ageMs <= TRUST_RULES.FRESHNESS_THRESHOLDS_MS.AGING) {
      return 'AGING';
    }
    return 'STALE';
  }

  /**
   * Calculates Bayesian smoothed fulfillment reliability rate.
   * Formula: (completedOrders + ALPHA_PRIOR) / (totalOrders + PSEUDO_COUNT_C)
   */
  public calculateFulfillmentReliability(
    totalOrders: number,
    completedOrders: number
  ): {
    rate: number;
    tier: TrustTier;
    isLowSample: boolean;
    sampleWarning?: string;
  } {
    const { PSEUDO_COUNT_C, ALPHA_PRIOR, MINIMUM_EVALUATION_SAMPLE } =
      TRUST_RULES.BAYESIAN_FULFILLMENT_PRIOR;

    const safeTotal = Math.max(0, totalOrders);
    const safeCompleted = Math.min(safeTotal, Math.max(0, completedOrders));

    // Bayesian smoothed estimate
    const smoothedRate =
      (safeCompleted + ALPHA_PRIOR) / (safeTotal + PSEUDO_COUNT_C);

    const isLowSample = safeTotal < MINIMUM_EVALUATION_SAMPLE;

    let tier: TrustTier = 'MEDIUM';
    if (isLowSample) {
      tier = 'UNKNOWN';
    } else if (smoothedRate >= 0.88) {
      tier = 'HIGH';
    } else if (smoothedRate >= 0.75) {
      tier = 'MEDIUM';
    } else {
      tier = 'LOW';
    }

    return {
      rate: Number(smoothedRate.toFixed(3)),
      tier,
      isLowSample,
      sampleWarning: isLowSample
        ? `New partner — fewer than ${MINIMUM_EVALUATION_SAMPLE} orders fulfilled (${safeCompleted}/${safeTotal})`
        : undefined,
    };
  }

  /**
   * Deterministic assessment for an individual dish listing.
   */
  public computeDishTrust(params: {
    dishId: string;
    dishName: string;
    restaurantId: string;
    branchId?: string;
    lastVerifiedAt?: string | null;
    lastVerifiedBy?: 'RESTAURANT' | 'ADMIN' | 'COMMUNITY_VERIFIED';
    isAvailable?: boolean;
  }): DishTrustAssessment {
    const {
      dishId,
      dishName,
      restaurantId,
      branchId,
      lastVerifiedAt,
      lastVerifiedBy = 'RESTAURANT',
      isAvailable = true,
    } = params;

    const freshnessCategory = this.evaluateFreshness(lastVerifiedAt);
    let baseConfidence = TRUST_RULES.DECAY_MULTIPLIERS[freshnessCategory];

    // Check active discrepancy reports for this dish
    const activeReports = this.discrepancyReports.filter(
      (r) =>
        r.dishName.toLowerCase() === dishName.toLowerCase() &&
        (r.menuItemId === dishId || r.restaurantId === restaurantId) &&
        (r.evidenceState === 'UNVERIFIED_REPORT' ||
          r.evidenceState === 'UNDER_REVIEW' ||
          r.evidenceState === 'CONFIRMED')
    );

    let isReported = activeReports.length > 0;
    let worstReportState: CustomerReportEvidenceState | undefined;
    let penalty = 0;

    for (const report of activeReports) {
      if (report.evidenceState === 'CONFIRMED') {
        penalty = Math.max(penalty, TRUST_RULES.REPORT_PENALTIES.CONFIRMED_DISCREPANCY);
        worstReportState = 'CONFIRMED';
      } else if (report.evidenceState === 'UNDER_REVIEW') {
        penalty = Math.max(penalty, TRUST_RULES.REPORT_PENALTIES.UNDER_REVIEW);
        if (!worstReportState || worstReportState === 'UNVERIFIED_REPORT') {
          worstReportState = 'UNDER_REVIEW';
        }
      } else if (report.evidenceState === 'UNVERIFIED_REPORT') {
        penalty = Math.max(penalty, TRUST_RULES.REPORT_PENALTIES.UNVERIFIED_REPORT);
        if (!worstReportState) worstReportState = 'UNVERIFIED_REPORT';
      }
    }

    const priceConfidenceScore = Math.max(
      0.0,
      Number((baseConfidence * (1.0 - penalty)).toFixed(2))
    );

    // Derive Price Tier
    let priceTier: TrustTier = 'LOW';
    if (priceConfidenceScore >= 0.85) {
      priceTier = 'HIGH';
    } else if (priceConfidenceScore >= 0.55) {
      priceTier = 'MEDIUM';
    } else if (freshnessCategory === 'UNKNOWN') {
      priceTier = 'UNKNOWN';
    } else {
      priceTier = 'LOW';
    }

    // Availability Tier
    let availabilityTier: TrustTier = isAvailable ? 'HIGH' : 'LOW';
    if (!isAvailable) {
      availabilityTier = 'LOW';
    }

    // Badge and Explanations
    let badgeLabel = 'Verified Price';
    let badgeTone: 'positive' | 'neutral' | 'warning' | 'critical' = 'positive';
    let shortExplanation = 'Price recently verified by restaurant';
    const detailedReasons: string[] = [];

    if (worstReportState === 'CONFIRMED') {
      badgeLabel = 'Disputed Price';
      badgeTone = 'critical';
      shortExplanation = 'Customers reported a price mismatch under review';
      detailedReasons.push('A confirmed customer discrepancy was logged for this item.');
    } else if (worstReportState === 'UNDER_REVIEW' || worstReportState === 'UNVERIFIED_REPORT') {
      badgeLabel = 'Price Under Review';
      badgeTone = 'warning';
      shortExplanation = 'A customer recently reported a price difference';
      detailedReasons.push('An unverified customer report is being checked with the kitchen.');
    } else if (freshnessCategory === 'FRESH') {
      badgeLabel = 'Verified Today';
      badgeTone = 'positive';
      shortExplanation = 'Price confirmed accurate within the last 24 hours';
      detailedReasons.push('Updated or audited within 24 hours by restaurant staff.');
    } else if (freshnessCategory === 'RECENT') {
      badgeLabel = 'Confirmed Recently';
      badgeTone = 'neutral';
      shortExplanation = 'Verified accurate within the last 3 days';
      detailedReasons.push('Audited within the past 72 hours.');
    } else if (freshnessCategory === 'AGING') {
      badgeLabel = 'Audited 3+ Days Ago';
      badgeTone = 'neutral';
      shortExplanation = 'Last verified between 3 and 7 days ago';
      detailedReasons.push('Price has not been re-audited in over 3 days.');
    } else if (freshnessCategory === 'STALE') {
      badgeLabel = 'Needs Verification';
      badgeTone = 'warning';
      shortExplanation = 'Price has not been confirmed in over a week';
      detailedReasons.push('Menu prices can fluctuate; please confirm with staff if unsure.');
    } else {
      badgeLabel = 'Unverified Price';
      badgeTone = 'neutral';
      shortExplanation = 'Listing imported without manual price audit';
      detailedReasons.push('This item does not yet have a recorded manual audit timestamp.');
    }

    if (!isAvailable) {
      detailedReasons.push('Kitchen currently marked this item as Out of Stock.');
    }

    return {
      dishId,
      dishName,
      branchId,
      restaurantId,
      overallTier: priceTier,
      priceTier,
      availabilityTier,
      freshnessCategory,
      priceConfidenceScore,
      badgeLabel,
      badgeTone,
      shortExplanation,
      detailedReasons,
      lastVerifiedAt: lastVerifiedAt || undefined,
      lastVerifiedBy,
      isReportedDiscrepancy: isReported,
      evidenceState: worstReportState,
    };
  }

  /**
   * Deterministic assessment for a restaurant operating profile.
   * Strictly separates Legal Identity from Menu Freshness.
   */
  public computeRestaurantTrust(params: {
    restaurantId: string;
    restaurantName: string;
    isVerified?: boolean;
    verificationStatus?: string;
    totalOrders?: number;
    completedOrders?: number;
    menuLastVerifiedAt?: string | null;
  }): RestaurantTrustAssessment {
    const {
      restaurantId,
      restaurantName,
      isVerified = false,
      verificationStatus = 'UNVERIFIED',
      totalOrders = 0,
      completedOrders = 0,
      menuLastVerifiedAt,
    } = params;

    // 1. Legal Identity
    const legalStatus =
      verificationStatus === 'VERIFIED' || isVerified
        ? 'VERIFIED'
        : verificationStatus === 'PENDING'
        ? 'PENDING'
        : 'UNVERIFIED';

    // 2. Operational Reliability (Bayesian smoothed)
    const fulfillment = this.calculateFulfillmentReliability(
      totalOrders,
      completedOrders
    );

    // 3. Active Discrepancy Reports
    const activeDiscrepancies = this.discrepancyReports.filter(
      (r) =>
        r.restaurantId === restaurantId &&
        r.evidenceState !== 'DISMISSED' &&
        r.evidenceState !== 'RESTAURANT_CORRECTED' &&
        r.evidenceState !== 'ADMIN_RESOLVED'
    );

    let reportHealthTier: TrustTier = 'HIGH';
    if (activeDiscrepancies.length >= 2) {
      reportHealthTier = 'LOW';
    } else if (activeDiscrepancies.length === 1) {
      reportHealthTier = 'MEDIUM';
    }

    // 4. Menu Freshness
    const menuFreshness = this.evaluateFreshness(menuLastVerifiedAt);

    // 5. Overall Health Tier
    let overallHealthTier: TrustTier = 'MEDIUM';
    if (
      legalStatus === 'VERIFIED' &&
      fulfillment.tier === 'HIGH' &&
      reportHealthTier === 'HIGH'
    ) {
      overallHealthTier = 'HIGH';
    } else if (
      fulfillment.tier === 'LOW' ||
      reportHealthTier === 'LOW' ||
      menuFreshness === 'STALE'
    ) {
      overallHealthTier = 'LOW';
    }

    // Summary Badge
    let summaryBadge = 'Trusted Merchant';
    let badgeTone: 'positive' | 'neutral' | 'warning' | 'critical' = 'positive';

    if (legalStatus === 'VERIFIED' && fulfillment.tier === 'HIGH') {
      summaryBadge = 'Highly Reliable Partner';
      badgeTone = 'positive';
    } else if (fulfillment.isLowSample) {
      summaryBadge = 'New Partner';
      badgeTone = 'neutral';
    } else if (reportHealthTier === 'LOW') {
      summaryBadge = 'Disputed Prices';
      badgeTone = 'warning';
    } else if (menuFreshness === 'STALE') {
      summaryBadge = 'Menu Needs Audit';
      badgeTone = 'neutral';
    }

    return {
      restaurantId,
      restaurantName,
      legalVerificationStatus: legalStatus,
      isBrelaVerified: legalStatus === 'VERIFIED',
      isTinVerified: legalStatus === 'VERIFIED',
      fulfillmentReliabilityTier: fulfillment.tier,
      bayesianReliabilityRate: fulfillment.rate,
      actualCompletedOrders: Math.max(0, completedOrders),
      totalOrdersCount: Math.max(0, totalOrders),
      hoursConfidenceTier: 'HIGH',
      locationConfidenceTier: 'HIGH',
      overallHealthTier,
      isLowSample: fulfillment.isLowSample,
      sampleSizeWarning: fulfillment.sampleWarning,
      activeDiscrepancyCount: activeDiscrepancies.length,
      reportHealthTier,
      summaryBadge,
      badgeTone,
      explanations: {
        identity:
          legalStatus === 'VERIFIED'
            ? 'Registered business with verified documentation'
            : 'Unverified business profile',
        fulfillment: fulfillment.isLowSample
          ? `New partner with ${completedOrders} completed orders. Reliability score pending.`
          : `${Math.round(fulfillment.rate * 100)}% reliability (${completedOrders}/${totalOrders} orders completed)`,
        menuFreshness:
          menuFreshness === 'FRESH'
            ? 'Menu audited within the last 24 hours'
            : menuFreshness === 'RECENT'
            ? 'Menu confirmed in the last 3 days'
            : 'Menu has not been audited recently',
        reportHealth:
          activeDiscrepancies.length === 0
            ? 'No active price or availability complaints'
            : `${activeDiscrepancies.length} discrepancy report(s) under review`,
      },
    };
  }

  /**
   * Submit a customer discrepancy report with rate limiting & anti-sabotage checks.
   */
  public submitDiscrepancyReport(params: {
    restaurantId: string;
    dishName: string;
    branchId?: string;
    menuItemId?: string;
    reportedPrice?: number;
    listedPrice?: number;
    category: ReportCategory;
    description?: string;
    evidenceUrl?: string;
    userId: string;
    hasPaidOrderHistory?: boolean;
  }): { success: boolean; report?: CustomerDiscrepancyReport; error?: string } {
    const {
      restaurantId,
      dishName,
      branchId,
      menuItemId,
      reportedPrice,
      listedPrice,
      category,
      description,
      evidenceUrl,
      userId,
      hasPaidOrderHistory = false,
    } = params;

    const now = Date.now();
    const itemKey = `${userId}:${menuItemId || dishName.toLowerCase()}`;

    // Rate Limit 1: Max 1 report per item per 24 hours
    const lastReportTime = this.userItemReportHistory.get(itemKey);
    if (
      lastReportTime &&
      now - lastReportTime <
        TRUST_RULES.REPORT_LIMITS.MAX_REPORTS_PER_ITEM_PER_USER_HOURS * 3600 * 1000
    ) {
      return {
        success: false,
        error:
          'You have already submitted a report for this item recently. Please allow 24 hours before reporting again.',
      };
    }

    // Rate Limit 2: Max 3 daily reports platform-wide
    const today = new Date().toISOString().split('T')[0];
    const userDaily = this.userDailyReportCount.get(userId);
    if (userDaily && userDaily.date === today) {
      if (userDaily.count >= TRUST_RULES.REPORT_LIMITS.MAX_REPORTS_PER_USER_DAILY) {
        return {
          success: false,
          error:
            'You have reached the maximum daily limit for discrepancy reports (3/day).',
        };
      }
      userDaily.count += 1;
    } else {
      this.userDailyReportCount.set(userId, { count: 1, date: today });
    }

    this.userItemReportHistory.set(itemKey, now);

    // Initial evidence state: unverified report
    const report: CustomerDiscrepancyReport = {
      id: `rep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      restaurantId,
      branchId,
      menuItemId,
      dishName,
      reportedPrice,
      listedPrice,
      category,
      description,
      evidenceUrl,
      reportedByUserId: userId,
      hasPaidOrderHistory,
      evidenceState: 'UNVERIFIED_REPORT',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Auto-escalate to UNDER_REVIEW if user has paid order history or multiple reports exist
    const existingReportsForDish = this.discrepancyReports.filter(
      (r) =>
        r.dishName.toLowerCase() === dishName.toLowerCase() &&
        r.restaurantId === restaurantId
    );
    if (
      hasPaidOrderHistory ||
      existingReportsForDish.length >= TRUST_RULES.REPORT_LIMITS.CORROBORATION_THRESHOLD - 1
    ) {
      report.evidenceState = 'UNDER_REVIEW';
    }

    this.discrepancyReports.push(report);

    // Realtime broadcast of report creation
    try {
      RealtimeService.publishEvent(
        `reports:restaurant:${restaurantId}`,
        'DATA_REPORT_CREATED',
        {
          reportId: report.id,
          restaurantId,
          dishName,
          category,
          evidenceState: report.evidenceState,
        }
      );
    } catch (err) {
      console.warn('[TrustService] Realtime dispatch warning:', err);
    }

    return { success: true, report };
  }

  /**
   * Resolve a discrepancy report (by Admin or Restaurant operator).
   * Instantly restores trust confidence if corrected or dismissed.
   */
  public resolveDiscrepancyReport(params: {
    reportId: string;
    action: 'DISMISS' | 'CONFIRM' | 'RESTAURANT_CORRECT';
    adminNotes?: string;
    updatedPrice?: number;
  }): { success: boolean; report?: CustomerDiscrepancyReport; error?: string } {
    const { reportId, action, adminNotes } = params;
    const report = this.discrepancyReports.find((r) => r.id === reportId);
    if (!report) {
      return { success: false, error: 'Discrepancy report not found' };
    }

    report.updatedAt = new Date().toISOString();
    report.resolvedAt = new Date().toISOString();
    report.adminNotes = adminNotes;

    if (action === 'DISMISS') {
      report.evidenceState = 'DISMISSED';
    } else if (action === 'CONFIRM') {
      report.evidenceState = 'CONFIRMED';
    } else if (action === 'RESTAURANT_CORRECT') {
      report.evidenceState = 'RESTAURANT_CORRECTED';
    }

    // Realtime broadcast of report resolution
    try {
      RealtimeService.publishEvent(
        `reports:restaurant:${report.restaurantId}`,
        'DATA_REPORT_RESOLVED',
        {
          reportId: report.id,
          restaurantId: report.restaurantId,
          dishName: report.dishName,
          evidenceState: report.evidenceState,
          action,
        }
      );
    } catch (err) {
      console.warn('[TrustService] Realtime dispatch warning:', err);
    }

    return { success: true, report };
  }

  /**
   * Get all active discrepancy reports for a specific restaurant.
   */
  public getReportsForRestaurant(restaurantId: string): CustomerDiscrepancyReport[] {
    return this.discrepancyReports.filter((r) => r.restaurantId === restaurantId);
  }

  /**
   * Get all reports across the platform (for Admin Verification Center).
   */
  public getAllReports(): CustomerDiscrepancyReport[] {
    return [...this.discrepancyReports];
  }

  /**
   * Reset store (used for test isolation).
   */
  public resetState(): void {
    this.discrepancyReports = [];
    this.userItemReportHistory.clear();
    this.userDailyReportCount.clear();
  }
}

export const TrustService = new TrustServiceClass();
