/**
 * Stage 11: Customer Discrepancy Reporting Modal
 * Enables customers to report wrong prices, out-of-stock items, or inaccurate hours.
 * Includes client-side rate limit messaging and anti-sabotage safeguards.
 */

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';
import { ReportCategory } from '../../types/trust';
import { DataReportsRepository } from '../../repositories/dataReports.repository';

interface ReportDiscrepancyModalProps {
  visible: boolean;
  onClose: () => void;
  restaurantId: string;
  restaurantName: string;
  branchId?: string;
  dishId?: string;
  dishName: string;
  listedPrice?: number;
  userId?: string;
  onSuccess?: () => void;
}

export const ReportDiscrepancyModal: React.FC<ReportDiscrepancyModalProps> = ({
  visible,
  onClose,
  restaurantId,
  restaurantName,
  branchId,
  dishId,
  dishName,
  listedPrice,
  userId = 'usr-cust-anon',
  onSuccess,
}) => {
  const [category, setCategory] = useState<ReportCategory>('PRICE_DISCREPANCY');
  const [reportedPrice, setReportedPrice] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ isError: boolean; message: string } | null>(null);

  if (!visible) return null;

  const categories: { key: ReportCategory; label: string; icon: string }[] = [
    { key: 'PRICE_DISCREPANCY', label: 'Price is Wrong', icon: '💰' },
    { key: 'OUT_OF_STOCK', label: 'Item Sold Out', icon: '🚫' },
    { key: 'DISH_NOT_ON_MENU', label: 'Not on Menu', icon: '📋' },
    { key: 'CLOSED_DURING_OPEN_HOURS', label: 'Branch Closed', icon: '🚪' },
    { key: 'OTHER', label: 'Other Issue', icon: '💬' },
  ];

  const handleSubmit = async () => {
    setFeedback(null);
    setSubmitting(true);

    const numericPrice = reportedPrice ? parseFloat(reportedPrice.replace(/[^0-9.]/g, '')) : undefined;

    // Map ReportCategory to DataReportType understood by DataReportsRepository
    const reportTypeMap: Record<ReportCategory, string> = {
      PRICE_DISCREPANCY: 'WRONG_PRICE',
      OUT_OF_STOCK: 'ITEM_UNAVAILABLE',
      DISH_NOT_ON_MENU: 'ITEM_UNAVAILABLE',
      CLOSED_DURING_OPEN_HOURS: 'WRONG_HOURS',
      WRONG_LOCATION: 'WRONG_LOCATION',
      OTHER: 'OTHER',
    };

    try {
      await DataReportsRepository.submit({
        reporterUserId: userId,
        reporterName: undefined,
        restaurantId,
        restaurantName,
        branchId,
        menuItemId: dishId,
        menuItemName: dishName,
        reportType: reportTypeMap[category] as any,
        message: description.trim() || `Customer reported: ${category.replace(/_/g, ' ').toLowerCase()}`,
        reportedValue: numericPrice != null ? `TZS ${numericPrice.toLocaleString()}` : category,
        catalogValue: listedPrice != null ? `TZS ${listedPrice.toLocaleString()}` : undefined,
        status: 'OPEN',
      });

      setFeedback({
        isError: false,
        message: 'Thank you! Your report has been submitted for kitchen and admin verification.',
      });

      setTimeout(() => {
        setSubmitting(false);
        if (onSuccess) onSuccess();
        onClose();
      }, 1400);
    } catch (err: any) {
      setFeedback({
        isError: true,
        message: err.message || 'An unexpected error occurred.',
      });
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Report Discrepancy</Text>
              <Text style={styles.subTitle}>
                {dishName} • {restaurantName}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {/* Feedback Alert */}
            {feedback ? (
              <View
                style={[
                  styles.feedbackBox,
                  feedback.isError ? styles.feedbackBoxError : styles.feedbackBoxSuccess,
                ]}
              >
                <Text
                  style={[
                    styles.feedbackText,
                    feedback.isError ? styles.feedbackTextError : styles.feedbackTextSuccess,
                  ]}
                >
                  {feedback.isError ? '⚠️ ' : '✅ '}
                  {feedback.message}
                </Text>
              </View>
            ) : null}

            {/* Category Selector */}
            <Text style={styles.fieldLabel}>What is the issue?</Text>
            <View style={styles.categoryGrid}>
              {categories.map((c) => {
                const isSelected = category === c.key;
                return (
                  <TouchableOpacity
                    key={c.key}
                    style={[styles.categoryCard, isSelected && styles.categoryCardSelected]}
                    onPress={() => setCategory(c.key)}
                  >
                    <Text style={styles.categoryIcon}>{c.icon}</Text>
                    <Text
                      style={[
                        styles.categoryLabel,
                        isSelected && styles.categoryLabelSelected,
                      ]}
                    >
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Price inputs if category is PRICE_DISCREPANCY */}
            {category === 'PRICE_DISCREPANCY' ? (
              <View style={styles.priceRow}>
                <View style={styles.priceCol}>
                  <Text style={styles.fieldLabel}>Listed Price</Text>
                  <Text style={styles.listedPriceDisplay}>
                    {listedPrice != null ? `TZS ${listedPrice.toLocaleString()}` : 'N/A'}
                  </Text>
                </View>
                <View style={styles.priceCol}>
                  <Text style={styles.fieldLabel}>Actual Price Seen</Text>
                  <TextInput
                    style={styles.priceInput}
                    placeholder="e.g. 15000"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    value={reportedPrice}
                    onChangeText={setReportedPrice}
                  />
                </View>
              </View>
            ) : null}

            {/* Details input */}
            <Text style={styles.fieldLabel}>Additional Details (Optional)</Text>
            <TextInput
              style={styles.textArea}
              placeholder="e.g. Waiter mentioned price changed last week..."
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={3}
              value={description}
              onChangeText={setDescription}
            />

            {/* Anti-sabotage disclaimer */}
            <Text style={styles.disclaimerText}>
              🛡️ To protect partner kitchens, discrepancy reports are corroborated by receipt evidence and audited before permanently adjusting trust badges.
            </Text>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel="Submit discrepancy report"
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>Submit Report for Verification</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: Radii.lg,
    borderTopRightRadius: Radii.lg,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  subTitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    fontSize: 20,
    color: '#64748B',
    fontWeight: '600',
  },
  body: {
    maxHeight: 520,
  },
  bodyContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  feedbackBox: {
    padding: Spacing.md,
    borderRadius: Radii.md,
  },
  feedbackBoxError: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  feedbackBoxSuccess: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  feedbackText: {
    fontSize: 13,
    lineHeight: 18,
  },
  feedbackTextError: {
    color: '#B91C1C',
    fontWeight: '600',
  },
  feedbackTextSuccess: {
    color: '#15803D',
    fontWeight: '600',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    gap: 6,
  },
  categoryCardSelected: {
    borderColor: '#F97316',
    backgroundColor: '#FFF7ED',
  },
  categoryIcon: {
    fontSize: 16,
  },
  categoryLabel: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  categoryLabelSelected: {
    color: '#C2410C',
  },
  priceRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  priceCol: {
    flex: 1,
  },
  listedPriceDisplay: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748B',
    paddingVertical: 10,
  },
  priceInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: Radii.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: Radii.md,
    padding: 12,
    fontSize: 14,
    color: '#0F172A',
    textAlignVertical: 'top',
    height: 70,
  },
  disclaimerText: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
  },
  submitBtn: {
    backgroundColor: '#F97316',
    paddingVertical: Spacing.md,
    borderRadius: Radii.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
