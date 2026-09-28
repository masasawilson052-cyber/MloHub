import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { OrderService, OrderQuote } from '../services/OrderService';
import { RealtimeService } from '../services/RealtimeService';
import { PlatformSettingsRepository } from '../repositories/platformSettings.repository';

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
}

const FIXED_DELIVERY_FEE_TZS = 2500;
const FIXED_SERVICE_FEE_TZS = 1500;

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [branchName, setBranchName] = useState<string | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [customerServiceFeeTzs, setCustomerServiceFeeTzs] = useState(1500);
  const [minimumOrderValueTzs, setMinimumOrderValueTzs] = useState(2000);

  const itemsRef = useRef<CartItem[]>([]);
  const restaurantIdRef = useRef<string | null>(null);
  const restaurantNameRef = useRef<string | null>(null);
  const branchIdRef = useRef<string | null>(null);
  const branchNameRef = useRef<string | null>(null);

  // Load authoritative platform financial settings
  useEffect(() => {
    let isMounted = true;
    PlatformSettingsRepository.getFinancialSettings()
      .then((settings) => {
        if (!isMounted) return;
        if (settings.customerServiceFeeTzs !== undefined) {
          setCustomerServiceFeeTzs(settings.customerServiceFeeTzs);
        }
        if (settings.minimumOrderValueTzs !== undefined) {
          setMinimumOrderValueTzs(settings.minimumOrderValueTzs);
        }
      })
      .catch((err) => {
        console.warn('Failed to load financial settings in CartContext:', err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Sync restaurant and branch metadata with items
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
    } else {
      restaurantIdRef.current = items[0].restaurantId;
      restaurantNameRef.current = items[0].restaurantName;
      branchIdRef.current = items[0].branchId || null;
      branchNameRef.current = items[0].branchName || null;
      setRestaurantId(items[0].restaurantId);
      setRestaurantName(items[0].restaurantName);
      setBranchId(items[0].branchId || null);
      setBranchName(items[0].branchName || null);
    }
  }, [items]);

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
        serviceFeeTzs: customerServiceFeeTzs,
      });
    },
    [items, customerServiceFeeTzs]
  );

  const defaultQuote = useMemo(() => getOrderQuote('Delivery', 0), [getOrderQuote]);

  const totalItems = defaultQuote.itemCount;
  const subtotalTzs = defaultQuote.subtotalTzs;
  const deliveryFeeTzs = items.length > 0 ? defaultQuote.deliveryFeeTzs : 0;
  const serviceFeeTzs = items.length > 0 ? defaultQuote.serviceFeeTzs : 0;
  const totalBillTzs = items.length > 0 ? defaultQuote.totalTzs : 0;
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
        customerServiceFeeTzs,
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

