import { StyleSheet } from 'react-native';
import { ThemeColors } from '../../../theme/palettes';

export const createFeeRulesStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    loadingArea: {
      padding: 30,
      alignItems: 'center',
    },
    sectionCard: {
      borderWidth: 1,
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
    },
    cardHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 4,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '700',
    },
    cardNotice: {
      fontSize: 13,
      lineHeight: 18,
      marginBottom: 12,
    },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.dangerSoft,
      borderWidth: 1,
      borderColor: colors.danger,
      padding: 10,
      borderRadius: 8,
      marginBottom: 12,
    },
    errorText: {
      fontSize: 12.5,
      fontWeight: '600',
      flex: 1,
    },
    fieldLabel: {
      fontSize: 12,
      fontWeight: '600',
      marginBottom: 4,
    },
    reasonBlock: {
      marginTop: 10,
      marginBottom: 14,
    },
    reasonInput: {
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      minHeight: 44,
    },
    saveBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: 8,
      marginTop: 4,
    },
    saveBtnText: {
      color: colors.onPrimary,
      fontSize: 14,
      fontWeight: '700',
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalBox: {
      width: '100%',
      maxWidth: 480,
      borderWidth: 1,
      borderRadius: 14,
      padding: 20,
    },
    modalHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 8,
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: '700',
    },
    modalDesc: {
      fontSize: 13,
      lineHeight: 19,
      marginBottom: 14,
    },
    confirmAuditBox: {
      padding: 12,
      borderRadius: 8,
      marginBottom: 18,
    },
    auditReasonPrompt: {
      fontSize: 11,
      textTransform: 'uppercase',
      fontWeight: '700',
      marginBottom: 2,
    },
    auditReasonVal: {
      fontSize: 13,
      fontStyle: 'italic',
      fontWeight: '600',
    },
    modalBtnRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 12,
    },
    modalCancelBtn: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 8,
      borderWidth: 1,
    },
    modalCancelText: {
      fontSize: 13,
      fontWeight: '600',
    },
    modalConfirmBtn: {
      paddingVertical: 10,
      paddingHorizontal: 18,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 100,
    },
    modalConfirmText: {
      color: colors.onPrimary,
      fontSize: 13,
      fontWeight: '700',
    },
  });
