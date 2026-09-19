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

    if (__DEV__) {
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
}
