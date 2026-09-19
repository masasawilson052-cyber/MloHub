import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { Alert } from 'react-native';
import { OrderService, OrderQuote } from '../services/OrderService';
import { RealtimeService } from '../services/RealtimeService';

export interface CartItem {
  dishId: string;
  dishName: string;
  dishNameSwahili?: string;
  restaurantId: string;
  restaurantName: string;
  branchId?: string;
  branchName?: string;
  priceTzs: number;
  quantity: number;
  imageUrl?: string;
  notes?: string;
}

interface CartContextType {
  items: CartItem[];
  restaurantId: string | null;
  restaurantName: string | null;
  addToCart: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void;
  removeFromCart: (dishId: string) => void;
  updateQuantity: (dishId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  subtotalTzs: number;
  deliveryFeeTzs: number;
  serviceFeeTzs: number;
  totalBillTzs: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  getOrderQuote: (diningOption?: 'Delivery' | 'Dine-In' | 'Takeaway') => OrderQuote;
}

const FIXED_DELIVERY_FEE_TZS = 2500;
const FIXED_SERVICE_FEE_TZS = 1500;

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState<string | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Sync restaurant metadata with items
  useEffect(() => {
    if (items.length === 0) {
      setRestaurantId(null);
      setRestaurantName(null);
    } else {
      setRestaurantId(items[0].restaurantId);
      setRestaurantName(items[0].restaurantName);
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

    // Check if adding from a different restaurant
    if (restaurantId && restaurantId !== newItem.restaurantId && items.length > 0) {
      Alert.alert(
        'Start new order?',
        `Your cart contains dishes from ${restaurantName}. Do you want to clear your cart and start an order with ${newItem.restaurantName}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Start New Order',
            style: 'destructive',
            onPress: () => {
              setItems([{ ...newItem, quantity: qty }]);
              setRestaurantId(newItem.restaurantId);
              setRestaurantName(newItem.restaurantName);
            },
          },
        ]
      );
      return;
    }

    setItems((prev) => {
      const existingIndex = prev.findIndex((i) => i.dishId === newItem.dishId);
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + qty,
        };
        return updated;
      }
      return [...prev, { ...newItem, quantity: qty }];
    });
  };

  const removeFromCart = (dishId: string) => {
    setItems((prev) => prev.filter((i) => i.dishId !== dishId));
  };

  const updateQuantity = (dishId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(dishId);
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.dishId === dishId ? { ...i, quantity } : i))
    );
  };

  const clearCart = () => {
    setItems([]);
    setRestaurantId(null);
    setRestaurantName(null);
  };

  const getOrderQuote = useCallback(
    (diningOption: 'Delivery' | 'Dine-In' | 'Takeaway' = 'Delivery'): OrderQuote => {
      return OrderService.quoteOrder({
        items: items.map((i) => ({ unitPriceTzs: i.priceTzs, quantity: i.quantity })),
        diningOption,
      });
    },
    [items]
  );

  const defaultQuote = useMemo(() => getOrderQuote('Delivery'), [getOrderQuote]);

  const totalItems = defaultQuote.itemCount;
  const subtotalTzs = defaultQuote.subtotalTzs;
  const deliveryFeeTzs = items.length > 0 ? defaultQuote.deliveryFeeTzs : 0;
  const serviceFeeTzs = items.length > 0 ? defaultQuote.serviceFeeTzs : 0;
  const totalBillTzs = items.length > 0 ? defaultQuote.totalTzs : 0;

  return (
    <CartContext.Provider
      value={{
        items,
        restaurantId,
        restaurantName,
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
