import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeMode, ThemeColors, lightColors, darkColors } from '../theme/palettes';

export interface AppThemeContextValue {
  mode: ThemeMode;
  resolvedMode: 'LIGHT' | 'DARK';
  isDark: boolean;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => Promise<void>;
}

const STORAGE_KEY = 'mlohub_admin_theme_mode';

const ThemeContext = createContext<AppThemeContextValue>({
  mode: 'SYSTEM',
  resolvedMode: 'LIGHT',
  isDark: false,
  colors: lightColors,
  setMode: async () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('SYSTEM');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (isMounted && saved && (saved === 'LIGHT' || saved === 'DARK' || saved === 'SYSTEM')) {
          setModeState(saved as ThemeMode);
        }
      } catch (e) {
        console.warn('Failed to load theme preference from AsyncStorage:', e);
      } finally {
        if (isMounted) setIsLoaded(true);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const setMode = async (newMode: ThemeMode) => {
    setModeState(newMode);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, newMode);
    } catch (e) {
      console.warn('Failed to persist theme preference:', e);
    }
  };

  const resolvedMode: 'LIGHT' | 'DARK' = useMemo(() => {
    if (mode === 'LIGHT') return 'LIGHT';
    if (mode === 'DARK') return 'DARK';
    return systemColorScheme === 'dark' ? 'DARK' : 'LIGHT';
  }, [mode, systemColorScheme]);

  const isDark = resolvedMode === 'DARK';

  const colors: ThemeColors = useMemo(() => {
    return resolvedMode === 'DARK' ? darkColors : lightColors;
  }, [resolvedMode]);

  const value = useMemo(
    () => ({
      mode,
      resolvedMode,
      isDark,
      colors,
      setMode,
    }),
    [mode, resolvedMode, isDark, colors]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): AppThemeContextValue => {
  return useContext(ThemeContext);
};
