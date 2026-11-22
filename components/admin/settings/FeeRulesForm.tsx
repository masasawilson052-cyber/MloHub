import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import { useLanguage } from '../../../context/LanguageContext';
import {
  PlatformSettingsRepository,
  AdminFeeSettings,
} from '../../../repositories/platformSettings.repository';
import {
  computeServiceFeeTzs,
  PublicFeeRules,
} from '../../../config/platformFees';
import { ThemeColors, lightColors } from '../../../theme/palettes';
import { FeeRulesFields } from './FeeRulesFields';
import { FeeRulesExample } from './FeeRulesExample';

let colors: ThemeColors = lightColors;

interface FeeRulesFormProps {
  onSaved?: () => void;
}

export const FeeRulesForm: React.FC<FeeRulesFormProps> = ({ onSaved }) => {
  const { colors: _tc } = useTheme();
  colors = _tc;
  const styles = createStyles(colors);
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [, setInitialSettings] = useState<AdminFeeSettings | null>(null);

  // Form inputs (percentages as strings, currency amounts as integers)
  const [serviceFeeBpsInput, setServiceFeeBpsInput] = useState('3.00');
  const [serviceFeeMinInput, setServiceFeeMinInput] = useState('200');
  const [serviceFeeMaxInput, setServiceFeeMaxInput] = useState('500');
  const [deliveryMinOrderInput, setDeliveryMinOrderInput] = useState('5000');
  const [takeawayMinOrderInput, setTakeawayMinOrderInput] = useState('2000');
  const [commDeliveryInput, setCommDeliveryInput] = useState('8.00');
  const [commTakeawayInput, setCommTakeawayInput] = useState('5.00');
  const [commDineInInput, setCommDineInInput] = useState('0.00');
  const [freeDaysInput, setFreeDaysInput] = useState('30');
  const [changeReason, setChangeReason] = useState('');

  // Confirmation modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const loadCurrentSettings = async () => {
    setLoading(true);
    try {
      const data = await PlatformSettingsRepository.getAdminFeeSettings();
      setInitialSettings(data);
      setServiceFeeBpsInput((data.serviceFeeBps / 100).toFixed(2));
      setServiceFeeMinInput(data.serviceFeeMinTzs.toString());
      setServiceFeeMaxInput(data.serviceFeeMaxTzs.toString());
      setDeliveryMinOrderInput(data.deliveryMinOrderTzs.toString());
      setTakeawayMinOrderInput(data.minimumOrderValueTzs.toString());
      setCommDeliveryInput((data.commissionBpsDelivery / 100).toFixed(2));
      setCommTakeawayInput((data.commissionBpsTakeaway / 100).toFixed(2));
      setCommDineInInput((data.commissionBpsDineIn / 100).toFixed(2));
      setFreeDaysInput(data.newRestaurantFreeDays.toString());
    } catch (err: any) {
      console.warn('FeeRulesForm: failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCurrentSettings();
  }, []);

  const parsePercent = (val: string): { valid: boolean; bps: number } => {
    const trimmed = val.trim();
    if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
      return { valid: false, bps: 0 };
    }
    const num = parseFloat(trimmed);
    if (isNaN(num) || num < 0 || num > 100) {
      return { valid: false, bps: 0 };
    }
    return { valid: true, bps: Math.round(num * 100) };
  };

  const parseNumber = (val: string, min: number = 0): { valid: boolean; value: number } => {
    const trimmed = val.trim();
    if (!/^\d+$/.test(trimmed)) {
      return { valid: false, value: 0 };
    }
    const num = parseInt(trimmed, 10);
    if (isNaN(num) || num < min) {
      return { valid: false, value: 0 };
    }
    return { valid: true, value: num };
  };

  const liveExample = useMemo(() => {
    const subtotal = 12000;
    const sBps = parsePercent(serviceFeeBpsInput).bps;
    const sMin = parseNumber(serviceFeeMinInput).value;
    const sMax = parseNumber(serviceFeeMaxInput).value;
    const commDelBps = parsePercent(commDeliveryInput).bps;

    const mockRules: PublicFeeRules = {
      serviceFeeBps: sBps,
      serviceFeeMinTzs: sMin,
      serviceFeeMaxTzs: sMax,
      deliveryMinOrderTzs: parseNumber(deliveryMinOrderInput).value,
      minimumOrderValueTzs: parseNumber(takeawayMinOrderInput).value,
      currency: 'TZS',
    };

    const serviceFee = computeServiceFeeTzs(subtotal, 'Delivery', mockRules);
    const commission = Math.floor((subtotal * commDelBps + 5000) / 10000);
    const restaurantPayout = Math.max(0, subtotal - commission);

    return {
      subtotal,
      serviceFee,
      commission,
      restaurantPayout,
    };
  }, [
    serviceFeeBpsInput,
    serviceFeeMinInput,
    serviceFeeMaxInput,
    deliveryMinOrderInput,
    takeawayMinOrderInput,
    commDeliveryInput,
  ]);

  const handleValidateAndPreview = () => {
    setValidationError(null);

    const sBps = parsePercent(serviceFeeBpsInput);
    if (!sBps.valid) {
      setValidationError(t('feeRulesInvalidPercent'));
      return;
    }

    const sMin = parseNumber(serviceFeeMinInput);
    if (!sMin.valid) {
      setValidationError(t('feeRulesInvalidNumber'));
      return;
    }

    const sMax = parseNumber(serviceFeeMaxInput, sMin.value);
    if (!sMax.valid) {
      setValidationError(t('feeRulesInvalidNumber'));
      return;
    }

    const delMin = parseNumber(deliveryMinOrderInput);
    if (!delMin.valid) {
      setValidationError(t('feeRulesInvalidNumber'));
      return;
    }

    const tMin = parseNumber(takeawayMinOrderInput);
    if (!tMin.valid) {
      setValidationError(t('feeRulesInvalidNumber'));
      return;
    }

    const commDel = parsePercent(commDeliveryInput);
    const commTak = parsePercent(commTakeawayInput);
    const commDin = parsePercent(commDineInInput);
    if (!commDel.valid || !commTak.valid || !commDin.valid) {
      setValidationError(t('feeRulesInvalidPercent'));
      return;
    }

    const freeDays = parseNumber(freeDaysInput);
    if (!freeDays.valid) {
      setValidationError(t('feeRulesInvalidNumber'));
      return;
    }

    if (changeReason.trim().length < 4) {
      setValidationError(t('feeRulesReasonRequired'));
      return;
    }

    setShowConfirmModal(true);
  };

  const handleConfirmSave = async () => {
    setIsSaving(true);
    try {
      const sBps = parsePercent(serviceFeeBpsInput).bps;
      const sMin = parseNumber(serviceFeeMinInput).value;
      const sMax = parseNumber(serviceFeeMaxInput).value;
      const delMin = parseNumber(deliveryMinOrderInput).value;
      const tMin = parseNumber(takeawayMinOrderInput).value;
      const commDel = parsePercent(commDeliveryInput).bps;
      const commTak = parsePercent(commTakeawayInput).bps;
      const commDin = parsePercent(commDineInInput).bps;
      const freeDays = parseNumber(freeDaysInput).value;

      const res = await PlatformSettingsRepository.updatePlatformFeeRules({
        serviceFeeBps: sBps,
        serviceFeeMinTzs: sMin,
        serviceFeeMaxTzs: sMax,
        deliveryMinOrderTzs: delMin,
        minimumOrderValueTzs: tMin,
        commissionBpsDelivery: commDel,
        commissionBpsTakeaway: commTak,
        commissionBpsDineIn: commDin,
        newRestaurantFreeDays: freeDays,
        reason: changeReason.trim(),
      });

      if (!res.success) {
        Alert.alert(t('feeRulesUpdateError'), res.error || 'Failed to update rules.');
        return;
      }

      Alert.alert(t('feeRulesTitle'), t('feeRulesUpdatedSuccess'));
      setShowConfirmModal(false);
      setChangeReason('');
      await loadCurrentSettings();
      onSaved?.();
    } catch (err: any) {
      Alert.alert(t('feeRulesUpdateError'), err?.message || 'Unexpected error');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingArea}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardHeaderRow}>
        <Ionicons name="calculator-outline" size={20} color={colors.primary} />
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
          {t('feeRulesTitle')}
        </Text>
      </View>
      <Text style={[styles.cardNotice, { color: colors.textSecondary }]}>
        {t('feeRulesSubtitle')}
      </Text>

      {validationError ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
          <Text style={[styles.errorText, { color: colors.danger }]}>{validationError}</Text>
        </View>
      ) : null}

      <FeeRulesFields
        colors={colors}
        t={t}
        serviceFeeBpsInput={serviceFeeBpsInput}
        setServiceFeeBpsInput={setServiceFeeBpsInput}
        serviceFeeMinInput={serviceFeeMinInput}
        setServiceFeeMinInput={setServiceFeeMinInput}
        serviceFeeMaxInput={serviceFeeMaxInput}
        setServiceFeeMaxInput={setServiceFeeMaxInput}
        deliveryMinOrderInput={deliveryMinOrderInput}
        setDeliveryMinOrderInput={setDeliveryMinOrderInput}
        takeawayMinOrderInput={takeawayMinOrderInput}
        setTakeawayMinOrderInput={setTakeawayMinOrderInput}
        commDeliveryInput={commDeliveryInput}
        setCommDeliveryInput={setCommDeliveryInput}
        commTakeawayInput={commTakeawayInput}
        setCommTakeawayInput={setCommTakeawayInput}
        commDineInInput={commDineInInput}
        setCommDineInInput={setCommDineInInput}
        freeDaysInput={freeDaysInput}
        setFreeDaysInput={setFreeDaysInput}
      />

      <FeeRulesExample
        colors={colors}
        t={t}
        subtotal={liveExample.subtotal}
        serviceFee={liveExample.serviceFee}
        commission={liveExample.commission}
        restaurantPayout={liveExample.restaurantPayout}
      />

      <View style={styles.reasonBlock}>
        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
          {t('feeRulesReasonLabel')}
        </Text>
        <TextInput
          style={[styles.reasonInput, { backgroundColor: colors.inputBackground, color: colors.textPrimary, borderColor: colors.inputBorder }]}
          placeholder={t('feeRulesReasonPlaceholder')}
          placeholderTextColor={colors.inputPlaceholder}
          value={changeReason}
          onChangeText={(val) => {
            setChangeReason(val);
            if (validationError) setValidationError(null);
          }}
        />
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, { backgroundColor: colors.primary }]}
        onPress={handleValidateAndPreview}
      >
        <Ionicons name="shield-checkmark-outline" size={16} color={colors.onPrimary} style={{ marginRight: 6 }} />
        <Text style={styles.saveBtnText}>{t('feeRulesSaveBtn')}</Text>
      </TouchableOpacity>

      <Modal visible={showConfirmModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeaderRow}>
              <Ionicons name="warning-outline" size={24} color={colors.warning} />
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                {t('feeRulesConfirmTitle')}
              </Text>
            </View>
            <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>
              {t('feeRulesConfirmDesc')}
            </Text>
            <View style={[styles.confirmAuditBox, { backgroundColor: colors.surfaceInteractive }]}>
              <Text style={[styles.auditReasonPrompt, { color: colors.textMuted }]}>Audit Reason:</Text>
              <Text style={[styles.auditReasonVal, { color: colors.textPrimary }]}>"{changeReason}"</Text>
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: colors.border }]}
                onPress={() => setShowConfirmModal(false)}
                disabled={isSaving}
              >
                <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>
                  {t('feeRulesConfirmCancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: colors.primary }]}
                onPress={handleConfirmSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                ) : (
                  <Text style={styles.modalConfirmText}>{t('feeRulesConfirmSubmit')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
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
