/**
 * Native Secure Auth Storage Adapter
 *
 * Implements hardware-backed keychain/keystore session storage for iOS and Android
 * using expo-secure-store. Handles large session payloads safely via chunking
 * to prevent Android KeyStore size limits (2048-byte cap).
 */

import * as SecureStore from 'expo-secure-store';

const CHUNK_SIZE = 1800;
const memoryFallback = new Map<string, string>();

export const authStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      // Check if chunked
      const chunkCountStr = await SecureStore.getItemAsync(`${key}__chunks`);
      if (chunkCountStr) {
        const count = parseInt(chunkCountStr, 10);
        if (Number.isFinite(count) && count > 0) {
          const parts: string[] = [];
          for (let i = 0; i < count; i++) {
            const part = await SecureStore.getItemAsync(`${key}__chunk_${i}`);
            if (part === null) return null;
            parts.push(part);
          }
          return parts.join('');
        }
      }

      // Single item read
      return await SecureStore.getItemAsync(key);
    } catch {
      return memoryFallback.get(key) || null;
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (value.length <= CHUNK_SIZE) {
        // Fits in a single key: clean up any old chunks if they existed
        const oldChunkCount = await SecureStore.getItemAsync(`${key}__chunks`);
        if (oldChunkCount) {
          const count = parseInt(oldChunkCount, 10);
          for (let i = 0; i < count; i++) {
            await SecureStore.deleteItemAsync(`${key}__chunk_${i}`);
          }
          await SecureStore.deleteItemAsync(`${key}__chunks`);
        }

        await SecureStore.setItemAsync(key, value, {
          keychainAccessible: SecureStore.WHEN_UNLOCKED,
        });
        return;
      }

      // Large session payload: slice into chunks
      const chunks: string[] = [];
      for (let i = 0; i < value.length; i += CHUNK_SIZE) {
        chunks.push(value.slice(i, i + CHUNK_SIZE));
      }

      // Delete standard unchunked key if it existed
      await SecureStore.deleteItemAsync(key).catch(() => {});

      // Write chunk count and all chunks
      await SecureStore.setItemAsync(`${key}__chunks`, String(chunks.length), {
        keychainAccessible: SecureStore.WHEN_UNLOCKED,
      });

      for (let i = 0; i < chunks.length; i++) {
        await SecureStore.setItemAsync(`${key}__chunk_${i}`, chunks[i], {
          keychainAccessible: SecureStore.WHEN_UNLOCKED,
        });
      }
    } catch {
      memoryFallback.set(key, value);
    }
  },

  removeItem: async (key: string): Promise<void> => {
    try {
      const chunkCountStr = await SecureStore.getItemAsync(`${key}__chunks`);
      if (chunkCountStr) {
        const count = parseInt(chunkCountStr, 10);
        for (let i = 0; i < count; i++) {
          await SecureStore.deleteItemAsync(`${key}__chunk_${i}`);
        }
        await SecureStore.deleteItemAsync(`${key}__chunks`);
      }
      await SecureStore.deleteItemAsync(key);
    } catch {
      memoryFallback.delete(key);
    }
  },
};
