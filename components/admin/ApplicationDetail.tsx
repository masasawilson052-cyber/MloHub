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
import { RestaurantApplicationEntity } from '../../db/types';

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
  const [isProcessing, setIsProcessing] = useState(false);
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [requestMode, setRequestMode] = useState(false);
  const [changeNote, setChangeNote] = useState('');

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
              <Ionicons name="close" size={22} color="#64748b" />
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
                      <ActivityIndicator size="small" color="#ffffff" />
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
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.promptConfirmText}>Send Instructions</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Action Footer */}
          {application.status === 'PENDING' && !rejectMode && !requestMode && (
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
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color="#ffffff" />
                    <Text style={styles.approveBtnText}>Approve & Activate</Text>
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
    backgroundColor: '#ffedd5',
  },
  statusApproved: {
    backgroundColor: '#dcfce7',
  },
  statusRejected: {
    backgroundColor: '#fee2e2',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: '#0f172a',
  },
  tierPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tierPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
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
    maxWidth: '65%',
    textAlign: 'right',
  },
  notesText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
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
    color: '#64748b',
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
  rejectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: '#fca5a5',
    backgroundColor: '#fef2f2',
  },
  rejectBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ef4444',
  },
  requestChangesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: '#bae6fd',
    backgroundColor: '#f0f9ff',
  },
  requestChangesText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0284c7',
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
    color: '#ffffff',
  },
});
