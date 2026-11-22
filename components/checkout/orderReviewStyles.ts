import { StyleSheet, Platform } from 'react-native';
import { ThemeColors } from '../../theme/palettes';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { Typography } from '../../theme/typography';

export const createOrderReviewStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(20, 40, 30, 0.45)',
      justifyContent: 'flex-end',
    },
    container: {
      backgroundColor: colors.card,
      borderTopLeftRadius: Radii.xl,
      borderTopRightRadius: Radii.xl,
      maxHeight: '90%',
      paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    headerTitle: {
      ...Typography.H2,
    },
    closeBtn: {
      padding: 6,
    },
    scrollArea: {
      maxHeight: 460,
    },
    scrollContent: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
    },
    sectionCard: {
      backgroundColor: colors.surfaceInteractive,
      borderRadius: Radii.md,
      padding: Spacing.md,
      marginBottom: Spacing.md,
    },
    sectionLabel: {
      ...Typography.Label,
      color: colors.textMuted,
      marginBottom: Spacing.xs,
    },
    restaurantName: {
      ...Typography.H2,
      color: colors.textPrimary,
    },
    verifiedBadge: {
      marginTop: 6,
    },
    inputGroup: {
      marginTop: Spacing.sm,
    },
    addressHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    savedAddrsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 8,
    },
    pillBtn: {
      paddingVertical: 5,
      paddingHorizontal: 10,
      backgroundColor: colors.card,
      borderRadius: Radii.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    pillBtnActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    pillText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    pillTextActive: {
      color: colors.onPrimary,
    },
    inputLabel: {
      ...Typography.Caption,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    textInput: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.sm,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.textPrimary,
    },
    routeQuoteCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.md,
      borderRadius: Radii.md,
      borderWidth: 1,
      marginTop: 4,
      gap: 8,
    },
    routeQuoteText: {
      fontSize: 13,
      lineHeight: 18,
      flex: 1,
    },
    zoneCard: {
      padding: Spacing.sm,
      borderRadius: Radii.md,
      borderWidth: 1,
      borderColor: colors.divider,
      backgroundColor: colors.surfaceInteractive,
    },
    zoneCardSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    zoneName: {
      fontSize: 13.5,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    zoneNameSelected: {
      color: colors.primary,
    },
    zoneDetails: {
      fontSize: 11.5,
      color: colors.textMuted,
      marginTop: 2,
    },
    zoneFee: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
      marginLeft: 8,
    },
    zoneFeeSelected: {
      color: colors.primary,
    },
    itemSummaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    itemSummaryQty: {
      width: 28,
      fontWeight: '700',
      color: colors.primary,
    },
    itemSummaryName: {
      flex: 1,
      ...Typography.BodyMedium,
      marginRight: Spacing.sm,
    },
    paymentMethodsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.xs,
      marginTop: Spacing.xs,
    },
    pmCard: {
      width: '48%',
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 8,
      gap: 8,
      minHeight: 60,
      backgroundColor: colors.card,
      borderRadius: Radii.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    pmCardSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    pmLabel: {
      flex: 1,
      fontSize: 12.5,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    pmLabelSelected: {
      color: colors.primary,
    },
    billCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.md,
      padding: Spacing.md,
      marginBottom: Spacing.md,
    },
    billRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    billLabel: {
      ...Typography.Body,
      color: colors.textSecondary,
    },
    billTotalRow: {
      borderTopWidth: 1,
      borderTopColor: colors.divider,
      paddingTop: Spacing.xs,
      marginTop: 4,
    },
    billTotalLabel: {
      ...Typography.H3,
      fontWeight: '700',
    },
    footer: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
    processingContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.xxxl,
    },
    processingTitle: {
      ...Typography.H2,
      marginTop: Spacing.md,
    },
    processingSub: {
      ...Typography.Body,
      color: colors.textSecondary,
      marginTop: Spacing.xs,
    },
    confirmedContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.xxl,
      paddingHorizontal: Spacing.lg,
    },
    successIconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.successSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.md,
    },
    confirmedTitle: {
      ...Typography.Display,
      fontSize: 24,
      color: colors.primary,
    },
    confirmedRestaurant: {
      ...Typography.H3,
      color: colors.textSecondary,
      marginTop: 4,
    },
    orderIdPill: {
      backgroundColor: colors.primarySoft,
      paddingVertical: 4,
      paddingHorizontal: Spacing.md,
      borderRadius: Radii.full,
      marginTop: Spacing.sm,
    },
    orderIdText: {
      fontWeight: '700',
      color: colors.primary,
      fontSize: 14,
    },
    confirmedMessage: {
      ...Typography.Body,
      textAlign: 'center',
      color: colors.textSecondary,
      marginTop: Spacing.md,
    },
    confirmedBtnCol: {
      width: '100%',
    },
    trackBtn: {
      marginBottom: Spacing.xs,
    },
  });
