import {
  MenuItem,
  MenuModifierGroup,
  OrderItemModifierSelectionSnapshot,
} from '../../types/domain';
import { MenuRepository } from '../../repositories/menus.repository';

export type { OrderItemModifierSelectionSnapshot };

export type CartAddOutcome = 'ADDED' | 'REPLACED_CART' | 'CANCELLED';

export type CartInteractionOutcome = CartAddOutcome | 'FAILED';

export interface ModifierOptionSelection {
  group_id: string;
  group_name: string;
  option_id: string;
  option_name: string;
  price_delta_tzs: number;
}

export interface RpcModifierGroupSelection {
  group_id: string;
  option_ids: string[];
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
  rpcModifiersPayload?: RpcModifierGroupSelection[];
}

export type CartItemInput = Omit<CartItem, 'quantity'> & {
  quantity?: number;
};

export interface CartStateSnapshot {
  items: CartItem[];
  restaurantId: string | null;
  restaurantName: string | null;
  branchId: string | null;
  branchName: string | null;
}

export interface MeasuredRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CartFlightFrame {
  translateX: number;
  translateY: number;
  scale: number;
  opacity: number;
  rotateDeg: number;
}

export const CART_FLIGHT_DURATION_MS = 540;

/**
 * Generates a deterministic cart-line signature from dishId, modifiers
 * (supporting both selectedModifiers and rpcModifiersPayload), and special notes.
 */
export function createCartLineSignature(
  dishId: string,
  selectedModifiers?:
    | ModifierOptionSelection[]
    | RpcModifierGroupSelection[]
    | OrderItemModifierSelectionSnapshot[],
  notes?: string
): string {
  const modParts: string[] = [];
  if (selectedModifiers && Array.isArray(selectedModifiers)) {
    for (const m of selectedModifiers) {
      if ('option_ids' in m && Array.isArray(m.option_ids)) {
        modParts.push(`${m.group_id}:${[...m.option_ids].sort().join(',')}`);
      } else if ('option_id' in m && typeof m.option_id === 'string') {
        modParts.push(`${m.group_id}:${m.option_id}`);
      }
    }
  }
  const modStr = modParts.sort().join('|');
  const noteStr = (notes || '').trim().toLowerCase();
  return `${dishId}::${modStr}::${noteStr}`;
}

/**
 * Normalizes a CartItemInput into a canonical CartItem with a deterministic cartLineId,
 * positive integer quantity, and trimmed real imageUrl (or undefined if blank).
 */
export function normalizeCartItemInput(newItem: CartItemInput): CartItem {
  const rawQty = Number(newItem.quantity ?? 1);
  const qty =
    Number.isFinite(rawQty) && rawQty > 0 ? Math.max(1, Math.floor(rawQty)) : 1;

  const cleanedImageUrl =
    typeof newItem.imageUrl === 'string' && newItem.imageUrl.trim().length > 0
      ? newItem.imageUrl.trim()
      : undefined;

  const lineSignature =
    newItem.cartLineId ||
    createCartLineSignature(
      newItem.dishId,
      newItem.selectedModifiers && newItem.selectedModifiers.length > 0
        ? newItem.selectedModifiers
        : newItem.rpcModifiersPayload,
      newItem.notes
    );

  return {
    ...newItem,
    imageUrl: cleanedImageUrl,
    cartLineId: lineSignature,
    quantity: qty,
  };
}

/**
 * Merges a new CartItem or CartItemInput into an existing cart item list,
 * incrementing quantity if the cartLineId signature matches or appending a new line.
 */
