import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { Shadows } from '../../theme/shadows';
import { Typography } from '../../theme/typography';
import { EmptyState } from '../ui/EmptyState';
import { Button } from '../ui/Button';

export interface CustomerReportItem {
  id: string;
  reason: 'WRONG_PRICE' | 'ITEM_UNAVAILABLE' | 'WRONG_HOURS' | 'WRONG_LOCATION' | 'RESTAURANT_CLOSED' | 'OTHER';
  details?: string;
  menuItemId?: string;
  dishName?: string;
  reportedAt: string;
  status: 'PENDING' | 'ACKNOWLEDGED' | 'RESOLVED';
}

export interface CustomerReportsPanelProps {
  reports: CustomerReportItem[];
  onAcknowledgeReport: (reportId: string) => Promise<void>;
  onFixDish: (menuItemId?: string) => void;
  language?: 'en' | 'sw';
}

export const CustomerReportsPanel: React.FC<CustomerReportsPanelProps> = ({
  reports,
  onAcknowledgeReport,
  onFixDish,
  language = 'en',
}) => {
  const getReasonLabel = (reason: CustomerReportItem['reason']) => {
    switch (reason) {
      case 'WRONG_PRICE':
        return 'Wrong Price Reported';
      case 'ITEM_UNAVAILABLE':
        return 'Item Sold Out / Unavailable';
      case 'WRONG_HOURS':
        return 'Operating Hours Incorrect';
      case 'WRONG_LOCATION':
        return 'Location Pin Discrepancy';
      case 'RESTAURANT_CLOSED':
        return 'Reported Closed During Open Hours';
      default:
        return 'Data Discrepancy';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Customer Reports & Data Trust</Text>
          <Text style={styles.sub}>
            Discrepancies reported by diners on MloHub. Addressing reports boosts your verified search ranking.
          </Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContainer}>
        {reports.length === 0 ? (
          <EmptyState
            title="Zero Customer Discrepancies ✓"
            message="Your restaurant data, branch pricing, and hours are matching diner expectations."
            icon="shield-checkmark-outline"
          />
        ) : (
          reports.map((rep) => (
            <View key={rep.id} style={styles.reportCard}>
              <View style={styles.cardHeader}>
                <View style={styles.reasonRow}>
                  <Ionicons name="alert-circle" size={18} color="#DC2626" />
                  <Text style={styles.reasonText}>{getReasonLabel(rep.reason)}</Text>
                </View>

                <View style={styles.statusPill}>
                  <Text style={styles.statusText}>{rep.status}</Text>
                </View>
              </View>

              {rep.dishName && (
                <Text style={styles.dishName}>Dish Impacted: {rep.dishName}</Text>
              )}

              {rep.details && <Text style={styles.detailsText}>"{rep.details}"</Text>}

              <Text style={styles.dateText}>
                Reported {new Date(rep.reportedAt).toLocaleDateString()}
              </Text>

              <View style={styles.footerRow}>
                {rep.status === 'PENDING' && (
                  <Button
                    title="Acknowledge"
                    onPress={() => onAcknowledgeReport(rep.id)}
                    variant="outline"
                    size="sm"
                  />
                )}

                {rep.menuItemId && (
                  <Button
                    title="Update Price / Dish →"
                    onPress={() => onFixDish(rep.menuItemId)}
                    variant="primary"
                    size="sm"
                  />
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.md,
    maxWidth: 900,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    marginBottom: Spacing.md,
  },
  title: {
    ...Typography.H2,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  sub: {
    ...Typography.Caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  listContainer: {
    gap: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  reportCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#FECACA',
    ...Shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reasonText: {
    ...Typography.BodyMedium,
    fontWeight: '700',
    color: '#991B1B',
  },
  statusPill: {
    backgroundColor: Colors.surfaceSecondary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radii.full,
  },
  statusText: {
    ...Typography.Caption,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  dishName: {
    ...Typography.BodyMedium,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginVertical: 2,
  },
  detailsText: {
    ...Typography.Body,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginVertical: 4,
  },
  dateText: {
    ...Typography.Caption,
    color: Colors.textMuted,
    fontSize: 11,
    marginBottom: 8,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: Spacing.xs,
  },
});
