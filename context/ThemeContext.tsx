import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { Appearance, Platform, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeMode, ThemeColors, lightColors, darkColors } from '../theme/palettes';

export const THEME_STORAGE_KEY = 'mlohub_theme_mode';
export const LEGACY_ADMIN_THEME_KEY = 'mlohub_admin_theme_mode';

export interface ThemeContextValue {
  mode: ThemeMode;
  resolvedMode: 'LIGHT' | 'DARK';
  isDark: boolean;
  isThemeHydrated: boolean;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => Promise<void>;
  toggleMode: () => Promise<void>;
}

export type AppThemeContextValue = ThemeContextValue;

export function isValidThemeMode(val: unknown): val is ThemeMode {
  return val === 'LIGHT' || val === 'DARK' || val === 'SYSTEM';
}

export function resolveThemeMode(
  mode: ThemeMode,
  systemScheme?: 'light' | 'dark' | null
): 'LIGHT' | 'DARK' {
  if (mode === 'LIGHT') return 'LIGHT';
  if (mode === 'DARK') return 'DARK';
  return systemScheme === 'dark' ? 'DARK' : 'LIGHT';
}

export interface StorageLike {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/**
 * Loads global theme mode from `mlohub_theme_mode`, migrating from legacy
 * `mlohub_admin_theme_mode` if present.
 */
export async function migrateAndLoadThemePreference(
  storage: StorageLike = AsyncStorage
): Promise<ThemeMode> {
  try {
    const saved = await storage.getItem(THEME_STORAGE_KEY);
    if (isValidThemeMode(saved)) {
      return saved;
    }

    const legacy = await storage.getItem(LEGACY_ADMIN_THEME_KEY);
    if (isValidThemeMode(legacy)) {
      await storage.setItem(THEME_STORAGE_KEY, legacy);
      try {
        await storage.removeItem(LEGACY_ADMIN_THEME_KEY);
      } catch {
        // Non-fatal cleanup
      }
      return legacy;
    }
  } catch (e) {
    console.warn('Failed to load or migrate theme preference:', e);
  }
  return 'SYSTEM';
}

function getInitialSyncWebMode(): { mode: ThemeMode; hydrated: boolean } {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      const current = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (isValidThemeMode(current)) {
        return { mode: current, hydrated: true };
      }
      const legacy = window.localStorage.getItem(LEGACY_ADMIN_THEME_KEY);
      if (isValidThemeMode(legacy)) {
        window.localStorage.setItem(THEME_STORAGE_KEY, legacy);
        window.localStorage.removeItem(LEGACY_ADMIN_THEME_KEY);
        return { mode: legacy, hydrated: true };
      }
    } catch {
      // Ignore storage access errors in restricted webviews
    }
  }
  return { mode: 'SYSTEM', hydrated: false };
}

function getWebSystemScheme(): 'light' | 'dark' | null {
  if (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function'
  ) {
    try {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return null;
    }
  }
  return null;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'SYSTEM',
  resolvedMode: 'LIGHT',
  isDark: false,
  isThemeHydrated: false,
  colors: lightColors,
  setMode: async () => {},
  toggleMode: async () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const rnColorScheme = useColorScheme();
  const initialSync = useMemo(() => getInitialSyncWebMode(), []);
  const [mode, setModeState] = useState<ThemeMode>(initialSync.mode);
  const [isThemeHydrated, setIsThemeHydrated] = useState<boolean>(initialSync.hydrated);
  const [systemScheme, setSystemScheme] = useState<'light' | 'dark' | null>(() => {
    const webScheme = getWebSystemScheme();
    if (webScheme) return webScheme;
    const rnScheme = rnColorScheme || Appearance?.getColorScheme?.();
    return rnScheme === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    if (rnColorScheme === 'dark' || rnColorScheme === 'light') {
      setSystemScheme(rnColorScheme);
    }
  }, [rnColorScheme]);

  // Listen dynamically to OS / browser color scheme changes for SYSTEM mode
  useEffect(() => {
    const sub = Appearance?.addChangeListener?.(({ colorScheme }) => {
      if (colorScheme === 'dark' || colorScheme === 'light') {
        setSystemScheme(colorScheme);
      }
    });

    let mediaQuery: MediaQueryList | null = null;
    const handleMediaChange = (evt: MediaQueryListEvent) => {
      setSystemScheme(evt.matches ? 'dark' : 'light');
    };

    if (
      Platform.OS === 'web' &&
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function'
    ) {
      try {
        mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        if (typeof mediaQuery.addEventListener === 'function') {
          mediaQuery.addEventListener('change', handleMediaChange);
        } else if (typeof (mediaQuery as any).addListener === 'function') {
          (mediaQuery as any).addListener(handleMediaChange);
        }
      } catch {
        // Ignore matchMedia listener errors
      }
    }

    return () => {
      sub?.remove?.();
      if (mediaQuery) {
        if (typeof mediaQuery.removeEventListener === 'function') {
          mediaQuery.removeEventListener('change', handleMediaChange);
        } else if (typeof (mediaQuery as any).removeListener === 'function') {
          (mediaQuery as any).removeListener(handleMediaChange);
        }
      }
    };
  }, []);

  // Hydrate and migrate stored preference
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const loadedMode = await migrateAndLoadThemePreference(AsyncStorage);
        if (isMounted) {
          setModeState(loadedMode);
        }
      } finally {
        if (isMounted) {
          setIsThemeHydrated(true);
        }
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const setMode = useCallback(async (newMode: ThemeMode) => {
    setModeState(newMode);
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, newMode);
        window.localStorage.removeItem(LEGACY_ADMIN_THEME_KEY);
      } catch {
        // Ignore localStorage write errors
      }
    }
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newMode);
      await AsyncStorage.removeItem(LEGACY_ADMIN_THEME_KEY);
    } catch (e) {
      console.warn('Failed to persist theme preference:', e);
    }
  }, []);

  const resolvedMode: 'LIGHT' | 'DARK' = useMemo(
    () => resolveThemeMode(mode, systemScheme),
    [mode, systemScheme]
  );

  const toggleMode = useCallback(async () => {
    const nextMode: ThemeMode = resolvedMode === 'DARK' ? 'LIGHT' : 'DARK';
    await setMode(nextMode);
  }, [resolvedMode, setMode]);

  const isDark = resolvedMode === 'DARK';

  const colors: ThemeColors = useMemo(
    () => (resolvedMode === 'DARK' ? darkColors : lightColors),
    [resolvedMode]
  );

  // Immediately synchronize Web DOM root attributes on change
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const root = document.documentElement;
      root.dataset.theme = resolvedMode === 'DARK' ? 'dark' : 'light';
      root.style.colorScheme = resolvedMode === 'DARK' ? 'dark' : 'light';
      root.style.backgroundColor = colors.appBackground;
      if (document.body) {
        document.body.style.backgroundColor = colors.appBackground;
        document.body.style.color = colors.textPrimary;
      }
    }
  }, [resolvedMode, colors]);

  const value = useMemo(
    () => ({
      mode,
      resolvedMode,
      isDark,
      isThemeHydrated,
      colors,
      setMode,
      toggleMode,
    }),
    [mode, resolvedMode, isDark, isThemeHydrated, colors, setMode, toggleMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  return useContext(ThemeContext);
};
