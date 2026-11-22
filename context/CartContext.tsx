import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { OrderService, OrderQuote } from '../services/OrderService';
import { RealtimeService } from '../services/RealtimeService';
import { useFeeRules } from '../hooks/useFeeRules';
import { useAuth } from './AuthContext';
import { BranchOperationsRepository } from '../repositories/branchOperations.repository';
import { MenuRepository } from '../repositories/menus.repository';
import {
  saveCartToStorage,
  loadCartFromStorage,
  clearCartStorage,
} from '../utils/cartStorage';

import {
  CartAddOutcome,
  ModifierOptionSelection,
  CartItem,
  CartItemInput,
  CartStateSnapshot,
  createCartLineSignature,
  normalizeCartItemInput,
  mergeCartItemList,
  processCartAddRequest,
} from '../services/cart/cartCore';

export type {
  CartAddOutcome,
  ModifierOptionSelection,
  CartItem,
  CartItemInput,
  CartStateSnapshot,
};

export {
  createCartLineSignature,
  normalizeCartItemInput,
  mergeCartItemList,
  processCartAddRequest,
};

export interface CartContextType {
  items: CartItem[];
  restaurantId: string | null;
  restaurantName: string | null;
  branchId: string | null;
  branchName: string | null;
  pricingDisclaimer: string;
  customerServiceFeeTzs: number;
  minimumOrderValueTzs: number;
  addToCart: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => Promise<CartAddOutcome>;
  removeFromCart: (cartLineIdOrDishId: string) => void;
  updateQuantity: (cartLineIdOrDishId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  subtotalTzs: number;
  deliveryFeeTzs: number;
  serviceFeeTzs: number;
  totalBillTzs: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  getOrderQuote: (diningOption?: 'Delivery' | 'Dine-In' | 'Takeaway', deliveryFeeTzs?: number) => OrderQuote;

  // Resilient Cart & Fulfillment
  lowestDeliveryFeeTzs: number | null;
  deliveryPricingMode: 'ROUTE_DISTANCE' | 'FIXED_ZONE';
  supportsDelivery: boolean;
  estimatedTotalBillTzs: number;
  cartUpdatedNotice: string | null;
  clearCartUpdatedNotice: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [branchName, setBranchName] = useState<string | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartUpdatedNotice, setCartUpdatedNotice] = useState<string | null>(null);

  const [deliveryPricingMode, setDeliveryPricingMode] = useState<'ROUTE_DISTANCE' | 'FIXED_ZONE'>('ROUTE_DISTANCE');
  const [lowestDeliveryFeeTzs, setLowestDeliveryFeeTzs] = useState<number | null>(null);
  const [supportsDelivery, setSupportsDelivery] = useState(true);

  const { feeRules } = useFeeRules();
  const minimumOrderValueTzs = feeRules.minimumOrderValueTzs;
  const { user } = useAuth();

  const itemsRef = useRef<CartItem[]>([]);
  const restaurantIdRef = useRef<string | null>(null);
  const restaurantNameRef = useRef<string | null>(null);
  const branchIdRef = useRef<string | null>(null);
  const branchNameRef = useRef<string | null>(null);
  const prevUserIdRef = useRef<string | null>(user?.id || null);

  const clearCartUpdatedNotice = useCallback(() => {
    setCartUpdatedNotice(null);
  }, []);

  // Clear cart only on explicit sign-out (when previous user was non-null, now null)
  useEffect(() => {
    if (prevUserIdRef.current && !user?.id) {
      itemsRef.current = [];
      restaurantIdRef.current = null;
      restaurantNameRef.current = null;
      branchIdRef.current = null;
      branchNameRef.current = null;
      setItems([]);
      setRestaurantId(null);
      setRestaurantName(null);
      setBranchId(null);
      setBranchName(null);
      clearCartStorage();
    }
    prevUserIdRef.current = user?.id || null;
  }, [user?.id]);

  // Hydrate cart from persistent storage on mount & re-check items against current live menu
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
          itemsRef.current = validItems;
          restaurantIdRef.current = stored.restaurantId;
          restaurantNameRef.current = stored.restaurantName;
          branchIdRef.current = stored.branchId || null;
          branchNameRef.current = stored.branchName || null;
          setItems(validItems);
          setRestaurantId(stored.restaurantId);
          setRestaurantName(stored.restaurantName);
          setBranchId(stored.branchId || null);
          setBranchName(stored.branchName || null);

