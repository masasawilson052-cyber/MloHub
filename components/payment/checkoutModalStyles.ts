import { StyleSheet, Platform } from 'react-native';
import { ThemeColors } from '../../theme/palettes';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { Shadows } from '../../constants/theme';

export const createCheckoutModalStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.65)',
      justifyContent: 'flex-end',
    },
    modalBox: {
      backgroundColor: colors.appBackground,
      borderTopLeftRadius: Radii.xxl,
      borderTopRightRadius: Radii.xxl,
      maxHeight: '94%',
      paddingBottom: Platform.OS === 'ios' ? 34 : 20,
      ...Shadows.lg,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing.xl,
      paddingBottom: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTag: {
      fontSize: 10,
      fontWeight: '800',
      color: colors.success,
      letterSpacing: 0.8,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '900',
      color: colors.text,
      marginTop: 2,
    },
    closeBtn: {
      padding: 6,
      borderRadius: Radii.full,
      backgroundColor: colors.card,
    },
    scrollContent: {
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.lg,
      gap: 16,
    },
  });