export function mergeCartItemList(
  prev: CartItem[],
  newItemOrNormalized: CartItem | CartItemInput
): CartItem[] {
  const itemWithLineId = normalizeCartItemInput(newItemOrNormalized);
  const lineSignature = itemWithLineId.cartLineId!;

  const existingIndex = prev.findIndex((i) => {
    const itemLineId =
      i.cartLineId ||
      createCartLineSignature(
        i.dishId,
        i.selectedModifiers && i.selectedModifiers.length > 0
          ? i.selectedModifiers
          : i.rpcModifiersPayload,
        i.notes
      );
    return itemLineId === lineSignature;
  });

  if (existingIndex > -1) {
    const updated = [...prev];
    updated[existingIndex] = {
      ...updated[existingIndex],
      quantity: updated[existingIndex].quantity + itemWithLineId.quantity,
    };
    return updated;
  }

  return [...prev, itemWithLineId];
}

/**
 * Pure state machine for adding an item to the cart with cross-restaurant and cross-branch protection.
 */
export async function processCartAddRequest(
  currentState: CartStateSnapshot,
  newItem: CartItemInput,
  confirmReplacement: (title: string, message: string) => Promise<boolean>
): Promise<{ state: CartStateSnapshot; outcome: CartAddOutcome }> {
  const itemWithLineId = normalizeCartItemInput(newItem);
  const currentRestId =
    currentState.restaurantId ||
    (currentState.items.length > 0 ? currentState.items[0].restaurantId : null);
  const currentRestName =
    currentState.restaurantName ||
    (currentState.items.length > 0
      ? currentState.items[0].restaurantName
      : null);
  const currentBranch =
    currentState.branchId ||
    (currentState.items.length > 0
      ? currentState.items[0].branchId || null
      : null);

  const isDifferentRestaurant = Boolean(
    currentRestId && currentRestId !== newItem.restaurantId
  );
  const isDifferentBranch = Boolean(
    currentBranch && newItem.branchId && currentBranch !== newItem.branchId
  );

  if (
    currentState.items.length > 0 &&
    (isDifferentRestaurant || isDifferentBranch)
  ) {
    const message = isDifferentRestaurant
      ? `Your cart contains dishes from ${currentRestName || 'another restaurant'}. Do you want to clear your cart and start an order with ${newItem.restaurantName}?`
      : `Your cart contains dishes from a different branch of ${currentRestName || 'this restaurant'}. Do you want to start a new order from this branch?`;

    const confirmed = await confirmReplacement('Start new order?', message);
    if (!confirmed) {
      return {
        state: currentState,
        outcome: 'CANCELLED',
      };
    }

    return {
      state: {
        items: [itemWithLineId],
        restaurantId: newItem.restaurantId,
        restaurantName: newItem.restaurantName,
        branchId: newItem.branchId || null,
        branchName: newItem.branchName || null,
      },
      outcome: 'REPLACED_CART',
    };
  }

  const nextItems = mergeCartItemList(currentState.items, itemWithLineId);
  return {
    state: {
      items: nextItems,
      restaurantId: newItem.restaurantId,
      restaurantName: newItem.restaurantName,
      branchId: newItem.branchId || currentBranch || null,
      branchName: newItem.branchName || currentState.branchName || null,
    },
    outcome: 'ADDED',
  };
}

/**
 * Validates whether all required modifier groups and min/max constraints are satisfied.
 */
export function validateModifierSelections(
  modifierGroups: MenuModifierGroup[],
  selectedOptionIds: Record<string, string[]>
): boolean {
  for (const grp of modifierGroups) {
    const availableOptionIds = new Set(
      (grp.options || [])
        .filter((o) => o.isAvailable !== false)
        .map((o) => o.id)
    );
    const rawSelected = selectedOptionIds[grp.id] || [];
    const validSelectedCount = rawSelected.filter((id) =>
      availableOptionIds.has(id)
    ).length;

    // Also reject if any selected ID is not a valid available option in this group
    if (validSelectedCount !== rawSelected.length) {
      return false;
    }

    const minRequired = grp.isRequired
      ? Math.max(1, grp.minSelections || 1)
      : grp.minSelections || 0;

    if (validSelectedCount < minRequired) {
      return false;
    }
    if (grp.maxSelections > 0 && validSelectedCount > grp.maxSelections) {
      return false;
    }
  }
  return true;
}

