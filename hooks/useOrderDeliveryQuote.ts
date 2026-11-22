import { useState, useEffect } from 'react';
import { DeliveryQuoteApi, DeliveryQuoteResult } from '../services/api/DeliveryQuoteApi';
import { FulfillmentType } from '../components/checkout/FulfillmentSelector';

export interface UseOrderDeliveryQuoteParams {
  visible: boolean;
  fulfillment: FulfillmentType;
  effectiveBranchId?: string | null;
  destinationCoords: { latitude: number; longitude: number } | null;
}

export interface UseOrderDeliveryQuoteResult {
  deliveryQuote: DeliveryQuoteResult | null;
  isLoadingQuote: boolean;
  quoteError: string | null;
  isOutsideDeliveryRange: boolean;
}

export function useOrderDeliveryQuote({
  visible,
  fulfillment,
  effectiveBranchId,
  destinationCoords,
}: UseOrderDeliveryQuoteParams): UseOrderDeliveryQuoteResult {
  const [deliveryQuote, setDeliveryQuote] = useState<DeliveryQuoteResult | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [isOutsideDeliveryRange, setIsOutsideDeliveryRange] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (visible && fulfillment === 'Delivery' && effectiveBranchId && destinationCoords) {
      setIsLoadingQuote(true);
      setQuoteError(null);
      setIsOutsideDeliveryRange(false);

      const timer = setTimeout(async () => {
        try {
          const quote = await DeliveryQuoteApi.getQuote({
            branchId: effectiveBranchId,
            destinationLatitude: destinationCoords.latitude,
            destinationLongitude: destinationCoords.longitude,
          });
          if (!isMounted) return;
          setDeliveryQuote(quote);
          setIsOutsideDeliveryRange(false);
          setQuoteError(null);
        } catch (err: any) {
          if (!isMounted) return;
          const isOutside =
            err?.code === 'OUTSIDE_DELIVERY_RANGE' ||
            (err?.message && err.message.includes('OUTSIDE_DELIVERY_RANGE'));
          if (isOutside) {
            setIsOutsideDeliveryRange(true);
            setQuoteError(
              err?.message ||
                'The delivery location is outside the maximum delivery radius for this branch.'
            );
          } else {
            setQuoteError(err?.message || 'Could not compute delivery quote.');
          }
          setDeliveryQuote(null);
        } finally {
          if (isMounted) setIsLoadingQuote(false);
        }
      }, 350);

      return () => {
        clearTimeout(timer);
      };
    } else {
      setDeliveryQuote(null);
      setIsOutsideDeliveryRange(false);
      setQuoteError(null);
      setIsLoadingQuote(false);
    }
    return () => {
      isMounted = false;
    };
  }, [visible, fulfillment, effectiveBranchId, destinationCoords]);

  return { deliveryQuote, isLoadingQuote, quoteError, isOutsideDeliveryRange };
}
