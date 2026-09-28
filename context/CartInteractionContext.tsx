import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AccessibilityInfo,
  Alert,
  InteractionManager,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  CartAddOutcome,
  CartItemInput,
  useCart,
} from '@/context/CartContext';
import { MenuRepository } from '@/repositories/menus.repository';
import { MenuModifierGroup } from '@/types/domain';
import {
  CustomizationConfirmMotionContext,
  CustomizableMenuItem,
  MeasuredRect,
  MenuItemCustomizationModal,
  measureViewRect,
} from '@/components/menu/MenuItemCustomizationModal';
import {
  ActiveCartFlight,
  CartMotionOverlay,
} from '@/components/cart/CartMotionOverlay';
import {
  AddToCartCoordinatorRoute,
  CartInteractionOutcome,
  buildInFlightAddKey,
  clearModifierLookupCache,
  createInFlightAddDeduplicator,
  getCachedModifiersForDish,
  isValidMeasuredRect,
  primeModifierLookupCache,
  resolveAddToCartDecision,
  shouldAnimateFoodToCart,
} from '@/services/cart/cartCore';

export type { AddToCartCoordinatorRoute, CartInteractionOutcome };
export {
  buildInFlightAddKey,
  clearModifierLookupCache,
  createInFlightAddDeduplicator,
  getCachedModifiersForDish,
  isValidMeasuredRect,
  primeModifierLookupCache,
  resolveAddToCartDecision,
  shouldAnimateFoodToCart,
};

export interface CartMotionSource {
  sourceRef?: React.RefObject<View | null>;
  sourceRect?: MeasuredRect | null;
  fallbackImageUrl?: string;
}

export type CartInteractionItemInput = CartItemInput & {
  description?: string;
  descriptionSw?: string;
  initialSelectedOptionIds?: Record<string, string[]>;
  prefetchedModifierGroups?: MenuModifierGroup[];
};

export interface CartInteractionContextType {
  requestAddToCart: (
    item: CartInteractionItemInput,
    motionSource?: CartMotionSource
  ) => Promise<CartInteractionOutcome>;
  registerCartTarget: (ref: React.RefObject<View | null>) => () => void;
  pulseVersion: number;
  triggerCartPulse: () => void;
  isCustomizationModalOpen: boolean;
  pendingDishIds: ReadonlySet<string>;
  isDishAddPending: (dishId: string) => boolean;
}

export async function triggerLightCartHaptic(): Promise<void> {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Never throw on web or unsupported devices
  }
}

function waitForCustomizerExit(): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };

    const fallbackTimer = setTimeout(finish, 90);

    try {
      InteractionManager.runAfterInteractions(() => {
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              clearTimeout(fallbackTimer);
              finish();
            });
          });
        } else {
          clearTimeout(fallbackTimer);
          finish();
        }
      });
    } catch {
      clearTimeout(fallbackTimer);
      finish();
    }
  });
}

const CartInteractionContext = createContext<CartInteractionContextType | undefined>(
  undefined
);

interface PendingCustomizationState {
  menuItem: CustomizableMenuItem;
  modifierGroups: MenuModifierGroup[];
  initialSelectedOptionIds?: Record<string, string[]>;
  initialQuantity: number;
  resolveOutcome: (outcome: CartInteractionOutcome) => void;
}

