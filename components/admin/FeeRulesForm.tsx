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
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  PlatformSettingsRepository,
  AdminFeeSettings,
} from '../../repositories/platformSettings.repository';
import {
  computeServiceFeeTzs,
  formatTzs,
  PublicFeeRules,
} from '../../config/platformFees';
import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

interface FeeRulesFormProps {
  onSaved?: () => void;
}

export const FeeRulesForm: React.FC<FeeRulesFormProps> = ({ onSaved }) => {
  const { colors: _tc } = useTheme();
  colors = _tc;
  const styles = createStyles(colors);
  const { t, language } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [initialSettings, setInitialSettings] = useState<AdminFeeSettings | null>(null);

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

  // Sample order for live example
  const [exampleSubtotalInput] = useState('12000');

  // Confirmation modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Load current settings via direct SELECT from platform_financial_settings
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

  /**
   * Percent validator: accept 0-100 with at most 2 decimals.
   * bps = Math.round(value * 100).
   */
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

  // Live Example Computation
  const liveExample = useMemo(() => {
    const subtotal = parseInt(exampleSubtotalInput.trim(), 10) || 12000;
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
    // Canonical integer formula: (subtotal * bps + 5000) / 10000
    const commission = Math.floor((subtotal * commDelBps + 5000) / 10000);
    const restaurantPayout = Math.max(0, subtotal - commission);

    return {
      subtotal,
      serviceFee,
      commission,
      restaurantPayout,
    };
  }, [
    exampleSubtotalInput,
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

      {/* SECTION 1: CUSTOMER SERVICE FEE (DELIVERY ORDERS) */}
      <Text style={[styles.groupHeading, { color: colors.primary }]}>
        1. Customer Service Fee (Delivery Orders)
      </Text>
      <View style={styles.formGrid}>
        <View style={styles.formCol}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
            {t('feeRulesServiceFeeBps')}
          </Text>
          <TextInput
            style={[styles.inputField, { backgroundColor: colors.inputBackground, color: colors.textPrimary, borderColor: colors.inputBorder }]}
            value={serviceFeeBpsInput}
            onChangeText={setServiceFeeBpsInput}
            keyboardType="numeric"
            placeholder="3.00"
          />
          <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
            {t('feeRulesServiceFeeBpsHint')}
          </Text>
        </View>

        <View style={styles.formCol}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
            {t('feeRulesServiceFeeMin')}
          </Text>
          <TextInput
            style={[styles.inputField, { backgroundColor: colors.inputBackground, color: colors.textPrimary, borderColor: colors.inputBorder }]}
            value={serviceFeeMinInput}
            onChangeText={setServiceFeeMinInput}
            keyboardType="numeric"
            placeholder="200"
          />
          <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
            {t('feeRulesServiceFeeMinHint')}
          </Text>
        </View>

        <View style={styles.formCol}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
            {t('feeRulesServiceFeeMax')}
          </Text>
          <TextInput
            style={[styles.inputField, { backgroundColor: colors.inputBackground, color: colors.textPrimary, borderColor: colors.inputBorder }]}
            value={serviceFeeMaxInput}
            onChangeText={setServiceFeeMaxInput}
            keyboardType="numeric"
            placeholder="500"
          />
          <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
            {t('feeRulesServiceFeeMaxHint')}
          </Text>
        </View>
      </View>

      {/* SECTION 2: MINIMUM ORDER THRESHOLDS */}
      <Text style={[styles.groupHeading, { color: colors.primary }]}>
        2. Minimum Order Floors
      </Text>
      <View style={styles.formGrid}>
        <View style={styles.formCol}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
            {t('feeRulesDeliveryMinOrder')}
          </Text>
          <TextInput
            style={[styles.inputField, { backgroundColor: colors.inputBackground, color: colors.textPrimary, borderColor: colors.inputBorder }]}
            value={deliveryMinOrderInput}
            onChangeText={setDeliveryMinOrderInput}
            keyboardType="numeric"
            placeholder="5000"
          />
          <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
            {t('feeRulesDeliveryMinOrderHint')}
          </Text>
        </View>

        <View style={styles.formCol}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
            {t('feeRulesMinOrderTakeaway')}
          </Text>
          <TextInput
            style={[styles.inputField, { backgroundColor: colors.inputBackground, color: colors.textPrimary, borderColor: colors.inputBorder }]}
            value={takeawayMinOrderInput}
            onChangeText={setTakeawayMinOrderInput}
            keyboardType="numeric"
            placeholder="2000"
          />
          <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
            {t('feeRulesMinOrderTakeawayHint')}
          </Text>
        </View>
      </View>

      {/* SECTION 3: RESTAURANT COMMISSION RATES & INCENTIVES */}
      <Text style={[styles.groupHeading, { color: colors.primary }]}>
        3. Restaurant Commission Rates & Grace Period
      </Text>
      <View style={styles.formGrid}>
        <View style={styles.formCol}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
            {t('feeRulesCommDelivery')}
          </Text>
          <TextInput
            style={[styles.inputField, { backgroundColor: colors.inputBackground, color: colors.textPrimary, borderColor: colors.inputBorder }]}
            value={commDeliveryInput}
            onChangeText={setCommDeliveryInput}
            keyboardType="numeric"
            placeholder="8.00"
          />
          <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
            {t('feeRulesCommDeliveryHint')}
          </Text>
        </View>

        <View style={styles.formCol}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
            {t('feeRulesCommTakeaway')}
          </Text>
          <TextInput
            style={[styles.inputField, { backgroundColor: colors.inputBackground, color: colors.textPrimary, borderColor: colors.inputBorder }]}
            value={commTakeawayInput}
            onChangeText={setCommTakeawayInput}
            keyboardType="numeric"
            placeholder="5.00"
          />
          <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
            {t('feeRulesCommTakeawayHint')}
          </Text>
        </View>

        <View style={styles.formCol}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
            {t('feeRulesCommDineIn')}
          </Text>
          <TextInput
            style={[styles.inputField, { backgroundColor: colors.inputBackground, color: colors.textPrimary, borderColor: colors.inputBorder }]}
            value={commDineInInput}
            onChangeText={setCommDineInInput}
            keyboardType="numeric"
            placeholder="0.00"
          />
          <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
            {t('feeRulesCommDineInHint')}
          </Text>
        </View>

        <View style={styles.formCol}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
            {t('feeRulesFreeDays')}
          </Text>
          <TextInput
            style={[styles.inputField, { backgroundColor: colors.inputBackground, color: colors.textPrimary, borderColor: colors.inputBorder }]}
            value={freeDaysInput}
            onChangeText={setFreeDaysInput}
            keyboardType="numeric"
            placeholder="30"
          />
          <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
            {t('feeRulesFreeDaysHint')}
          </Text>
        </View>
      </View>

      {/* SECTION 4: LIVE EXAMPLE CARD */}
      <View style={[styles.exampleCard, { backgroundColor: colors.surfaceInteractive, borderColor: colors.border }]}>
        <View style={styles.exampleHeader}>
          <Ionicons name="sparkles-outline" size={16} color={colors.primary} />
          <Text style={[styles.exampleTitle, { color: colors.textPrimary }]}>
            {t('feeRulesLiveExampleTitle')}
          </Text>
        </View>
        <Text style={[styles.fieldHint, { color: colors.textMuted, marginBottom: 10 }]}>
          Sample order calculation for a delivery order:
        </Text>

        <View style={styles.exampleRow}>
          <Text style={[styles.exampleLabel, { color: colors.textSecondary }]}>{t('feeRulesExampleSubtotal')}:</Text>
          <Text style={[styles.exampleVal, { color: colors.textPrimary }]}>{formatTzs(liveExample.subtotal)}</Text>
        </View>
        <View style={styles.exampleRow}>
          <Text style={[styles.exampleLabel, { color: colors.textSecondary }]}>{t('feeRulesExampleServiceFee')}:</Text>
          <Text style={[styles.exampleVal, { color: colors.success }]}>+{formatTzs(liveExample.serviceFee)}</Text>
        </View>
        <View style={styles.exampleRow}>
          <Text style={[styles.exampleLabel, { color: colors.textSecondary }]}>{t('feeRulesExampleCommission')}:</Text>
          <Text style={[styles.exampleVal, { color: colors.danger }]}>-{formatTzs(liveExample.commission)}</Text>
        </View>
        <View style={[styles.exampleRow, styles.exampleHighlightRow]}>
          <Text style={[styles.exampleLabelHighlight, { color: colors.textPrimary }]}>{t('feeRulesExamplePayout')}:</Text>
          <Text style={[styles.exampleValHighlight, { color: colors.primary }]}>{formatTzs(liveExample.restaurantPayout)}</Text>
        </View>
      </View>

      {/* SECTION 5: AUDIT CHANGE REASON */}
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

      {/* CONFIRMATION / IMPACT PREVIEW MODAL */}
      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.65)' }]}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeaderRow}>
              <Ionicons name="warning-outline" size={24} color={colors.warning} />
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                {language === 'sw' ? 'Hakiki Mabadiliko ya Sheria za Ada' : 'Confirm Fee Policy Mutation'}
              </Text>
            </View>

            <Text style={[styles.modalNotice, { color: colors.textSecondary }]}>
              {language === 'sw'
                ? 'Mabadiliko haya yataanza kutumika mara moja kwa maagizo MAPYA pekee. Maagizo yaliyopita hayataathiriwa.'
                : 'These fee changes will apply authoritatively to NEW orders in PostgreSQL. Historical orders retain their immutable snapshots.'}
            </Text>

            <View style={[styles.impactBox, { backgroundColor: colors.surfaceInteractive, borderColor: colors.border }]}>
              <View style={styles.impactRow}>
                <Text style={[styles.impactLabel, { color: colors.textSecondary }]}>Service Fee:</Text>
                <Text style={[styles.impactVal, { color: colors.textPrimary }]}>
                  {initialSettings ? (initialSettings.serviceFeeBps / 100).toFixed(2) : '3.00'}% → {serviceFeeBpsInput}% (Min: {serviceFeeMinInput}, Max: {serviceFeeMaxInput} TZS)
                </Text>
              </View>
              <View style={styles.impactRow}>
                <Text style={[styles.impactLabel, { color: colors.textSecondary }]}>Delivery Min Order:</Text>
                <Text style={[styles.impactVal, { color: colors.textPrimary }]}>
                  {initialSettings ? formatTzs(initialSettings.deliveryMinOrderTzs) : '5,000 TZS'} → {formatTzs(deliveryMinOrderInput)}
                </Text>
              </View>
              <View style={styles.impactRow}>
                <Text style={[styles.impactLabel, { color: colors.textSecondary }]}>Takeaway Min Order:</Text>
                <Text style={[styles.impactVal, { color: colors.textPrimary }]}>
                  {initialSettings ? formatTzs(initialSettings.minimumOrderValueTzs) : '2,000 TZS'} → {formatTzs(takeawayMinOrderInput)}
                </Text>
              </View>
              <View style={styles.impactRow}>
                <Text style={[styles.impactLabel, { color: colors.textSecondary }]}>Commission (Del/Tak/Din):</Text>
                <Text style={[styles.impactVal, { color: colors.textPrimary }]}>
                  {commDeliveryInput}% / {commTakeawayInput}% / {commDineInInput}%
                </Text>
              </View>
              <View style={styles.impactRow}>
                <Text style={[styles.impactLabel, { color: colors.textSecondary }]}>Free Grace Days:</Text>
                <Text style={[styles.impactVal, { color: colors.textPrimary }]}>
                  {freeDaysInput} days
                </Text>
              </View>
              <View style={styles.impactRow}>
                <Text style={[styles.impactLabel, { color: colors.textSecondary }]}>Reason:</Text>
                <Text style={[styles.impactVal, { color: colors.textPrimary, fontWeight: '400' }]}>
                  {changeReason}
                </Text>
              </View>
            </View>

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={[styles.cancelBtn, { backgroundColor: colors.surfaceInteractive, borderColor: colors.border }]}
                onPress={() => setShowConfirmModal(false)}
                disabled={isSaving}
              >
                <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>
                  {language === 'sw' ? 'Ghairi' : 'Cancel'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: colors.primary }]}
                onPress={handleConfirmSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                ) : (
                  <Text style={styles.confirmBtnText}>
                    {language === 'sw' ? 'Hifadhi Mabadiliko' : 'Confirm Mutation'}
                  </Text>
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
      padding: 40,
      alignItems: 'center',
    },
    sectionCard: {
      borderRadius: 14,
      borderWidth: 1,
      padding: 20,
      marginBottom: 20,
    },
    cardHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 8,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '800',
    },
    cardNotice: {
      fontSize: 13,
      lineHeight: 18,
      marginBottom: 20,
    },
    groupHeading: {
      fontSize: 13,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: 8,
      marginBottom: 12,
    },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 10,
      borderRadius: 8,
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      marginBottom: 16,
    },
    errorText: {
      fontSize: 12,
      fontWeight: '600',
    },
    formGrid: {
      flexDirection: 'row',
      gap: 16,
      marginBottom: 16,
      flexWrap: 'wrap',
    },
    formCol: {
      flex: 1,
      minWidth: 180,
    },
    fieldLabel: {
      fontSize: 12,
      fontWeight: '700',
      marginBottom: 6,
    },
    inputField: {
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 9,
      fontSize: 14,
      fontWeight: '700',
    },
    fieldHint: {
      fontSize: 11,
      marginTop: 4,
    },
    exampleCard: {
      borderRadius: 12,
      borderWidth: 1,
      padding: 14,
      marginBottom: 18,
      gap: 6,
    },
    exampleHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 4,
    },
    exampleTitle: {
      fontSize: 13,
      fontWeight: '800',
    },
    exampleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    exampleHighlightRow: {
      borderTopWidth: 1,
      borderTopColor: 'rgba(0,0,0,0.08)',
      paddingTop: 8,
      marginTop: 4,
    },
    exampleLabel: {
      fontSize: 12,
      fontWeight: '600',
    },
    exampleVal: {
      fontSize: 12,
      fontWeight: '700',
    },
    exampleLabelHighlight: {
      fontSize: 13,
      fontWeight: '800',
    },
    exampleValHighlight: {
      fontSize: 14,
      fontWeight: '800',
    },
    reasonBlock: {
      marginBottom: 20,
    },
    reasonInput: {
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 13,
    },
    saveBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: 10,
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    saveBtnText: {
      color: colors.onPrimary,
      fontSize: 13,
      fontWeight: '700',
    },
    modalOverlay: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
    },
    modalCard: {
      width: '100%',
      maxWidth: 500,
      borderRadius: 16,
      borderWidth: 1,
      padding: 24,
    },
    modalHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 12,
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: '800',
      flex: 1,
    },
    modalNotice: {
      fontSize: 13,
      lineHeight: 18,
      marginBottom: 16,
    },
    impactBox: {
      borderRadius: 10,
      borderWidth: 1,
      padding: 12,
      marginBottom: 20,
      gap: 8,
    },
    impactRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    impactLabel: {
      fontSize: 12,
      fontWeight: '600',
    },
    impactVal: {
      fontSize: 12,
      fontWeight: '800',
    },
    modalActionRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 10,
    },
    cancelBtn: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
    },
    cancelBtnText: {
      fontSize: 12,
      fontWeight: '700',
    },
    confirmBtn: {
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 10,
      minWidth: 160,
      alignItems: 'center',
    },
    confirmBtnText: {
      color: colors.onPrimary,
      fontSize: 12,
      fontWeight: '700',
    },
  });
