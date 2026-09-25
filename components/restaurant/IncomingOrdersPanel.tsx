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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { Shadows } from '../../theme/shadows';
import { Typography } from '../../theme/typography';
import { formatTzs } from '../../utils/formatters';
import { Order, OrderStatus } from '../../types/domain';
import { RestaurantRole } from '../../types/auth';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';

import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

export interface IncomingOrdersPanelProps {
  orders: Order[];
  onAcceptOrder: (orderId: string, estimatedPrepMinutes: number) => Promise<void>;
  onRejectOrder: (orderId: string, reason: string) => Promise<void>;
  onUpdateStatus: (orderId: string, nextStatus: OrderStatus) => Promise<void>;
  language?: 'en' | 'sw';
  userRole?: RestaurantRole;
}

export const IncomingOrdersPanel: React.FC<IncomingOrdersPanelProps> = ({
  orders,
  onAcceptOrder,
  onRejectOrder,
  onUpdateStatus,
  language = 'en',
  userRole,
}) => {
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'PREPARING' | 'READY' | 'OUT_FOR_DELIVERY' | 'COMPLETED'>('ALL');

  // Accept Modal State
  const [acceptingOrder, setAcceptingOrder] = useState<Order | null>(null);
  const [prepMinutes, setPrepMinutes] = useState(25);
  const [isSubmittingAccept, setIsSubmittingAccept] = useState(false);

  // Reject Modal State
  const [rejectingOrder, setRejectingOrder] = useState<Order | null>(null);
  const [rejectionReason, setRejectionReason] = useState('Item unavailable');
  const [customReason, setCustomReason] = useState('');
  const [isSubmittingReject, setIsSubmittingReject] = useState(false);

  const filterMap = (o: Order) => {
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'PENDING') return o.status === 'PENDING';
    if (statusFilter === 'PREPARING') return o.status === 'ACCEPTED' || o.status === 'PREPARING';
    if (statusFilter === 'READY') return o.status === 'READY';
    if (statusFilter === 'OUT_FOR_DELIVERY') return o.status === 'OUT_FOR_DELIVERY';
    if (statusFilter === 'COMPLETED') return o.status === 'COMPLETED';
    return true;
  };

  const filteredOrders = orders.filter(filterMap);

  const handleConfirmAccept = async () => {
    if (!acceptingOrder) return;
    try {
      setIsSubmittingAccept(true);
      await onAcceptOrder(acceptingOrder.id, prepMinutes);
      setAcceptingOrder(null);
    } finally {
      setIsSubmittingAccept(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingOrder) return;
    const finalReason = rejectionReason === 'Other' && customReason ? customReason : rejectionReason;
    try {
      setIsSubmittingReject(true);
      await onRejectOrder(rejectingOrder.id, finalReason);
      setRejectingOrder(null);
      setCustomReason('');
    } finally {
      setIsSubmittingReject(false);
    }
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'PENDING':
        return <Badge label="Received" variant="warning" size="sm" />;
      case 'ACCEPTED':
        return <Badge label="Accepted" variant="info" size="sm" />;
      case 'PREPARING':
        return <Badge label="Cooking" variant="accent" size="sm" />;
      case 'READY':
        return <Badge label="Ready" variant="success" size="sm" />;
      case 'OUT_FOR_DELIVERY':
        return <Badge label="Dispatched" variant="info" size="sm" />;
      case 'COMPLETED':
        return <Badge label="Completed" variant="neutral" size="sm" />;
      case 'REJECTED':
      case 'CANCELLED':
        return <Badge label={status} variant="error" size="sm" />;
      default:
        return <Badge label={status} variant="neutral" size="sm" />;
    }
  };

  return (
    <View style={styles.container}>
      {/* Filter Tabs */}
      <View style={styles.filterBar}>
        {(['ALL', 'PENDING', 'PREPARING', 'READY', 'COMPLETED'] as const).map((tab) => {
          const isActive = statusFilter === tab;
          let count = 0;
          if (tab === 'ALL') count = orders.length;
          else if (tab === 'PENDING') count = orders.filter((o) => o.status === 'PENDING').length;
          else if (tab === 'PREPARING') count = orders.filter((o) => o.status === 'ACCEPTED' || o.status === 'PREPARING').length;
          else if (tab === 'READY') count = orders.filter((o) => o.status === 'READY').length;
          else if (tab === 'COMPLETED') count = orders.filter((o) => o.status === 'COMPLETED').length;

          return (
            <TouchableOpacity
              key={tab}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => setStatusFilter(tab)}
              accessibilityRole="button"
            >
              <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                {tab === 'ALL'
                  ? 'All Orders'
                  : tab === 'PENDING'
                  ? 'Received'
                  : tab === 'PREPARING'
                  ? 'Cooking'
                  : tab === 'READY'
                  ? 'Ready'
                  : 'Completed'}
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

      {/* Orders List */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollList}
      >
        {filteredOrders.length === 0 ? (
          <EmptyState
            title="No Orders in this Queue"
            message="Incoming orders placed by customers will appear here with live updates."
            icon="receipt-outline"
          />
        ) : (
          filteredOrders.map((order) => (
            <View key={order.id} style={styles.orderCard}>
              <View style={styles.orderCardHeader}>
                <View style={styles.orderMetaLeft}>
                  <Text style={styles.orderNumber}>#{order.orderNumber}</Text>
                  <Text style={styles.orderFulfillment}>
                    {order.fulfillmentType === 'Delivery' ? '🛵 Delivery' : order.fulfillmentType === 'Takeaway' ? '🥡 Takeaway' : '🍽️ Dine-In'}
                  </Text>
                </View>
                <View style={styles.orderMetaRight}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {getStatusBadge(order.status)}
                    {order.status === 'PENDING' && order.paymentStatus !== 'SUCCESS' ? (
                      <Badge label="Awaiting Payment" variant="warning" size="sm" />
                    ) : (
                      <Badge
                        label={order.paymentStatus === 'SUCCESS' ? 'Paid' : order.paymentStatus}
                        variant={order.paymentStatus === 'SUCCESS' ? 'success' : 'neutral'}
                        size="sm"
                      />
                    )}
                  </View>
                  <Text style={styles.orderTime}>
                    {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </View>

              {/* Items Snapshot */}
              <View style={styles.itemsList}>
                {(order.items || []).map((item, idx) => (
                  <View key={item.id || idx} style={styles.itemRow}>
                    <Text style={styles.itemQty}>{item.quantity}x</Text>
                    <Text style={styles.itemName} numberOfLines={1}>
                      {item.itemNameSnapshot}
                    </Text>
                    <Text style={styles.itemPrice}>
                      {formatTzs(item.subtotal || item.priceSnapshot * item.quantity)}
                    </Text>
                  </View>
                ))}
              </View>

              {order.specialInstructions && (
                <View style={styles.notesBox}>
                  <Ionicons name="chatbubble-ellipses-outline" size={14} color={colors.textMuted} />
                  <Text style={styles.notesText}>{order.specialInstructions}</Text>
                </View>
              )}

              {/* Bill & Actions */}
              <View style={styles.orderFooter}>
                <View>
                  <Text style={styles.totalLabel}>Total Bill</Text>
                  <Text style={styles.totalVal}>{formatTzs(order.totalTzs)}</Text>
                </View>

                <View style={styles.actionsRow}>
                  {order.status === 'PENDING' && (!userRole || userRole === 'OWNER' || userRole === 'MANAGER') && (
                    <>
                      <TouchableOpacity
                        style={styles.rejectBtn}
                        onPress={() => setRejectingOrder(order)}
                      >
                        <Text style={styles.rejectBtnText}>Reject</Text>
                      </TouchableOpacity>
                      {(() => {
                        const isPaid = order.paymentStatus === 'SUCCESS';
                        return (
                          <TouchableOpacity
                            style={[
                              styles.acceptBtn,
                              !isPaid && { opacity: 0.45, backgroundColor: colors.divider },
                            ]}
                            disabled={!isPaid}
                            onPress={() => isPaid && setAcceptingOrder(order)}
                          >
                            <Text style={[styles.acceptBtnText, !isPaid && { color: colors.textMuted }]}>
                              {isPaid ? 'Accept Order' : 'Awaiting Payment'}
                            </Text>
                          </TouchableOpacity>
                        );
                      })()}
                    </>
                  )}

                  {order.status === 'ACCEPTED' && (!userRole || userRole === 'OWNER' || userRole === 'MANAGER' || userRole === 'CHEF') && (
                    <TouchableOpacity
                      style={styles.actionTransitionBtn}
                      onPress={() => onUpdateStatus(order.id, 'PREPARING')}
                    >
                      <Ionicons name="flame" size={16} color={colors.white} />
                      <Text style={styles.actionTransitionText}>Start Cooking</Text>
                    </TouchableOpacity>
                  )}

                  {order.status === 'PREPARING' && (!userRole || userRole === 'OWNER' || userRole === 'MANAGER' || userRole === 'CHEF') && (
                    <TouchableOpacity
                      style={[styles.actionTransitionBtn, { backgroundColor: colors.success }]}
                      onPress={() => onUpdateStatus(order.id, 'READY')}
                    >
                      <Ionicons name="bag-check" size={16} color={colors.white} />
                      <Text style={styles.actionTransitionText}>Mark Ready</Text>
                    </TouchableOpacity>
                  )}

                  {order.status === 'READY' && (!userRole || userRole === 'OWNER' || userRole === 'MANAGER') && (
                    order.fulfillmentType === 'Delivery' ? (
                      <TouchableOpacity
                        style={[styles.actionTransitionBtn, { backgroundColor: '#2563eb' }]}
                        onPress={() => onUpdateStatus(order.id, 'OUT_FOR_DELIVERY')}
                        accessibilityRole="button"
                        accessibilityLabel="Dispatch Order"
                      >
                        <Ionicons name="bicycle" size={16} color={colors.white} />
                        <Text style={styles.actionTransitionText}>Dispatch Order</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={[styles.actionTransitionBtn, { backgroundColor: colors.primaryDark }]}
                        onPress={() => onUpdateStatus(order.id, 'COMPLETED')}
                        accessibilityRole="button"
                        accessibilityLabel="Hand to Customer"
                      >
                        <Ionicons name="checkmark-done" size={16} color={colors.white} />
                        <Text style={styles.actionTransitionText}>Hand to Customer</Text>
                      </TouchableOpacity>
                    )
                  )}

                  {order.status === 'OUT_FOR_DELIVERY' && (!userRole || userRole === 'OWNER' || userRole === 'MANAGER') && (
                    <TouchableOpacity
                      style={[styles.actionTransitionBtn, { backgroundColor: colors.primaryDark }]}
                      onPress={() => onUpdateStatus(order.id, 'COMPLETED')}
                      accessibilityRole="button"
                      accessibilityLabel="Delivered / Complete"
                    >
                      <Ionicons name="checkmark-done" size={16} color={colors.white} />
                      <Text style={styles.actionTransitionText}>Delivered / Complete</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Accept Modal with Estimated Time */}
      <Modal visible={Boolean(acceptingOrder)} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Accept Order #{acceptingOrder?.orderNumber}</Text>
              <TouchableOpacity onPress={() => setAcceptingOrder(null)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalPrompt}>
              Set estimated preparation time for the customer:
            </Text>

            <View style={styles.prepOptionsRow}>
              {[15, 25, 40, 60].map((mins) => (
                <TouchableOpacity
                  key={mins}
                  style={[styles.prepPill, prepMinutes === mins && styles.prepPillActive]}
                  onPress={() => setPrepMinutes(mins)}
                >
                  <Text style={[styles.prepPillText, prepMinutes === mins && styles.prepPillTextActive]}>
                    {mins} mins
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActionsRow}>
              <Button
                title="Cancel"
                onPress={() => setAcceptingOrder(null)}
                variant="outline"
                style={{ flex: 1 }}
              />
              <Button
                title={isSubmittingAccept ? 'Accepting...' : 'Confirm & Notify Kitchen'}
                onPress={handleConfirmAccept}
                loading={isSubmittingAccept}
                variant="primary"
                style={{ flex: 2 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Reject Modal with Mandatory Reason */}
      <Modal visible={Boolean(rejectingOrder)} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.danger }]}>
                Reject Order #{rejectingOrder?.orderNumber}
              </Text>
              <TouchableOpacity onPress={() => setRejectingOrder(null)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalPrompt}>
              Select reason for rejecting this order (customer will be notified):
            </Text>

            {['Item unavailable', 'Kitchen closed', 'Capacity full', 'Unable to fulfill', 'Other'].map((reason) => (
              <TouchableOpacity
                key={reason}
                style={[styles.reasonOption, rejectionReason === reason && styles.reasonOptionSelected]}
                onPress={() => setRejectionReason(reason)}
              >
                <View style={[styles.radioDot, rejectionReason === reason && styles.radioDotActive]} />
                <Text style={styles.reasonText}>{reason}</Text>
              </TouchableOpacity>
            ))}

            {rejectionReason === 'Other' && (
              <TextInput
                style={styles.customReasonInput}
                placeholder="Specify rejection reason..."
                value={customReason}
                onChangeText={setCustomReason}
              />
            )}

            <View style={styles.modalActionsRow}>
              <Button
                title="Keep Order"
                onPress={() => setRejectingOrder(null)}
                variant="outline"
                style={{ flex: 1 }}
              />
              <Button
                title={isSubmittingReject ? 'Rejecting...' : 'Confirm Rejection'}
                onPress={handleConfirmReject}
                loading={isSubmittingReject}
                variant="danger"
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
  filterBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radii.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.divider,
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryDark,
  },
  filterChipText: {
    ...Typography.Caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: colors.onPrimary,
  },
  filterCountBadge: {
    backgroundColor: colors.surfaceInteractive,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radii.full,
  },
  filterCountBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  filterCountText: {
    ...Typography.Caption,
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  filterCountTextActive: {
    color: colors.onPrimary,
  },
  scrollList: {
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  orderCard: {
    backgroundColor: colors.card,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    paddingBottom: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  orderMetaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderNumber: {
    ...Typography.H3,
    color: colors.textPrimary,
    fontWeight: '800',
  },
  orderFulfillment: {
    ...Typography.Caption,
    color: colors.textMuted,
    backgroundColor: colors.surfaceInteractive,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.sm,
  },
  orderMetaRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderTime: {
    ...Typography.Caption,
    color: colors.textMuted,
  },
  itemsList: {
    marginVertical: Spacing.xs,
    gap: 6,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemQty: {
    ...Typography.BodyMedium,
    fontWeight: '700',
    color: colors.primary,
    width: 28,
  },
  itemName: {
    ...Typography.Body,
    flex: 1,
    color: colors.textPrimary,
  },
  itemPrice: {
    ...Typography.BodyMedium,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  notesBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceInteractive,
    padding: Spacing.xs,
    borderRadius: Radii.sm,
    marginTop: 6,
  },
  notesText: {
    ...Typography.Caption,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: Spacing.sm,
    marginTop: Spacing.sm,
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  totalLabel: {
    ...Typography.Caption,
    color: colors.textMuted,
  },
  totalVal: {
    ...Typography.H3,
    color: colors.primary,
    fontWeight: '800',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  acceptBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radii.md,
  },
  acceptBtnText: {
    ...Typography.Caption,
    color: colors.onPrimary,
    fontWeight: '700',
  },
  rejectBtn: {
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radii.md,
  },
  rejectBtnText: {
    ...Typography.Caption,
    color: colors.danger,
    fontWeight: '700',
  },
  actionTransitionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radii.md,
  },
  actionTransitionText: {
    ...Typography.Caption,
    color: colors.onPrimary,
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
    maxWidth: 460,
    width: '100%',
    ...Shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  modalTitle: {
    ...Typography.H3,
    fontWeight: '700',
  },
  modalPrompt: {
    ...Typography.Body,
    color: colors.textSecondary,
    marginBottom: Spacing.md,
  },
  prepOptionsRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  prepPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  prepPillActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  prepPillText: {
    ...Typography.Caption,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  prepPillTextActive: {
    color: colors.primary,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  reasonOptionSelected: {
    backgroundColor: colors.surfaceInteractive,
    borderRadius: Radii.sm,
    paddingHorizontal: 8,
  },
  radioDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.border,
  },
  radioDotActive: {
    borderColor: colors.danger,
    backgroundColor: colors.error,
  },
  reasonText: {
    ...Typography.Body,
    color: colors.textPrimary,
  },
  customReasonInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: Radii.md,
    padding: Spacing.sm,
    marginVertical: Spacing.sm,
    ...Typography.Body,
  },
});
let styles = createStyles(lightColors);
