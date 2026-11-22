import { StyleSheet } from 'react-native';
import { ThemeColors } from '../../theme/palettes';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';

export const createCheckoutSignInStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.lg,
      padding: Spacing.md,
      marginBottom: Spacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      marginBottom: Spacing.sm,
    },
    title: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    subtitle: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    cancelBtn: {
      padding: 4,
    },
    tabRow: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceInteractive,
      borderRadius: Radii.sm,
      padding: 3,
      marginBottom: Spacing.md,
    },
    tabBtn: {
      flex: 1,
      paddingVertical: 7,
      alignItems: 'center',
      borderRadius: Radii.sm - 2,
    },
    tabBtnActive: {
      backgroundColor: colors.card,
    },
    tabText: {
      fontSize: 12.5,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    tabTextActive: {
      color: colors.primary,
      fontWeight: '700',
    },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.dangerSoft || '#FEE2E2',
      borderWidth: 1,
      borderColor: colors.danger,
      padding: 8,
      borderRadius: Radii.sm,
      marginBottom: Spacing.sm,
    },
    errorText: {
      fontSize: 12,
      color: colors.danger,
      flex: 1,
      fontWeight: '600',
    },
    fieldGroup: {
      marginBottom: Spacing.sm,
    },
    label: {
      fontSize: 11.5,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 3,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.inputBorder || colors.border,
      backgroundColor: colors.inputBackground || colors.card,
      color: colors.textPrimary,
      borderRadius: Radii.sm,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 8,
      fontSize: 13.5,
    },
    passwordLabelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 3,
    },
    forgotLink: {
      fontSize: 11.5,
      color: colors.primary,
      fontWeight: '600',
    },
    passwordInputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.inputBorder || colors.border,
      backgroundColor: colors.inputBackground || colors.card,
      borderRadius: Radii.sm,
    },
    eyeBtn: {
      paddingHorizontal: 10,
    },
    termsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginVertical: Spacing.xs,
    },
    termsText: {
      fontSize: 12,
      color: colors.textSecondary,
      flex: 1,
    },
    submitBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      borderRadius: Radii.sm,
      marginTop: 6,
    },
    submitBtnText: {
      fontSize: 13.5,
      fontWeight: '700',
      color: colors.onPrimary,
    },
  });
