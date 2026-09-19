import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { Shadows } from '../../theme/shadows';
import { Typography } from '../../theme/typography';
import { Reservation, ReservationStatus } from '../../types/domain';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { Button } from '../ui/Button';

export interface ReservationManagerProps {
  reservations: Reservation[];
  onUpdateStatus: (reservationId: string, nextStatus: ReservationStatus) => Promise<void>;
  maxTablesCapacity?: number;
  language?: 'en' | 'sw';
}

export const ReservationManager: React.FC<ReservationManagerProps> = ({
  reservations,
  onUpdateStatus,
  maxTablesCapacity = 20,
  language = 'en',
}) => {
  const [activeTab, setActiveTab] = useState<string>('TODAY');

  const todayStr = new Date().toISOString().split('T')[0];

  const filteredReservations = reservations.filter((r) => {
    if (activeTab === 'ALL') return true;
    if (activeTab === 'TODAY') {
      return (r.reservationDate?.startsWith(todayStr) || r.scheduledAt?.startsWith(todayStr)) && r.status !== 'CANCELLED';
    }
    if (activeTab === 'PENDING') {
      return r.status === 'PENDING' || r.status === 'PENDING_RESTAURANT_APPROVAL';
    }
    return r.status === activeTab;
  });

  const todayConfirmedCount = reservations.filter(
    (r) => (r.reservationDate?.startsWith(todayStr) || r.scheduledAt?.startsWith(todayStr)) &&
      (r.status === 'CONFIRMED' || r.status === 'SEATED')
  ).reduce((sum, r) => sum + (r.partySize || 1), 0);

  const isNearCapacity = todayConfirmedCount >= maxTablesCapacity * 0.8;

  const getStatusBadge = (status: ReservationStatus) => {
    switch (status) {
      case 'PENDING':
      case 'PENDING_RESTAURANT_APPROVAL':
        return <Badge label="Pending Approval" variant="warning" size="sm" />;
      case 'AWAITING_DEPOSIT':
        return <Badge label="Awaiting Deposit" variant="warning" size="sm" />;
      case 'CONFIRMED':
        return <Badge label="Confirmed" variant="success" size="sm" />;
      case 'SEATED':
        return <Badge label="Seated" variant="neutral" size="sm" />;
      case 'COMPLETED':
        return <Badge label="Completed" variant="success" size="sm" />;
      case 'CANCELLED':
        return <Badge label="Cancelled" variant="error" size="sm" />;
      case 'REJECTED':
        return <Badge label="Rejected" variant="error" size="sm" />;
      case 'NO_SHOW':
        return <Badge label="No-Show" variant="error" size="sm" />;
      case 'PAYMENT_REVIEW_REQUIRED':
        return <Badge label="Review Payment" variant="warning" size="sm" />;
      default:
        return <Badge label={status} variant="neutral" size="sm" />;
    }
  };

  const tabs = [
    { id: 'TODAY', label: "Today's Bookings" },
    { id: 'PENDING', label: 'Pending Approval' },
    { id: 'AWAITING_DEPOSIT', label: 'Awaiting Deposit' },
    { id: 'CONFIRMED', label: 'Confirmed' },
    { id: 'SEATED', label: 'Seated' },
    { id: 'ALL', label: 'All' },
  ];

  return (
    <View style={styles.container}>
      {/* Capacity Health Banner */}
      <View style={[styles.capacityBanner, isNearCapacity && styles.capacityBannerWarning]}>
        <View style={styles.capacityLeft}>
          <Ionicons
            name={isNearCapacity ? 'warning-outline' : 'cafe-outline'}
            size={20}
            color={isNearCapacity ? '#B45309' : Colors.primaryDark}
          />
          <View>
            <Text style={styles.capacityTitle}>
              {language === 'sw' ? 'Uwezo wa Meza za Leo' : "Today's Table Capacity"}
            </Text>
            <Text style={styles.capacitySub}>
              {todayConfirmedCount} / {maxTablesCapacity} seats currently occupied/booked today
            </Text>
          </View>
        </View>

        {isNearCapacity && (
          <View style={styles.busyPill}>
            <Text style={styles.busyPillText}>Almost Full</Text>
          </View>
        )}
      </View>

      {/* Tabs Filter */}
      <View style={styles.filterRow}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          let count = 0;
          if (tab.id === 'TODAY') {
            count = reservations.filter((r) => (r.reservationDate?.startsWith(todayStr) || r.scheduledAt?.startsWith(todayStr)) && r.status !== 'CANCELLED').length;
          } else if (tab.id === 'ALL') {
            count = reservations.length;
          } else if (tab.id === 'PENDING') {
            count = reservations.filter((r) => r.status === 'PENDING' || r.status === 'PENDING_RESTAURANT_APPROVAL').length;
          } else {
            count = reservations.filter((r) => r.status === tab.id).length;
          }

          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => setActiveTab(tab.id)}
              accessibilityRole="button"
            >
              <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                {tab.label}
              </Text>
              {count > 0 && (
                <View style={[styles.filterCountBadge, isActive && styles.filterCountBadgeActive]}>
                  <Text style={[styles.filterCountText, isActive && styles.filterCountTextActive]}>
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Reservations List */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContainer}>
        {filteredReservations.length === 0 ? (
          <EmptyState
            title="No Reservations Found"
            message="Guest table bookings and dining requests will appear here."
            icon="calendar-outline"
          />
        ) : (
          filteredReservations.map((res) => (
            <View key={res.id} style={styles.reservationCard}>
              <View style={styles.cardHeader}>
                <View style={styles.customerBlock}>
                  <Text style={styles.customerName}>
                    {(res as any).customerName || 'Dine-in Guest'}
                  </Text>
                  <Text style={{ fontSize: 11, color: Colors.muted, fontWeight: '700' }}>
                    Ref: {res.reference || res.id}
                  </Text>
                </View>
                <View style={styles.headerRight}>
                  {getStatusBadge(res.status)}
                </View>
              </View>

              {/* Booking Details Grid */}
              <View style={styles.detailsGrid}>
                <View style={styles.detailItem}>
                  <Ionicons name="calendar-outline" size={15} color={Colors.textMuted} />
                  <Text style={styles.detailText}>{res.reservationDate || 'Today'}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Ionicons name="time-outline" size={15} color={Colors.textMuted} />
                  <Text style={styles.detailText}>{res.reservationTime || '19:30'}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Ionicons name="people-outline" size={15} color={Colors.textMuted} />
                  <Text style={styles.detailText}>{res.partySize} Guests</Text>
                </View>
                <View style={styles.detailItem}>
                  <Ionicons name="card-outline" size={15} color={Colors.textMuted} />
                  <Text style={styles.detailText}>
                    {res.isDepositPaid
                      ? `Deposit Paid (TZS ${res.depositAmountTzs?.toLocaleString() || 0})`
                      : res.depositAmountTzs && res.depositAmountTzs > 0
                      ? `Deposit Due (TZS ${res.depositAmountTzs.toLocaleString()})`
                      : 'No Deposit'}
                  </Text>
                </View>
              </View>

              {res.areaPreference && res.areaPreference !== 'ANY' && (
                <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 4 }}>
                  Area: {res.areaPreference}
                </Text>
              )}

              {res.tableName && (
                <Text style={{ fontSize: 11, color: Colors.primaryDark, fontWeight: '700', marginTop: 2 }}>
                  Table: {res.tableName}
                </Text>
              )}

              {(res.customerNote || (res as any).specialRequest) && (
                <View style={styles.notesBox}>
                  <Text style={styles.notesLabel}>Special Request:</Text>
                  <Text style={styles.notesText}>{res.customerNote || (res as any).specialRequest}</Text>
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.actionsRow}>
                {(res.status === 'PENDING' || res.status === 'PENDING_RESTAURANT_APPROVAL') && (
                  <>
                    <Button
                      title="Reject"
                      onPress={() => onUpdateStatus(res.id, 'REJECTED')}
                      variant="outline"
                      size="sm"
                      style={{ borderColor: Colors.error }}
                    />
                    <Button
                      title="Accept Booking ✓"
                      onPress={() => onUpdateStatus(res.id, 'CONFIRMED')}
                      variant="primary"
                      size="sm"
                    />
                  </>
                )}

                {res.status === 'CONFIRMED' && (
                  <>
                    <Button
                      title="No-Show"
                      onPress={() => onUpdateStatus(res.id, 'NO_SHOW')}
                      variant="ghost"
                      size="sm"
                    />
                    <Button
                      title="Mark Seated ✓"
                      onPress={() => onUpdateStatus(res.id, 'SEATED')}
                      variant="secondary"
                      size="sm"
                    />
                  </>
                )}

                {res.status === 'SEATED' && (
                  <Button
                    title="Mark Completed ✓"
                    onPress={() => onUpdateStatus(res.id, 'COMPLETED')}
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
    maxWidth: 1000,
    width: '100%',
    alignSelf: 'center',
  },
  capacityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  capacityBannerWarning: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  capacityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  capacityTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  capacitySub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  busyPill: {
    backgroundColor: '#FEF3C7',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: Radii.full,
  },
  busyPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B45309',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: Radii.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: 4,
  },
  filterChipActive: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryDark,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text,
  },
  filterChipTextActive: {
    color: Colors.white,
  },
  filterCountBadge: {
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radii.full,
  },
  filterCountBadgeActive: {
    backgroundColor: Colors.white,
  },
  filterCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.text,
  },
  filterCountTextActive: {
    color: Colors.primaryDark,
  },
  listContainer: {
    gap: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  reservationCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  customerBlock: {
    gap: 2,
  },
  customerName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 11,
    color: Colors.text,
  },
  notesBox: {
    backgroundColor: '#f9fafb',
    padding: Spacing.xs,
    borderRadius: Radii.sm,
    marginTop: Spacing.xs,
  },
  notesLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  notesText: {
    fontSize: 11,
    color: Colors.text,
    fontStyle: 'italic',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
});
