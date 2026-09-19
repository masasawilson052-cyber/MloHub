import type { ViewStyle } from 'react-native';
import { Colors } from './colors';
import { Spacing } from './spacing';
import { Radii } from './radius';

export const LayoutTokens = {
  containerMaxWidth: 800,
  minTouchTarget: 48,
  cardPadding: Spacing.md,
  cardRadius: Radii.lg,
  modalRadius: Radii.xl,
};

export const CommonStyles: Record<string, ViewStyle> = {
  screenContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centeredContent: {
    width: '100%',
    maxWidth: LayoutTokens.containerMaxWidth,
    alignSelf: 'center',
  },
  cardBase: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: Spacing.md,
  },
};
