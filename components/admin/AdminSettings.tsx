import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';
import { FINANCIAL_CONFIG, formatTzs } from '../../config/platformFees';

interface AdminSettingsProps {
  language?: 'en' | 'sw';
}

export const AdminSettings: React.FC<AdminSettingsProps> = ({
  language = 'en',
}) => {
  const [pilotZones, setPilotZones] = useState([
    { id: 'mikocheni', name: 'Mikocheni A & B', city: 'Dar es Salaam', active: true },
    { id: 'upanga', name: 'Upanga East & West', city: 'Dar es Salaam', active: true },
    { id: 'masaki', name: 'Masaki & Oysterbay', city: 'Dar es Salaam', active: true },
    { id: 'kariakoo', name: 'Kariakoo Commercial Hub', city: 'Dar es Salaam', active: true },
    { id: 'sinza', name: 'Sinza & Kijitonyama', city: 'Dar es Salaam', active: true },
    { id: 'kinondoni', name: 'Kinondoni & Mwananyamala', city: 'Dar es Salaam', active: true },
    { id: 'cbd', name: 'Posta / CBD City Center', city: 'Dar es Salaam', active: false },
  ]);

  const toggleZone = (id: string) => {
    setPilotZones((prev) =>
      prev.map((z) => (z.id === id ? { ...z, active: !z.active } : z))
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.headerArea}>
        <Text style={styles.title}>
          {language === 'sw' ? 'Mipangilio ya Mfumo' : 'Platform Operations Settings & Policy'}
        </Text>
        <Text style={styles.subtitle}>
          Authoritative financial fee structure, active pilot delivery zones, and catalog freshness rules.
        </Text>
      </View>

      {/* Financial Authority Card */}
      <View style={styles.sectionCard}>
        <View style={styles.cardHeaderRow}>
          <Ionicons name="cash-outline" size={20} color={Colors.primary} />
          <Text style={styles.cardTitle}>Centralized Financial Fee Authority</Text>
        </View>
        <Text style={styles.cardNotice}>
          Fee parameters are locked to <Text style={styles.codeText}>config/platformFees.ts</Text> and server-side RPCs. They cannot be tampered with by individual frontend clients.
        </Text>

        <View style={styles.feeGrid}>
          <View style={styles.feeItem}>
            <Text style={styles.feeLabel}>Platform Commission</Text>
            <Text style={styles.feeValue}>
              {FINANCIAL_CONFIG.DEFAULT_PLATFORM_COMMISSION_RATE * 100}%
            </Text>
            <Text style={styles.feeSub}>Deducted from restaurant food subtotal</Text>
          </View>
          <View style={styles.feeItem}>
            <Text style={styles.feeLabel}>Customer Service Fee</Text>
            <Text style={styles.feeValue}>{formatTzs(FINANCIAL_CONFIG.SERVICE_FEE_TZS)}</Text>
            <Text style={styles.feeSub}>Fixed per completed order</Text>
          </View>
          <View style={styles.feeItem}>
            <Text style={styles.feeLabel}>Base Delivery Fee</Text>
            <Text style={styles.feeValue}>
              {formatTzs(FINANCIAL_CONFIG.STANDARD_DELIVERY_FEE_TZS)}
            </Text>
            <Text style={styles.feeSub}>Standard intra-zone rider payout</Text>
          </View>
          <View style={styles.feeItem}>
            <Text style={styles.feeLabel}>Minimum Order Value</Text>
            <Text style={styles.feeValue}>
              {formatTzs(FINANCIAL_CONFIG.MIN_ORDER_SUBTOTAL_TZS)}
            </Text>
            <Text style={styles.feeSub}>Subtotal required for checkout</Text>
          </View>
        </View>
      </View>

      {/* Pilot Coverage Zones */}
      <View style={styles.sectionCard}>
        <View style={styles.cardHeaderRow}>
          <Ionicons name="map-outline" size={20} color="#0284c7" />
          <Text style={styles.cardTitle}>Pilot Delivery Coverage Zones (Dar es Salaam)</Text>
        </View>

        <View style={styles.zonesList}>
          {pilotZones.map((zone) => (
            <View key={zone.id} style={styles.zoneRow}>
              <View>
                <Text style={styles.zoneName}>{zone.name}</Text>
                <Text style={styles.zoneCity}>{zone.city}</Text>
              </View>
              <Switch
                value={zone.active}
                onValueChange={() => toggleZone(zone.id)}
                trackColor={{ false: '#cbd5e1', true: '#fed7aa' }}
                thumbColor={zone.active ? Colors.primary : '#94a3b8'}
              />
            </View>
          ))}
        </View>
      </View>

      {/* Freshness Policy Rules */}
      <View style={styles.sectionCard}>
        <View style={styles.cardHeaderRow}>
          <Ionicons name="shield-checkmark-outline" size={20} color="#16a34a" />
          <Text style={styles.cardTitle}>Catalog Freshness Threshold Policies</Text>
        </View>

        <View style={styles.policyGrid}>
          <View style={styles.policyRow}>
            <View style={[styles.policyDot, { backgroundColor: '#10b981' }]} />
            <Text style={styles.policyLabel}>Fresh Tier:</Text>
            <Text style={styles.policyValue}>Prices verified within the last 7 days</Text>
          </View>
          <View style={styles.policyRow}>
            <View style={[styles.policyDot, { backgroundColor: '#0284c7' }]} />
            <Text style={styles.policyLabel}>Recent Tier:</Text>
            <Text style={styles.policyValue}>Prices verified between 7 and 14 days</Text>
          </View>
          <View style={styles.policyRow}>
            <View style={[styles.policyDot, { backgroundColor: '#f59e0b' }]} />
            <Text style={styles.policyLabel}>Aging Tier:</Text>
            <Text style={styles.policyValue}>Prices verified between 14 and 30 days (Reminder queued)</Text>
          </View>
          <View style={styles.policyRow}>
            <View style={[styles.policyDot, { backgroundColor: '#ef4444' }]} />
            <Text style={styles.policyLabel}>Stale Tier:</Text>
            <Text style={styles.policyValue}>Unverified for &gt; 30 days (Demoted from search ranking)</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.xl,
  },
  headerArea: {
    gap: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  cardNotice: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 16,
  },
  codeText: {
    fontFamily: 'monospace',
    color: '#0f172a',
    fontWeight: '700',
  },
  feeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  feeItem: {
    flex: 1,
    minWidth: 160,
    backgroundColor: '#f8fafc',
    borderRadius: Radii.md,
    padding: Spacing.md,
    gap: 2,
  },
  feeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  feeValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  feeSub: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
  },
  zonesList: {
    gap: Spacing.xs,
  },
  zoneRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  zoneName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  zoneCity: {
    fontSize: 11,
    color: '#64748b',
  },
  policyGrid: {
    gap: Spacing.sm,
  },
  policyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  policyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  policyLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    minWidth: 80,
  },
  policyValue: {
    fontSize: 12,
    color: '#475569',
    flex: 1,
  },
});