export const CartInteractionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { addToCart } = useCart();
  const [pulseVersion, setPulseVersion] = useState(0);
  const [activeFlight, setActiveFlight] = useState<ActiveCartFlight | null>(null);
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);
  const [pendingCustomization, setPendingCustomization] =
    useState<PendingCustomizationState | null>(null);
  const [pendingDishIds, setPendingDishIds] = useState<ReadonlySet<string>>(
    () => new Set()
  );

  const cartTargetRefs = useRef<Array<React.RefObject<View | null>>>([]);
  const customizationHandledRef = useRef(false);
  const addRequestsInFlightRef = useRef<Map<string, Promise<CartInteractionOutcome>>>(
    new Map()
  );

  const setDishPending = useCallback((dishId: string, isPending: boolean) => {
    const normalized = String(dishId || '').trim();
    if (!normalized) return;
    setPendingDishIds((prev) => {
      const has = prev.has(normalized);
      if (isPending && has) return prev;
      if (!isPending && !has) return prev;
      const next = new Set(prev);
      if (isPending) {
        next.add(normalized);
      } else {
        next.delete(normalized);
      }
      return next;
    });
  }, []);

  const isDishAddPending = useCallback(
    (dishId: string) => pendingDishIds.has(String(dishId || '').trim()),
    [pendingDishIds]
  );

  useEffect(() => {
    let isMounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (isMounted) setReduceMotionEnabled(Boolean(enabled));
      })
      .catch(() => {});

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => {
        setReduceMotionEnabled(Boolean(enabled));
      }
    );

    return () => {
      isMounted = false;
      subscription?.remove();
    };
  }, []);

  const registerCartTarget = useCallback(
    (ref: React.RefObject<View | null>) => {
      cartTargetRefs.current = [
        ...cartTargetRefs.current.filter((existing) => existing !== ref),
        ref,
      ];
      return () => {
        cartTargetRefs.current = cartTargetRefs.current.filter(
          (existing) => existing !== ref
        );
      };
    },
    []
  );

  const measureActiveCartTarget = useCallback(async (): Promise<MeasuredRect | null> => {
    for (let i = cartTargetRefs.current.length - 1; i >= 0; i -= 1) {
      const candidateRef = cartTargetRefs.current[i];
      const rect = await measureViewRect(candidateRef);
      if (isValidMeasuredRect(rect)) {
        return rect;
      }
    }
    return null;
  }, []);

  const triggerCartPulse = useCallback(() => {
    setPulseVersion((prev) => prev + 1);
  }, []);

  const executeConfirmedFeedbackAndMotion = useCallback(
    async (params: {
      outcome: CartInteractionOutcome;
      imageUrl?: string;
      quantity: number;
      sourceRect: MeasuredRect | null;
    }) => {
      const { outcome, imageUrl, quantity, sourceRect } = params;
      if (outcome === 'CANCELLED' || outcome === 'FAILED') {
        return;
      }

      const targetRect = await measureActiveCartTarget();
      const canFly = shouldAnimateFoodToCart({
        outcome,
        imageUrl,
        sourceRect,
        targetRect,
        reduceMotionEnabled,
      });

      if (canFly && imageUrl && sourceRect && targetRect) {
        const flightId = `flight-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        setActiveFlight({
          id: flightId,
          imageUrl: imageUrl.trim(),
          quantity: Math.max(1, quantity),
          sourceRect,
          targetRect,
        });
      } else {
        triggerCartPulse();
        await triggerLightCartHaptic();
      }
    },
    [measureActiveCartTarget, reduceMotionEnabled, triggerCartPulse]
  );

  const handleFlightComplete = useCallback(
    (flightId: string) => {
      setActiveFlight((current) => {
        if (!current || current.id !== flightId) return current;
        return null;
      });
      triggerCartPulse();
      void triggerLightCartHaptic();
    },
    [triggerCartPulse]
  );

  const requestAddToCart = useCallback(
    async (
      item: CartInteractionItemInput,
      motionSource?: CartMotionSource
    ): Promise<CartInteractionOutcome> => {
      const inFlightKey = buildInFlightAddKey(item);
      const existingInFlight = addRequestsInFlightRef.current.get(inFlightKey);
      if (existingInFlight) {
        return existingInFlight;
      }

      const executionPromise = (async (): Promise<CartInteractionOutcome> => {
        setDishPending(item.dishId, true);
        try {
          const realImageUrl =
            typeof item.imageUrl === 'string' && item.imageUrl.trim().length > 0
              ? item.imageUrl.trim()
              : undefined;

          const normalizedQuantity = Math.max(
            1,
            Math.floor(Number(item.quantity ?? 1) || 1)
          );

          // Measure source rect early while source element is mounted and visible
          const preMeasuredSourceRect = realImageUrl
            ? motionSource?.sourceRect ?? (await measureViewRect(motionSource?.sourceRef))
            : null;

          let modifierGroups: MenuModifierGroup[];
          try {
            if (Array.isArray(item.prefetchedModifierGroups)) {
              modifierGroups = item.prefetchedModifierGroups;
              primeModifierLookupCache(item.dishId, modifierGroups);
            } else {
              modifierGroups = await getCachedModifiersForDish(item.dishId, (id) =>
                MenuRepository.getModifiersForItem(id)
              );
            }
          } catch {
            Alert.alert(
              'Unable to load meal options',
              'We could not verify this meal’s available options. Please try again.'
            );
            return 'FAILED';
          }

          const route = resolveAddToCartDecision(item, modifierGroups);

          if (route === 'OPEN_CUSTOMIZATION_MODAL') {
            setDishPending(item.dishId, false);
            return await new Promise<CartInteractionOutcome>((resolve) => {
              customizationHandledRef.current = false;
              setPendingCustomization({
                menuItem: {
                  id: item.dishId,
                  name: item.dishName,
                  nameSw: item.dishNameSwahili,
                  description: item.description,
                  price: item.basePriceTzs ?? item.priceTzs,
                  imageUrl: realImageUrl,
                  restaurantId: item.restaurantId,
                  restaurantName: item.restaurantName,
                  branchId: item.branchId,
                  branchName: item.branchName,
                  notes: item.notes,
                },
                modifierGroups,
                initialSelectedOptionIds: item.initialSelectedOptionIds,
                initialQuantity: normalizedQuantity,
                resolveOutcome: resolve,
              });
            });
          }

          const outcome = await addToCart({
            ...item,
            imageUrl: realImageUrl,
            quantity: normalizedQuantity,
          });

          await executeConfirmedFeedbackAndMotion({
            outcome,
            imageUrl: realImageUrl,
            quantity: normalizedQuantity,
            sourceRect: preMeasuredSourceRect,
          });

          return outcome;
        } finally {
          setDishPending(item.dishId, false);
          addRequestsInFlightRef.current.delete(inFlightKey);
        }
      })();

      addRequestsInFlightRef.current.set(inFlightKey, executionPromise);
      return executionPromise;
    },
    [addToCart, executeConfirmedFeedbackAndMotion, setDishPending]
  );

  const handleCustomizationClose = useCallback(() => {
    setPendingCustomization((current) => {
      if (current && !customizationHandledRef.current) {
        current.resolveOutcome('CANCELLED');
      }
      return null;
    });
  }, []);

  const handleCustomizationAddToCart = useCallback(
    async (
      customizedItem: CartItemInput & { quantity: number },
      motionContext?: CustomizationConfirmMotionContext
    ): Promise<CartAddOutcome> => {
      customizationHandledRef.current = true;
      const resolver = pendingCustomization?.resolveOutcome;
      setPendingCustomization(null);

      await waitForCustomizerExit();

      const realImageUrl =
        typeof customizedItem.imageUrl === 'string' &&
        customizedItem.imageUrl.trim().length > 0
          ? customizedItem.imageUrl.trim()
          : undefined;

      const outcome = await addToCart({
        ...customizedItem,
        imageUrl: realImageUrl,
      });

      await executeConfirmedFeedbackAndMotion({
        outcome,
        imageUrl: realImageUrl,
        quantity: customizedItem.quantity,
        sourceRect: motionContext?.sourceRect ?? null,
      });

      resolver?.(outcome);
      return outcome;
    },
    [addToCart, executeConfirmedFeedbackAndMotion, pendingCustomization]
  );

  const contextValue = useMemo<CartInteractionContextType>(
    () => ({
      requestAddToCart,
      registerCartTarget,
      pulseVersion,
      triggerCartPulse,
      isCustomizationModalOpen: Boolean(pendingCustomization),
      pendingDishIds,
      isDishAddPending,
    }),
    [
      requestAddToCart,
      registerCartTarget,
      pulseVersion,
      triggerCartPulse,
      pendingCustomization,
      pendingDishIds,
      isDishAddPending,
    ]
  );

  return (
    <CartInteractionContext.Provider value={contextValue}>
      {children}
      <MenuItemCustomizationModal
        visible={Boolean(pendingCustomization)}
        onClose={handleCustomizationClose}
        menuItem={pendingCustomization?.menuItem ?? null}
        initialModifierGroups={pendingCustomization?.modifierGroups}
        initialSelectedOptionIds={pendingCustomization?.initialSelectedOptionIds}
        initialQuantity={pendingCustomization?.initialQuantity ?? 1}
        onAddToCart={handleCustomizationAddToCart}
      />
      <CartMotionOverlay
        flight={activeFlight}
        onFlightComplete={handleFlightComplete}
      />
    </CartInteractionContext.Provider>
  );
};

export const useCartInteractionContext = (): CartInteractionContextType => {
  const context = useContext(CartInteractionContext);
  if (!context) {
    throw new Error(
      'useCartInteraction must be used within a CartInteractionProvider'
    );
  }
  return context;
};
