import { useEffect, useRef } from 'react';
import { CartItem } from '../services/cart/cartCore';
import { MenuRepository } from '../repositories/menus.repository';
import {
  loadCartFromStorage,
  saveCartToStorage,
  clearCartStorage,
} from '../utils/cartStorage';

export interface UseCartHydrationProps {
  onHydrated: (payload: {
    items: CartItem[];
    restaurantId: string;
    restaurantName: string;
    branchId: string | null;
    branchName: string | null;
  }) => void;
  onNotice: (notice: string) => void;
}

export function useCartHydration({ onHydrated, onNotice }: UseCartHydrationProps): void {
  const onHydratedRef = useRef(onHydrated);
  const onNoticeRef = useRef(onNotice);
  onHydratedRef.current = onHydrated;
  onNoticeRef.current = onNotice;

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const stored = await loadCartFromStorage();
        if (!stored || !isMounted || stored.items.length === 0) return;

        let liveDishes: any[] = [];
        try {
          liveDishes = await MenuRepository.listItems(stored.restaurantId);
        } catch (mErr) {
          console.warn('[CartContext] Could not fetch live menu for re-check, retaining cart as stored:', mErr);
        }

        let hasUpdates = false;
        const validItems: CartItem[] = [];

        for (const item of stored.items) {
          const liveItem = liveDishes.find((d) => d.id === item.dishId);
          if (liveDishes.length > 0) {
            // Drop dishes that are unavailable, archived, or out of stock
            if (!liveItem || liveItem.isAvailable === false || liveItem.isArchived === true || liveItem.stockQuantity === 0) {
              hasUpdates = true;
              continue;
            }
            // Update prices if changed
            if (liveItem.priceTzs && liveItem.priceTzs !== item.priceTzs) {
              hasUpdates = true;
              validItems.push({
                ...item,
                priceTzs: liveItem.priceTzs,
                restaurantId: stored.restaurantId,
                restaurantName: stored.restaurantName,
                branchId: stored.branchId || undefined,
                branchName: stored.branchName || undefined,
              });
              continue;
            }
          }
          validItems.push({
            ...item,
            restaurantId: stored.restaurantId,
            restaurantName: stored.restaurantName,
            branchId: stored.branchId || undefined,
            branchName: stored.branchName || undefined,
          });
        }

        if (!isMounted) return;

        if (validItems.length > 0) {
          onHydratedRef.current({
            items: validItems,
            restaurantId: stored.restaurantId,
            restaurantName: stored.restaurantName,
            branchId: stored.branchId || null,
            branchName: stored.branchName || null,
          });

          if (hasUpdates) {
            onNoticeRef.current('Some items in your cart were updated to match current menu availability and prices.');
            saveCartToStorage(stored.restaurantId, stored.restaurantName, stored.branchId, stored.branchName, validItems);
          }
        } else if (hasUpdates) {
          await clearCartStorage();
          onNoticeRef.current('Some items in your cart were updated to match current menu availability and prices.');
        }
      } catch (err) {
        console.warn('[CartContext] Failed to hydrate stored cart:', err);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);
}