/**
 * Reconciles historical order modifier snapshots against current live modifier groups.
 * Only retains options that exist in the current group and are currently available.
 * If a historical required option was removed or made unavailable, that group is left
 * unselected ([]) so the customer must explicitly choose a valid current option.
 */
export function reconcileHistoricalModifierSelections(
  currentGroups: MenuModifierGroup[],
  historicalSelections?:
    | OrderItemModifierSelectionSnapshot[]
    | ModifierOptionSelection[]
): Record<string, string[]> {
  const historicalByGroup: Record<string, string[]> = {};

  if (Array.isArray(historicalSelections)) {
    for (const entry of historicalSelections) {
      if (!entry || typeof entry.group_id !== 'string') continue;
      if (!historicalByGroup[entry.group_id]) {
        historicalByGroup[entry.group_id] = [];
      }
      if ('option_ids' in entry && Array.isArray(entry.option_ids)) {
        for (const optId of entry.option_ids) {
          if (
            typeof optId === 'string' &&
            !historicalByGroup[entry.group_id].includes(optId)
          ) {
            historicalByGroup[entry.group_id].push(optId);
          }
        }
      } else if ('option_id' in entry && typeof entry.option_id === 'string') {
        if (!historicalByGroup[entry.group_id].includes(entry.option_id)) {
          historicalByGroup[entry.group_id].push(entry.option_id);
        }
      }
    }
  }

  const reconciled: Record<string, string[]> = {};
  for (const grp of currentGroups) {
    const availableSet = new Set(
      (grp.options || [])
        .filter((opt) => opt.isAvailable !== false)
        .map((opt) => opt.id)
    );
    const requestedIds = historicalByGroup[grp.id] || [];
    const validIds = requestedIds.filter((id) => availableSet.has(id));
    const maxAllowed = grp.maxSelections > 0 ? grp.maxSelections : validIds.length;
    reconciled[grp.id] = validIds.slice(0, maxAllowed);
  }

  return reconciled;
}

/**
 * Builds initial modifier selections for MenuItemCustomizationModal.
 * - When `initialSelectedOptionIds` is provided (e.g. from reorder), sanitizes it against
 *   current available options and does NOT auto-select fallback options for missing required groups.
 * - When `initialSelectedOptionIds` is undefined (fresh open), preselects the first available option
 *   for required single-select (1-of-1) groups.
 */
export function buildDefaultModifierSelections(
  groups: MenuModifierGroup[],
  initialSelectedOptionIds?: Record<string, string[]>
): Record<string, string[]> {
  if (initialSelectedOptionIds) {
    const sanitized: Record<string, string[]> = {};
    for (const g of groups) {
      const availableSet = new Set(
        (g.options || [])
          .filter((opt) => opt.isAvailable !== false)
          .map((opt) => opt.id)
      );
      const candidateIds = initialSelectedOptionIds[g.id] || [];
      const validIds = candidateIds.filter((id) => availableSet.has(id));
      const maxAllowed = g.maxSelections > 0 ? g.maxSelections : validIds.length;
      sanitized[g.id] = validIds.slice(0, maxAllowed);
    }
    return sanitized;
  }

  const initialSelections: Record<string, string[]> = {};
  for (const g of groups) {
    const availableOptions = (g.options || []).filter(
      (opt) => opt.isAvailable !== false
    );
    if (
      g.isRequired &&
      g.minSelections === 1 &&
      g.maxSelections === 1 &&
      availableOptions.length > 0
    ) {
      initialSelections[g.id] = [availableOptions[0].id];
    } else {
      initialSelections[g.id] = [];
    }
  }
  return initialSelections;
}

/**
 * Computes authoritative current customization pricing from current base price and current modifier groups.
 */
