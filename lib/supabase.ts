import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { runtimeConfig } from './runtimeConfig';

const rawUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim();
const rawAnonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').trim();

const PLACEHOLDER_URL_PATTERNS = [
  'your-project',
  'your-supabase-url',
  'sandbox.supabase.co',
  'placeholder.supabase.co',
  'example.supabase.co',
];

const PLACEHOLDER_KEY_PATTERNS = [
  'your-anon-key',
  'sandbox-anon-key',
  'your_local_publishable_key',
  'paste_your_local_publishable_key',
  'paste_your',
  'placeholder',
  'your-key',
];

export const isSupabaseConfigured = (): boolean => {
  if (!rawUrl || !rawAnonKey) return false;

  // URL validation
  const lowerUrl = rawUrl.toLowerCase();
  const isHttpOrHttps = lowerUrl.startsWith('http://') || lowerUrl.startsWith('https://');
  if (!isHttpOrHttps) return false;
  if (PLACEHOLDER_URL_PATTERNS.some((pattern) => lowerUrl.includes(pattern))) return false;

  // Anon key validation
  const lowerKey = rawAnonKey.toLowerCase();
  if (PLACEHOLDER_KEY_PATTERNS.some((pattern) => lowerKey.includes(pattern))) return false;
  if (rawAnonKey.length < 20) return false;

  return true;
};

// CRITICAL SECURITY ENFORCEMENT:
// If the runtime mode requires a real Supabase instance (production, staging, development),
// missing or placeholder Supabase credentials must FAIL CLOSED immediately.
if (runtimeConfig.requiresRealSupabase && !isSupabaseConfigured()) {
  throw new Error(
    `[MLOHUB CRITICAL CONFIG ERROR] Runtime mode "${runtimeConfig.mode}" requires a real, non-placeholder Supabase instance.\n` +
    `EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY must be valid and non-placeholder.\n` +
    `For local development, connect to local Supabase (e.g., http://127.0.0.1:54321).\n` +
    `Silent fallback to local mock data is strictly prohibited in ${runtimeConfig.mode} mode.`
  );
}

// In test/demo mode, allow graceful dummy fallback if live credentials are not supplied
const activeUrl = isSupabaseConfigured() ? rawUrl : 'https://placeholder.supabase.co';
const activeAnonKey = isSupabaseConfigured() ? rawAnonKey : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';


// Isomorphic storage adapter: uses AsyncStorage in React Native/web, and an in-memory map in Node.js
const memoryStore = new Map<string, string>();

const isomorphicStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      if (typeof window !== 'undefined' && AsyncStorage && typeof AsyncStorage.getItem === 'function') {
        return await AsyncStorage.getItem(key);
      }
      // In native React Native (where window is undefined but navigator.product is ReactNative)
      if (typeof navigator !== 'undefined' && (navigator as any).product === 'ReactNative' && AsyncStorage) {
        return await AsyncStorage.getItem(key);
      }
    } catch {
      // Fallback to memory store
    }
    return memoryStore.get(key) || null;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
        return;
      }
      if (typeof window !== 'undefined' && AsyncStorage && typeof AsyncStorage.setItem === 'function') {
        await AsyncStorage.setItem(key, value);
        return;
      }
      if (typeof navigator !== 'undefined' && (navigator as any).product === 'ReactNative' && AsyncStorage) {
        await AsyncStorage.setItem(key, value);
        return;
      }
    } catch {
      // Fallback to memory store
    }
    memoryStore.set(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
        return;
      }
      if (typeof window !== 'undefined' && AsyncStorage && typeof AsyncStorage.removeItem === 'function') {
        await AsyncStorage.removeItem(key);
        return;
      }
      if (typeof navigator !== 'undefined' && (navigator as any).product === 'ReactNative' && AsyncStorage) {
        await AsyncStorage.removeItem(key);
        return;
      }
    } catch {
      // Fallback to memory store
    }
    memoryStore.delete(key);
  },
};

export const supabase = createClient(activeUrl, activeAnonKey, {
  auth: {
    storage: isomorphicStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
export const supabaseAdmin = serviceRoleKey
  ? createClient(activeUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : supabase;

// Auto-refresh tokens when app is active in foreground on native platforms
try {
  if (typeof navigator !== 'undefined' && (navigator as any).product === 'ReactNative') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { AppState, Platform } = require('react-native');
    if (Platform && Platform.OS !== 'web') {
      AppState.addEventListener('change', (state: string) => {
        if (state === 'active') {
          supabase.auth.startAutoRefresh();
        } else {
          supabase.auth.stopAutoRefresh();
        }
      });
    }
  }
} catch {
  // Graceful no-op in headless test or web environments
}

