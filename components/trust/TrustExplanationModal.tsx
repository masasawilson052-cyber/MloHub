/**
 * Stage 11: Trust Explanation Modal
 * Transparently explains why a dish price or restaurant listing is trusted or unverified.
 * Gives plain-language reasons without exposing raw calculation math.
 */

import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';
import { DishTrustAssessment, RestaurantTrustAssessment } from '../../types/trust';

interface TrustExplanationModalProps {
  visible: boolean;
  onClose: () => void;
  dishAssessment?: DishTrustAssessment | null;
  restaurantAssessment?: RestaurantTrustAssessment | null;
  onOpenReportModal?: () => void;
}

export const TrustExplanationModal: React.FC<TrustExplanationModalProps> = ({
  visible,
  onClose,
  dishAssessment,
  restaurantAssessment,
  onOpenReportModal,
}) => {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.shieldIcon}>🛡️</Text>
              <Text style={styles.headerTitle}>Why You Can Trust This</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Close trust explanation"
            >
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {/* Dish Trust Section */}
            {dishAssessment ? (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionCategory}>DISH PRICE & FRESHNESS</Text>
                <View style={styles.badgeRow}>
                  <View
                    style={[
                      styles.tierPill,
                      dishAssessment.badgeTone === 'positive' && styles.tierPillPositive,
                      dishAssessment.badgeTone === 'warning' && styles.tierPillWarning,
                      dishAssessment.badgeTone === 'critical' && styles.tierPillCritical,
                      dishAssessment.badgeTone === 'neutral' && styles.tierPillNeutral,
                    ]}
                  >
                    <Text
                      style={[
                        styles.tierPillText,
                        dishAssessment.badgeTone === 'positive' && styles.tierTextPositive,
                        dishAssessment.badgeTone === 'warning' && styles.tierTextWarning,
                        dishAssessment.badgeTone === 'critical' && styles.tierTextCritical,
                        dishAssessment.badgeTone === 'neutral' && styles.tierTextNeutral,
                      ]}
                    >
                      {dishAssessment.badgeLabel}
                    </Text>
                  </View>
                  <Text style={styles.dishNameTitle}>{dishAssessment.dishName}</Text>
                </View>

                <Text style={styles.explanationText}>
                  {dishAssessment.shortExplanation}
                </Text>

                {dishAssessment.detailedReasons.length > 0 ? (
                  <View style={styles.reasonsList}>
                    {dishAssessment.detailedReasons.map((reason, idx) => (
                      <View key={idx} style={styles.reasonItem}>
                        <Text style={styles.bulletDot}>•</Text>
                        <Text style={styles.reasonText}>{reason}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Restaurant Trust Section */}
            {restaurantAssessment ? (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionCategory}>RESTAURANT RELIABILITY</Text>
                <View style={styles.badgeRow}>
                  <View
                    style={[
                      styles.tierPill,
                      restaurantAssessment.badgeTone === 'positive' && styles.tierPillPositive,
                      restaurantAssessment.badgeTone === 'warning' && styles.tierPillWarning,
                      restaurantAssessment.badgeTone === 'neutral' && styles.tierPillNeutral,
                    ]}
                  >
                    <Text
                      style={[
                        styles.tierPillText,
                        restaurantAssessment.badgeTone === 'positive' && styles.tierTextPositive,
                        restaurantAssessment.badgeTone === 'warning' && styles.tierTextWarning,
                        restaurantAssessment.badgeTone === 'neutral' && styles.tierTextNeutral,
                      ]}
                    >
                      {restaurantAssessment.summaryBadge}
                    </Text>
                  </View>
                  <Text style={styles.dishNameTitle}>
                    {restaurantAssessment.restaurantName}
                  </Text>
                </View>

                {/* Identity & Legal */}
                <View style={styles.dimensionRow}>
                  <Text style={styles.dimensionLabel}>Legal Registration:</Text>
                  <Text style={styles.dimensionValue}>
                    {restaurantAssessment.explanations.identity}
                  </Text>
                </View>

                {/* Order Fulfillment */}
                <View style={styles.dimensionRow}>
                  <Text style={styles.dimensionLabel}>Fulfillment Record:</Text>
                  <Text style={styles.dimensionValue}>
                    {restaurantAssessment.explanations.fulfillment}
                  </Text>
                </View>

                {/* Report Health */}
                <View style={styles.dimensionRow}>
                  <Text style={styles.dimensionLabel}>Price Complaints:</Text>
                  <Text style={styles.dimensionValue}>
                    {restaurantAssessment.explanations.reportHealth}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Transparency Guarantee Banner */}
            <View style={styles.guaranteeBox}>
              <Text style={styles.guaranteeTitle}>💡 Our Verification Standards</Text>
              <Text style={styles.guaranteeBody}>
                Prices on MloHub are audited regularly with physical menus and kitchen staff.
                If you encounter a price difference or an unavailable dish, report it below to help
                the community and earn verification points.
              </Text>
            </View>

            {/* Action Buttons */}
            {onOpenReportModal ? (
              <TouchableOpacity
                style={styles.reportBtn}
                onPress={() => {
                  onClose();
                  onOpenReportModal();
                }}
                accessibilityRole="button"
                accessibilityLabel="Report a price or menu discrepancy"
              >
                <Text style={styles.reportBtnText}>⚠️ Report Price or Menu Error</Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  sheetContainer: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: Radii.lg,
    overflow: 'hidden',
    ...Platform.select({
      ios: Shadows.modal,
      android: { elevation: 8 },
      default: {},
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  shieldIcon: {
    fontSize: 20,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  closeBtn: {
    fontSize: 18,
    color: '#64748B',
    fontWeight: '600',
    padding: Spacing.xs,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  sectionCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: Radii.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionCategory: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
    flexWrap: 'wrap',
  },
  tierPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
  },
  tierPillPositive: {
    backgroundColor: '#DCFCE7',
  },
  tierPillWarning: {
    backgroundColor: '#FEF3C7',
  },
  tierPillCritical: {
    backgroundColor: '#FEE2E2',
  },
  tierPillNeutral: {
    backgroundColor: '#F1F5F9',
  },
  tierPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  tierTextPositive: {
    color: '#15803D',
  },
  tierTextWarning: {
    color: '#B45309',
  },
  tierTextCritical: {
    color: '#B91C1C',
  },
  tierTextNeutral: {
    color: '#475569',
  },
  dishNameTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    flexShrink: 1,
  },
  explanationText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  reasonsList: {
    marginTop: Spacing.xs,
    gap: 4,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  bulletDot: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  reasonText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    flex: 1,
  },
  dimensionRow: {
    marginTop: Spacing.sm,
    gap: 2,
  },
  dimensionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  dimensionValue: {
    fontSize: 13,
    color: '#1E293B',
  },
  guaranteeBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: Radii.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  guaranteeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E40AF',
    marginBottom: 4,
  },
  guaranteeBody: {
    fontSize: 12,
    color: '#1E3A8A',
    lineHeight: 18,
  },
  reportBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#F97316',
    borderRadius: Radii.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  reportBtnText: {
    color: '#C2410C',
    fontWeight: '700',
    fontSize: 14,
  },
});
