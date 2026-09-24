import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { Alert } from 'react-native';
import { OrderService, OrderQuote } from '../services/OrderService';
import { RealtimeService } from '../services/RealtimeService';
import { PlatformSettingsRepository } from '../repositories/platformSettings.repository';

export interface ModifierOptionSelection {
  group_id: string;
  group_name: string;
  option_id: string;
  option_name: string;
  price_delta_tzs: number;
}

export interface CartItem {
  dishId: string;
  cartLineId?: string;
  dishName: string;
  dishNameSwahili?: string;
  restaurantId: string;
  restaurantName: string;
  branchId?: string;
  branchName?: string;
  priceTzs: number;
  basePriceTzs?: number;
  quantity: number;
  imageUrl?: string;
  notes?: string;
  selectedModifiers?: ModifierOptionSelection[];
  rpcModifiersPayload?: {
    group_id: string;
    option_ids: string[];
  }[];
}

export function createCartLineSignature(
  dishId: string,
  selectedModifiers?: ModifierOptionSelection[] | { group_id: string; option_ids: string[] }[],
  notes?: string
): string {
  const modParts: string[] = [];
  if (selectedModifiers && Array.isArray(selectedModifiers)) {
    for (const m of selectedModifiers) {
      if ('option_id' in m) {
        modParts.push(`${m.group_id}:${m.option_id}`);
      } else if ('option_ids' in m && Array.isArray((m as any).option_ids)) {
        modParts.push(`${m.group_id}:${(m as any).option_ids.sort().join(',')}`);
      }
    }
  }
  const modStr = modParts.sort().join('|');
  const noteStr = (notes || '').trim().toLowerCase();
  return `${dishId}::${modStr}::${noteStr}`;
}

interface CartContextType {
  items: CartItem[];
  restaurantId: string | null;
  restaurantName: string | null;
  branchId: string | null;
  branchName: string | null;
  pricingDisclaimer: string;
  customerServiceFeeTzs: number;
  minimumOrderValueTzs: number;
  addToCart: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void;
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
    if (items.length === 0) {
      setRestaurantId(null);
      setRestaurantName(null);
      setBranchId(null);
      setBranchName(null);
    } else {
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

        return hasChanges ? updated : currentItems;
      });
    });

    return () => {
      unsubscribe();
    };
  }, [restaurantId]);

  const addToCart = (newItem: Omit<CartItem, 'quantity'> & { quantity?: number }) => {
    const qty = newItem.quantity && newItem.quantity > 0 ? newItem.quantity : 1;
    const lineSignature = newItem.cartLineId || createCartLineSignature(
      newItem.dishId,
      newItem.selectedModifiers || newItem.rpcModifiersPayload,
      newItem.notes
    );
    const itemWithLineId: CartItem = {
      ...newItem,
      cartLineId: lineSignature,
      quantity: qty,
    };

    // Check if adding from a different restaurant or different branch
    const isDifferentRestaurant = restaurantId && restaurantId !== newItem.restaurantId;
    const currentBranch = branchId || (items.length > 0 ? items[0].branchId : null);
    const isDifferentBranch = currentBranch && newItem.branchId && currentBranch !== newItem.branchId;

    if (items.length > 0 && (isDifferentRestaurant || isDifferentBranch)) {
      const message = isDifferentRestaurant
        ? `Your cart contains dishes from ${restaurantName || 'another restaurant'}. Do you want to clear your cart and start an order with ${newItem.restaurantName}?`
        : `Your cart contains dishes from a different branch of ${restaurantName || 'this restaurant'}. Do you want to start a new order from this branch?`;

      Alert.alert(
        'Start new order?',
        message,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Start New Order',
            style: 'destructive',
            onPress: () => {
              setItems([itemWithLineId]);
              setRestaurantId(newItem.restaurantId);
              setRestaurantName(newItem.restaurantName);
              setBranchId(newItem.branchId || null);
              setBranchName(newItem.branchName || null);
            },
          },
        ]
      );
      return;
    }

    setItems((prev) => {
      const existingIndex = prev.findIndex((i) => {
        const itemLineId = i.cartLineId || createCartLineSignature(i.dishId, i.selectedModifiers || i.rpcModifiersPayload, i.notes);
        return itemLineId === lineSignature;
      });

      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + qty,
        };
        return updated;
      }
      return [...prev, itemWithLineId];
    });
  };

  const removeFromCart = (cartLineIdOrDishId: string) => {
    setItems((prev) =>
      prev.filter((i) => {
        const lineId = i.cartLineId || createCartLineSignature(i.dishId, i.selectedModifiers || i.rpcModifiersPayload, i.notes);
        if (lineId === cartLineIdOrDishId) return false;
        // Legacy fallback: if passed pure dishId and line doesn't match, also match on dishId if no custom lineId
        if (i.dishId === cartLineIdOrDishId && !i.selectedModifiers?.length && !i.notes) return false;
        return true;
      })
    );
  };

  const updateQuantity = (cartLineIdOrDishId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(cartLineIdOrDishId);
      return;
    }
    setItems((prev) =>
      prev.map((i) => {
        const lineId = i.cartLineId || createCartLineSignature(i.dishId, i.selectedModifiers || i.rpcModifiersPayload, i.notes);
        if (lineId === cartLineIdOrDishId || (i.dishId === cartLineIdOrDishId && !i.selectedModifiers?.length && !i.notes)) {
          return { ...i, quantity };
        }
        return i;
      })
    );
  };

  const clearCart = () => {
    setItems([]);
    setRestaurantId(null);
    setRestaurantName(null);
    setBranchId(null);
    setBranchName(null);
  };

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
