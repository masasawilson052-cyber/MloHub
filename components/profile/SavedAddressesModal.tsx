import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radii } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { CustomerSavedAddress, ServiceArea } from '../../types/domain';
import { CustomerAddressesRepository } from '../../repositories/customerAddresses.repository';
import { Button } from '../ui/Button';

import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

interface SavedAddressesModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectAddress?: (address: CustomerSavedAddress) => void;
}

export const SavedAddressesModal: React.FC<SavedAddressesModalProps> = ({
  visible,
  onClose,
  onSelectAddress,
}) => {
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<CustomerSavedAddress[]>([]);
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // New Address Form
  const [label, setLabel] = useState('Home');
  const [streetAddress, setStreetAddress] = useState('');
  const [areaName, setAreaName] = useState('Masaki');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [addrs, areas] = await Promise.all([
        CustomerAddressesRepository.list(user.id),
        CustomerAddressesRepository.listServiceAreas(),
      ]);
      setAddresses(addrs);
      setServiceAreas(areas);
      if (areas.length > 0 && !areaName) {
        setAreaName(areas[0].name);
      }
    } catch (err: any) {
      console.warn('Failed to load saved addresses:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible && user?.id) {
      loadData();
    }
  }, [visible, user?.id]);

  const handleCreate = async () => {
    if (!streetAddress.trim()) {
      Alert.alert('Address Required', 'Please enter your street address or landmark.');
      return;
    }
    if (!user?.id) return;

    setSaving(true);
    try {
      await CustomerAddressesRepository.create({
        customerId: user.id,
        label,
        streetAddress: streetAddress.trim(),
        areaName,
        deliveryInstructions: deliveryInstructions.trim() || undefined,
        isDefault,
      });
      setIsAddingNew(false);
      setStreetAddress('');
      setDeliveryInstructions('');
      await loadData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save address.');
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (addrId: string) => {
    if (!user?.id) return;
    try {
      await CustomerAddressesRepository.setDefault(addrId, user.id);
      await loadData();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const handleDelete = async (addrId: string) => {
    if (!user?.id) return;
    Alert.alert('Delete Address', 'Are you sure you want to remove this saved address?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await CustomerAddressesRepository.delete(addrId, user.id);
            await loadData();
          } catch (err: any) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Saved Delivery Addresses</Text>
              <Text style={styles.subtitle}>Dar es Salaam & active delivery zones</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {loading ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
            ) : isAddingNew ? (
              <View style={styles.formCard}>
                <Text style={styles.formTitle}>Add New Delivery Address</Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Label</Text>
                  <View style={styles.chipsRow}>
                    {['Home', 'Work', 'Other'].map((l) => (
                      <TouchableOpacity
                        key={l}
                        style={[styles.chip, label === l && styles.chipActive]}
                        onPress={() => setLabel(l)}
                      >
                        <Text style={[styles.chipText, label === l && styles.chipTextActive]}>{l}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Area / Ward</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                    {serviceAreas.map((area) => (
                      <TouchableOpacity
                        key={area.id}
                        style={[styles.chip, areaName === area.name && styles.chipActive]}
                        onPress={() => setAreaName(area.name)}
                      >
                        <Text style={[styles.chipText, areaName === area.name && styles.chipTextActive]}>
                          {area.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Street Address / House / Landmark</Text>
                  <TextInput
                    style={styles.input}
                    value={streetAddress}
                    onChangeText={setStreetAddress}
                    placeholder="e.g. Haile Selassie Rd, near Village Supermarket"
                    placeholderTextColor={colors.inputPlaceholder}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Delivery Instructions (Optional)</Text>
                  <TextInput
                    style={styles.input}
                    value={deliveryInstructions}
                    onChangeText={setDeliveryInstructions}
                    placeholder="e.g. Call upon arrival at gate"
                    placeholderTextColor={colors.inputPlaceholder}
                  />
                </View>

                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setIsDefault(!isDefault)}
                >
                  <Ionicons
                    name={isDefault ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={isDefault ? colors.primary : colors.textMuted}
                  />
                  <Text style={styles.checkboxText}>Set as default delivery address</Text>
                </TouchableOpacity>

                <View style={styles.formBtnRow}>
                  <Button
                    title="Cancel"
                    onPress={() => setIsAddingNew(false)}
                    variant="ghost"
                    size="md"
                    style={{ flex: 1, marginRight: 8 }}
                  />
                  <Button
                    title="Save Address"
                    onPress={handleCreate}
                    variant="primary"
                    size="md"
                    loading={saving}
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            ) : (
              <View>
                {addresses.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Ionicons name="location-outline" size={48} color={colors.textMuted} />
                    <Text style={styles.emptyTitle}>No saved addresses yet</Text>
                    <Text style={styles.emptySub}>Add your home or office address for fast 1-click checkout.</Text>
                  </View>
                ) : (
                  addresses.map((addr) => (
                    <TouchableOpacity
                      key={addr.id}
                      style={[styles.addrCard, addr.isDefault && styles.addrCardDefault]}
                      onPress={() => {
                        if (onSelectAddress) {
                          onSelectAddress(addr);
                          onClose();
                        }
                      }}
                    >
                      <View style={styles.addrHeader}>
                        <View style={styles.addrLabelRow}>
                          <Ionicons
                            name={addr.label === 'Work' ? 'briefcase-outline' : 'home-outline'}
                            size={18}
                            color={colors.primary}
                          />
                          <Text style={styles.addrLabel}>{addr.label}</Text>
                          {addr.isDefault && (
                            <View style={styles.defaultBadge}>
                              <Text style={styles.defaultBadgeText}>DEFAULT</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.addrActions}>
                          {!addr.isDefault && (
                            <TouchableOpacity
                              onPress={() => handleSetDefault(addr.id)}
                              style={styles.actionBtn}
                            >
                              <Text style={styles.actionBtnText}>Set Default</Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity
                            onPress={() => handleDelete(addr.id)}
                            style={styles.deleteBtn}
                          >
                            <Ionicons name="trash-outline" size={18} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      </View>

                      <Text style={styles.addrStreet}>{addr.streetAddress}</Text>
                      <Text style={styles.addrArea}>
                        {addr.areaName ? `${addr.areaName}, ` : ''}{addr.city}
                      </Text>
                      {addr.deliveryInstructions ? (
                        <Text style={styles.addrNotes}>Note: {addr.deliveryInstructions}</Text>
                      ) : null}
                    </TouchableOpacity>
                  ))
                )}

                <Button
                  title="+ Add New Address"
                  onPress={() => setIsAddingNew(true)}
                  variant="outline"
                  size="md"
                  fullWidth={true}
                  style={{ marginTop: Spacing.md }}
                />
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    maxHeight: '85%',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  scroll: {
    padding: Spacing.lg,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 12,
  },
  emptySub: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 260,
  },
  addrCard: {
    backgroundColor: colors.appBackground,
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addrCardDefault: {
    borderColor: colors.primary,
    backgroundColor: colors.successSoft,
  },
  addrHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  addrLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addrLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  defaultBadge: {
    backgroundColor: colors.successSoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.success,
  },
  addrActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  deleteBtn: {
    padding: 4,
  },
  addrStreet: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  addrArea: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  addrNotes: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: 4,
  },
  formCard: {
    backgroundColor: colors.card,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: Spacing.md,
  },
  inputGroup: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: colors.appBackground,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginRight: 6,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight || '#E8F5E9',
  },
  chipText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.lg,
  },
  checkboxText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  formBtnRow: {
    flexDirection: 'row',
  },
});
let styles = createStyles(lightColors);
