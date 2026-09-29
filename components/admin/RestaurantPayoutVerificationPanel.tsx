import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { PayoutsRepository } from '../../repositories/payouts.repository';
import { MerchantPayoutDestination } from '../../types/domain';
import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

interface RestaurantPayoutVerificationPanelProps {
  restaurantId: string;
  onStatusChanged?: () => void;
}

export const RestaurantPayoutVerificationPanel: React.FC<RestaurantPayoutVerificationPanelProps> = ({
  restaurantId,
  onStatusChanged,
}) => {
  const { colors: _tc } = useTheme();
  colors = _tc;
  const styles = createStyles(colors);

  const [destinations, setDestinations] = useState<MerchantPayoutDestination[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Review states
  const [activeReviewId, setActiveReviewId] = useState<string | null>(null);
  const [reviewMode, setReviewMode] = useState<'VERIFY' | 'REJECT' | null>(null);
  const [verifiedAccountName, setVerifiedAccountName] = useState('');
  const [verificationReference, setVerificationReference] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const loadDestinations = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    setError(null);
    try {
      const list = await PayoutsRepository.listDestinations(restaurantId);
      setDestinations(list);
    } catch (err: any) {
      setError(err?.message || 'Failed to load payout destinations.');
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    loadDestinations();
  }, [loadDestinations]);

  const handleStartVerify = (destination: MerchantPayoutDestination) => {
    setActiveReviewId(destination.id);
    setReviewMode('VERIFY');
    setVerifiedAccountName(destination.accountName || '');
    setVerificationReference(`KYC-MANUAL-${Date.now().toString().slice(-6)}`);
    setRejectionReason('');
  };

  const handleStartReject = (destination: MerchantPayoutDestination) => {
    setActiveReviewId(destination.id);
    setReviewMode('REJECT');
    setRejectionReason('');
    setVerifiedAccountName('');
    setVerificationReference('');
  };

  const handleCancelReview = () => {
    setActiveReviewId(null);
    setReviewMode(null);
    setVerifiedAccountName('');
    setVerificationReference('');
    setRejectionReason('');
  };

  const handleConfirmVerify = async (destinationId: string) => {
    if (!verifiedAccountName.trim() || !verificationReference.trim()) {
      Alert.alert('Missing Required Information', 'Please provide both the verified account name and verification reference.');
      return;
    }

    setIsProcessing(true);
    try {
      await PayoutsRepository.reviewDestination(destinationId, 'VERIFIED', {
        verificationReference: verificationReference.trim(),
        verifiedAccountName: verifiedAccountName.trim(),
      });
      handleCancelReview();
      await loadDestinations();
      if (onStatusChanged) onStatusChanged();
      Alert.alert('Payout Verified', 'Payout destination has been verified successfully.');
    } catch (err: any) {
      Alert.alert('Verification Failed', err?.message || 'Failed to verify payout destination.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmReject = async (destinationId: string) => {
    if (!rejectionReason.trim()) {
      Alert.alert('Reason Required', 'Please provide an explicit reason for rejecting this payout destination.');
      return;
    }

    setIsProcessing(true);
    try {
      await PayoutsRepository.reviewDestination(destinationId, 'REJECTED', {
        reason: rejectionReason.trim(),
      });
      handleCancelReview();
      await loadDestinations();
      if (onStatusChanged) onStatusChanged();
      Alert.alert('Payout Rejected', 'Payout destination has been rejected.');
    } catch (err: any) {
      Alert.alert('Rejection Failed', err?.message || 'Failed to reject payout destination.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="card-outline" size={16} color={colors.primary} />
          <Text style={styles.title}>Payout Destinations & Verification</Text>
        </View>
        {loading && <ActivityIndicator size="small" color={colors.primary} />}
      </View>

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : destinations.length === 0 ? (
        <Text style={styles.emptyText}>No registered payout destinations for this restaurant.</Text>
      ) : (
        <View style={{ gap: 8 }}>
          {destinations.map((dest) => {
            const isPending = dest.verificationStatus === 'PENDING_VERIFICATION' || dest.verificationStatus === 'UNVERIFIED';
            const isVerified = dest.verificationStatus === 'VERIFIED';
            const isRejected = dest.verificationStatus === 'REJECTED';
            const isBeingReviewed = activeReviewId === dest.id;

            return (
              <View key={dest.id} style={styles.destCard}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.providerName}>{dest.provider}</Text>
                      {dest.isDefault && (
                        <View style={styles.defaultBadge}>
                          <Text style={styles.defaultBadgeText}>Default</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.maskedIdentifier}>{dest.maskedAccountIdentifier}</Text>
                    <Text style={styles.accountName}>Account Name: {dest.accountName}</Text>
                    <Text style={styles.createdAtText}>
                      Created: {new Date(dest.createdAt).toLocaleDateString()}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusPill,
                      isVerified
                        ? styles.statusVerified
                        : isRejected
                        ? styles.statusRejected
                        : styles.statusPending,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        {
                          color: isVerified
                            ? colors.success
                            : isRejected
                            ? colors.danger
                            : colors.warning,
                        },
                      ]}
                    >
                      {isVerified ? 'VERIFIED ✓' : dest.verificationStatus}
                    </Text>
                  </View>
                </View>

                {/* Verification Actions for PENDING_VERIFICATION */}
                {isPending && !isBeingReviewed && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.verifyBtn}
                      onPress={() => handleStartVerify(dest)}
                      disabled={isProcessing}
                    >
                      <Ionicons name="checkmark-circle-outline" size={14} color={colors.onPrimary} />
                      <Text style={styles.verifyBtnText}>Verify Destination</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.rejectBtn}
                      onPress={() => handleStartReject(dest)}
                      disabled={isProcessing}
                    >
                      <Ionicons name="close-circle-outline" size={14} color={colors.danger} />
                      <Text style={styles.rejectBtnText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Review Form (Verify dialog) */}
                {isBeingReviewed && reviewMode === 'VERIFY' && (
                  <View style={styles.reviewForm}>
                    <Text style={styles.formTitle}>Verify Payout Destination</Text>
                    <View style={{ gap: 4 }}>
                      <Text style={styles.fieldLabel}>Verified Account Legal Name:</Text>
                      <TextInput
                        style={styles.input}
                        value={verifiedAccountName}
                        onChangeText={setVerifiedAccountName}
                        placeholder="e.g. Mama Ntilie Catering Enterprises"
                        placeholderTextColor={colors.textMuted}
                      />
                    </View>
                    <View style={{ gap: 4 }}>
                      <Text style={styles.fieldLabel}>Verification Reference / KYC Ref:</Text>
                      <TextInput
                        style={styles.input}
                        value={verificationReference}
                        onChangeText={setVerificationReference}
                        placeholder="e.g. MANUAL-KYC-20260928-001"
                        placeholderTextColor={colors.textMuted}
                      />
                    </View>
                    <View style={styles.formButtonRow}>
                      <TouchableOpacity
                        style={styles.cancelFormBtn}
                        onPress={handleCancelReview}
                        disabled={isProcessing}
                      >
                        <Text style={styles.cancelFormBtnText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.confirmVerifyBtn}
                        onPress={() => handleConfirmVerify(dest.id)}
                        disabled={isProcessing}
                      >
                        {isProcessing ? (
                          <ActivityIndicator size="small" color={colors.onPrimary} />
                        ) : (
                          <Text style={styles.confirmVerifyBtnText}>Confirm Verification</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Review Form (Reject dialog) */}
                {isBeingReviewed && reviewMode === 'REJECT' && (
                  <View style={[styles.reviewForm, { borderColor: colors.danger }]}>
                    <Text style={[styles.formTitle, { color: colors.danger }]}>
                      Reject Payout Destination
                    </Text>
                    <View style={{ gap: 4 }}>
                      <Text style={styles.fieldLabel}>Rejection Reason (Required):</Text>
                      <TextInput
                        style={[styles.input, { minHeight: 60 }]}
                        value={rejectionReason}
                        onChangeText={setRejectionReason}
                        placeholder="e.g. Account name mismatch with business license..."
                        placeholderTextColor={colors.textMuted}
                        multiline
                        numberOfLines={2}
                      />
                    </View>
                    <View style={styles.formButtonRow}>
                      <TouchableOpacity
                        style={styles.cancelFormBtn}
                        onPress={handleCancelReview}
                        disabled={isProcessing}
                      >
                        <Text style={styles.cancelFormBtnText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.confirmRejectBtn}
                        onPress={() => handleConfirmReject(dest.id)}
                        disabled={isProcessing}
                      >
                        {isProcessing ? (
                          <ActivityIndicator size="small" color={colors.onPrimary} />
                        ) : (
                          <Text style={styles.confirmRejectBtnText}>Confirm Rejection</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.card,
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: Spacing.md,
      gap: Spacing.sm,
      marginTop: Spacing.sm,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    title: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    errorText: {
      fontSize: 12,
      color: colors.danger,
    },
    emptyText: {
      fontSize: 12,
      color: colors.textSecondary,
      fontStyle: 'italic',
    },
    destCard: {
      backgroundColor: colors.appBackground,
      borderRadius: Radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: Spacing.sm,
      gap: 6,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    providerName: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    defaultBadge: {
      backgroundColor: colors.primarySoft,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: Radii.sm,
    },
    defaultBadgeText: {
      fontSize: 9.5,
      fontWeight: '700',
      color: colors.primary,
    },
    maskedIdentifier: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textPrimary,
      fontFamily: 'monospace',
      marginTop: 2,
    },
    accountName: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 1,
    },
    createdAtText: {
      fontSize: 10,
      color: colors.textMuted,
      marginTop: 1,
    },
    statusPill: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: Radii.full,
    },
    statusPending: {
      backgroundColor: colors.warningSoft,
    },
    statusVerified: {
      backgroundColor: colors.successSoft,
    },
    statusRejected: {
      backgroundColor: colors.dangerSoft,
    },
    statusPillText: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    actionRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: 6,
      marginTop: 4,
    },
    verifyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.success,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: Radii.sm,
    },
    verifyBtnText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.onPrimary,
    },
    rejectBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.dangerSoft,
      borderWidth: 1,
      borderColor: colors.danger,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: Radii.sm,
    },
    rejectBtnText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.danger,
    },
    reviewForm: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.success,
      borderRadius: Radii.md,
      padding: Spacing.sm,
      gap: 8,
      marginTop: 4,
    },
    formTitle: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.success,
    },
    fieldLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    input: {
      backgroundColor: colors.appBackground,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.sm,
      paddingHorizontal: 8,
      paddingVertical: 6,
      fontSize: 12,
      color: colors.textPrimary,
    },
    formButtonRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 6,
      marginTop: 2,
    },
    cancelFormBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    cancelFormBtnText: {
      fontSize: 11,
      color: colors.textSecondary,
    },
    confirmVerifyBtn: {
      backgroundColor: colors.success,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: Radii.sm,
    },
    confirmVerifyBtnText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.onPrimary,
    },
    confirmRejectBtn: {
      backgroundColor: colors.danger,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: Radii.sm,
    },
    confirmRejectBtnText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.onPrimary,
    },
  });
