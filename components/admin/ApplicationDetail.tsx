import React, { useState, useEffect } from 'react';
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
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';
import { RestaurantApplicationEntity } from '../../db/types';
import { RestaurantVerificationDocument } from '../../types/domain';
import {
  listDocumentsForApplication,
  createTemporaryDocumentAccessUrl,
} from '../../services/MerchantVerificationService';

import { useTheme } from '../../context/ThemeContext';

import { ThemeColors, lightColors } from '../../theme/palettes';
let colors: ThemeColors = lightColors;

interface ApplicationDetailProps {
  application: RestaurantApplicationEntity | null;
  visible: boolean;
  onClose: () => void;
  onApprove: (appId: string) => Promise<void>;
  onReject: (appId: string, reason: string) => Promise<void>;
  onRequestChanges?: (appId: string, note: string) => Promise<void>;
  language?: 'en' | 'sw';
}

export const ApplicationDetail: React.FC<ApplicationDetailProps> = ({
  application,
  visible,
  onClose,
  onApprove,
  onReject,
  onRequestChanges,
  language = 'en',
}) => {
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);
  const [isProcessing, setIsProcessing] = useState(false);
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [requestMode, setRequestMode] = useState(false);
  const [changeNote, setChangeNote] = useState('');
  const [documents, setDocuments] = useState<RestaurantVerificationDocument[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);

  useEffect(() => {
    if (visible && application?.id) {
      setIsLoadingDocs(true);
      listDocumentsForApplication(application.id)
        .then(setDocuments)
        .catch(() => setDocuments([]))
        .finally(() => setIsLoadingDocs(false));
    } else {
      setDocuments([]);
    }
  }, [visible, application?.id]);

  const handleOpenDoc = async (storagePath: string) => {
    try {
      const url = await createTemporaryDocumentAccessUrl(storagePath, 900);
      await Linking.openURL(url);
    } catch (err: any) {
      Alert.alert('Document Error', err?.message || 'Failed to open document preview.');
    }
  };

  if (!application) return null;

  const handleApprove = async () => {
    setIsProcessing(true);
    try {
      await onApprove(application.id);
      onClose();
    } catch (err: any) {
      Alert.alert('Approval Error', err.message || 'Failed to approve application.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectReason.trim()) {
      Alert.alert('Missing Reason', 'Please provide a reason for rejecting this application.');
      return;
    }
    setIsProcessing(true);
    try {
      await onReject(application.id, rejectReason.trim());
      setRejectMode(false);
      setRejectReason('');
      onClose();
    } catch (err: any) {
      Alert.alert('Rejection Error', err.message || 'Failed to reject application.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmRequestChanges = async () => {
    if (!changeNote.trim()) {
      Alert.alert('Missing Note', 'Please provide instructions on what needs to be corrected.');
      return;
    }
    setIsProcessing(true);
    try {
      if (onRequestChanges) {
        await onRequestChanges(application.id, changeNote.trim());
      }
      setRequestMode(false);
      setChangeNote('');
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to submit request.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>{application.businessName}</Text>
              <Text style={styles.modalSubtitle}>
                Submitted {new Date(application.createdAt).toLocaleDateString()}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} disabled={isProcessing}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Status & Tier Banner */}
            <View style={styles.statusBanner}>
              <View style={styles.badgeRow}>
                <View
                  style={[
                    styles.statusPill,
                    application.status === 'APPROVED'
                      ? styles.statusApproved
                      : application.status === 'REJECTED'
                      ? styles.statusRejected
                      : styles.statusPending,
                  ]}
                >
                  <Text style={styles.statusPillText}>{application.status}</Text>
                </View>
                <View style={styles.tierPill}>
                  <Ionicons
                    name={application.hasTinOrLicense ? 'shield-checkmark' : 'storefront-outline'}
                    size={14}
                    color={application.hasTinOrLicense ? '#059669' : '#0284c7'}
                  />
                  <Text style={styles.tierPillText}>
                    {application.hasTinOrLicense ? 'Verified Tier Candidate' : 'Informal Seller Candidate'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Business Details Section */}
            <View style={styles.cardSection}>
              <Text style={styles.sectionHeader}>Business Information</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Cuisine Type:</Text>
                <Text style={styles.infoValue}>{application.cuisineType}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Neighborhood:</Text>
                <Text style={styles.infoValue}>{application.neighborhood}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Address / Location:</Text>
                <Text style={styles.infoValue}>{application.address}</Text>
              </View>
            </View>

            {/* Owner Details Section */}
            <View style={styles.cardSection}>
              <Text style={styles.sectionHeader}>Owner & Verification</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Owner Full Name:</Text>
                <Text style={styles.infoValue}>{application.ownerName}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Phone Number:</Text>
                <Text style={styles.infoValue}>{application.ownerPhone}</Text>
              </View>
              {application.ownerEmail && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Email Address:</Text>
                  <Text style={styles.infoValue}>{application.ownerEmail}</Text>
                </View>
              )}
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>TIN Document:</Text>
                <Text style={styles.infoValue}>
                  {application.tinNumber || (application.hasTinOrLicense ? 'TIN On File' : 'Not Provided (Informal Tier)')}
                </Text>
              </View>
            </View>

            {/* Notes Section */}
            {application.notes && (
              <View style={styles.cardSection}>
                <Text style={styles.sectionHeader}>Applicant / Reviewer Notes</Text>
                <Text style={styles.notesText}>{application.notes}</Text>
              </View>
            )}

            {/* Verification Documents (Private Storage) */}
            <View style={styles.cardSection}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.sectionHeader}>Verification Documents (Private)</Text>
                {isLoadingDocs && <ActivityIndicator size="small" color={colors.primary} />}
              </View>

              {documents.length === 0 ? (
                <Text style={{ fontSize: 12, color: colors.textSecondary, fontStyle: 'italic', marginTop: 4 }}>
                  No uploaded verification files attached to this application.
                </Text>
              ) : (
                <View style={{ gap: 8, marginTop: 6 }}>
                  {documents.map((doc) => (
                    <View
                      key={doc.id}
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: 8,
                        backgroundColor: colors.appBackground,
                        borderRadius: Radii.md,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                          {doc.documentType}
                        </Text>
                        <Text style={{ fontSize: 10.5, color: colors.textSecondary }}>
                          Status: {doc.verificationStatus} • {new Date(doc.createdAt).toLocaleDateString()}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                          paddingVertical: 5,
                          paddingHorizontal: 10,
                          backgroundColor: colors.primarySoft,
                          borderRadius: Radii.sm,
                        }}
                        onPress={() => handleOpenDoc(doc.storagePath)}
                      >
                        <Ionicons name="eye-outline" size={14} color={colors.primary} />
                        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>View</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Reject Form Input */}
            {rejectMode && (
              <View style={styles.inputPromptBox}>
                <Text style={styles.promptTitle}>State Rejection Reason:</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Incomplete address, invalid contact..."
                  value={rejectReason}
                  onChangeText={setRejectReason}
                  multiline
                  numberOfLines={3}
                />
                <View style={styles.promptBtnRow}>
                  <TouchableOpacity
                    style={styles.promptCancelBtn}
                    onPress={() => setRejectMode(false)}
                    disabled={isProcessing}
                  >
                    <Text style={styles.promptCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.promptRejectConfirmBtn}
                    onPress={handleConfirmReject}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <ActivityIndicator size="small" color={colors.onPrimary} />
                    ) : (
                      <Text style={styles.promptConfirmText}>Confirm Rejection</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Request Changes Form Input */}
            {requestMode && (
              <View style={styles.inputPromptBox}>
                <Text style={styles.promptTitle}>Notes for Applicant:</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Please re-upload clearer business license..."
                  value={changeNote}
                  onChangeText={setChangeNote}
                  multiline
                  numberOfLines={3}
                />
                <View style={styles.promptBtnRow}>
                  <TouchableOpacity
                    style={styles.promptCancelBtn}
                    onPress={() => setRequestMode(false)}
                    disabled={isProcessing}
                  >
                    <Text style={styles.promptCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.promptRequestConfirmBtn}
                    onPress={handleConfirmRequestChanges}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <ActivityIndicator size="small" color={colors.onPrimary} />
                    ) : (
                      <Text style={styles.promptConfirmText}>Send Instructions</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Action Footer (Gate A Approval) */}
          {(application.status === 'PENDING' ||
            application.status === 'SUBMITTED' ||
            application.status === 'UNDER_REVIEW' ||
            application.status === 'CHANGES_REQUESTED') &&
            !rejectMode &&
            !requestMode && (
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.rejectBtn}
                  onPress={() => setRejectMode(true)}
                  disabled={isProcessing}
                >
                  <Ionicons name="close-circle-outline" size={18} color="#ef4444" />
                  <Text style={styles.rejectBtnText}>Reject</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.requestChangesBtn}
                  onPress={() => setRequestMode(true)}
                  disabled={isProcessing}
                >
                  <Ionicons name="create-outline" size={18} color="#0284c7" />
                  <Text style={styles.requestChangesText}>Request Info</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.approveBtn}
                  onPress={handleApprove}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <ActivityIndicator size="small" color={colors.onPrimary} />
                  ) : (
                    <>
                      <Ionicons name="shield-checkmark" size={18} color={colors.onPrimary} />
                      <Text style={styles.approveBtnText}>Approve Merchant (Gate A)</Text>
                    </>
                  )}
                </TouchableOpacity>
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
  statusBanner: {
    marginBottom: Spacing.xs,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.full,
  },
  statusPending: {
    backgroundColor: colors.warningSoft,
  },
  statusApproved: {
    backgroundColor: colors.successSoft,
  },
  statusRejected: {
    backgroundColor: colors.dangerSoft,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: colors.textPrimary,
  },
  tierPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.appBackground,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tierPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
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
    maxWidth: '65%',
    textAlign: 'right',
  },
  notesText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
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
  promptBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
  },
  promptCancelBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radii.md,
  },
  promptCancelText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  promptRejectConfirmBtn: {
    backgroundColor: '#ef4444',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radii.md,
  },
  promptRequestConfirmBtn: {
    backgroundColor: '#0284c7',
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
  rejectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  rejectBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.danger,
  },
  requestChangesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: colors.info,
    backgroundColor: colors.infoSoft,
  },
  requestChangesText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.info,
  },
  approveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    borderRadius: Radii.md,
    backgroundColor: '#16a34a',
  },
  approveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.onPrimary,
  },
});
let styles = createStyles(lightColors);
