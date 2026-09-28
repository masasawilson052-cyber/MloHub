import { Order } from '../types/domain';

export type KitchenTimerCategory = 'NORMAL' | 'ATTENTION' | 'LATE';

/**
 * Categorizes elapsed kitchen preparation duration:
 * - < 15 minutes: NORMAL (cooking on track)
 * - 15 to 30 minutes: ATTENTION (prep time taking longer than usual)
 * - >= 30 minutes: LATE (order is overdue, surfaces in Attention Center)
 */
export function getKitchenTimerCategory(
  order: Pick<Order, 'createdAt'>,
  currentTime: number = Date.now()
): KitchenTimerCategory {
  const createdAtMs = new Date(order.createdAt).getTime();
  const elapsedMinutes = Math.max(0, Math.floor((currentTime - createdAtMs) / (1000 * 60)));
  if (elapsedMinutes < 15) return 'NORMAL';
  if (elapsedMinutes < 30) return 'ATTENTION';
  return 'LATE';
}

/**
 * Returns true if an active cooking order has exceeded the 30-minute late threshold.
 */
export function isKitchenOrderLate(
  order: Pick<Order, 'createdAt' | 'status'>,
  currentTime: number = Date.now()
): boolean {
  if (order.status !== 'ACCEPTED' && order.status !== 'PREPARING') return false;
  return getKitchenTimerCategory(order, currentTime) === 'LATE';
}
