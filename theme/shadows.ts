import type { ViewStyle } from 'react-native';

const isNativeRuntime =
  typeof navigator !== 'undefined' && (navigator as any).product === 'ReactNative';

const isWeb =
  !isNativeRuntime ||
  typeof window !== 'undefined' ||
  (typeof process !== 'undefined' &&
    (process.env?.EXPO_OS === 'web' ||
      process.env?.EXPO_PLATFORM === 'web' ||
      process.env?.npm_lifecycle_event === 'web' ||
      process.env?.npm_lifecycle_script?.includes('web')));

export const Shadows: Record<string, ViewStyle> = {
  none: isWeb
    ? ({ boxShadow: 'none' } as unknown as ViewStyle)
    : {
        shadowColor: 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
        elevation: 0,
      },
  sm: isWeb
    ? ({ boxShadow: '0 1px 3px rgba(20, 32, 51, 0.04)' } as unknown as ViewStyle)
    : {
        shadowColor: '#142033',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 1,
      },
  md: isWeb
    ? ({ boxShadow: '0 3px 6px rgba(20, 32, 51, 0.07)' } as unknown as ViewStyle)
    : {
        shadowColor: '#142033',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.07,
        shadowRadius: 6,
        elevation: 3,
      },
  lg: isWeb
    ? ({ boxShadow: '0 6px 12px rgba(20, 32, 51, 0.10)' } as unknown as ViewStyle)
    : {
        shadowColor: '#142033',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
      },
  card: isWeb
    ? ({ boxShadow: '0 2px 6px rgba(20, 32, 51, 0.05)' } as unknown as ViewStyle)
    : {
        shadowColor: '#142033',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
      },
  modal: isWeb
    ? ({ boxShadow: '0 10px 20px rgba(20, 32, 51, 0.16)' } as unknown as ViewStyle)
    : {
        shadowColor: '#142033',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.16,
        shadowRadius: 20,
        elevation: 10,
      },
};

