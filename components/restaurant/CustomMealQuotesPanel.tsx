import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { Shadows } from '../../theme/shadows';
import { Typography } from '../../theme/typography';
import { formatTzs } from '../../utils/formatters';
import { CustomMealRequest } from '../../types/domain';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Badge } from '../ui/Badge';

import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

export interface CustomMealQuotesPanelProps {
  requests: CustomMealRequest[];
  onSubmitQuote: (requestId: string, quote: { priceTzs: number; prepMinutes: number; deliveryFeeTzs?: number; message?: string }) => Promise<void>;
  onWithdrawQuote: (requestId: string) => Promise<void>;
  language?: 'en' | 'sw';
}

export const CustomMealQuotesPanel: React.FC<CustomMealQuotesPanelProps> = ({
  requests,
  onSubmitQuote,
  onWithdrawQuote,
  language = 'en',
}) => {
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);
  const [quotingRequest, setQuotingRequest] = useState<CustomMealRequest | null>(null);
  const [quotedPrice, setQuotedPrice] = useState('15000');
  const [quotedDeliveryFee, setQuotedDeliveryFee] = useState('3000');
  const [quotedPrepMins, setQuotedPrepMins] = useState('35');
  const [quotedMessage, setQuotedMessage] = useState('We can prepare this fresh for you with authentic spices.');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenQuote = (req: CustomMealRequest) => {
    setQuotingRequest(req);
    setQuotedPrice(String(req.budgetTzs || 15000));
    setQuotedDeliveryFee('3000');
  };

  const handleSendQuote = async () => {
    if (!quotingRequest) return;
    const priceNum = parseInt(quotedPrice.replace(/[^0-9]/g, ''), 10);
    const prepNum = parseInt(quotedPrepMins, 10) || 30;
    const isDelivery = quotingRequest.fulfillmentMode === 'RESTAURANT_DELIVERY';
    const deliveryFeeNum = isDelivery ? parseInt(quotedDeliveryFee.replace(/[^0-9]/g, ''), 10) || 0 : 0;

    if (isNaN(priceNum) || priceNum <= 0) {
      Alert.alert('Validation', 'Please enter a valid quoted price.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmitQuote(quotingRequest.id, {
        priceTzs: priceNum,
        prepMinutes: prepNum,
        deliveryFeeTzs: deliveryFeeNum,
        message: quotedMessage.trim() || undefined,
      });
      setQuotingRequest(null);
      Alert.alert('Quote Dispatched', 'Your quote has been transmitted to the customer for review.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to submit quote.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Custom Meal Inquiries & Chef Quotes</Text>
          <Text style={styles.sub}>
            Review customer dietary requests, formulated budgets, and submit custom pricing.
          </Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContainer}>
        {requests.length === 0 ? (
          <EmptyState
            title="No Active Custom Meal Requests"
            message="When diners in your neighborhood request bespoke or customized meals, inquiries will appear here."
            icon="restaurant-outline"
          />
        ) : (
          requests.map((req) => (
            <View key={req.id} style={styles.requestCard}>
              <View style={styles.cardHeader}>
                <View style={styles.dishTitleRow}>
                  <Text style={styles.dishName}>{req.dishName}</Text>
                  <View style={styles.servingsBadge}>
                    <Text style={styles.servingsText}>{req.servingsCount}</Text>
                  </View>
                </View>

                <Badge
                  label={req.status}
                  variant={(req.status as string) === 'QUOTE_SUBMITTED' ? 'info' : req.status === 'ACCEPTED' ? 'success' : 'neutral'}
                  size="sm"
                />
              </View>

              <View style={styles.detailsRow}>
                <Text style={styles.budgetLabel}>Customer Budget:</Text>
                <Text style={styles.budgetValue}>{formatTzs(req.budgetTzs)}</Text>
                <Text style={styles.optionLabel}>• {req.diningOption}</Text>
              </View>

              {req.specialInstructions ? (
                <View style={styles.instructionsBox}>
                  <Text style={styles.instructionsTitle}>Instructions / Preferences:</Text>
                  <Text style={styles.instructionsText}>{req.specialInstructions}</Text>
                </View>
              ) : null}

              {/* Action Buttons */}
              <View style={styles.cardFooter}>
                <Text style={styles.timeText}>
                  {new Date(req.createdAt).toLocaleDateString()}
                </Text>

                <View style={styles.actionsGroup}>
                  {(req.status as string) === 'QUOTE_SUBMITTED' ? (
                    <Button
                      title="Withdraw Quote"
                      onPress={() => onWithdrawQuote(req.id)}
                      variant="outline"
                      size="sm"
                    />
                  ) : req.status === 'ACCEPTED' ? (
                    <View style={styles.acceptedPill}>
                      <Text style={styles.acceptedPillText}>Quote Accepted by Diner ✓</Text>
                    </View>
                  ) : (
                    <Button
                      title="Submit Chef Quote"
                      onPress={() => handleOpenQuote(req)}
                      variant="primary"
                      size="sm"
                    />
                  )}
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Quote Formulation Modal */}
      <Modal visible={Boolean(quotingRequest)} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Formulate Chef Quote</Text>
              <TouchableOpacity onPress={() => setQuotingRequest(null)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSub}>
              Dish: <Text style={{ fontWeight: '700', color: colors.textPrimary }}>{quotingRequest?.dishName}</Text>
            </Text>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Quoted Price (TZS) *</Text>
              <TextInput
                style={styles.textInput}
                value={quotedPrice}
                onChangeText={setQuotedPrice}
                keyboardType="numeric"
              />
            </View>

            {quotingRequest?.fulfillmentMode === 'RESTAURANT_DELIVERY' && (
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Merchant Delivery Fee (TZS) *</Text>
                <TextInput
                  style={styles.textInput}
                  value={quotedDeliveryFee}
                  onChangeText={setQuotedDeliveryFee}
                  keyboardType="numeric"
                  placeholder="e.g. 3000"
                />
              </View>
            )}

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Estimated Prep Time (Minutes) *</Text>
              <TextInput
                style={styles.textInput}
                value={quotedPrepMins}
                onChangeText={setQuotedPrepMins}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Chef Note to Customer</Text>
              <TextInput
                style={[styles.textInput, { minHeight: 60 }]}
                value={quotedMessage}
                onChangeText={setQuotedMessage}
                multiline
              />
            </View>

            <View style={styles.modalActionsRow}>
              <Button
                title="Cancel"
                onPress={() => setQuotingRequest(null)}
                variant="outline"
                style={{ flex: 1 }}
              />
              <Button
                title={isSubmitting ? 'Sending...' : 'Send Quote to Diner'}
                onPress={handleSendQuote}
                loading={isSubmitting}
                variant="primary"
                style={{ flex: 2 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.md,
    maxWidth: 1000,
    width: '100%',
    alignSelf: 'center',
  },
  headerRow: {
    marginBottom: Spacing.md,
  },
  title: {
    ...Typography.H2,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  sub: {
    ...Typography.Caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  listContainer: {
    gap: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  requestCard: {
    backgroundColor: colors.card,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: colors.divider,
    ...Shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  dishTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dishName: {
    ...Typography.H3,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  servingsBadge: {
    backgroundColor: colors.surfaceInteractive,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.sm,
  },
  servingsText: {
    ...Typography.Caption,
    color: colors.textSecondary,
    fontSize: 11,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginVertical: 4,
  },
  budgetLabel: {
    ...Typography.Caption,
    color: colors.textMuted,
  },
  budgetValue: {
    ...Typography.BodyMedium,
    fontWeight: '700',
    color: colors.primary,
  },
  optionLabel: {
    ...Typography.Caption,
    color: colors.textSecondary,
  },
  instructionsBox: {
    backgroundColor: colors.surfaceInteractive,
    padding: Spacing.xs,
    borderRadius: Radii.sm,
    marginVertical: Spacing.xs,
  },
  instructionsTitle: {
    ...Typography.Caption,
    fontWeight: '700',
    color: colors.textSecondary,
    fontSize: 10,
  },
  instructionsText: {
    ...Typography.Body,
    color: colors.textPrimary,
    fontSize: 12.5,
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: Spacing.xs,
    marginTop: Spacing.xs,
  },
  timeText: {
    ...Typography.Caption,
    color: colors.textMuted,
    fontSize: 11,
  },
  actionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  acceptedPill: {
    backgroundColor: colors.successSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.full,
  },
  acceptedPillText: {
    ...Typography.Caption,
    color: colors.success,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  modalCard: {
    backgroundColor: colors.card,
    borderRadius: Radii.lg,
    padding: Spacing.lg,
    maxWidth: 480,
    width: '100%',
    ...Shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    ...Typography.H3,
    fontWeight: '700',
  },
  modalSub: {
    ...Typography.Body,
    color: colors.textSecondary,
    marginVertical: Spacing.sm,
  },
  field: {
    marginBottom: Spacing.sm,
  },
  fieldLabel: {
    ...Typography.Caption,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: Radii.md,
    padding: Spacing.sm,
    ...Typography.Body,
    backgroundColor: colors.card,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
});
let styles = createStyles(lightColors);
