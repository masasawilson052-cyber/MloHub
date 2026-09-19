import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { Shadows } from '../../theme/shadows';
import { Typography } from '../../theme/typography';
import { Order, OrderStatus } from '../../types/domain';

export interface KitchenBoardProps {
  orders: Order[];
  onAdvanceStatus: (orderId: string, nextStatus: OrderStatus) => Promise<void>;
  language?: 'en' | 'sw';
}

interface KitchenCardProps {
  order: Order;
  onAdvanceStatus: (orderId: string, nextStatus: OrderStatus) => Promise<void>;
  currentTime: number;
}

const KitchenOrderCard: React.FC<KitchenCardProps> = ({ order, onAdvanceStatus, currentTime }) => {
  const createdAtMs = new Date(order.createdAt).getTime();
  const elapsedMinutes = Math.max(0, Math.floor((currentTime - createdAtMs) / (1000 * 60)));

  const isNormal = elapsedMinutes < 15;
  const isAttention = elapsedMinutes >= 15 && elapsedMinutes < 30;
  const isLate = elapsedMinutes >= 30;

  const timerColor = isLate ? '#DC2626' : isAttention ? '#D97706' : '#15803D';
  const timerBg = isLate ? '#FEE2E2' : isAttention ? '#FEF3C7' : '#DCFCE7';

  return (
    <View style={[styles.card, isLate && styles.cardLate]}>
      {/* Top Card Bar */}
      <View style={styles.cardHeader}>
        <View style={styles.orderNumberRow}>
          <Text style={styles.orderNumber}>#{order.orderNumber}</Text>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>
              {order.fulfillmentType === 'Delivery' ? '🛵 DEL' : order.fulfillmentType === 'Takeaway' ? '🥡 T/A' : '🍽️ DINE'}
            </Text>
          </View>
        </View>

        {/* Elapsed Timer */}
        <View style={[styles.timerBadge, { backgroundColor: timerBg }]}>
          <Ionicons name="time-outline" size={13} color={timerColor} />
          <Text style={[styles.timerText, { color: timerColor }]}>
            {elapsedMinutes}m ago
          </Text>
        </View>
      </View>

      {/* Items List */}
      <View style={styles.itemsContainer}>
        {(order.items || []).map((item, idx) => (
          <View key={item.id || idx} style={styles.itemRow}>
            <View style={styles.qtyBadge}>
              <Text style={styles.qtyBadgeText}>{item.quantity}</Text>
            </View>
            <Text style={styles.itemName} numberOfLines={2}>
              {item.itemNameSnapshot}
            </Text>
          </View>
        ))}
      </View>

      {/* Special Kitchen Notes */}
      {order.specialInstructions ? (
        <View style={styles.notesBox}>
          <Ionicons name="warning-outline" size={14} color="#D97706" />
          <Text style={styles.notesText}>{order.specialInstructions}</Text>
        </View>
      ) : null}

      {/* Large Kitchen Action CTA */}
      <View style={styles.cardFooter}>
        {order.status === 'ACCEPTED' && (
          <TouchableOpacity
            style={[styles.bigActionBtn, { backgroundColor: Colors.accent }]}
            onPress={() => onAdvanceStatus(order.id, 'PREPARING')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Start cooking order ${order.orderNumber}`}
          >
            <Ionicons name="flame" size={20} color={Colors.white} />
            <Text style={styles.bigActionBtnText}>Start Cooking 🔥</Text>
          </TouchableOpacity>
        )}

        {order.status === 'PREPARING' && (
          <TouchableOpacity
            style={[styles.bigActionBtn, { backgroundColor: Colors.success }]}
            onPress={() => onAdvanceStatus(order.id, 'READY')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Mark order ${order.orderNumber} ready`}
          >
            <Ionicons name="bag-check" size={20} color={Colors.white} />
            <Text style={styles.bigActionBtnText}>Mark Ready ✅</Text>
          </TouchableOpacity>
        )}

        {order.status === 'READY' && (
          <TouchableOpacity
            style={[styles.bigActionBtn, { backgroundColor: Colors.primaryDark }]}
            onPress={() => onAdvanceStatus(order.id, 'COMPLETED')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Complete order ${order.orderNumber}`}
          >
            <Ionicons name="checkmark-done" size={20} color={Colors.white} />
            <Text style={styles.bigActionBtnText}>Complete & Dispatch 🚀</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export const KitchenBoard: React.FC<KitchenBoardProps> = ({
  orders,
  onAdvanceStatus,
  language = 'en',
}) => {
  const { width } = useWindowDimensions();
  const isWide = width >= 960;

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const acceptedOrders = orders.filter((o) => o.status === 'ACCEPTED');
  const preparingOrders = orders.filter((o) => o.status === 'PREPARING');
  const readyOrders = orders.filter((o) => o.status === 'READY');

  const totalKitchenOrders = acceptedOrders.length + preparingOrders.length + readyOrders.length;

  return (
    <View style={styles.container}>
      {/* Board Summary Header */}
      <View style={styles.boardHeader}>
        <View style={styles.headerLeft}>
          <Ionicons name="restaurant" size={22} color={Colors.primary} />
          <Text style={styles.boardTitle}>
            {language === 'sw' ? 'Mfuatano wa Jikoni (Kitchen Queue)' : 'Live Kitchen Queue'}
          </Text>
        </View>
        <View style={styles.headerCountPill}>
          <Text style={styles.headerCountText}>
            {totalKitchenOrders} {language === 'sw' ? 'oda zinazoendelea' : 'orders active'}
          </Text>
        </View>
      </View>

      {/* 3-Column Kanban Layout */}
      <ScrollView
        horizontal={!isWide}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.columnsContainer, isWide && styles.columnsContainerWide]}
      >
        {/* Column 1: NEW / ACCEPTED */}
        <View style={styles.column}>
          <View style={[styles.columnHeader, { borderLeftColor: '#F59E0B' }]}>
            <Text style={styles.columnTitle}>
              {language === 'sw' ? 'ZILIZOTHIBITISHWA' : 'NEW / ACCEPTED'}
            </Text>
            <View style={[styles.columnBadge, { backgroundColor: '#FEF3C7' }]}>
              <Text style={[styles.columnBadgeText, { color: '#B45309' }]}>
                {acceptedOrders.length}
              </Text>
            </View>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.columnScroll}>
            {acceptedOrders.length === 0 ? (
              <View style={styles.emptyColBox}>
                <Text style={styles.emptyColText}>No orders waiting to cook</Text>
              </View>
            ) : (
              acceptedOrders.map((o) => (
                <KitchenOrderCard
                  key={o.id}
                  order={o}
                  onAdvanceStatus={onAdvanceStatus}
                  currentTime={now}
                />
              ))
            )}
          </ScrollView>
        </View>

        {/* Column 2: PREPARING / COOKING */}
        <View style={styles.column}>
          <View style={[styles.columnHeader, { borderLeftColor: Colors.accent }]}>
            <Text style={styles.columnTitle}>
              {language === 'sw' ? 'INAPIKWA SASA' : 'PREPARING'}
            </Text>
            <View style={[styles.columnBadge, { backgroundColor: '#FFF7ED' }]}>
              <Text style={[styles.columnBadgeText, { color: '#EA580C' }]}>
                {preparingOrders.length}
              </Text>
            </View>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.columnScroll}>
            {preparingOrders.length === 0 ? (
              <View style={styles.emptyColBox}>
                <Text style={styles.emptyColText}>No items currently cooking</Text>
              </View>
            ) : (
              preparingOrders.map((o) => (
                <KitchenOrderCard
                  key={o.id}
                  order={o}
                  onAdvanceStatus={onAdvanceStatus}
                  currentTime={now}
                />
              ))
            )}
          </ScrollView>
        </View>

        {/* Column 3: READY FOR PICKUP */}
        <View style={styles.column}>
          <View style={[styles.columnHeader, { borderLeftColor: Colors.success }]}>
            <Text style={styles.columnTitle}>
              {language === 'sw' ? 'TAYARI KUKABIDHI' : 'READY FOR PICKUP'}
            </Text>
            <View style={[styles.columnBadge, { backgroundColor: '#DCFCE7' }]}>
              <Text style={[styles.columnBadgeText, { color: '#15803D' }]}>
                {readyOrders.length}
              </Text>
            </View>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.columnScroll}>
            {readyOrders.length === 0 ? (
              <View style={styles.emptyColBox}>
                <Text style={styles.emptyColText}>No orders waiting for pickup</Text>
              </View>
            ) : (
              readyOrders.map((o) => (
                <KitchenOrderCard
                  key={o.id}
                  order={o}
                  onAdvanceStatus={onAdvanceStatus}
                  currentTime={now}
                />
              ))
            )}
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.md,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  boardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  boardTitle: {
    ...Typography.H2,
    color: Colors.textPrimary,
  },
  headerCountPill: {
    backgroundColor: Colors.primaryMuted,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.full,
  },
  headerCountText: {
    ...Typography.Caption,
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  columnsContainer: {
    gap: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  columnsContainerWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  column: {
    width: 320,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radii.lg,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    maxHeight: '100%',
  },
  columnHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderLeftWidth: 4,
    backgroundColor: Colors.surface,
    borderRadius: Radii.sm,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  columnTitle: {
    ...Typography.Caption,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: Colors.textPrimary,
  },
  columnBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radii.full,
  },
  columnBadgeText: {
    ...Typography.Caption,
    fontWeight: '800',
    fontSize: 11,
  },
  columnScroll: {
    gap: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  emptyColBox: {
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyColText: {
    ...Typography.Caption,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  cardLate: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FFFDFD',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    paddingBottom: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  orderNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  orderNumber: {
    ...Typography.H3,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  typeBadge: {
    backgroundColor: Colors.surfaceSecondary,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: Radii.sm,
  },
  typeBadgeText: {
    ...Typography.Caption,
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.full,
    gap: 4,
  },
  timerText: {
    ...Typography.Caption,
    fontSize: 11,
    fontWeight: '700',
  },
  itemsContainer: {
    marginVertical: Spacing.xs,
    gap: 6,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyBadge: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: Colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBadgeText: {
    ...Typography.Caption,
    fontWeight: '800',
    color: Colors.primaryDark,
    fontSize: 12,
  },
  itemName: {
    ...Typography.BodyMedium,
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  notesBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    padding: Spacing.xs,
    borderRadius: Radii.sm,
    marginVertical: Spacing.xs,
  },
  notesText: {
    ...Typography.Caption,
    color: '#92400E',
    fontWeight: '600',
  },
  cardFooter: {
    marginTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: Spacing.xs,
  },
  bigActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: Radii.md,
    ...Shadows.sm,
  },
  bigActionBtnText: {
    ...Typography.BodyMedium,
    color: Colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
});