export function computeCustomizationPricing(
  basePriceTzs: number,
  modifierGroups: MenuModifierGroup[],
  selectedOptionIds: Record<string, string[]>,
  quantity: number
): {
  selectedList: ModifierOptionSelection[];
  rpcPayload: RpcModifierGroupSelection[];
  modifiersDelta: number;
  unitPrice: number;
  totalPrice: number;
} {
  const list: ModifierOptionSelection[] = [];
  const payload: RpcModifierGroupSelection[] = [];
  let delta = 0;

  for (const grp of modifierGroups) {
    const chosenIds = selectedOptionIds[grp.id] || [];
    const validOptionIds: string[] = [];

    for (const optId of chosenIds) {
      const opt = (grp.options || []).find(
        (o) => o.id === optId && o.isAvailable !== false
      );
      if (opt) {
        validOptionIds.push(opt.id);
        list.push({
          group_id: grp.id,
          group_name: grp.name,
          option_id: opt.id,
          option_name: opt.name,
          price_delta_tzs: opt.priceDeltaTzs,
        });
        delta += opt.priceDeltaTzs;
      }
    }

    if (validOptionIds.length > 0) {
      payload.push({
        group_id: grp.id,
        option_ids: validOptionIds,
      });
    }
  }

  const safeQty = Math.max(1, Math.floor(Number(quantity) || 1));
  const unitPrice = basePriceTzs + delta;
  const totalPrice = unitPrice * safeQty;

  return {
    selectedList: list,
    rpcPayload: payload,
    modifiersDelta: delta,
    unitPrice,
    totalPrice,
  };
}

// ============================================================================
// FAIL-CLOSED SESSION MODIFIER CACHE
// ============================================================================

const modifierGroupsSessionCache = new Map<string, MenuModifierGroup[]>();
const modifierGroupsInFlight = new Map<string, Promise<MenuModifierGroup[]>>();

/**
 * Session-cached lookup for dish modifier groups.
 * FAIL-CLOSED:
 * - Never converts a repository/network error into `[]`.
 * - Never caches a failed lookup, so subsequent taps retry the query.
 * - Only caches genuine successful responses (`[]` or `MenuModifierGroup[]`).
 */
export async function getCachedModifiersForDish(
  dishId: string,
  fetcher: (id: string) => Promise<MenuModifierGroup[]> = (id) =>
    MenuRepository.getModifiersForItem(id)
): Promise<MenuModifierGroup[]> {
  const normalizedId = String(dishId || '').trim();
  if (!normalizedId) {
    return [];
  }

  if (modifierGroupsSessionCache.has(normalizedId)) {
    return modifierGroupsSessionCache.get(normalizedId)!;
  }

  if (modifierGroupsInFlight.has(normalizedId)) {
    return modifierGroupsInFlight.get(normalizedId)!;
  }

  const requestPromise = (async () => {
    try {
      const groups = await fetcher(normalizedId);
      const safeGroups = Array.isArray(groups) ? groups : [];
      modifierGroupsSessionCache.set(normalizedId, safeGroups);
      return safeGroups;
    } finally {
      modifierGroupsInFlight.delete(normalizedId);
    }
  })();

  modifierGroupsInFlight.set(normalizedId, requestPromise);
  return requestPromise;
}

export function primeModifierLookupCache(
  dishId: string,
  groups: MenuModifierGroup[]
): void {
  modifierGroupsSessionCache.set(String(dishId || '').trim(), groups);
}

export function clearModifierLookupCache(): void {
  modifierGroupsSessionCache.clear();
  modifierGroupsInFlight.clear();
}

export type AddToCartCoordinatorRoute =
  | 'OPEN_CUSTOMIZATION_MODAL'
  | 'DIRECT_ADD';

