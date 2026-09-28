import {
  CartInteractionContextType,
  CartInteractionItemInput,
  CartInteractionOutcome,
  CartMotionSource,
  useCartInteractionContext,
} from '@/context/CartInteractionContext';

export type {
  CartInteractionContextType,
  CartInteractionItemInput,
  CartInteractionOutcome,
  CartMotionSource,
};

export const useCartInteraction = (): CartInteractionContextType => {
  return useCartInteractionContext();
};
