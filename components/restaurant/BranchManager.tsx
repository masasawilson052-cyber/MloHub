import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Switch,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { Shadows } from '../../theme/shadows';
import { Typography } from '../../theme/typography';
import { RestaurantBranch } from '../../types/domain';
import { BranchRepository } from '../../repositories/branches.repository';
import { Button } from '../ui/Button';
import { BranchLocationPickerModal } from './BranchLocationPickerModal';

import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

export interface BranchManagerProps {
  restaurantId: string;
  branches: RestaurantBranch[];
  onBranchUpdated: () => Promise<void> | void;
  language?: 'en' | 'sw';
}

export const BranchManager: React.FC<BranchManagerProps> = ({
  restaurantId,
  branches,
  onBranchUpdated,
  language = 'en',
}) => {
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<RestaurantBranch | null>(null);
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [showAdvancedGps, setShowAdvancedGps] = useState(false);

  // Form Fields
  const [name, setName] = useState('');
  const [region, setRegion] = useState('Dar es Salaam');
  const [district, setDistrict] = useState('');
  const [ward, setWard] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [latStr, setLatStr] = useState('');
  const [lngStr, setLngStr] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLocationPicked = (loc: {
    region: string;
    district: string;
    ward: string;
    address: string;
    latitude: number;
    longitude: number;
  }) => {
    setRegion(loc.region);
    setDistrict(loc.district);
    setWard(loc.ward);
    setAddress(loc.address);
    setLatStr(String(loc.latitude));
    setLngStr(String(loc.longitude));
  };

  const openAddModal = () => {
    setEditingBranch(null);
    setName('');
    setRegion('Dar es Salaam');
    setDistrict('Kinondoni');
    setWard('');
    setAddress('');
    setPhone('');
    setLatStr('');
    setLngStr('');
    setIsActive(true);
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const openEditModal = (branch: RestaurantBranch) => {
    setEditingBranch(branch);
    setName(branch.name || '');
    setRegion(branch.region || 'Dar es Salaam');
    setDistrict(branch.district || '');
    setWard(branch.ward || '');
    setAddress(branch.address || '');
    setPhone(branch.phone || '');
    setLatStr(branch.latitude != null ? String(branch.latitude) : '');
    setLngStr(branch.longitude != null ? String(branch.longitude) : '');
    setIsActive(branch.isActive ?? true);
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    setErrorMsg(null);

    const trimmedName = name.trim();
    const trimmedAddress = address.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName) {
      setErrorMsg(language === 'sw' ? 'Jina la tawi linahitajika.' : 'Branch name is required.');
      return;
    }
    if (!trimmedAddress) {
      setErrorMsg(language === 'sw' ? 'Anuani ya mtaa inahitajika.' : 'Street address is required.');
      return;
    }
    if (!trimmedPhone) {
      setErrorMsg(language === 'sw' ? 'Nambari ya simu inahitajika.' : 'Contact phone is required.');
      return;
    }

    const latitude = latStr.trim() ? parseFloat(latStr.trim()) : undefined;
    const longitude = lngStr.trim() ? parseFloat(lngStr.trim()) : undefined;

    if (latStr.trim() && isNaN(latitude as number)) {
      setErrorMsg(language === 'sw' ? 'Latitude si sahihi.' : 'Invalid latitude value.');
      return;
    }
    if (lngStr.trim() && isNaN(longitude as number)) {
      setErrorMsg(language === 'sw' ? 'Longitude si sahihi.' : 'Invalid longitude value.');
      return;
    }

    setIsSaving(true);
    try {
      if (editingBranch) {
        // Update existing branch
        await BranchRepository.update(editingBranch.id, {
          name: trimmedName,
          region: region.trim() || 'Dar es Salaam',
          district: district.trim() || undefined,
          ward: ward.trim() || undefined,
          address: trimmedAddress,
          phone: trimmedPhone,
          latitude,
          longitude,
          isActive,
        });
      } else {
        // Create new branch
        await BranchRepository.create({
          restaurantId,
          name: trimmedName,
          region: region.trim() || 'Dar es Salaam',
          district: district.trim() || undefined,
          ward: ward.trim() || undefined,
          address: trimmedAddress,
          phone: trimmedPhone,
          latitude,
          longitude,
          isActive,
        });
      }

      setIsModalOpen(false);
      await onBranchUpdated();
    } catch (err: any) {
      console.error('[BranchManager] Save error:', err);
      setErrorMsg(err?.message || (language === 'sw' ? 'Imeshindikana kuhifadhi tawi.' : 'Failed to save branch.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>
            {language === 'sw' ? 'Matawi ya Mgahawa' : 'Restaurant Branches'}
          </Text>
          <Text style={styles.subtitle}>
            {language === 'sw'
              ? 'Tawi linahitajika ili menyu ionekane na wateja waweze kuagiza.'
              : 'At least one active branch is required for food discovery and online orders.'}
          </Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openAddModal} activeOpacity={0.8}>
          <Ionicons name="add" size={18} color={colors.white} />
          <Text style={styles.addBtnText}>
            {language === 'sw' ? 'Ongeza Tawi' : 'Add Branch'}
          </Text>
        </TouchableOpacity>
      </View>

      {branches.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="business-outline" size={36} color={colors.textMuted} style={{ marginBottom: Spacing.sm }} />
          <Text style={styles.emptyTitle}>
            {language === 'sw' ? 'Hakuna tawi lililoongezwa bado' : 'No branches added yet'}
          </Text>
          <Text style={styles.emptyDesc}>
            {language === 'sw'
              ? 'Bofya kitufe cha "Ongeza Tawi" hapo juu ili kusanidi eneo lako la biashara na kuanza kupokea oda.'
              : 'Click "+ Add Branch" to configure your operating location and enable food discovery.'}
          </Text>
        </View>
      ) : (
        <View style={styles.branchList}>
          {branches.map((b) => (
            <View key={b.id} style={styles.branchCard}>
              <View style={styles.branchHeader}>
                <View style={styles.branchNameRow}>
                  <Text style={styles.branchName}>{b.name}</Text>
                  <View style={[styles.statusBadge, b.isActive ? styles.statusActive : styles.statusInactive]}>
                    <Text style={[styles.statusText, b.isActive ? styles.statusTextActive : styles.statusTextInactive]}>
                      {b.isActive
                        ? (language === 'sw' ? 'Inafanya Kazi' : 'Active')
                        : (language === 'sw' ? 'Imefungwa' : 'Inactive')}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => openEditModal(b)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="pencil" size={16} color={colors.primary} />
                  <Text style={styles.editBtnText}>
                    {language === 'sw' ? 'Hariri' : 'Edit'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.branchDetails}>
                <View style={styles.detailRow}>
                  <Ionicons name="location-outline" size={14} color={colors.textMuted} style={styles.detailIcon} />
                  <Text style={styles.detailText}>
                    {[b.address, b.ward, b.district, b.region].filter(Boolean).join(', ')}
                  </Text>
                </View>

                {b.phone ? (
                  <View style={styles.detailRow}>
                    <Ionicons name="call-outline" size={14} color={colors.textMuted} style={styles.detailIcon} />
                    <Text style={styles.detailText}>{b.phone}</Text>
                  </View>
                ) : null}

                {b.latitude != null && b.longitude != null ? (
                  <View style={styles.detailRow}>
                    <Ionicons name="navigate-outline" size={14} color={colors.textMuted} style={styles.detailIcon} />
                    <Text style={styles.coordText}>GPS: {b.latitude.toFixed(4)}, {b.longitude.toFixed(4)}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Branch Modal */}
      <Modal visible={isModalOpen} transparent animationType="fade" onRequestClose={() => setIsModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingBranch
                  ? (language === 'sw' ? 'Hariri Tawi' : 'Edit Branch')
                  : (language === 'sw' ? 'Ongeza Tawi Jipya' : 'Add New Branch')}
              </Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color={colors.brandInk} />
              </TouchableOpacity>
            </View>

            {errorMsg ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={16} color={colors.error} style={{ marginRight: 6 }} />
                <Text style={styles.errorBannerText}>{errorMsg}</Text>
              </View>
            ) : null}

            <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
              {/* Preset / Map Location Picker CTA */}
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  backgroundColor: colors.successSoft,
                  borderRadius: Radii.lg,
                  borderWidth: 1,
                  borderColor: '#1d6637',
                  marginBottom: Spacing.md,
                }}
                onPress={() => setIsLocationPickerOpen(true)}
              >
                <Ionicons name="map-outline" size={18} color="#1d6637" />
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#1d6637' }}>
                  {language === 'sw' ? 'Chagua Eneo kwenye Ramani na Vituo (Presets)' : 'Pick Location from Map & Presets'}
                </Text>
              </TouchableOpacity>

              {/* Branch Name */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>
                  {language === 'sw' ? 'Jina la Tawi *' : 'Branch Name *'}
                </Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder={language === 'sw' ? 'Mf. Tawi Kuu - Sinza' : 'e.g. Main Branch - Sinza'}
                  placeholderTextColor={colors.inputPlaceholder}
                />
              </View>

              {/* Region & District */}
              <View style={styles.fieldRow}>
                <View style={[styles.fieldGroup, { flex: 1, marginRight: Spacing.sm }]}>
                  <Text style={styles.fieldLabel}>
                    {language === 'sw' ? 'Mkoa' : 'Region'}
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={region}
                    onChangeText={setRegion}
                    placeholder="Dar es Salaam"
                    placeholderTextColor={colors.inputPlaceholder}
                  />
                </View>

                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>
                    {language === 'sw' ? 'Wilaya' : 'District'}
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={district}
                    onChangeText={setDistrict}
                    placeholder="Kinondoni"
                    placeholderTextColor={colors.inputPlaceholder}
                  />
                </View>
              </View>

              {/* Ward / Neighborhood */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>
                  {language === 'sw' ? 'Kata / Eneo (Ward)' : 'Ward / Neighborhood'}
                </Text>
                <TextInput
                  style={styles.input}
                  value={ward}
                  onChangeText={setWard}
                  placeholder={language === 'sw' ? 'Mf. Sinza, Mikocheni, n.k.' : 'e.g. Sinza, Mikocheni, etc.'}
                  placeholderTextColor={colors.inputPlaceholder}
                />
              </View>

              {/* Street Address */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>
                  {language === 'sw' ? 'Anuani ya Mtaa *' : 'Street Address *'}
                </Text>
                <TextInput
                  style={styles.input}
                  value={address}
                  onChangeText={setAddress}
                  placeholder={language === 'sw' ? 'Mf. Shekilango Road, Plot 14' : 'e.g. Shekilango Road, Plot 14'}
                  placeholderTextColor={colors.inputPlaceholder}
                />
              </View>

              {/* Contact Phone */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>
                  {language === 'sw' ? 'Nambari ya Simu ya Tawi *' : 'Branch Contact Phone *'}
                </Text>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="07XXXXXXXX"
                  keyboardType="phone-pad"
                  placeholderTextColor={colors.inputPlaceholder}
                />
              </View>

              {/* Collapsible Advanced GPS Section */}
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  backgroundColor: colors.surfaceInteractive,
                  borderRadius: Radii.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  marginBottom: Spacing.sm,
                }}
                onPress={() => setShowAdvancedGps(!showAdvancedGps)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name={showAdvancedGps ? 'chevron-down' : 'chevron-forward'} size={16} color={colors.textSecondary} />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                    {language === 'sw' ? 'Mipangilio ya Kina ya GPS (Advanced GPS)' : 'Advanced GPS Coordinates'}
                  </Text>
                </View>
                {latStr && lngStr ? (
                  <View style={{ backgroundColor: colors.successSoft, paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radii.sm }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#1d6637' }}>✓ GPS Set</Text>
                  </View>
                ) : null}
              </TouchableOpacity>

              {showAdvancedGps && (
                <View style={styles.fieldRow}>
                  <View style={[styles.fieldGroup, { flex: 1, marginRight: Spacing.sm }]}>
                    <Text style={styles.fieldLabel}>
                      {language === 'sw' ? 'Latitude (GPS)' : 'Latitude (GPS)'}
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={latStr}
                      onChangeText={setLatStr}
                      placeholder="-6.7645"
                      keyboardType="numeric"
                      placeholderTextColor={colors.inputPlaceholder}
                    />
                  </View>

                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>
                      {language === 'sw' ? 'Longitude (GPS)' : 'Longitude (GPS)'}
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={lngStr}
                      onChangeText={setLngStr}
                      placeholder="39.2450"
                      keyboardType="numeric"
                      placeholderTextColor={colors.inputPlaceholder}
                    />
                  </View>
                </View>
              )}

              {/* Active Toggle */}
              <View style={styles.toggleRow}>
                <View style={{ flex: 1, marginRight: Spacing.md }}>
                  <Text style={styles.toggleLabel}>
                    {language === 'sw' ? 'Tawi Liko Wazi' : 'Branch Active'}
                  </Text>
                  <Text style={styles.toggleSub}>
                    {language === 'sw'
                      ? 'Washa ili kuruhusu wateja kupata vyakula vya tawi hili.'
                      : 'Enable to allow customers to discover dishes from this branch.'}
                  </Text>
                </View>
                <Switch
                  value={isActive}
                  onValueChange={setIsActive}
                  trackColor={{ false: colors.border, true: colors.primary }}
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsModalOpen(false)}
                disabled={isSaving}
              >
                <Text style={styles.cancelBtnText}>
                  {language === 'sw' ? 'Ghairi' : 'Cancel'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveBtn, isSaving && { opacity: 0.7 }]}
                onPress={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.saveBtnText}>
                    {language === 'sw' ? 'Hifadhi Tawi' : 'Save Branch'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <BranchLocationPickerModal
        visible={isLocationPickerOpen}
        onClose={() => setIsLocationPickerOpen(false)}
        onSelectLocation={handleLocationPicked}
        initialCoordinates={{
          latitude: latStr ? parseFloat(latStr) : undefined,
          longitude: lngStr ? parseFloat(lngStr) : undefined,
        }}
        language={language}
      />
    </View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: Radii.lg,
    padding: Spacing.lg,
    marginVertical: Spacing.md,
    borderWidth: 1,
    borderColor: colors.divider,
    ...Shadows.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  titleWrap: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radii.md,
  },
  addBtnText: {
    color: colors.onPrimary,
    fontWeight: '700',
    fontSize: 12,
    marginLeft: 4,
  },
  emptyCard: {
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardElevated,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: colors.divider,
    borderStyle: 'dashed',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  emptyDesc: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
    maxWidth: 280,
  },
  branchList: {
    gap: Spacing.sm,
  },
  branchCard: {
    backgroundColor: colors.cardElevated,
    borderRadius: Radii.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  branchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  branchNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  branchName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radii.full,
  },
  statusActive: {
    backgroundColor: colors.successSoft,
  },
  statusInactive: {
    backgroundColor: colors.surfaceInteractive,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusTextActive: {
    color: colors.success,
  },
  statusTextInactive: {
    color: colors.textMuted,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.sm,
    backgroundColor: colors.primarySoft,
  },
  editBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    marginLeft: 4,
  },
  branchDetails: {
    gap: 4,
    marginTop: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailIcon: {
    marginRight: 6,
  },
  detailText: {
    fontSize: 12,
    color: colors.textMuted,
    flex: 1,
  },
  coordText: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: 'monospace',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: Radii.xl,
    padding: Spacing.lg,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    ...Shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    paddingBottom: Spacing.sm,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
    padding: Spacing.sm,
    borderRadius: Radii.sm,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  errorBannerText: {
    fontSize: 12,
    color: colors.danger,
    flex: 1,
  },
  formScroll: {
    maxHeight: 420,
  },
  fieldGroup: {
    marginBottom: Spacing.sm,
  },
  fieldRow: {
    flexDirection: 'row',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: Radii.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.textPrimary,
    backgroundColor: colors.inputBg,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  toggleSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radii.md,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: Radii.md,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.onPrimary,
  },
});
let styles = createStyles(lightColors);
