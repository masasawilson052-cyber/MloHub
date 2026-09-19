import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { Typography } from '../../theme/typography';
import { RestaurantTab } from './RestaurantSidebar';

export interface AttentionAlert {
  id: string;
  type: 'ORDER' | 'VERIFICATION' | 'REPORT' | 'RESERVATION' | 'STOCK';
  severity: 'HIGH' | 'MEDIUM' | 'INFO';
  title: string;
  description: string;
  actionLabel: string;
  targetTab: RestaurantTab;
}

export interface AttentionCenterProps {
  alerts: AttentionAlert[];
  onNavigateTab: (tab: RestaurantTab) => void;
  language?: 'en' | 'sw';
}

export const AttentionCenter: React.FC<AttentionCenterProps> = ({
  alerts,
  onNavigateTab,
  language = 'en',
}) => {
  if (alerts.length === 0) {
    return (
      <View style={styles.allGoodCard}>
        <View style={styles.allGoodIconCircle}>
          <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
        </View>
        <View style={styles.allGoodTextCol}>
          <Text style={styles.allGoodTitle}>
            {language === 'sw' ? 'Mambo Yote Yako Sawa!' : 'Everything is Running Smoothly'}
          </Text>
          <Text style={styles.allGoodSubtitle}>
            {language === 'sw'
              ? 'Hakuna oda zinazosubiri, bei zote zimethibitishwa na jiko lipo tayari.'
              : 'No pending orders, all menu prices are verified fresh, and kitchen queue is clear.'}
          </Text>
        </View>
      </View>
    );
  }

  const getAlertIcon = (type: AttentionAlert['type']) => {
    switch (type) {
      case 'ORDER':
        return 'receipt-outline';
      case 'VERIFICATION':
        return 'shield-checkmark-outline';
      case 'REPORT':
        return 'alert-circle-outline';
      case 'RESERVATION':
        return 'calendar-outline';
      case 'STOCK':
        return 'cube-outline';
      default:
        return 'notifications-outline';
    }
  };

  const getSeverityStyle = (severity: AttentionAlert['severity']) => {
    switch (severity) {
      case 'HIGH':
        return {
          bg: '#FEF2F2',
          border: '#FCA5A5',
          text: '#991B1B',
          iconColor: '#DC2626',
        };
      case 'MEDIUM':
        return {
          bg: '#FFFBEB',
          border: '#FDE68A',
          text: '#92400E',
          iconColor: '#D97706',
        };
      default:
        return {
          bg: '#EFF6FF',
          border: '#BFDBFE',
          text: '#1E40AF',
          iconColor: '#2563EB',
        };
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Ionicons name="flash-outline" size={18} color={Colors.accent} />
          <Text style={styles.headerTitle}>
            {language === 'sw' ? 'Inayohitaji Uangalizi Sasa' : 'Needs Your Attention'}
          </Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{alerts.length}</Text>
        </View>
      </View>

      <View style={styles.alertsList}>
        {alerts.map((alert) => {
          const styleConfig = getSeverityStyle(alert.severity);

          return (
            <TouchableOpacity
              key={alert.id}
              style={[
                styles.alertCard,
                { backgroundColor: styleConfig.bg, borderColor: styleConfig.border },
              ]}
              onPress={() => onNavigateTab(alert.targetTab)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`${alert.title}: ${alert.description}`}
            >
              <View style={styles.alertLeft}>
                <Ionicons
                  name={getAlertIcon(alert.type) as any}
                  size={20}
                  color={styleConfig.iconColor}
                  style={styles.alertIcon}
                />
                <View style={styles.textContainer}>
                  <Text style={[styles.alertTitle, { color: styleConfig.text }]}>
                    {alert.title}
                  </Text>
                  <Text style={styles.alertDescription} numberOfLines={2}>
                    {alert.description}
                  </Text>
                </View>
              </View>

              <View style={styles.actionBtn}>
                <Text style={styles.actionBtnText}>{alert.actionLabel}</Text>
                <Ionicons name="arrow-forward" size={13} color={Colors.primaryDark} />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    ...Typography.H3,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  countBadge: {
    backgroundColor: Colors.accentLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  countText: {
    ...Typography.Caption,
    color: Colors.accentDark,
    fontWeight: '800',
    fontSize: 11,
  },
  alertsList: {
    gap: Spacing.xs,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: Radii.md,
    borderWidth: 1,
  },
  alertLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.sm,
  },
  alertIcon: {
    marginRight: Spacing.sm,
  },
  textContainer: {
    flex: 1,
  },
  alertTitle: {
    ...Typography.BodyMedium,
    fontWeight: '700',
    fontSize: 13.5,
  },
  alertDescription: {
    ...Typography.Caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.white,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  actionBtnText: {
    ...Typography.Caption,
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  allGoodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
    borderWidth: 1,
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  allGoodIconCircle: {
    marginRight: Spacing.sm,
  },
  allGoodTextCol: {
    flex: 1,
  },
  allGoodTitle: {
    ...Typography.BodyMedium,
    fontWeight: '700',
    color: '#166534',
  },
  allGoodSubtitle: {
    ...Typography.Caption,
    color: '#15803D',
    marginTop: 1,
  },
});
