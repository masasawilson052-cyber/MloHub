import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Modal,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import {
  PlatformSettingsRepository,
  PlatformFinancialSettings,
  PlatformOperationalSettings,
} from '../../repositories/platformSettings.repository';
import { formatTzs } from '../../config/platformFees';


import { ThemeColors, lightColors } from '../../theme/palettes';
let colors: ThemeColors = lightColors;

interface AdminSettingsProps {
  language?: 'en' | 'sw';
}

type SettingsTab = 'FINANCE' | 'FRESHNESS' | 'SUPPORT_POLICY';

export const AdminSettings: React.FC<AdminSettingsProps> = ({ language = 'en' }) => {
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);
  const [activeTab, setActiveTab] = useState<SettingsTab>('FINANCE');
  const [loading, setLoading] = useState(false);

  // Financial Settings State
  const [finSettings, setFinSettings] = useState<PlatformFinancialSettings | null>(null);
  const [commissionInput, setCommissionInput] = useState('10.0');
  const [serviceFeeInput, setServiceFeeInput] = useState('1500');
  const [minOrderInput, setMinOrderInput] = useState('2000');
  const [finChangeReason, setFinChangeReason] = useState('');
  const [showFinConfirm, setShowFinConfirm] = useState(false);
  const [isSavingFin, setIsSavingFin] = useState(false);

  // Operational Settings State
  const [opSettings, setOpSettings] = useState<PlatformOperationalSettings | null>(null);
  const [freshDays, setFreshDays] = useState('7');
  const [recentDays, setRecentDays] = useState('14');
  const [staleDays, setStaleDays] = useState('30');
  const [supportPhone, setSupportPhone] = useState('+255 700 000 000');
  const [supportEmail, setSupportEmail] = useState('support@mlohub.co.tz');
  const [supportHours, setSupportHours] = useState('07:00 AM - 11:00 PM EAT');
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [restAppsEnabled, setRestAppsEnabled] = useState(true);
  const [custRegEnabled, setCustRegEnabled] = useState(true);
  const [opChangeReason, setOpChangeReason] = useState('');
  const [isSavingOp, setIsSavingOp] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadSettings = async () => {
      setLoading(true);
      try {
        const [fin, op] = await Promise.all([
          PlatformSettingsRepository.getFinancialSettings(),
          PlatformSettingsRepository.getOperationalSettings(),
        ]);
        if (isMounted) {
          setFinSettings(fin);
          setCommissionInput((fin.defaultCommissionRate * 100).toFixed(1));
          setServiceFeeInput(fin.customerServiceFeeTzs.toString());
          setMinOrderInput(fin.minimumOrderValueTzs.toString());

          setOpSettings(op);
          setFreshDays(op.freshDays.toString());
          setRecentDays(op.recentDays.toString());
          setStaleDays(op.staleDays.toString());
          setSupportPhone(op.supportPhone);
          setSupportEmail(op.supportEmail);
          setSupportHours(op.supportHours);
          setMaintenanceMode(op.maintenanceMode);
          setRestAppsEnabled(op.restaurantApplicationsEnabled);
          setCustRegEnabled(op.customerRegistrationEnabled);
        }
      } catch (e) {
        console.warn('Failed to load settings:', e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadSettings();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSaveFinancial = async () => {
    if (finChangeReason.trim().length < 4) {
      Alert.alert('Reason Required', 'Please provide a descriptive reason of at least 4 characters.');
      return;
    }

    setIsSavingFin(true);
    try {
      const commPct = parseFloat(commissionInput);
      const sFee = parseInt(serviceFeeInput, 10);
      const minOrd = parseInt(minOrderInput, 10);

      const res = await PlatformSettingsRepository.updateFinancialSettings({
        commissionPercent: commPct,
        serviceFeeTzs: sFee,
        minimumOrderTzs: minOrd,
        reason: finChangeReason.trim(),
      });

      if (!res.success) {
        Alert.alert('Update Failed', res.error || 'Check administrator credentials.');
        return;
      }

      Alert.alert(
        'Settings Updated',
        'Financial configuration updated. Changes apply immediately to new orders only.'
      );
      setShowFinConfirm(false);
      setFinChangeReason('');

      const updated = await PlatformSettingsRepository.getFinancialSettings();
      setFinSettings(updated);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update financial settings.');
    } finally {
      setIsSavingFin(false);
    }
  };

  const handleSaveOperational = async () => {
    const f = parseInt(freshDays, 10);
    const r = parseInt(recentDays, 10);
    const s = parseInt(staleDays, 10);

    if (f <= 0 || r <= f || s <= r) {
      Alert.alert('Invalid Thresholds', 'Thresholds must satisfy: 0 < Fresh < Recent < Stale.');
      return;
    }

    if (opChangeReason.trim().length < 4) {
      Alert.alert('Reason Required', 'Please provide a descriptive change reason (minimum 4 characters).');
      return;
    }

    setIsSavingOp(true);
    try {
      const res = await PlatformSettingsRepository.updateOperationalSettings({
        freshDays: f,
        recentDays: r,
        staleDays: s,
        supportPhone: supportPhone.trim(),
        supportEmail: supportEmail.trim(),
        supportHours: supportHours.trim(),
        maintenanceMode,
        restaurantApplicationsEnabled: restAppsEnabled,
        customerRegistrationEnabled: custRegEnabled,
        reason: opChangeReason.trim(),
      });

      if (!res.success) {
        Alert.alert('Update Failed', res.error || 'Failed to update policy.');
        return;
      }

      Alert.alert('Policies Updated', 'Platform operational policies updated successfully.');
      setOpChangeReason('');
      const updated = await PlatformSettingsRepository.getOperationalSettings();
      setOpSettings(updated);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update operational policy.');
    } finally {
      setIsSavingOp(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.appBackground }]}
      contentContainerStyle={styles.content}
    >
      {/* Header */}
      <View style={styles.headerArea}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {language === 'sw' ? 'Mipangilio ya Mfumo' : 'Platform Operations Settings & Policy'}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Centralized financial fee authority, catalog freshness rules, support coordinates, and operational safeguards.
        </Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {(
          [
            { key: 'FINANCE', label: 'Financial Policy', icon: 'cash-outline' },
            { key: 'FRESHNESS', label: 'Catalog Freshness', icon: 'shield-checkmark-outline' },
            { key: 'SUPPORT_POLICY', label: 'Support & Platform Safeguards', icon: 'lock-closed-outline' },
          ] as const
        ).map((t) => {
          const isSelected = activeTab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[
                styles.tabBtn,
                {
                  backgroundColor: isSelected ? colors.primary : colors.surfaceInteractive,
                  borderColor: isSelected ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setActiveTab(t.key)}
            >
              <Ionicons
                name={t.icon as any}
                size={16}
                color={isSelected ? colors.card : colors.textSecondary}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  { color: isSelected ? colors.card : colors.textSecondary },
                  isSelected && { fontWeight: '700' },
                ]}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.loadingArea}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : activeTab === 'FINANCE' ? (
        /* FINANCIAL POLICY TAB */
        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="cash-outline" size={20} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
              Centralized Financial Fee Authority
            </Text>
          </View>
          <Text style={[styles.cardNotice, { color: colors.textSecondary }]}>
            Enforced authoritatively in PostgreSQL (<Text style={{ fontFamily: 'monospace' }}>create_order_secure</Text>). Changes apply strictly to NEW orders. Historical orders retain their economic snapshot forever.
          </Text>

          <View style={styles.formGrid}>
            <View style={styles.formCol}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                Platform Commission (%)
              </Text>
              <TextInput
                style={[
                  styles.inputField,
                  {
                    backgroundColor: colors.inputBackground,
                    color: colors.textPrimary,
                    borderColor: colors.inputBorder,
                  },
                ]}
                value={commissionInput}
                onChangeText={setCommissionInput}
                keyboardType="numeric"
              />
              <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
                Standard deduction on food subtotal
              </Text>
            </View>

            <View style={styles.formCol}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                Customer Service Fee (TZS)
              </Text>
              <TextInput
                style={[
                  styles.inputField,
                  {
                    backgroundColor: colors.inputBackground,
                    color: colors.textPrimary,
                    borderColor: colors.inputBorder,
                  },
                ]}
                value={serviceFeeInput}
                onChangeText={setServiceFeeInput}
                keyboardType="numeric"
              />
              <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
                Fixed charge per order checkout
              </Text>
            </View>

            <View style={styles.formCol}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                Minimum Order Value (TZS)
              </Text>
              <TextInput
                style={[
                  styles.inputField,
                  {
                    backgroundColor: colors.inputBackground,
                    color: colors.textPrimary,
                    borderColor: colors.inputBorder,
                  },
                ]}
                value={minOrderInput}
                onChangeText={setMinOrderInput}
                keyboardType="numeric"
              />
              <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
                Subtotal floor required for checkout
              </Text>
            </View>
          </View>

          <View style={styles.reasonBlock}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              Reason for Policy Mutation (Audit Requirement)
            </Text>
            <TextInput
              style={[
                styles.reasonInput,
                {
                  backgroundColor: colors.inputBackground,
                  color: colors.textPrimary,
                  borderColor: colors.inputBorder,
                },
              ]}
              placeholder="e.g., Launch merchant incentive or holiday fee adjustment"
              placeholderTextColor={colors.inputPlaceholder}
              value={finChangeReason}
              onChangeText={setFinChangeReason}
            />
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: colors.primary }]}
            onPress={() => setShowFinConfirm(true)}
          >
            <Ionicons name="shield-checkmark-outline" size={16} color={colors.onPrimary} style={{ marginRight: 6 }} />
            <Text style={styles.saveBtnText}>Preview Impact & Save Changes</Text>
          </TouchableOpacity>
        </View>
      ) : activeTab === 'FRESHNESS' ? (
        /* CATALOG FRESHNESS TAB */
        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.success} />
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
              Catalog Freshness Threshold Policies
            </Text>
          </View>
          <Text style={[styles.cardNotice, { color: colors.textSecondary }]}>
            Controls dish freshness grading across discovery ranking and the Verification Center. Validation requirement: 0 &lt; Fresh &lt; Recent &lt; Stale.
          </Text>

          <View style={styles.formGrid}>
            <View style={styles.formCol}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Fresh Tier (Days)</Text>
              <TextInput
                style={[
                  styles.inputField,
                  {
                    backgroundColor: colors.inputBackground,
                    color: colors.textPrimary,
                    borderColor: colors.inputBorder,
                  },
                ]}
                value={freshDays}
                onChangeText={setFreshDays}
                keyboardType="numeric"
              />
              <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
                Verified within last X days
              </Text>
            </View>

            <View style={styles.formCol}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Recent Tier (Days)</Text>
              <TextInput
                style={[
                  styles.inputField,
                  {
                    backgroundColor: colors.inputBackground,
                    color: colors.textPrimary,
                    borderColor: colors.inputBorder,
                  },
                ]}
                value={recentDays}
                onChangeText={setRecentDays}
                keyboardType="numeric"
              />
              <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
                Upper bound for recent confirmation
              </Text>
            </View>

            <View style={styles.formCol}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Stale Tier (Days)</Text>
              <TextInput
                style={[
                  styles.inputField,
                  {
                    backgroundColor: colors.inputBackground,
                    color: colors.textPrimary,
                    borderColor: colors.inputBorder,
                  },
                ]}
                value={staleDays}
                onChangeText={setStaleDays}
                keyboardType="numeric"
              />
              <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
                Triggers search demotion
              </Text>
            </View>
          </View>

          <View style={styles.reasonBlock}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              Reason for Threshold Adjustment
            </Text>
            <TextInput
              style={[
                styles.reasonInput,
                {
                  backgroundColor: colors.inputBackground,
                  color: colors.textPrimary,
                  borderColor: colors.inputBorder,
                },
              ]}
              placeholder="e.g., Tightening freshness requirement for high season"
              placeholderTextColor={colors.inputPlaceholder}
              value={opChangeReason}
              onChangeText={setOpChangeReason}
            />
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: colors.primary }]}
            onPress={handleSaveOperational}
            disabled={isSavingOp}
          >
            <Text style={styles.saveBtnText}>Save Freshness Thresholds</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* SUPPORT & SAFEGUARDS TAB */
        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.danger} />
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
              Support & Operational Safeguards
            </Text>
          </View>
          <Text style={[styles.cardNotice, { color: colors.textSecondary }]}>
            Non-secret support contact coordinates and platform-wide emergency switches.
          </Text>

          <View style={styles.formGrid}>
            <View style={styles.formCol}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Support Phone</Text>
              <TextInput
                style={[
                  styles.inputField,
                  {
                    backgroundColor: colors.inputBackground,
                    color: colors.textPrimary,
                    borderColor: colors.inputBorder,
                  },
                ]}
                value={supportPhone}
                onChangeText={setSupportPhone}
              />
            </View>

            <View style={styles.formCol}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Support Email</Text>
              <TextInput
                style={[
                  styles.inputField,
                  {
                    backgroundColor: colors.inputBackground,
                    color: colors.textPrimary,
                    borderColor: colors.inputBorder,
                  },
                ]}
                value={supportEmail}
                onChangeText={setSupportEmail}
              />
            </View>

            <View style={styles.formCol}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Support Hours</Text>
              <TextInput
                style={[
                  styles.inputField,
                  {
                    backgroundColor: colors.inputBackground,
                    color: colors.textPrimary,
                    borderColor: colors.inputBorder,
                  },
                ]}
                value={supportHours}
                onChangeText={setSupportHours}
              />
            </View>
          </View>

          {/* Toggle Switches */}
          <View style={[styles.toggleList, { borderTopColor: colors.divider }]}>
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.toggleTitle, { color: colors.textPrimary }]}>
                  Maintenance Mode
                </Text>
                <Text style={[styles.toggleSub, { color: colors.textSecondary }]}>
                  Blocks customer checkout and merchant edits. Admin console remains accessible.
                </Text>
              </View>
              <Switch
                value={maintenanceMode}
                onValueChange={setMaintenanceMode}
                trackColor={{ false: colors.border, true: colors.danger }}
              />
            </View>

            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.toggleTitle, { color: colors.textPrimary }]}>
                  Restaurant Applications Enabled
                </Text>
                <Text style={[styles.toggleSub, { color: colors.textSecondary }]}>
                  Allow new food spots to submit onboarding applications.
                </Text>
              </View>
              <Switch
                value={restAppsEnabled}
                onValueChange={setRestAppsEnabled}
                trackColor={{ false: colors.border, true: colors.success }}
              />
            </View>

            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.toggleTitle, { color: colors.textPrimary }]}>
                  Customer Registration Enabled
                </Text>
                <Text style={[styles.toggleSub, { color: colors.textSecondary }]}>
                  Allow new consumers to create MloHub user accounts.
                </Text>
              </View>
              <Switch
                value={custRegEnabled}
                onValueChange={setCustRegEnabled}
                trackColor={{ false: colors.border, true: colors.success }}
              />
            </View>
          </View>

          <View style={styles.reasonBlock}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              Reason for Policy Mutation
            </Text>
            <TextInput
              style={[
                styles.reasonInput,
                {
                  backgroundColor: colors.inputBackground,
                  color: colors.textPrimary,
                  borderColor: colors.inputBorder,
                },
              ]}
              placeholder="e.g., Scheduled infrastructure maintenance"
              placeholderTextColor={colors.inputPlaceholder}
              value={opChangeReason}
              onChangeText={setOpChangeReason}
            />
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: colors.primary }]}
            onPress={handleSaveOperational}
            disabled={isSavingOp}
          >
            <Text style={styles.saveBtnText}>Save Safeguards & Policy</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Confirmation Modal for Financial Policy Mutation */}
      <Modal visible={showFinConfirm} transparent animationType="fade">
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalBackdrop }]}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.surfaceRaised,
                borderColor: colors.borderStrong,
              },
            ]}
          >
            <View style={styles.modalHeaderRow}>
              <Ionicons name="warning" size={24} color={colors.warning} />
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                Confirm Financial Policy Mutation
              </Text>
            </View>

            <Text style={[styles.modalNotice, { color: colors.textSecondary }]}>
              You are about to change the authoritative platform financial structure. This action requires SUPER_ADMIN credentials and will be logged to the immutable audit trail.
            </Text>

            <View
              style={[
                styles.impactBox,
                {
                  backgroundColor: colors.surfaceInteractive,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={styles.impactRow}>
                <Text style={[styles.impactLabel, { color: colors.textSecondary }]}>
                  Commission:
                </Text>
                <Text style={[styles.impactVal, { color: colors.textPrimary }]}>
                  {finSettings ? (finSettings.defaultCommissionRate * 100).toFixed(1) : '10.0'}% → {commissionInput}%
                </Text>
              </View>
              <View style={styles.impactRow}>
                <Text style={[styles.impactLabel, { color: colors.textSecondary }]}>
                  Service Fee:
                </Text>
                <Text style={[styles.impactVal, { color: colors.textPrimary }]}>
                  {finSettings ? formatTzs(finSettings.customerServiceFeeTzs) : '1,500 TZS'} → {formatTzs(serviceFeeInput)}
                </Text>
              </View>
              <View style={styles.impactRow}>
                <Text style={[styles.impactLabel, { color: colors.textSecondary }]}>
                  Minimum Order:
                </Text>
                <Text style={[styles.impactVal, { color: colors.textPrimary }]}>
                  {finSettings ? formatTzs(finSettings.minimumOrderValueTzs) : '2,000 TZS'} → {formatTzs(minOrderInput)}
                </Text>
              </View>
              <View style={styles.impactRow}>
                <Text style={[styles.impactLabel, { color: colors.textSecondary }]}>
                  Reason:
                </Text>
                <Text style={[styles.impactVal, { color: colors.textPrimary, fontWeight: '400' }]}>
                  {finChangeReason}
                </Text>
              </View>
            </View>

            <Text style={[styles.immutabilityReminder, { color: colors.textMuted }]}>
              Note: This change affects NEW orders only. Existing orders, escrow captures, and completed settlements remain unchanged.
            </Text>

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={[
                  styles.cancelBtn,
                  {
                    backgroundColor: colors.surfaceInteractive,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => setShowFinConfirm(false)}
              >
                <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: colors.primary }]}
                onPress={handleSaveFinancial}
                disabled={isSavingFin}
              >
                {isSavingFin ? (
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                ) : (
                  <Text style={styles.confirmBtnText}>Confirm Policy Mutation</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 60,
  },
  headerArea: {
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 4,
    maxWidth: 700,
  },
  tabBar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 9,
    borderWidth: 1,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  loadingArea: {
    padding: 60,
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
  toggleList: {
    borderTopWidth: 1,
    paddingTop: 16,
    marginBottom: 20,
    gap: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  toggleSub: {
    fontSize: 11,
    marginTop: 2,
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
    marginBottom: 12,
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
  immutabilityReminder: {
    fontSize: 11,
    fontStyle: 'italic',
    marginBottom: 20,
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
let styles = createStyles(lightColors);