export function resolveAddToCartDecision(
  itemOrModifierGroups: MenuModifierGroup[] | unknown,
  maybeModifierGroups?: MenuModifierGroup[]
): AddToCartCoordinatorRoute {
  const modifierGroups = Array.isArray(itemOrModifierGroups)
    ? itemOrModifierGroups
    : maybeModifierGroups;
  if (Array.isArray(modifierGroups) && modifierGroups.length > 0) {
    return 'OPEN_CUSTOMIZATION_MODAL';
  }
  return 'DIRECT_ADD';
}

export function buildInFlightAddKey(item: {
  restaurantId: string;
  branchId?: string;
  dishId: string;
}): string {
  return `${item.restaurantId}:${item.branchId ?? ''}:${item.dishId}`;
}

/**
 * Creates an in-flight deduplicator keyed by restaurantId:branchId:dishId.
 * Rapid simultaneous taps for the same dish share one in-flight Promise,
 * while different dishes proceed independently and completed dishes can be added again.
 */
export function createInFlightAddDeduplicator<T = CartInteractionOutcome>() {
  const inFlightMap = new Map<string, Promise<T>>();

  return {
    run(key: string, taskFactory: () => Promise<T>): Promise<T> {
      const existing = inFlightMap.get(key);
      if (existing) {
        return existing;
      }

      const task = Promise.resolve()
        .then(() => taskFactory())
        .finally(() => {
          inFlightMap.delete(key);
        });

      inFlightMap.set(key, task);
      return task;
    },
    isPending(key: string): boolean {
      return inFlightMap.has(key);
    },
    size(): number {
      return inFlightMap.size;
    },
  };
}

/**
 * Reorder preparation helper that validates the current menu item and current modifiers
 * from authoritative repositories before adding or opening customization.
 */
export type ReorderItemPreparationResult =
  | {
      status: 'UNAVAILABLE';
      reason: string;
    }
  | {
      status: 'LOOKUP_FAILED';
      reason: string;
    }
  | {
      status: 'READY';
      currentItem: MenuItem;
      modifierGroups: MenuModifierGroup[];
      route: AddToCartCoordinatorRoute;
      initialSelectedOptionIds: Record<string, string[]>;
      requiresUserCustomization: boolean;
    };

export async function prepareReorderItemWithCurrentMenu(params: {
  menuItemId?: string;
  historicalModifiers?:
    | OrderItemModifierSelectionSnapshot[]
    | ModifierOptionSelection[];
  fetchMenuItem?: (id: string) => Promise<MenuItem | null>;
  fetchModifiers?: (id: string) => Promise<MenuModifierGroup[]>;
}): Promise<ReorderItemPreparationResult> {
  const menuItemId = String(params.menuItemId || '').trim();
  if (!menuItemId) {
    return {
      status: 'UNAVAILABLE',
      reason: 'One item from this order is no longer available.',
    };
  }

  const getMenuItem =
    params.fetchMenuItem || ((id: string) => MenuRepository.getItemById(id));
  const getModifiers =
    params.fetchModifiers ||
    ((id: string) => getCachedModifiersForDish(id));

  let currentItem: MenuItem | null = null;
  try {
    currentItem = await getMenuItem(menuItemId);
  } catch {
    return {
      status: 'LOOKUP_FAILED',
      reason: 'Unable to verify current menu item details. Please try again.',
    };
  }

  if (
    !currentItem ||
    currentItem.isAvailable === false ||
    currentItem.isArchived === true
  ) {
    return {
      status: 'UNAVAILABLE',
      reason: 'One item from this order is no longer available.',
    };
  }

  let modifierGroups: MenuModifierGroup[] = [];
  try {
    modifierGroups = await getModifiers(menuItemId);
  } catch (lookupErr: any) {
    console.warn(
      '[cartCore.prepareReorderItemWithCurrentMenu] Modifiers lookup unavailable; proceeding with direct add fallback:',
      lookupErr
    );
    modifierGroups = [];
  }

  const route = resolveAddToCartDecision(modifierGroups);
  const initialSelectedOptionIds =
    route === 'OPEN_CUSTOMIZATION_MODAL'
      ? reconcileHistoricalModifierSelections(
          modifierGroups,
          params.historicalModifiers
        )
      : {};

  return {
    status: 'READY',
    currentItem,
    modifierGroups,
    route,
    initialSelectedOptionIds,
    requiresUserCustomization: route === 'OPEN_CUSTOMIZATION_MODAL',
  };
}

