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
  onDelete?: (restaurantId: string) => Promise<void>;
  onArchive?: (restaurantId: string, reason: string) => Promise<void>;
  onUnarchive?: (restaurantId: string) => Promise<void>;
  language?: 'en' | 'sw';
}

export const RestaurantDetailAdmin: React.FC<RestaurantDetailAdminProps> = ({
  restaurant,
  visible,
  onClose,
  onSuspend,
  onReactivate,
  onUpgradeToVerified,
  onDelete,
  onArchive,
  onUnarchive,
  language = 'en',
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [suspendMode, setSuspendMode] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [upgradeMode, setUpgradeMode] = useState(false);
  const [tinNumber, setTinNumber] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [archiveMode, setArchiveMode] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  if (!restaurant) return null;

  const handleModalClose = () => {
    if (isProcessing) return;
    setSuspendMode(false);
    setUpgradeMode(false);
    setArchiveMode(false);
    setActionError(null);
    onClose();
  };

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

  const handleConfirmArchive = async () => {
    if (!onArchive) return;
    if (!archiveReason.trim()) {
      Alert.alert('Reason Required', 'Please enter a clear reason for archiving this vendor.');
      return;
    }
    setIsProcessing(true);
    setActionError(null);
    try {
      await onArchive(restaurant.id, archiveReason.trim());
      setArchiveMode(false);
      setArchiveReason('');
      onClose();
    } catch (err: any) {
      setActionError(err.message || 'Failed to archive restaurant.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmUnarchive = async () => {
    if (!onUnarchive) return;
    setIsProcessing(true);
    setActionError(null);
    try {
      await onUnarchive(restaurant.id);
      onClose();
    } catch (err: any) {
      Alert.alert('Restore Error', err.message || 'Failed to restore restaurant.');
    } finally {
      setIsProcessing(false);
    }
  };

  const isArchived = !!((restaurant as any).archivedAt || (restaurant as any).archived_at);
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
            <TouchableOpacity style={styles.closeBtn} onPress={handleModalClose} disabled={isProcessing}>
              <Ionicons name="close" size={22} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Status Pills */}
            <View style={styles.badgeRow}>
              {isArchived ? (
                <View style={[styles.pill, { backgroundColor: '#fee2e2' }]}>
                  <Ionicons name="archive" size={12} color="#b91c1c" />
                  <Text style={[styles.pillText, { color: '#b91c1c' }]}>ARCHIVED</Text>
                </View>
              ) : (
                <View style={[styles.pill, isSuspended ? styles.pillSuspended : styles.pillActive]}>
                  <Text style={styles.pillText}>{isSuspended ? 'SUSPENDED' : 'ACTIVE'}</Text>
                </View>
              )}
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

            {/* Archive Warning Notice */}
            {isArchived && (
              <View style={[styles.cardSection, { backgroundColor: '#fff1f2', borderColor: '#fecdd3' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="archive" size={16} color="#be123c" />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#be123c' }}>Archived Restaurant</Text>
                </View>
                <Text style={{ fontSize: 12, color: '#9f1239', marginTop: 2 }}>
                  Reason: {(restaurant as any).archiveReason || (restaurant as any).archive_reason || 'Archived by platform operator'}
                </Text>
                {((restaurant as any).archivedAt || (restaurant as any).archived_at) && (
                  <Text style={{ fontSize: 11, color: '#e11d48', marginTop: 2 }}>
                    Archived at: {new Date((restaurant as any).archivedAt || (restaurant as any).archived_at).toLocaleString()}
                  </Text>
                )}
              </View>
            )}

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

            {/* Archive Confirmation Form */}
            {archiveMode && (
              <View style={[styles.inputPromptBox, styles.deletePromptBox]}>
                <View style={styles.deletePromptHeader}>
                  <Ionicons name="archive" size={20} color="#ea580c" />
                  <Text style={[styles.deletePromptTitle, { color: '#c2410c' }]}>Archive Restaurant?</Text>
                </View>
                <Text style={styles.deletePromptSubtitle}>
                  Archiving <Text style={{ fontWeight: '700' }}>"{restaurant.name}"</Text> safely unpublishes and hides it from public discovery while preserving historical order logs, payments, and ratings.
                </Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Reason for archiving (e.g. permanently closed, duplicate entry, owner requested removal)..."
                  value={archiveReason}
                  onChangeText={setArchiveReason}
                  multiline
                />
                {actionError && (
                  <View style={styles.inlineErrorBox}>
                    <Ionicons name="alert-circle" size={16} color="#dc2626" />
                    <Text style={styles.inlineErrorText}>{actionError}</Text>
                  </View>
                )}
                <View style={styles.promptBtnRow}>
                  <TouchableOpacity
                    style={styles.promptCancelBtn}
                    onPress={() => {
                      setArchiveMode(false);
                      setActionError(null);
                    }}
                    disabled={isProcessing}
                  >
                    <Text style={styles.promptCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.promptDeleteConfirmBtn, { backgroundColor: '#ea580c' }]}
                    onPress={handleConfirmArchive}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <>
                        <Ionicons name="archive-outline" size={14} color="#ffffff" />
                        <Text style={styles.promptDeleteConfirmText}>Confirm Archive</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Action Footer */}
          {!suspendMode && !upgradeMode && !archiveMode && (
            <View style={styles.modalFooter}>
              {isArchived && onUnarchive && (
                <TouchableOpacity
                  style={styles.reactivateBtn}
                  onPress={handleConfirmUnarchive}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Ionicons name="refresh-circle-outline" size={16} color="#ffffff" />
                      <Text style={styles.reactivateBtnText}>Restore / Unarchive</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {!isArchived && !isVerified && onUpgradeToVerified && !isSuspended && (
                <TouchableOpacity
                  style={styles.upgradeBtn}
                  onPress={() => setUpgradeMode(true)}
                  disabled={isProcessing}
                >
                  <Ionicons name="shield-checkmark" size={16} color="#0284c7" />
                  <Text style={styles.upgradeBtnText}>Upgrade to Verified</Text>
                </TouchableOpacity>
              )}

              {!isArchived && (isSuspended ? (
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
              ))}

              {!isArchived && onArchive && (
                <TouchableOpacity
                  style={[styles.deleteBtn, { backgroundColor: '#fff7ed', borderColor: '#fed7aa' }]}
                  onPress={() => {
                    setArchiveMode(true);
                    setSuspendMode(false);
                    setUpgradeMode(false);
                    setActionError(null);
                  }}
                  disabled={isProcessing}
                >
                  <Ionicons name="archive-outline" size={16} color="#ea580c" />
                  <Text style={[styles.deleteBtnText, { color: '#ea580c' }]}>Archive</Text>
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
  deleteBtn: {
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
  deleteBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#dc2626',
  },
  deletePromptBox: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
  },
  deletePromptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  deletePromptTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#991b1b',
  },
  deletePromptSubtitle: {
    fontSize: 13,
    color: '#7f1d1d',
    lineHeight: 18,
    marginBottom: 12,
  },
  inlineErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fee2e2',
    padding: 8,
    borderRadius: Radii.sm,
    marginBottom: 10,
  },
  inlineErrorText: {
    fontSize: 12,
    color: '#dc2626',
    flex: 1,
  },
  promptDeleteConfirmBtn: {
    backgroundColor: '#dc2626',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  promptDeleteConfirmText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});
