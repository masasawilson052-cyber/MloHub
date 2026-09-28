import { RestaurantTab } from '../constants/restaurantPortal';

export interface AttentionAlert {
  id: string;
  type: 'ORDER' | 'KITCHEN_LATE' | 'VERIFICATION' | 'REPORT' | 'RESERVATION' | 'STOCK';
  severity: 'HIGH' | 'MEDIUM' | 'INFO';
  priority?: number;
  title: string;
  description: string;
  actionLabel: string;
  targetTab: RestaurantTab;
}

/**
 * Sorts operational alerts strictly by urgency:
 * Priority 1: PAID orders waiting for acceptance / prep time
 * Priority 2: Late kitchen orders (>30m elapsed prep time)
 * Priority 3: Sold-out items or menu price verification overdue
 * Priority 4: Table reservations & operational daily reports
 */
export function sortAttentionAlerts(alerts: AttentionAlert[]): AttentionAlert[] {
  const getPriority = (alert: AttentionAlert): number => {
    if (alert.priority !== undefined) return alert.priority;
    if (alert.type === 'ORDER' && alert.severity === 'HIGH') return 1;
    if (alert.type === 'KITCHEN_LATE') return 2;
    if (alert.type === 'STOCK' || alert.type === 'VERIFICATION') return 3;
    if (alert.type === 'RESERVATION' || alert.type === 'REPORT') return 4;
    return 5;
  };
  return [...alerts].sort((a, b) => getPriority(a) - getPriority(b));
}
