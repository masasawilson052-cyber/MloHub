const STORAGE_KEY = '@mlohub_database_v1';

// In-memory fallback cache for fast synchronous reads and native memory fallback
let memoryStorage: Record<string, string> = {};

export const StorageDriver = {
  async getItem(key: string = STORAGE_KEY): Promise<string | null> {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const item = window.localStorage.getItem(key);
        if (item) return item;
      }
      return memoryStorage[key] || null;
    } catch (e) {
      console.warn('StorageDriver getItem error:', e);
      return memoryStorage[key] || null;
    }
  },

  async setItem(key: string = STORAGE_KEY, value: string): Promise<void> {
    try {
      memoryStorage[key] = value;
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch (e) {
      console.warn('StorageDriver setItem error:', e);
    }
  },

  async removeItem(key: string = STORAGE_KEY): Promise<void> {
    try {
      delete memoryStorage[key];
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch (e) {
      console.warn('StorageDriver removeItem error:', e);
    }
  },

  async clear(): Promise<void> {
    memoryStorage = {};
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch (e) {
        // ignore
      }
    }
  },
};
