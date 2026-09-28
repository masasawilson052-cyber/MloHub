import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, Radii, Shadows } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

import {
  LocationPreset,
  DAR_ES_SALAAM_LOCATION_PRESETS,
} from '../../constants/branchPresets';

export { LocationPreset, DAR_ES_SALAAM_LOCATION_PRESETS };

export interface BranchLocationPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectLocation: (loc: {
    region: string;
    district: string;
    ward: string;
    address: string;
    latitude: number;
    longitude: number;
  }) => void;
  initialCoordinates?: { latitude?: number; longitude?: number };
  language?: 'en' | 'sw';
}

export const BranchLocationPickerModal: React.FC<BranchLocationPickerModalProps> = ({
  visible,
  onClose,
  onSelectLocation,
  initialCoordinates,
  language = 'en',
}) => {
  const { colors: _tc } = useTheme();
  colors = _tc;
  const styles = createStyles(colors);

  const [search, setSearch] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<LocationPreset>(
    () =>
      DAR_ES_SALAAM_LOCATION_PRESETS.find(
        (p) =>
          initialCoordinates?.latitude != null &&
          Math.abs(p.latitude - initialCoordinates.latitude) < 0.01 &&
          initialCoordinates?.longitude != null &&
          Math.abs(p.longitude - initialCoordinates.longitude) < 0.01
      ) || DAR_ES_SALAAM_LOCATION_PRESETS[0]
  );

  const filteredPresets = DAR_ES_SALAAM_LOCATION_PRESETS.filter((p) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.ward.toLowerCase().includes(q) ||
      p.district.toLowerCase().includes(q) ||
      p.address.toLowerCase().includes(q)
    );
  });

  const handleConfirm = () => {
    onSelectLocation({
      region: selectedPreset.region,
      district: selectedPreset.district,
      ward: selectedPreset.ward,
      address: selectedPreset.address,
      latitude: selectedPreset.latitude,
      longitude: selectedPreset.longitude,
    });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>
                {language === 'sw' ? 'Chagua Eneo la Tawi (Ramani na Vituo)' : 'Select Branch Location'}
              </Text>
              <Text style={styles.modalSubtitle}>
                {language === 'sw'
                  ? 'Chagua eneo maarufu la Dar es Salaam kusanidi GPS na anwani sahihi.'
                  : 'Select a verified location zone to configure GPS pin and address coordinates.'}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Search Box */}
          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder={language === 'sw' ? 'Tafuta mtaa, kata au wilaya...' : 'Search neighborhood, ward, or street...'}
              placeholderTextColor={colors.inputPlaceholder}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Active Pin Preview Card */}
          <View style={styles.pinPreviewCard}>
            <View style={styles.pinHeader}>
              <View style={styles.pinIconWrap}>
                <Ionicons name="location" size={24} color="#1d6637" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pinTitle}>{selectedPreset.name}</Text>
                <Text style={styles.pinAddress}>{selectedPreset.address}</Text>
              </View>
              <View style={styles.pinTag}>
                <Text style={styles.pinTagText}>{selectedPreset.tag}</Text>
              </View>
            </View>

            <View style={styles.pinDetailsRow}>
              <View style={styles.pinDetailItem}>
                <Text style={styles.pinDetailLabel}>District / Ward:</Text>
                <Text style={styles.pinDetailValue}>
                  {selectedPreset.district} • {selectedPreset.ward}
                </Text>
              </View>
              <View style={styles.pinDetailItem}>
                <Text style={styles.pinDetailLabel}>GPS Coordinates:</Text>
                <Text style={styles.pinDetailValue}>
                  {selectedPreset.latitude.toFixed(4)}, {selectedPreset.longitude.toFixed(4)}
                </Text>
              </View>
            </View>
          </View>

          {/* Presets List */}
          <ScrollView contentContainerStyle={styles.presetsList} showsVerticalScrollIndicator={false}>
            <Text style={styles.listSectionTitle}>
              {language === 'sw' ? 'Maeneo Yaliyohakikiwa ya Dar es Salaam:' : 'Verified Dar es Salaam Zones:'}
            </Text>

            {filteredPresets.map((preset) => {
              const isSelected = selectedPreset.id === preset.id;
              return (
                <TouchableOpacity
                  key={preset.id}
                  style={[styles.presetItem, isSelected && styles.presetItemSelected]}
                  onPress={() => setSelectedPreset(preset)}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={isSelected ? '#1d6637' : colors.textMuted}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.presetName, isSelected && styles.presetNameSelected]}>
                      {preset.name}
                    </Text>
                    <Text style={styles.presetSub}>
                      {preset.district} • {preset.ward} — {preset.address}
                    </Text>
                  </View>
                  <Text style={styles.presetCoords}>
                    {preset.latitude.toFixed(2)}, {preset.longitude.toFixed(2)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Footer CTA */}
          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>
                {language === 'sw' ? 'Ghairi' : 'Cancel'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
              <Ionicons name="checkmark-circle" size={18} color={colors.onPrimary} />
              <Text style={styles.confirmBtnText}>
                {language === 'sw' ? 'Thibitisha Eneo Hili' : 'Confirm Location'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: Spacing.md,
    },
    modalContainer: {
      backgroundColor: colors.card,
      width: '100%',
      maxWidth: 620,
      maxHeight: '90%',
      borderRadius: Radii.xl,
      overflow: 'hidden',
      ...Shadows.lg,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      padding: Spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    modalSubtitle: {
      fontSize: 11.5,
      color: colors.textSecondary,
      marginTop: 2,
    },
    closeBtn: {
      padding: 4,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.appBackground,
      marginHorizontal: Spacing.lg,
      marginTop: Spacing.md,
      paddingHorizontal: 12,
      height: 44,
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchInput: {
      flex: 1,
      fontSize: 13,
      color: colors.textPrimary,
    },
    pinPreviewCard: {
      marginHorizontal: Spacing.lg,
      marginTop: Spacing.md,
      padding: Spacing.md,
      backgroundColor: colors.successSoft,
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderColor: '#1d6637',
      gap: 10,
    },
    pinHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    pinIconWrap: {
      width: 40,
      height: 40,
      borderRadius: Radii.full,
      backgroundColor: '#ffffff',
      justifyContent: 'center',
      alignItems: 'center',
    },
    pinTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: '#1d6637',
    },
    pinAddress: {
      fontSize: 11.5,
      color: colors.textSecondary,
      marginTop: 1,
    },
    pinTag: {
      backgroundColor: '#ffffff',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: Radii.full,
      borderWidth: 1,
      borderColor: '#1d6637',
    },
    pinTagText: {
      fontSize: 10,
      fontWeight: '700',
      color: '#1d6637',
    },
    pinDetailsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      borderTopWidth: 1,
      borderTopColor: 'rgba(29, 102, 55, 0.2)',
      paddingTop: 8,
    },
    pinDetailItem: {
      gap: 2,
    },
    pinDetailLabel: {
      fontSize: 10.5,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    pinDetailValue: {
      fontSize: 11.5,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    presetsList: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      gap: 8,
    },
    listSectionTitle: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    presetItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 10,
      borderRadius: Radii.md,
      backgroundColor: colors.appBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    presetItemSelected: {
      borderColor: '#1d6637',
      backgroundColor: colors.successSoft,
    },
    presetName: {
      fontSize: 12.5,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    presetNameSelected: {
      color: '#1d6637',
    },
    presetSub: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 1,
    },
    presetCoords: {
      fontSize: 10,
      fontFamily: 'monospace',
      color: colors.textMuted,
    },
    modalFooter: {
      flexDirection: 'row',
      gap: 10,
      padding: Spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.card,
    },
    cancelBtn: {
      paddingVertical: 12,
      paddingHorizontal: 18,
      borderRadius: Radii.lg,
      backgroundColor: colors.surfaceInteractive,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    confirmBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 12,
      borderRadius: Radii.lg,
      backgroundColor: '#1d6637',
    },
    confirmBtnText: {
      fontSize: 13.5,
      fontWeight: '800',
      color: colors.onPrimary,
    },
  });
