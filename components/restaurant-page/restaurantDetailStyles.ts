import { StyleSheet } from 'react-native';
import { ThemeColors } from '../../theme/palettes';
import { Spacing, Radii, Shadows } from '../../constants/theme';

export const createRestaurantDetailStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.appBackground,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: Radii.full,
      backgroundColor: colors.surfaceInteractive,
      alignItems: 'center',
      justifyContent: 'center',
    },
    favBtn: {
      width: 40,
      height: 40,
      borderRadius: Radii.full,
      backgroundColor: colors.surfaceInteractive,
      alignItems: 'center',
      justifyContent: 'center',
    },
    topTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
      flex: 1,
      textAlign: 'center',
      marginHorizontal: Spacing.sm,
    },
    scrollContent: {
      paddingBottom: 160,
    },
    largeScreenContainer: {
      maxWidth: 800,
      width: '100%',
      alignSelf: 'center',
    },
    mapSectionCard: {
      margin: Spacing.md,
      backgroundColor: colors.card,
      borderRadius: Radii.lg,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: colors.divider,
      marginTop: Spacing.md,
      ...Shadows.sm,
    },
    mapSectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.xs,
    },
    mapSectionEyebrow: {
      fontSize: 10,
      fontWeight: '800',
      color: colors.textMuted,
      letterSpacing: 0.5,
    },
    mapSectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    openMapsBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: Radii.sm,
    },
    openMapsBtnText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.onPrimary,
      marginLeft: 4,
    },
    mapAddressText: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: Spacing.sm,
    },
    mapWrap: {
      borderRadius: Radii.md,
      overflow: 'hidden',
    },
    topInfoSlot: {
      width: '100%',
    },
    stickyTabBarWrap: {
      width: '100%',
      zIndex: 10,
      backgroundColor: colors.surface,
    },
    menuBodySlot: {
      width: '100%',
    },
  });
