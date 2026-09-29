import React, { useState, useEffect, useCallback } from 'react';
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
import { RestaurantRepository } from '../../repositories';
import { RestaurantLaunchReadiness } from '../../types/domain';
import { RestaurantPayoutVerificationPanel } from './RestaurantPayoutVerificationPanel';

import { useTheme } from '../../context/ThemeContext';

import { ThemeColors, lightColors } from '../../theme/palettes';
let colors: ThemeColors = lightColors;

interface RestaurantDetailAdminProps {
  restaurant: RestaurantEntity | null;
  visible: boolean;
  onClose: () => void;
  onSuspend: (restaurantId: string, reason: string) => Promise<void>;
  onReactivate: (restaurantId: string) => Promise<void>;
  onDelete?: (restaurantId: string) => Promise<void>;
  onArchive?: (restaurantId: string, reason: string) => Promise<void>;
  onUnarchive?: (restaurantId: string) => Promise<void>;
  onApproveLaunch?: (restaurantId: string) => Promise<void>;
  onRequestLaunchCorrections?: (restaurantId: string, reason: string) => Promise<void>;
  language?: 'en' | 'sw';
}

export const RestaurantDetailAdmin: React.FC<RestaurantDetailAdminProps> = ({
  restaurant,
  visible,
  onClose,
  onSuspend,
  onReactivate,
  onDelete,
  onArchive,
  onUnarchive,
  onApproveLaunch,
  onRequestLaunchCorrections,
  language = 'en',
}) => {
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);
  const [isProcessing, setIsProcessing] = useState(false);
  const [suspendMode, setSuspendMode] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [archiveMode, setArchiveMode] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');
  const [correctionsMode, setCorrectionsMode] = useState(false);
  const [correctionsReason, setCorrectionsReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<RestaurantLaunchReadiness | null>(null);
  const [isLoadingReadiness, setIsLoadingReadiness] = useState(false);

  const fetchReadiness = useCallback(async () => {
    if (!restaurant?.id) return;
    setIsLoadingReadiness(true);
    try {
      const res = await RestaurantRepository.getLaunchReadiness(restaurant.id);
      setReadiness(res);
    } catch {
      setReadiness(null);
    } finally {
      setIsLoadingReadiness(false);
    }
  }, [restaurant?.id]);

  useEffect(() => {
    if (visible && restaurant?.id) {
      fetchReadiness();
    } else {
      setReadiness(null);
    }
  }, [visible, restaurant?.id, fetchReadiness]);

  if (!restaurant) return null;

  const handleModalClose = () => {
    if (isProcessing) return;
    setSuspendMode(false);
    setArchiveMode(false);
    setCorrectionsMode(false);
    setCorrectionsReason('');
    setActionError(null);
    onClose();
  };

  const handleApproveLaunch = async () => {
    if (!onApproveLaunch) return;
    setIsProcessing(true);
    setActionError(null);
    try {
      await onApproveLaunch(restaurant.id);
      onClose();
    } catch (err: any) {
      setActionError(err?.message || 'Failed to approve launch.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmCorrections = async () => {
    if (!onRequestLaunchCorrections) return;
    if (!correctionsReason.trim()) {
      Alert.alert('Reason Required', 'Please specify what corrections the merchant must make.');
      return;
    }
    setIsProcessing(true);
    setActionError(null);
    try {
      await onRequestLaunchCorrections(restaurant.id, correctionsReason.trim());
      setCorrectionsMode(false);
      setCorrectionsReason('');
      onClose();
    } catch (err: any) {
      setActionError(err?.message || 'Failed to request corrections.');
    } finally {
      setIsProcessing(false);
    }
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
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Status Pills */}
            <View style={styles.badgeRow}>
              {isArchived ? (
                <View style={[styles.pill, { backgroundColor: colors.dangerSoft }]}>
                  <Ionicons name="archive" size={12} color="#b91c1c" />
                  <Text style={[styles.pillText, { color: colors.danger }]}>ARCHIVED</Text>
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
              <View style={[styles.cardSection, { backgroundColor: colors.dangerSoft, borderColor: colors.danger }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="archive" size={16} color={colors.danger} />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.danger }}>Archived Restaurant</Text>
                </View>
                <Text style={{ fontSize: 12, color: colors.textPrimary, marginTop: 2 }}>
                  Reason: {(restaurant as any).archiveReason || (restaurant as any).archive_reason || 'Archived by platform operator'}
                </Text>
                {((restaurant as any).archivedAt || (restaurant as any).archived_at) && (
                  <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                    Archived at: {new Date((restaurant as any).archivedAt || (restaurant as any).archived_at).toLocaleString()}
                  </Text>
                )}
              </View>
            )}

            {/* Gate B Store Launch Review Card */}
            {(restaurant.launchStatus || (restaurant as any).launch_status) && (
              <View style={[styles.cardSection, { borderColor: '#1d6637', backgroundColor: colors.successSoft }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="rocket-outline" size={18} color="#1d6637" />
                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#1d6637' }}>
                      Gate B Store Launch Status
                    </Text>
                  </View>
                  <View style={[styles.pill, { backgroundColor: colors.surface, borderColor: '#1d6637', borderWidth: 1 }]}>
                    <Text style={[styles.pillText, { color: '#1d6637', fontWeight: '800' }]}>
                      {restaurant.launchStatus || (restaurant as any).launch_status || 'SETUP_REQUIRED'}
                    </Text>
                  </View>
                </View>

                {/* Payout Destination Verification Panel inside Gate B area */}
                <RestaurantPayoutVerificationPanel
                  restaurantId={restaurant.id}
                  onStatusChanged={fetchReadiness}
                />

                {/* Authoritative Server Launch Readiness Checklist */}
                <View style={{ backgroundColor: colors.card, padding: 12, borderRadius: Radii.md, borderWidth: 1, borderColor: colors.border, gap: 8, marginTop: 8 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 12.5, fontWeight: '800', color: colors.textPrimary }}>
                      STORE LAUNCH READINESS CHECKLIST
                    </Text>
                    {isLoadingReadiness ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : readiness ? (
                      <Text style={{ fontSize: 12, fontWeight: '800', color: readiness.canSubmitForReview ? colors.success : colors.warning }}>
                        Readiness: {readiness.readinessPercent}%
                      </Text>
                    ) : null}
                  </View>

                  {readiness ? (
                    <View style={{ gap: 5 }}>
                      {[
                        { label: 'Business documents', met: readiness.businessVerified ?? readiness.criteria?.hasVerificationDoc },
                        { label: 'Active branch', met: readiness.hasActiveBranch ?? readiness.criteria?.hasActiveBranch },
                        { label: 'Exact location', met: readiness.branchHasCoordinates ?? readiness.criteria?.hasAddress },
                        { label: 'Opening hours', met: readiness.hasOpeningHours ?? readiness.criteria?.hasOperatingHours },
                        { label: 'Storefront image', met: readiness.hasStorefrontImage ?? readiness.criteria?.hasGalleryPhotos },
                        { label: 'Verified owner phone', met: readiness.hasVerifiedContact ?? readiness.criteria?.hasPhone },
                        { label: 'Menu', met: readiness.hasMenu ?? (readiness.criteria?.hasValidMenuItem && readiness.criteria?.hasPricedItem) },
                        { label: 'Payout destination', met: readiness.hasPayoutDestination ?? readiness.criteria?.hasPayoutConfigured },
                        { label: 'Delivery configuration', met: readiness.deliveryConfigured ?? readiness.criteria?.hasAddress },
                      ].map((item, idx) => (
                        <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 2 }}>
                          <Text style={{ fontSize: 12, color: colors.textPrimary }}>{item.label}</Text>
                          <Text style={{ fontSize: 12, fontWeight: '800', color: item.met ? '#16a34a' : '#ef4444' }}>
                            {item.met ? '✓' : '✕'}
                          </Text>
                        </View>
                      ))}

                      {readiness.blockers && readiness.blockers.length > 0 && (
                        <View style={{ backgroundColor: colors.dangerSoft, padding: 8, borderRadius: Radii.sm, marginTop: 4, gap: 2 }}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.danger }}>
                            Launch Blockers:
                          </Text>
                          {readiness.blockers.map((b, idx) => (
                            <Text key={idx} style={{ fontSize: 10.5, color: colors.danger }}>• {b}</Text>
                          ))}
                        </View>
                      )}
                    </View>
                  ) : (
                    <Text style={{ fontSize: 11, color: colors.textSecondary, fontStyle: 'italic' }}>
                      {isLoadingReadiness ? 'Evaluating 12 launch readiness criteria...' : 'Unable to retrieve server readiness report.'}
                    </Text>
                  )}
                </View>

                {(restaurant.launchStatus === 'GO_LIVE_REVIEW' || (restaurant as any).launch_status === 'GO_LIVE_REVIEW') && !correctionsMode && (
                  <View style={{ marginTop: 8, gap: 6 }}>
                    <Text style={{ fontSize: 12, color: colors.textPrimary, lineHeight: 16 }}>
                      This vendor has submitted their store setup for Administrator Gate B Launch Approval. Approval requires AAL2 MFA clearance and will publish the store to Dar es Salaam diners.
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                      {onRequestLaunchCorrections && (
                        <TouchableOpacity
                          style={{
                            flex: 1,
                            paddingVertical: 10,
                            borderRadius: Radii.md,
                            backgroundColor: colors.card,
                            borderWidth: 1,
                            borderColor: colors.border,
                            alignItems: 'center',
                          }}
                          onPress={() => setCorrectionsMode(true)}
                          disabled={isProcessing}
                        >
                          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                            Request Corrections
                          </Text>
                        </TouchableOpacity>
                      )}
                      {onApproveLaunch && (
                        <TouchableOpacity
                          style={[
                            {
                              flex: 1.5,
                              paddingVertical: 10,
                              borderRadius: Radii.md,
                              backgroundColor: '#1d6637',
                              flexDirection: 'row',
                              justifyContent: 'center',
                              alignItems: 'center',
                              gap: 6,
                            },
                            (!readiness?.canSubmitForReview || isProcessing) && {
                              opacity: 0.5,
                              backgroundColor: colors.textMuted,
                            },
                          ]}
                          onPress={handleApproveLaunch}
                          disabled={isProcessing || readiness?.canSubmitForReview !== true}
                        >
                          {isProcessing ? (
                            <ActivityIndicator size="small" color={colors.onPrimary} />
                          ) : (
                            <>
                              <Ionicons name="checkmark-done-circle" size={16} color={colors.onPrimary} />
                              <Text style={{ fontSize: 12, fontWeight: '800', color: colors.onPrimary }}>
                                Approve Launch (Gate B)
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}

                {correctionsMode && (
                  <View style={{ marginTop: 8, gap: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                      Instructions / Corrections Required:
                    </Text>
                    <TextInput
                      style={[styles.textInput, { backgroundColor: colors.card }]}
                      placeholder="e.g. Please update branch operating hours and add high-res photos..."
                      value={correctionsReason}
                      onChangeText={setCorrectionsReason}
                      multiline
                      numberOfLines={3}
                    />
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                      <TouchableOpacity
                        style={[styles.promptCancelBtn, { paddingVertical: 8, paddingHorizontal: 14 }]}
                        onPress={() => setCorrectionsMode(false)}
                        disabled={isProcessing}
                      >
                        <Text style={styles.promptCancelText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.promptDeleteConfirmBtn, { backgroundColor: '#ea580c', paddingVertical: 8, paddingHorizontal: 14 }]}
                        onPress={handleConfirmCorrections}
                        disabled={isProcessing}
                      >
                        <Text style={styles.promptConfirmText}>Send Corrections</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
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
                      <ActivityIndicator size="small" color={colors.onPrimary} />
                    ) : (
                      <Text style={styles.promptConfirmText}>Confirm Suspension</Text>
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
                  <Text style={[styles.deletePromptTitle, { color: colors.primary }]}>Archive Restaurant?</Text>
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
                      <ActivityIndicator size="small" color={colors.onPrimary} />
                    ) : (
                      <>
                        <Ionicons name="archive-outline" size={14} color={colors.onPrimary} />
                        <Text style={styles.promptDeleteConfirmText}>Confirm Archive</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Action Footer */}
          {!suspendMode && !archiveMode && (
            <View style={styles.modalFooter}>
              {isArchived && onUnarchive && (
                <TouchableOpacity
                  style={styles.reactivateBtn}
                  onPress={handleConfirmUnarchive}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <ActivityIndicator size="small" color={colors.onPrimary} />
                  ) : (
                    <>
                      <Ionicons name="refresh-circle-outline" size={16} color={colors.onPrimary} />
                      <Text style={styles.reactivateBtnText}>Restore / Unarchive</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {!isArchived && (isSuspended ? (
                <TouchableOpacity
                  style={styles.reactivateBtn}
                  onPress={handleConfirmReactivate}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <ActivityIndicator size="small" color={colors.onPrimary} />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={16} color={colors.onPrimary} />
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
                  style={[styles.deleteBtn, { backgroundColor: colors.primarySoft, borderColor: colors.warning }]}
                  onPress={() => {
                    setArchiveMode(true);
                    setSuspendMode(false);
                    setActionError(null);
                  }}
                  disabled={isProcessing}
                >
                  <Ionicons name="archive-outline" size={16} color="#ea580c" />
                  <Text style={[styles.deleteBtnText, { color: colors.primary }]}>Archive</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  modalContainer: {
    backgroundColor: colors.card,
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
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: Radii.full,
    backgroundColor: colors.surfaceInteractive,
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
    backgroundColor: colors.successSoft,
  },
  pillSuspended: {
    backgroundColor: colors.dangerSoft,
  },
  pillVerified: {
    backgroundColor: colors.successSoft,
  },
  pillBasic: {
    backgroundColor: colors.infoSoft,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: colors.textPrimary,
  },
  cardSection: {
    backgroundColor: colors.appBackground,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: Spacing.xs,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textSecondary,
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
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    maxWidth: '60%',
    textAlign: 'right',
  },
  suspendedAlertCard: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
  },
  suspendedAlertTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.danger,
  },
  suspendedAlertText: {
    fontSize: 13,
    color: colors.textPrimary,
    marginTop: 2,
  },
  inputPromptBox: {
    backgroundColor: colors.primarySoft,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: colors.warning,
    gap: Spacing.sm,
  },
  promptTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  textInput: {
    backgroundColor: colors.card,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: colors.warning,
    padding: Spacing.sm,
    fontSize: 13,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  singleTextInput: {
    backgroundColor: colors.card,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: colors.warning,
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
    color: colors.textSecondary,
    fontWeight: '600',
  },
  promptSuspendConfirmBtn: {
    backgroundColor: '#ef4444',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radii.md,
  },
  promptConfirmText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: Spacing.sm,
  },
  suspendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: Radii.md,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  suspendBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.danger,
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
    color: colors.onPrimary,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: Radii.md,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  deleteBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.danger,
  },
  deletePromptBox: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
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
    color: colors.danger,
  },
  deletePromptSubtitle: {
    fontSize: 13,
    color: colors.danger,
    lineHeight: 18,
    marginBottom: 12,
  },
  inlineErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.dangerSoft,
    padding: 8,
    borderRadius: Radii.sm,
    marginBottom: 10,
  },
  inlineErrorText: {
    fontSize: 12,
    color: colors.danger,
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
    color: colors.onPrimary,
  },
});
let styles = createStyles(lightColors);
