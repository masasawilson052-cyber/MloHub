import { CartItem } from '../services/cart/cartCore';

export const CART_STORAGE_KEY = '@mlohub_persisted_cart_v1';
export const FULFILLMENT_PREFERENCE_KEY = '@mlohub_last_fulfillment_choice';
export const CART_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface PersistedCartLineItem {
  dishId: string;
  dishName: string;
  dishNameSwahili?: string;
  priceTzs: number;
  quantity: number;
  selectedModifiers?: any;
  rpcModifiersPayload?: any;
  notes?: string;
  imageUrl?: string;
  cartLineId?: string;
}

export interface PersistedCartPayload {
  version: 1;
  savedAt: number;
  restaurantId: string;
  restaurantName: string;
  branchId?: string | null;
  branchName?: string | null;
  items: PersistedCartLineItem[];
}

const memoryStore = new Map<string, string>();

function getStorage(): {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, val: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
} {
  if (typeof window !== 'undefined' && window.localStorage) {
    return {
      getItem: async (key: string) => window.localStorage.getItem(key),
      setItem: async (key: string, val: string) => window.localStorage.setItem(key, val),
      removeItem: async (key: string) => window.localStorage.removeItem(key),
    };
  }
  try {
    const asyncStorage = require('@react-native-async-storage/async-storage');
    const storage = asyncStorage.default || asyncStorage;
    if (storage && typeof storage.getItem === 'function') {
      return storage;
    }
  } catch {}

  return {
    getItem: async (key: string) => memoryStore.get(key) || null,
    setItem: async (key: string, val: string) => {
      memoryStore.set(key, val);
    },
    removeItem: async (key: string) => {
      memoryStore.delete(key);
    },
  };
}

/**
 * Strips any user, session, or extraneous metadata; keeps only item essentials
 */
export function sanitizeItemsForStorage(items: CartItem[]): PersistedCartLineItem[] {
  return items.map((i) => ({
    dishId: i.dishId,
    dishName: i.dishName,
    dishNameSwahili: i.dishNameSwahili,
    priceTzs: i.priceTzs,
    quantity: i.quantity,
    selectedModifiers: i.selectedModifiers,
    rpcModifiersPayload: i.rpcModifiersPayload,
    notes: i.notes,
    imageUrl: i.imageUrl,
    cartLineId: i.cartLineId,
  }));
}

export async function saveCartToStorage(
  restaurantId: string,
  restaurantName: string,
  branchId: string | null | undefined,
  branchName: string | null | undefined,
  items: CartItem[]
): Promise<void> {
  if (!restaurantId || items.length === 0) {
    await clearCartStorage();
    return;
  }

  const payload: PersistedCartPayload = {
    version: 1,
    savedAt: Date.now(),
    restaurantId,
    restaurantName,
    branchId: branchId || null,
    branchName: branchName || null,
    items: sanitizeItemsForStorage(items),
  };

  const serialized = JSON.stringify(payload);

  try {
    const storage = getStorage();
    await storage.setItem(CART_STORAGE_KEY, serialized);
  } catch (err) {
    console.warn('[cartStorage] Failed to save cart:', err);
  }
}

export async function loadCartFromStorage(): Promise<PersistedCartPayload | null> {
  try {
    const storage = getStorage();
    const raw = await storage.getItem(CART_STORAGE_KEY);
    if (!raw) return null;

    const parsed: PersistedCartPayload = JSON.parse(raw);
    if (!parsed || !parsed.savedAt || !parsed.restaurantId || !Array.isArray(parsed.items)) {
      await clearCartStorage();
      return null;
    }

    // 24-hour expiry check
    const age = Date.now() - parsed.savedAt;
    if (age > CART_EXPIRY_MS) {
      await clearCartStorage();
      return null;
    }

    return parsed;
  } catch (err) {
    console.warn('[cartStorage] Failed to load cart from storage:', err);
    await clearCartStorage();
    return null;
  }
}

export async function clearCartStorage(): Promise<void> {
  try {
    const storage = getStorage();
    await storage.removeItem(CART_STORAGE_KEY);
  } catch (err) {
    console.warn('[cartStorage] Failed to clear cart:', err);
  }
}

export async function saveLastFulfillmentPreference(
  choice: 'Delivery' | 'Takeaway' | 'Dine-In'
): Promise<void> {
  try {
    const storage = getStorage();
    await storage.setItem(FULFILLMENT_PREFERENCE_KEY, choice);
  } catch {}
}

export async function loadLastFulfillmentPreference(): Promise<'Delivery' | 'Takeaway' | 'Dine-In' | null> {
  try {
    const storage = getStorage();
    const raw = await storage.getItem(FULFILLMENT_PREFERENCE_KEY);
    if (raw === 'Delivery' || raw === 'Takeaway' || raw === 'Dine-In') {
      return raw;
    }
    return null;
  } catch {
    return null;
  }
}
