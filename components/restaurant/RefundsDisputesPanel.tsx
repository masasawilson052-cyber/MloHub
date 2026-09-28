import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { Shadows } from '../../theme/shadows';
import { Typography } from '../../theme/typography';
import { formatTzs } from '../../utils/formatters';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { RefundRequest, FinancialDispute } from '../../types/domain';
import { DisputesRepository } from '../../repositories/disputes.repository';
import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

export interface RefundsDisputesPanelProps {
  refunds: RefundRequest[];
  disputes: FinancialDispute[];
  onRefresh?: () => Promise<void>;
  language?: 'en' | 'sw';
}

export const RefundsDisputesPanel: React.FC<RefundsDisputesPanelProps> = ({
  refunds,
  disputes,
  onRefresh,
  language = 'en',
}) => {
  const { colors: _tc } = useTheme();
  colors = _tc;
  styles = createStyles(colors);

  const [activeTab, setActiveTab] = useState<'REFUNDS' | 'DISPUTES'>('REFUNDS');
  const [selectedDispute, setSelectedDispute] = useState<FinancialDispute | null>(null);
  const [evidenceDescription, setEvidenceDescription] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [isSubmittingEvidence, setIsSubmittingEvidence] = useState(false);
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(new Set());

  const handleAcknowledge = (id: string) => {
    setAcknowledgedIds((prev) => new Set([...prev, id]));
    Alert.alert(
      language === 'sw' ? 'Imethibitishwa' : 'Acknowledged',
      language === 'sw'
        ? 'Umethibitisha kupokea taarifa ya ombi hili.'
        : 'You have acknowledged this financial notification.'
    );
  };

  const handleOpenEvidenceModal = (dispute: FinancialDispute) => {
    setSelectedDispute(dispute);
    setEvidenceDescription('');
    setEvidenceUrl('');
  };

  const handleSubmitEvidence = async () => {
    if (!selectedDispute) return;
    if (!evidenceDescription.trim()) {
      Alert.alert(
        language === 'sw' ? 'Hitilafu' : 'Validation Error',
        language === 'sw' ? 'Tafadhali eleza ushahidi wako.' : 'Please provide an explanation of the evidence.'
      );
      return;
    }

    try {
      setIsSubmittingEvidence(true);
      const res = await DisputesRepository.addEvidence({
        disputeId: selectedDispute.id,
        filePath: evidenceUrl.trim() || 'merchant_portal_statement',
        fileType: 'text/plain',
        description: evidenceDescription.trim(),
      });

      if (res.success) {
        Alert.alert(
          language === 'sw' ? 'Ushahidi Umewasilishwa' : 'Evidence Submitted',
          language === 'sw'
            ? 'Ushahidi umepokelewa na timu ya usuluhishi ya jukwaa.'
            : 'Your documentation has been attached for platform resolution.'
        );
        setSelectedDispute(null);
        if (onRefresh) await onRefresh();
      } else {
        Alert.alert('Error', res.error || 'Failed to submit evidence');
      }
    } finally {
      setIsSubmittingEvidence(false);
    }
  };

  const getRefundBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
      case 'APPROVED':
        return <Badge label={language === 'sw' ? 'Imerudishwa' : 'Refund Approved'} variant="error" size="sm" />;
      case 'REJECTED':
        return <Badge label={language === 'sw' ? 'Imekataliwa' : 'Declined'} variant="success" size="sm" />;
      default:
        return <Badge label={language === 'sw' ? 'Inakaguliwa' : 'Under Review'} variant="warning" size="sm" />;
    }
  };

  const getDisputeBadge = (status: string) => {
    switch (status) {
      case 'RESOLVED':
        return <Badge label={language === 'sw' ? 'Imetatuliwa' : 'Resolved'} variant="success" size="sm" />;
      case 'UNDER_REVIEW':
      case 'EVIDENCE_PERIOD':
        return <Badge label={language === 'sw' ? 'Ushahidi Unahitajika' : 'Action Required'} variant="error" size="sm" />;
      default:
        return <Badge label={language === 'sw' ? 'Wazi' : 'Open Claim'} variant="warning" size="sm" />;
    }
  };

  return (
    <View style={styles.container}>
      {/* Platform Authority Notice Banner */}
      <View style={styles.authorityNotice}>
        <Ionicons name="shield-checkmark-outline" size={20} color={colors.info} />
        <View style={{ flex: 1 }}>
          <Text style={styles.authorityTitle}>
            {language === 'sw' ? 'Mamlaka ya Kifedha ya Jukwaa' : 'Platform Dispute Governance'}
          </Text>
          <Text style={styles.authoritySub}>
            {language === 'sw'
              ? 'MloHub inasimamia marejesho na migogoro ya fedha kwa uadilifu. Migahawa haiwezi kujiridhia marejesho binafsi bali inaweza kuwasilisha ushahidi na kuthibitisha.'
              : 'Customer refunds and disputes are audited authoritatively by MloHub Platform Admin. Merchants can review claims, provide kitchen logs, and submit dispute evidence.'}
          </Text>
        </View>
      </View>

      {/* Sub-tab Switcher */}
      <View style={styles.tabSwitcher}>
        <TouchableOpacity
          style={[styles.switchBtn, activeTab === 'REFUNDS' && styles.switchBtnActive]}
          onPress={() => setActiveTab('REFUNDS')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="return-down-back-outline"
            size={16}
            color={activeTab === 'REFUNDS' ? colors.primary : colors.textMuted}
          />
          <Text style={[styles.switchBtnText, activeTab === 'REFUNDS' && styles.switchBtnTextActive]}>
            {language === 'sw' ? `Marejesho (${refunds.length})` : `Customer Refunds (${refunds.length})`}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.switchBtn, activeTab === 'DISPUTES' && styles.switchBtnActive]}
          onPress={() => setActiveTab('DISPUTES')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="alert-circle-outline"
            size={16}
            color={activeTab === 'DISPUTES' ? colors.primary : colors.textMuted}
          />
          <Text style={[styles.switchBtnText, activeTab === 'DISPUTES' && styles.switchBtnTextActive]}>
            {language === 'sw' ? `Migogoro (${disputes.length})` : `Financial Disputes (${disputes.length})`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Refunds Section */}
      {activeTab === 'REFUNDS' && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContainer}>
          {refunds.length === 0 ? (
            <EmptyState
              title={language === 'sw' ? 'Hakuna Marejesho' : 'Zero Refund Requests'}
              message={
                language === 'sw'
                  ? 'Hakuna madai ya kurudishiwa pesa yaliyowasilishwa kwa mgahawa wako.'
                  : 'No customer refund claims are currently registered for your store.'
              }
              icon="checkmark-circle-outline"
            />
          ) : (
            refunds.map((ref) => {
              const isAck = acknowledgedIds.has(ref.id);
              const requestedAmt = Number(ref.requestedAmountTzs || 0);
              const approvedAmt = ref.approvedAmountTzs ? Number(ref.approvedAmountTzs) : null;

              return (
                <View key={ref.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                      <Text style={styles.cardOrderRef}>
                        {ref.orderId ? `Order #${ref.orderId}` : `Payment Ref #${ref.paymentId}`}
                      </Text>
                      <Text style={styles.cardDate}>
                        {new Date(ref.requestedAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </Text>
                    </View>
                    {getRefundBadge(ref.status)}
                  </View>

                  <View style={styles.cardBody}>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>{language === 'sw' ? 'Sababu:' : 'Customer Claim:'}</Text>
                      <Text style={styles.infoVal}>{ref.reasonCode} {ref.reasonDetail ? `• ${ref.reasonDetail}` : ''}</Text>
                    </View>

                    <View style={styles.amountsRow}>
                      <View>
                        <Text style={styles.amountLabel}>{language === 'sw' ? 'Kiasi Kilichoombwa' : 'Requested'}</Text>
                        <Text style={styles.amountVal}>{formatTzs(requestedAmt)}</Text>
                      </View>
                      <View>
                        <Text style={styles.amountLabel}>{language === 'sw' ? 'Athari ya Kifedha' : 'Settlement Deduction'}</Text>
                        <Text style={[styles.amountVal, { color: colors.danger }]}>
                          {approvedAmt !== null ? formatTzs(approvedAmt) : language === 'sw' ? 'Inasubiri ukaguzi' : 'Pending Review'}
                        </Text>
                      </View>
                    </View>

                    {ref.failureReason && (
                      <View style={styles.resolutionBox}>
                        <Text style={styles.resolutionTitle}>{language === 'sw' ? 'Uamuzi:' : 'Resolution:'}</Text>
                        <Text style={styles.resolutionText}>{ref.failureReason}</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.cardFooter}>
                    <TouchableOpacity
                      style={[styles.ackBtn, isAck && styles.ackBtnDisabled]}
                      disabled={isAck}
                      onPress={() => handleAcknowledge(ref.id)}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={isAck ? 'checkmark-circle' : 'checkmark-circle-outline'}
                        size={16}
                        color={isAck ? colors.success : colors.textPrimary}
                      />
                      <Text style={[styles.ackBtnText, isAck && { color: colors.success }]}>
                        {isAck ? (language === 'sw' ? 'Imethibitishwa' : 'Acknowledged') : language === 'sw' ? 'Thibitisha' : 'Acknowledge'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Disputes Section */}
      {activeTab === 'DISPUTES' && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContainer}>
          {disputes.length === 0 ? (
            <EmptyState
              title={language === 'sw' ? 'Hakuna Migogoro' : 'Zero Financial Disputes'}
              message={
                language === 'sw'
                  ? 'Akaunti yako ya biashara haina mgogoro wowote wa kifedha.'
                  : 'No customer dispute claims or chargeback investigations are open.'
              }
              icon="shield-checkmark-outline"
            />
          ) : (
            disputes.map((disp) => {
              const disputedAmt = Number(disp.disputedAmountTzs || 0);
              const deadlineDate = disp.evidenceDeadlineAt ? new Date(disp.evidenceDeadlineAt) : null;
              const isOverdue = deadlineDate ? deadlineDate.getTime() < Date.now() : false;

              return (
                <View key={disp.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                      <Text style={styles.cardOrderRef}>
                        {disp.orderId ? `Order #${disp.orderId}` : `Dispute Ref #${disp.id.slice(0, 8)}`}
                      </Text>
                      <Text style={styles.cardDate}>
                        {new Date(disp.openedAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </Text>
                    </View>
                    {getDisputeBadge(disp.status)}
                  </View>

                  <View style={styles.cardBody}>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>{language === 'sw' ? 'Madai ya Mteja:' : 'Dispute Reason:'}</Text>
                      <Text style={styles.infoVal}>{disp.reasonCode} {disp.description ? `• ${disp.description}` : ''}</Text>
                    </View>

                    <View style={styles.amountsRow}>
                      <View>
                        <Text style={styles.amountLabel}>{language === 'sw' ? 'Kiasi Kwenye Mgogoro' : 'Disputed Amount'}</Text>
                        <Text style={[styles.amountVal, { color: colors.danger }]}>{formatTzs(disputedAmt)}</Text>
                      </View>

                      {deadlineDate && (
                        <View>
                          <Text style={styles.amountLabel}>
                            {language === 'sw' ? 'Mwisho wa Ushahidi' : 'Evidence Deadline'}
                          </Text>
                          <Text style={[styles.amountVal, isOverdue ? { color: colors.danger } : { color: colors.warning }]}>
                            {deadlineDate.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </View>
                      )}
                    </View>

                    {disp.resolution && (
                      <View style={styles.resolutionBox}>
                        <Text style={styles.resolutionTitle}>{language === 'sw' ? 'Uamuzi wa Jukwaa:' : 'Platform Resolution:'}</Text>
                        <Text style={styles.resolutionText}>{disp.resolution}</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.cardFooter}>
                    {disp.status !== 'RESOLVED' && (
                      <TouchableOpacity
                        style={styles.evidenceBtn}
                        onPress={() => handleOpenEvidenceModal(disp)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="document-attach-outline" size={16} color={colors.onPrimary} />
                        <Text style={styles.evidenceBtnText}>
                          {language === 'sw' ? 'Wasilisha Ushahidi' : 'Submit Evidence'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Evidence Submission Modal */}
      {selectedDispute && (
        <Modal
          visible={true}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setSelectedDispute(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {language === 'sw' ? 'Wasilisha Ushahidi wa Mgogoro' : 'Submit Dispute Evidence'}
                </Text>
                <TouchableOpacity onPress={() => setSelectedDispute(null)}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalSub}>
                {language === 'sw'
                  ? 'Eleza muktadha wa jikoni, risiti, au kumbukumbu za utayarishaji kutetea madai haya.'
                  : 'Provide food preparation notes, photo references, or packaging verification to defend this claim.'}
              </Text>

              <Text style={styles.inputLabel}>{language === 'sw' ? 'Maelezo ya Ushahidi *' : 'Explanation & Evidence Details *'}</Text>
              <TextInput
                style={styles.textArea}
                multiline
                numberOfLines={4}
                placeholder={
                  language === 'sw'
                    ? 'Eleza jinsi chakula kilivyotayarishwa na kukabidhiwa kwa usahihi...'
                    : 'Detail how the order was accurately fulfilled and handed over...'
                }
                placeholderTextColor={colors.textMuted}
                value={evidenceDescription}
                onChangeText={setEvidenceDescription}
              />

              <Text style={styles.inputLabel}>{language === 'sw' ? 'Kiungo cha Picha au Faili (Hiari)' : 'Document or Image URL (Optional)'}</Text>
              <TextInput
                style={styles.textInput}
                placeholder="https://..."
                placeholderTextColor={colors.textMuted}
                value={evidenceUrl}
                onChangeText={setEvidenceUrl}
                autoCapitalize="none"
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setSelectedDispute(null)}
                  disabled={isSubmittingEvidence}
                >
                  <Text style={styles.cancelBtnText}>{language === 'sw' ? 'Ghairi' : 'Cancel'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.confirmBtn}
                  onPress={handleSubmitEvidence}
                  disabled={isSubmittingEvidence}
                >
                  {isSubmittingEvidence ? (
                    <ActivityIndicator size="small" color={colors.onPrimary} />
                  ) : (
                    <Text style={styles.confirmBtnText}>{language === 'sw' ? 'Wasilisha' : 'Submit Evidence'}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    authorityNotice: {
      backgroundColor: colors.infoSoft,
      borderWidth: 1,
      borderColor: colors.info,
      borderRadius: Radii.md,
      padding: Spacing.md,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    authorityTitle: {
      fontSize: Typography.BodyMedium.fontSize,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    authoritySub: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
      lineHeight: 16,
    },
    tabSwitcher: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    switchBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: Radii.full,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    switchBtnActive: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
    },
    switchBtnText: {
      fontSize: Typography.Caption.fontSize,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    switchBtnTextActive: {
      color: colors.primary,
    },
    listContainer: {
      gap: Spacing.md,
      paddingBottom: Spacing.xl,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: Spacing.md,
      ...Shadows.sm,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
      paddingBottom: Spacing.xs,
    },
    cardHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    cardOrderRef: {
      fontSize: Typography.BodyMedium.fontSize,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    cardDate: {
      fontSize: 12,
      color: colors.textMuted,
    },
    cardBody: {
      gap: Spacing.xs,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      flexWrap: 'wrap',
    },
    infoLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    infoVal: {
      fontSize: 13,
      color: colors.textPrimary,
    },
    amountsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: Spacing.xs,
      paddingVertical: Spacing.xs,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
    amountLabel: {
      fontSize: 11,
      color: colors.textMuted,
      textTransform: 'uppercase',
      fontWeight: '500',
    },
    amountVal: {
      fontSize: Typography.bodyLarge.fontSize,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 2,
    },
    resolutionBox: {
      backgroundColor: colors.surface,
      borderRadius: Radii.sm,
      padding: Spacing.sm,
      marginTop: Spacing.xs,
      borderLeftWidth: 3,
      borderLeftColor: colors.info,
    },
    resolutionTitle: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
    },
    resolutionText: {
      fontSize: 13,
      color: colors.textPrimary,
      marginTop: 2,
    },
    cardFooter: {
      marginTop: Spacing.sm,
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: Spacing.sm,
    },
    ackBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: Radii.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    ackBtnDisabled: {
      borderColor: colors.success,
      backgroundColor: colors.successSoft,
    },
    ackBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    evidenceBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 14,
      borderRadius: Radii.sm,
      backgroundColor: colors.primary,
    },
    evidenceBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.onPrimary,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: Spacing.lg,
    },
    modalCard: {
      width: '100%',
      maxWidth: 520,
      backgroundColor: colors.card,
      borderRadius: Radii.lg,
      padding: Spacing.lg,
      ...Shadows.lg,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.xs,
    },
    modalTitle: {
      fontSize: Typography.H3.fontSize,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    modalSub: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: Spacing.md,
      lineHeight: 18,
    },
    inputLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 4,
      marginTop: Spacing.xs,
    },
    textArea: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.md,
      padding: Spacing.sm,
      fontSize: 14,
      color: colors.textPrimary,
      textAlignVertical: 'top',
      minHeight: 80,
    },
    textInput: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.md,
      padding: Spacing.sm,
      fontSize: 14,
      color: colors.textPrimary,
      height: 40,
    },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: Spacing.sm,
      marginTop: Spacing.lg,
    },
    cancelBtn: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: Radii.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cancelBtnText: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    confirmBtn: {
      paddingVertical: 8,
      paddingHorizontal: 18,
      borderRadius: Radii.md,
      backgroundColor: colors.primary,
    },
    confirmBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.onPrimary,
    },
  });

let styles = createStyles(lightColors);
