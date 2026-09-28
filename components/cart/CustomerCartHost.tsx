import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { useCart } from '@/context/CartContext';
import { FloatingCartButton } from '@/components/cart/FloatingCartButton';
import { CartDrawer } from '@/components/cart/CartDrawer';
import { OrderReviewModal } from '@/components/checkout/OrderReviewModal';

export interface CustomerCartHostProps {
  showWhenEmpty?: boolean;
  bottomOffset?: number;
  isVerifiedRestaurant?: boolean;
  onOrderSuccess?: (orderId: string) => void;
}

export const CustomerCartHost: React.FC<CustomerCartHostProps> = ({
  showWhenEmpty = true,
  bottomOffset,
  isVerifiedRestaurant = false,
  onOrderSuccess,
}) => {
  const router = useRouter();
  const { isCartOpen, setIsCartOpen } = useCart();
  const [isOrderReviewOpen, setIsOrderReviewOpen] = useState(false);

  return (
    <>
      <FloatingCartButton
        showWhenEmpty={showWhenEmpty}
        bottomOffset={bottomOffset}
      />
      <CartDrawer
        visible={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onProceedToCheckout={() => {
          setIsCartOpen(false);
          setIsOrderReviewOpen(true);
        }}
      />
      <OrderReviewModal
        visible={isOrderReviewOpen}
        onClose={() => setIsOrderReviewOpen(false)}
        isVerifiedRestaurant={isVerifiedRestaurant}
        onOrderConfirmed={(orderId) => {
          setIsOrderReviewOpen(false);
          if (onOrderSuccess) {
            onOrderSuccess(orderId);
          } else {
            router.push({ pathname: '/(tabs)/orders', params: { orderId } });
          }
        }}
      />
    </>
  );
};
