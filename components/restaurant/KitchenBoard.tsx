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

import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

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

  const timerColor = isLate ? colors.danger : isAttention ? colors.warning : colors.success;
  const timerBg = isLate ? colors.dangerSoft : isAttention ? colors.warningSoft : colors.successSoft;

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
            style={[styles.bigActionBtn, { backgroundColor: colors.accent }]}
            onPress={() => onAdvanceStatus(order.id, 'PREPARING')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Start cooking order ${order.orderNumber}`}
          >
            <Ionicons name="flame" size={20} color={colors.white} />
            <Text style={styles.bigActionBtnText}>Start Cooking 🔥</Text>
          </TouchableOpacity>
        )}

        {order.status === 'PREPARING' && (
          <TouchableOpacity
            style={[styles.bigActionBtn, { backgroundColor: colors.success }]}
            onPress={() => onAdvanceStatus(order.id, 'READY')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Mark order ${order.orderNumber} ready`}
          >
            <Ionicons name="bag-check" size={20} color={colors.white} />
            <Text style={styles.bigActionBtnText}>Mark Ready ✅</Text>
          </TouchableOpacity>
        )}

        {order.status === 'READY' && (
          order.fulfillmentType === 'Delivery' ? (
            <TouchableOpacity
              style={[styles.bigActionBtn, { backgroundColor: '#2563eb' }]}
              onPress={() => onAdvanceStatus(order.id, 'OUT_FOR_DELIVERY')}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Dispatch order ${order.orderNumber} for delivery`}
            >
              <Ionicons name="bicycle" size={20} color={colors.white} />
              <Text style={styles.bigActionBtnText}>Dispatch Delivery 🛵</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.bigActionBtn, { backgroundColor: colors.primaryDark }]}
              onPress={() => onAdvanceStatus(order.id, 'COMPLETED')}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Hand order ${order.orderNumber} to customer`}
            >
              <Ionicons name="checkmark-done" size={20} color={colors.white} />
              <Text style={styles.bigActionBtnText}>Hand to Customer ✅</Text>
            </TouchableOpacity>
          )
        )}

        {order.status === 'OUT_FOR_DELIVERY' && (
          <TouchableOpacity
            style={[styles.bigActionBtn, { backgroundColor: colors.primaryDark }]}
            onPress={() => onAdvanceStatus(order.id, 'COMPLETED')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Mark delivery complete for order ${order.orderNumber}`}
          >
            <Ionicons name="checkmark-done" size={20} color={colors.white} />
            <Text style={styles.bigActionBtnText}>Delivered / Complete ✅</Text>
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
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);
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
          <Ionicons name="restaurant" size={22} color={colors.primary} />
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
          <View style={[styles.columnHeader, { borderLeftColor: colors.warning }]}>
            <Text style={styles.columnTitle}>
              {language === 'sw' ? 'ZILIZOTHIBITISHWA' : 'NEW / ACCEPTED'}
            </Text>
            <View style={[styles.columnBadge, { backgroundColor: colors.warningSoft }]}>
              <Text style={[styles.columnBadgeText, { color: colors.warning }]}>
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
          <View style={[styles.columnHeader, { borderLeftColor: colors.accent }]}>
            <Text style={styles.columnTitle}>
              {language === 'sw' ? 'INAPIKWA SASA' : 'PREPARING'}
            </Text>
            <View style={[styles.columnBadge, { backgroundColor: colors.primarySoft }]}>
              <Text style={[styles.columnBadgeText, { color: colors.primary }]}>
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
          <View style={[styles.columnHeader, { borderLeftColor: colors.success }]}>
            <Text style={styles.columnTitle}>
              {language === 'sw' ? 'TAYARI KUKABIDHI' : 'READY FOR PICKUP'}
            </Text>
            <View style={[styles.columnBadge, { backgroundColor: colors.successSoft }]}>
              <Text style={[styles.columnBadgeText, { color: colors.success }]}>
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

const createStyles = (colors: ThemeColors) => StyleSheet.create({
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
    color: colors.textPrimary,
  },
  headerCountPill: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.full,
  },
  headerCountText: {
    ...Typography.Caption,
    color: colors.primary,
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
    backgroundColor: colors.surfaceInteractive,
    borderRadius: Radii.lg,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: colors.divider,
    maxHeight: '100%',
  },
  columnHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderLeftWidth: 4,
    backgroundColor: colors.card,
    borderRadius: Radii.sm,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  columnTitle: {
    ...Typography.Caption,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: colors.textPrimary,
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
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: Radii.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: colors.divider,
    ...Shadows.sm,
  },
  cardLate: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
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
    color: colors.textPrimary,
  },
  typeBadge: {
    backgroundColor: colors.surfaceInteractive,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: Radii.sm,
  },
  typeBadgeText: {
    ...Typography.Caption,
    fontSize: 9,
    fontWeight: '700',
    color: colors.textSecondary,
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
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBadgeText: {
    ...Typography.Caption,
    fontWeight: '800',
    color: colors.primary,
    fontSize: 12,
  },
  itemName: {
    ...Typography.BodyMedium,
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  notesBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.warningSoft,
    padding: Spacing.xs,
    borderRadius: Radii.sm,
    marginVertical: Spacing.xs,
  },
  notesText: {
    ...Typography.Caption,
    color: colors.warning,
    fontWeight: '600',
  },
  cardFooter: {
    marginTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
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
    color: colors.onPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
});
let styles = createStyles(lightColors);