// ============================================================================
// FLIGHT MOTION & TRAJECTORY PREDICATES
// ============================================================================

export function isValidMeasuredRect(
  rect: MeasuredRect | null | undefined
): rect is MeasuredRect {
  if (!rect) return false;
  return (
    Number.isFinite(rect.x) &&
    Number.isFinite(rect.y) &&
    Number.isFinite(rect.width) &&
    Number.isFinite(rect.height) &&
    rect.width > 0 &&
    rect.height > 0
  );
}

export function shouldAnimateFoodToCart(params: {
  outcome: CartInteractionOutcome;
  imageUrl?: string | null;
  sourceRect?: MeasuredRect | null;
  targetRect?: MeasuredRect | null;
  reduceMotionEnabled?: boolean;
}): boolean {
  if (params.outcome !== 'ADDED' && params.outcome !== 'REPLACED_CART') {
    return false;
  }
  if (params.reduceMotionEnabled) {
    return false;
  }
  const trimmedUrl =
    typeof params.imageUrl === 'string' ? params.imageUrl.trim() : '';
  if (!trimmedUrl) {
    return false;
  }
  return (
    isValidMeasuredRect(params.sourceRect) &&
    isValidMeasuredRect(params.targetRect)
  );
}

/**
 * Pure trajectory calculator for curved food-to-cart motion.
 * Interpolates from the center of sourceRect to the center of targetRect
 * along a parabolic arc with scale down (1.0 -> 0.24), opacity fade near arrival,
 * and subtle rotation (max ±4 deg).
 */
export function computeCartFlightFrame(
  progress: number,
  sourceRect: MeasuredRect,
  targetRect: MeasuredRect
): CartFlightFrame {
  'worklet';
  const clamped = Math.max(0, Math.min(1, progress));

  const startCenterX = sourceRect.x + sourceRect.width / 2;
  const startCenterY = sourceRect.y + sourceRect.height / 2;
  const endCenterX = targetRect.x + targetRect.width / 2;
  const endCenterY = targetRect.y + targetRect.height / 2;

  const deltaX = endCenterX - startCenterX;
  const deltaY = endCenterY - startCenterY;

  const horizontalDistance = Math.abs(deltaX);
  const verticalDistance = Math.abs(deltaY);
  const arcLift = Math.min(
    130,
    Math.max(48, (horizontalDistance + verticalDistance) * 0.18)
  );

  const currentCenterX = startCenterX + deltaX * clamped;
  const currentCenterY =
    startCenterY + deltaY * clamped - Math.sin(clamped * Math.PI) * arcLift;

  const translateX = currentCenterX - sourceRect.width / 2;
  const translateY = currentCenterY - sourceRect.height / 2;

  const scale = 1 - clamped * 0.76; // 1.0 -> 0.24

  let opacity = 1;
  if (clamped >= 1) {
    opacity = 0;
  } else if (clamped < 0.78) {
    opacity = 1 - (clamped / 0.78) * 0.1; // 1.0 -> 0.9
  } else {
    opacity = Math.max(0, 0.9 * (1 - (clamped - 0.78) / 0.22)); // 0.9 -> 0.0
  }

  const directionSign = deltaX >= 0 ? 1 : -1;
  const rotateDeg = Math.sin(clamped * Math.PI) * 4 * directionSign; // max ±4 deg

  return {
    translateX,
    translateY,
    scale,
    opacity,
    rotateDeg,
  };
}
