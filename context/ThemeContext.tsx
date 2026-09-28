import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { Appearance, Platform, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SystemUI from 'expo-system-ui';
import {
  ThemeMode,
  ThemeColors,
  lightColors,
  THEME_STORAGE_KEY,
  LEGACY_ADMIN_THEME_KEY,
  isValidThemeMode,
  resolveThemeMode,
  resolveThemeColors,
  computeNextToggledMode,
  StorageLike,
  migrateAndLoadThemePreference,
} from '../theme/palettes';

export {
  THEME_STORAGE_KEY,
  LEGACY_ADMIN_THEME_KEY,
  isValidThemeMode,
  resolveThemeMode,
  resolveThemeColors,
  computeNextToggledMode,
  migrateAndLoadThemePreference,
};
export type { StorageLike };

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

export function getInitialSyncWebMode(): { mode: ThemeMode; hydrated: boolean } {
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
      return { mode: 'LIGHT', hydrated: true };
    } catch {
      // Ignore storage access errors in restricted webviews
    }
  }
  return { mode: 'LIGHT', hydrated: false };
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
  mode: 'LIGHT',
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
    const nextMode: ThemeMode = computeNextToggledMode(mode, systemScheme);
    await setMode(nextMode);
  }, [mode, systemScheme, setMode]);

  const isDark = resolvedMode === 'DARK';

  const colors: ThemeColors = useMemo(
    () => resolveThemeColors(mode, systemScheme),
    [mode, systemScheme]
  );

  // Synchronize native Appearance color scheme and SystemUI root background
  useEffect(() => {
    if (Platform.OS !== 'web') {
      try {
        if (typeof Appearance?.setColorScheme === 'function') {
          const targetScheme =
            mode === 'LIGHT'
              ? 'light'
              : mode === 'DARK'
              ? 'dark'
              : (null as unknown as 'light' | 'dark');
          Appearance.setColorScheme(targetScheme);
        }
      } catch {
        // Ignore unsupported Appearance.setColorScheme environments
      }
      try {
        SystemUI.setBackgroundColorAsync(colors.appBackground).catch(() => {});
      } catch {
        // Ignore SystemUI errors in headless environments
      }
    }
  }, [mode, colors.appBackground]);

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

