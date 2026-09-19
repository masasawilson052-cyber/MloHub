import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';
import { RestaurantEntity } from '../../db/types';

interface RestaurantDetailAdminProps {
  restaurant: RestaurantEntity | null;
  visible: boolean;
  onClose: () => void;
  onSuspend: (restaurantId: string, reason: string) => Promise<void>;
  onReactivate: (restaurantId: string) => Promise<void>;
  onUpgradeToVerified?: (
    restaurantId: string,
    docs: { tinNumber: string; businessLicenseNumber: string }
  ) => Promise<void>;
  language?: 'en' | 'sw';
}

export const RestaurantDetailAdmin: React.FC<RestaurantDetailAdminProps> = ({
  restaurant,
  visible,
  onClose,
  onSuspend,
  onReactivate,
  onUpgradeToVerified,
  language = 'en',
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [suspendMode, setSuspendMode] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [upgradeMode, setUpgradeMode] = useState(false);
  const [tinNumber, setTinNumber] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');

  if (!restaurant) return null;

  const handleConfirmSuspend = async () => {
    if (!suspendReason.trim()) {
      Alert.alert('Reason Required', 'Please enter a clear reason for suspending this vendor.');
      return;
    }
    setIsProcessing(true);
    try {
      await onSuspend(restaurant.id, suspendReason.trim());
      setSuspendMode(false);
      setSuspendReason('');
      onClose();
    } catch (err: any) {
      Alert.alert('Suspension Error', err.message || 'Failed to suspend restaurant.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmReactivate = async () => {
    setIsProcessing(true);
    try {
      await onReactivate(restaurant.id);
      onClose();
    } catch (err: any) {
      Alert.alert('Reactivation Error', err.message || 'Failed to reactivate restaurant.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmUpgrade = async () => {
    if (!tinNumber.trim() || !licenseNumber.trim()) {
      Alert.alert('Documents Required', 'Please provide both TIN number and Business License number.');
      return;
    }
    if (!onUpgradeToVerified) return;

    setIsProcessing(true);
    try {
      await onUpgradeToVerified(restaurant.id, {
        tinNumber: tinNumber.trim(),
        businessLicenseNumber: licenseNumber.trim(),
      });
      setUpgradeMode(false);
      setTinNumber('');
      setLicenseNumber('');
      onClose();
    } catch (err: any) {
      Alert.alert('Upgrade Error', err.message || 'Failed to upgrade to verified tier.');
    } finally {
      setIsProcessing(false);
    }
  };

  const isSuspended = !!restaurant.isSuspended || restaurant.verificationStatus === 'SUSPENDED';
  const isVerified = restaurant.sellerTier === 'VERIFIED_RESTAURANT' || restaurant.sellerTier === 'VERIFIED_SELLER';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>{restaurant.name}</Text>
              <Text style={styles.modalSubtitle}>
                ID: {restaurant.id} • {restaurant.neighborhood}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} disabled={isProcessing}>
              <Ionicons name="close" size={22} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Status Pills */}
            <View style={styles.badgeRow}>
              <View style={[styles.pill, isSuspended ? styles.pillSuspended : styles.pillActive]}>
                <Text style={styles.pillText}>{isSuspended ? 'SUSPENDED' : 'ACTIVE'}</Text>
              </View>
              <View style={[styles.pill, isVerified ? styles.pillVerified : styles.pillBasic]}>
                <Ionicons
                  name={isVerified ? 'shield-checkmark' : 'storefront-outline'}
                  size={12}
                  color={isVerified ? '#047857' : '#0369a1'}
                />
                <Text style={styles.pillText}>
                  {isVerified ? 'VERIFIED SELLER' : 'BASIC INFORMAL SELLER'}
                </Text>
              </View>
            </View>

            {/* Business Info */}
            <View style={styles.cardSection}>
              <Text style={styles.sectionHeader}>Business Profile</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Cuisine / Specialty:</Text>
                <Text style={styles.infoValue}>{restaurant.cuisine} • {restaurant.specialty}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Address:</Text>
                <Text style={styles.infoValue}>{restaurant.address}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Hours:</Text>
                <Text style={styles.infoValue}>{restaurant.openingHours || '07:00 AM'} - {restaurant.closingHours || '10:00 PM'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Rating / Reviews:</Text>
                <Text style={styles.infoValue}>⭐ {restaurant.rating} ({restaurant.reviewsCount || 0} reviews)</Text>
              </View>
            </View>

            {/* Owner & Payout Details */}
            <View style={styles.cardSection}>
              <Text style={styles.sectionHeader}>Owner & Payout Configuration</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Owner Name:</Text>
                <Text style={styles.infoValue}>{restaurant.ownerName || 'Not recorded'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Owner Phone:</Text>
                <Text style={styles.infoValue}>{restaurant.ownerPhone || restaurant.phone || 'Not recorded'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Payout Phone / Provider:</Text>
                <Text style={styles.infoValue}>{restaurant.payoutPhoneNumber || restaurant.phone || '-'} ({restaurant.payoutProvider || 'M-Pesa'})</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>TIN / License:</Text>
                <Text style={styles.infoValue}>{restaurant.tinNumber || 'No TIN provided'}</Text>
              </View>
            </View>

            {/* Suspension Reason (if suspended) */}
            {isSuspended && restaurant.suspensionReason && (
              <View style={[styles.cardSection, styles.suspendedAlertCard]}>
                <Text style={styles.suspendedAlertTitle}>Suspension Reason:</Text>
                <Text style={styles.suspendedAlertText}>{restaurant.suspensionReason}</Text>
              </View>
            )}

            {/* Suspend Input Form */}
            {suspendMode && (
              <View style={styles.inputPromptBox}>
                <Text style={styles.promptTitle}>Mandatory Reason for Suspension:</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Terms violation, health inspection report, customer fraud..."
                  value={suspendReason}
                  onChangeText={setSuspendReason}
                  multiline
                  numberOfLines={3}
                />
                <View style={styles.promptBtnRow}>
                  <TouchableOpacity
                    style={styles.promptCancelBtn}
                    onPress={() => setSuspendMode(false)}
                    disabled={isProcessing}
                  >
                    <Text style={styles.promptCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.promptSuspendConfirmBtn}
                    onPress={handleConfirmSuspend}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.promptConfirmText}>Confirm Suspension</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Upgrade Input Form */}
            {upgradeMode && (
              <View style={styles.inputPromptBox}>
                <Text style={styles.promptTitle}>Enter Official Tax & Business Credentials:</Text>
                <TextInput
                  style={styles.singleTextInput}
                  placeholder="TIN Number (e.g. 134-889-201)"
                  value={tinNumber}
                  onChangeText={setTinNumber}
                />
                <TextInput
                  style={styles.singleTextInput}
                  placeholder="Business License (e.g. BL-TZ-2026-8819)"
                  value={licenseNumber}
                  onChangeText={setLicenseNumber}
                />
                <View style={styles.promptBtnRow}>
                  <TouchableOpacity
                    style={styles.promptCancelBtn}
                    onPress={() => setUpgradeMode(false)}
                    disabled={isProcessing}
                  >
                    <Text style={styles.promptCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.promptUpgradeConfirmBtn}
                    onPress={handleConfirmUpgrade}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.promptConfirmText}>Verify & Upgrade</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Action Footer */}
          {!suspendMode && !upgradeMode && (
            <View style={styles.modalFooter}>
              {!isVerified && onUpgradeToVerified && !isSuspended && (
                <TouchableOpacity
                  style={styles.upgradeBtn}
                  onPress={() => setUpgradeMode(true)}
                  disabled={isProcessing}
                >
                  <Ionicons name="shield-checkmark" size={16} color="#0284c7" />
                  <Text style={styles.upgradeBtnText}>Upgrade to Verified</Text>
                </TouchableOpacity>
              )}

              {isSuspended ? (
                <TouchableOpacity
                  style={styles.reactivateBtn}
                  onPress={handleConfirmReactivate}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={16} color="#ffffff" />
                      <Text style={styles.reactivateBtnText}>Reactivate Restaurant</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.suspendBtn}
                  onPress={() => setSuspendMode(true)}
                  disabled={isProcessing}
                >
                  <Ionicons name="ban-outline" size={16} color="#ef4444" />
                  <Text style={styles.suspendBtnText}>Suspend Restaurant</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    width: '100%',
    maxWidth: 640,
    maxHeight: '90%',
    borderRadius: Radii.xl,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: Radii.full,
    backgroundColor: '#f1f5f9',
  },
  modalContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.full,
  },
  pillActive: {
    backgroundColor: '#dcfce7',
  },
  pillSuspended: {
    backgroundColor: '#fee2e2',
  },
  pillVerified: {
    backgroundColor: '#ecfdf5',
  },
  pillBasic: {
    backgroundColor: '#f0f9ff',
  },
  pillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: '#0f172a',
  },
  cardSection: {
    backgroundColor: '#f8fafc',
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: Spacing.xs,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  infoLabel: {
    fontSize: 13,
    color: '#64748b',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
    maxWidth: '60%',
    textAlign: 'right',
  },
  suspendedAlertCard: {
    backgroundColor: '#fff1f2',
    borderColor: '#fecdd3',
  },
  suspendedAlertTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#be123c',
  },
  suspendedAlertText: {
    fontSize: 13,
    color: '#9f1239',
    marginTop: 2,
  },
  inputPromptBox: {
    backgroundColor: '#fff7ed',
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#fed7aa',
    gap: Spacing.sm,
  },
  promptTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9a3412',
  },
  textInput: {
    backgroundColor: '#ffffff',
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: '#fed7aa',
    padding: Spacing.sm,
    fontSize: 13,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  singleTextInput: {
    backgroundColor: '#ffffff',
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    fontSize: 13,
  },
  promptBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
  },
  promptCancelBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
  },
  promptCancelText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  promptSuspendConfirmBtn: {
    backgroundColor: '#ef4444',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radii.md,
  },
  promptUpgradeConfirmBtn: {
    backgroundColor: '#0284c7',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radii.md,
  },
  promptConfirmText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: Spacing.sm,
  },
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: Radii.md,
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  upgradeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0284c7',
  },
  suspendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: Radii.md,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  suspendBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ef4444',
  },
  reactivateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: Radii.md,
    backgroundColor: '#16a34a',
  },
  reactivateBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});