          if (hasUpdates) {
            setCartUpdatedNotice('Some items in your cart were updated to match current menu availability and prices.');
            saveCartToStorage(stored.restaurantId, stored.restaurantName, stored.branchId, stored.branchName, validItems);
          }
        } else if (hasUpdates) {
          await clearCartStorage();
          setCartUpdatedNotice('Some items in your cart were updated to match current menu availability and prices.');
        }
      } catch (err) {
        console.warn('[CartContext] Failed to hydrate stored cart:', err);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  // Sync restaurant and branch metadata with items & auto-persist
  useEffect(() => {
    itemsRef.current = items;
    if (items.length === 0) {
      restaurantIdRef.current = null;
      restaurantNameRef.current = null;
      branchIdRef.current = null;
      branchNameRef.current = null;
      setRestaurantId(null);
      setRestaurantName(null);
      setBranchId(null);
      setBranchName(null);
      clearCartStorage();
    } else {
      const restId = items[0].restaurantId;
      const restName = items[0].restaurantName;
      const bId = items[0].branchId || null;
      const bName = items[0].branchName || null;
      restaurantIdRef.current = restId;
      restaurantNameRef.current = restName;
      branchIdRef.current = bId;
      branchNameRef.current = bName;
      setRestaurantId(restId);
      setRestaurantName(restName);
      setBranchId(bId);
      setBranchName(bName);
      saveCartToStorage(restId, restName, bId, bName, items);
    }
  }, [items]);

  // Query branch delivery pricing mode and delivery zones to establish branch delivery capability
  useEffect(() => {
    let isMounted = true;
    const targetBranchId = branchId || (items.length > 0 ? items[0].branchId : null);
    if (!targetBranchId) {
      setLowestDeliveryFeeTzs(null);
      setSupportsDelivery(true);
      setDeliveryPricingMode('ROUTE_DISTANCE');
      return;
    }

    Promise.all([
      BranchOperationsRepository.getBranchDeliveryPricing(targetBranchId).catch(() => ({
        pricingMode: 'ROUTE_DISTANCE' as const,
        baseFeeTzs: 2000,
        minimumFeeTzs: 2000,
      })),
      BranchOperationsRepository.getDeliveryZones(targetBranchId).catch(() => []),
    ]).then(([pricing, zones]) => {
      if (!isMounted) return;
      const mode = pricing.pricingMode || 'ROUTE_DISTANCE';
      setDeliveryPricingMode(mode);

      const activeZones = (zones || []).filter((z) => z.isActive !== false);
      const branchSupportsDel = mode === 'ROUTE_DISTANCE' || activeZones.length > 0;
      setSupportsDelivery(branchSupportsDel);

      if (mode === 'FIXED_ZONE') {
        if (activeZones.length > 0) {
          const minZone = Math.min(...activeZones.map((z) => z.feeTzs));
          setLowestDeliveryFeeTzs(minZone);
        } else {
          setLowestDeliveryFeeTzs(null);
        }
      } else {
        const base = pricing.baseFeeTzs;
        setLowestDeliveryFeeTzs(typeof base === 'number' && base > 0 ? base : null);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [branchId, items]);

  // Real-time menu price and availability monitoring for cart items
  useEffect(() => {
    if (!restaurantId) return;

    const unsubscribe = RealtimeService.subscribeToMenu(restaurantId, (event) => {
      const payload = event.payload;
      if (!payload || !payload.menuItemId) return;

      setItems((currentItems) => {
        let hasChanges = false;
        const updated = currentItems.map((item) => {
          if (item.dishId === payload.menuItemId) {
            let newPrice = item.priceTzs;
            if (payload.priceTzs && payload.priceTzs !== item.priceTzs) {
              newPrice = payload.priceTzs;
              hasChanges = true;
              Alert.alert(
                'Price Updated',
                `The price for "${item.dishName}" has updated from TZS ${item.priceTzs.toLocaleString()} to TZS ${payload.priceTzs.toLocaleString()}.`
              );
            }
            if (payload.isAvailable === false || payload.stockQuantity === 0) {
              Alert.alert(
                'Item Sold Out',
                `"${item.dishName}" is currently out of stock and was marked unavailable by the kitchen.`
              );
            }
            return { ...item, priceTzs: newPrice };
          }
          return item;
        });

        if (hasChanges) {
          itemsRef.current = updated;
          return updated;
        }
        return currentItems;
      });
    });

    return () => {
      unsubscribe();
    };
  }, [restaurantId]);

  const addToCart = useCallback(
    async (newItem: Omit<CartItem, 'quantity'> & { quantity?: number }): Promise<CartAddOutcome> => {
      const snapshot: CartStateSnapshot = {
        items: itemsRef.current,
        restaurantId: restaurantIdRef.current,
        restaurantName: restaurantNameRef.current,
        branchId: branchIdRef.current,
        branchName: branchNameRef.current,
      };

      const { state: nextState, outcome } = await processCartAddRequest(
        snapshot,
        newItem,
        (title, message) =>
          new Promise<boolean>((resolve) => {
            let settled = false;
            const finish = (confirmed: boolean) => {
              if (!settled) {
                settled = true;
                resolve(confirmed);
              }
            };

            Alert.alert(
              title,
              message,
              [
                {
                  text: 'Cancel',
                  style: 'cancel',
                  onPress: () => finish(false),
                },
                {
                  text: 'Start New Order',
                  style: 'destructive',
                  onPress: () => finish(true),
                },
              ],
              {
                cancelable: true,
                onDismiss: () => finish(false),
              }
            );
          })
      );

      if (outcome === 'ADDED' || outcome === 'REPLACED_CART') {
        itemsRef.current = nextState.items;
        restaurantIdRef.current = nextState.restaurantId;
        restaurantNameRef.current = nextState.restaurantName;
        branchIdRef.current = nextState.branchId;
        branchNameRef.current = nextState.branchName;
        setItems(nextState.items);
        setRestaurantId(nextState.restaurantId);
        setRestaurantName(nextState.restaurantName);
        setBranchId(nextState.branchId);
        setBranchName(nextState.branchName);
      }

      return outcome;
    },
    []
  );

  const removeFromCart = useCallback((cartLineIdOrDishId: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => {
        const lineId =
          i.cartLineId ||
          createCartLineSignature(i.dishId, i.selectedModifiers || i.rpcModifiersPayload, i.notes);
        if (lineId === cartLineIdOrDishId) return false;
        // Legacy fallback: if passed pure dishId and line doesn't match, also match on dishId if no custom lineId
        if (i.dishId === cartLineIdOrDishId && !i.selectedModifiers?.length && !i.notes) return false;
        return true;
      });
      itemsRef.current = next;
      return next;
    });
  }, []);

  const updateQuantity = useCallback(
    (cartLineIdOrDishId: string, quantity: number) => {
      if (quantity <= 0) {
        removeFromCart(cartLineIdOrDishId);
        return;
      }
      setItems((prev) => {
        const next = prev.map((i) => {
          const lineId =
            i.cartLineId ||
            createCartLineSignature(i.dishId, i.selectedModifiers || i.rpcModifiersPayload, i.notes);
          if (
            lineId === cartLineIdOrDishId ||
            (i.dishId === cartLineIdOrDishId && !i.selectedModifiers?.length && !i.notes)
          ) {
            return { ...i, quantity };
          }
          return i;
        });
        itemsRef.current = next;
        return next;
      });
    },
    [removeFromCart]
  );

  const clearCart = useCallback(() => {
    itemsRef.current = [];
    restaurantIdRef.current = null;
    restaurantNameRef.current = null;
    branchIdRef.current = null;
    branchNameRef.current = null;
    setItems([]);
    setRestaurantId(null);
    setRestaurantName(null);
    setBranchId(null);
    setBranchName(null);
  }, []);

  const getOrderQuote = useCallback(
    (diningOption: 'Delivery' | 'Dine-In' | 'Takeaway' = 'Delivery', deliveryFeeTzs?: number): OrderQuote => {
      return OrderService.quoteOrder({
        items: items.map((i) => ({ unitPriceTzs: i.priceTzs, quantity: i.quantity })),
        diningOption,
        deliveryFeeTzs,
        feeRules,
      });
    },
    [items, feeRules]
  );

  const defaultQuote = useMemo(() => getOrderQuote('Delivery', 0), [getOrderQuote]);

  const totalItems = defaultQuote.itemCount;
  const subtotalTzs = defaultQuote.subtotalTzs;
  const deliveryFeeTzs = items.length > 0 ? defaultQuote.deliveryFeeTzs : 0;
  const serviceFeeTzs = items.length > 0 ? defaultQuote.serviceFeeTzs : 0;
  const totalBillTzs = items.length > 0 ? defaultQuote.totalTzs : 0;
  const estimatedTotalBillTzs = items.length > 0
    ? subtotalTzs + serviceFeeTzs + (lowestDeliveryFeeTzs || 0)
    : 0;
  const pricingDisclaimer = 'Estimate — final total is revalidated by the restaurant branch.';

  return (
    <CartContext.Provider
      value={{
        items,
        restaurantId,
        restaurantName,
        branchId,
        branchName,
        pricingDisclaimer,
        customerServiceFeeTzs: serviceFeeTzs,
        minimumOrderValueTzs,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        totalItems,
        subtotalTzs,
        deliveryFeeTzs,
        serviceFeeTzs,
        totalBillTzs,
        isCartOpen,
        setIsCartOpen,
        getOrderQuote,
        lowestDeliveryFeeTzs,
        deliveryPricingMode,
        supportsDelivery,
        estimatedTotalBillTzs,
        cartUpdatedNotice,
        clearCartUpdatedNotice,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

