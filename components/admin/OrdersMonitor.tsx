import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';
import { Order, OrderStatus } from '../../types/domain';
import { formatTzs } from '../../config/platformFees';
import { useTheme } from '../../context/ThemeContext';

interface OrdersMonitorProps {
  orders: Order[];
  language?: 'en' | 'sw';
}

export const OrdersMonitor: React.FC<OrdersMonitorProps> = ({
  orders,
  language = 'en',
}) => {
  const { colors, isDark } = useTheme();
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const isOrderException = (ord: Order) => {
    if (ord.status === 'CANCELLED') return { isException: true, reason: 'Cancelled' };
    if (ord.paymentStatus === 'FAILED') return { isException: true, reason: 'Payment Failed' };
    const minutesSince = Math.floor((Date.now() - new Date(ord.createdAt).getTime()) / (1000 * 60));
    if (ord.status === 'PENDING' && minutesSince > 20) return { isException: true, reason: `Pending > ${minutesSince}m` };
    if (ord.status === 'PREPARING' && minutesSince > 90) return { isException: true, reason: `Prep > ${minutesSince}m` };
    return { isException: false, reason: '' };
  };

  const getItemSummary = (ord: Order): string => {
    if (ord.items && Array.isArray(ord.items) && ord.items.length > 0) {
      return ord.items.map((i) => `${i.quantity || 1}x ${i.itemNameSnapshot || 'Dish'}`).join(', ');
    }
    return `Order #${ord.orderNumber || ord.id.slice(0, 6)}`;
  };

  const filtered = orders.filter((ord) => {
    if (statusFilter === 'EXCEPTIONS') {
      if (!isOrderException(ord).isException) return false;
    } else if (statusFilter !== 'ALL' && ord.status !== statusFilter) {
      return false;
    }

    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;

    const dish = getItemSummary(ord).toLowerCase();
    const orderNum = (ord.orderNumber || ord.id || '').toLowerCase();
    const restName = (ord.restaurantName || '').toLowerCase();
    const addr = (ord.deliveryAddress || '').toLowerCase();

    return (
      orderNum.includes(query) ||
      dish.includes(query) ||
      restName.includes(query) ||
      addr.includes(query)
    );
  });

  const exceptionsCount = orders.filter((o) => isOrderException(o).isException).length;

  const getStatusBadge = (status: OrderStatus | string) => {
    switch (status) {
      case 'COMPLETED':
        return { bg: '#dcfce7', color: '#15803d' };
      case 'ACCEPTED':
      case 'PREPARING':
        return { bg: '#e0f2fe', color: '#0369a1' };
      case 'READY':
        return { bg: '#fef3c7', color: '#b45309' };
      case 'CANCELLED':
        return { bg: '#fee2e2', color: '#b91c1c' };
      case 'PENDING':
      default:
        return { bg: '#f1f5f9', color: '#475569' };
    }
  };


  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>
            {language === 'sw' ? 'Ufuatiliaji wa Oda za Chakula' : 'Orders Operations Monitor'}
          </Text>
          <Text style={styles.subtitle}>
            Supervise fulfillment pipelines, tracking status from kitchen preparation to customer delivery.
          </Text>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controlsRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusPills}>
          <TouchableOpacity
            style={[styles.pill, statusFilter === 'ALL' && styles.pillActive]}
            onPress={() => setStatusFilter('ALL')}
          >
            <Text style={[styles.pillText, statusFilter === 'ALL' && styles.pillTextActive]}>
              All ({orders.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pill, statusFilter === 'EXCEPTIONS' && { backgroundColor: '#fee2e2', borderColor: '#fca5a5' }]}
            onPress={() => setStatusFilter('EXCEPTIONS')}
          >
            <Text style={[styles.pillText, statusFilter === 'EXCEPTIONS' ? { color: '#b91c1c', fontWeight: '800' } : { color: '#dc2626' }]}>
              Exceptions ({exceptionsCount})
            </Text>
          </TouchableOpacity>

          {(['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'] as const).map((st) => (
            <TouchableOpacity
              key={st}
              style={[styles.pill, statusFilter === st && styles.pillActive]}
              onPress={() => setStatusFilter(st)}
            >
              <Text style={[styles.pillText, statusFilter === st && styles.pillTextActive]}>
                {st}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={14} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search order #, dish, customer..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Orders List */}
      <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="cart-outline" size={48} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>No Orders Found</Text>
            <Text style={styles.emptySubtitle}>No orders match the selected filter criteria.</Text>
          </View>
        ) : (
          <View style={styles.cardsGrid}>
            {filtered.map((ord) => {
              const statusBadge = getStatusBadge(ord.status);
              const exc = isOrderException(ord);
              const totalItems = ord.items?.reduce((sum, item) => sum + (item.quantity || 1), 0) || 1;

              return (
                <TouchableOpacity
                  key={ord.id}
                  style={[styles.card, exc.isException && styles.cardException]}
                  onPress={() => setSelectedOrder(ord)}
                  activeOpacity={0.8}
                >
                  {exc.isException && (
                    <View style={styles.exceptionBanner}>
                      <Ionicons name="warning" size={12} color="#b91c1c" />
                      <Text style={styles.exceptionBannerText}>EXCEPTION: {exc.reason}</Text>
                    </View>
                  )}

                  <View style={styles.cardHeader}>
                    <View>
                      <Text style={styles.orderNumber}>#{ord.orderNumber || ord.id.slice(0, 8)}</Text>
                      <Text style={styles.restaurantName}>{ord.restaurantName || 'Restaurant'}</Text>
                    </View>
                    <View style={[styles.statusTag, { backgroundColor: statusBadge.bg }]}>
                      <Text style={[styles.statusTagText, { color: statusBadge.color }]}>
                        {ord.status}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardBody}>
                    <View style={styles.dishRow}>
                      <Ionicons name="fast-food-outline" size={14} color={Colors.primary} />
                      <Text style={styles.dishName}>{getItemSummary(ord)}</Text>
                      <Text style={styles.servingsBadge}>({totalItems} items)</Text>
                    </View>

                    <View style={styles.metaGrid}>
                      <View style={styles.metaItem}>
                        <Text style={styles.metaLabel}>Fulfillment:</Text>
                        <Text style={styles.metaValue}>{ord.fulfillmentType || 'Delivery'}</Text>
                      </View>
                      <View style={styles.metaItem}>
                        <Text style={styles.metaLabel}>Order Total:</Text>
                        <Text style={[styles.metaValue, { fontWeight: '800', color: '#0f172a' }]}>
                          {formatTzs(ord.totalTzs || 0)}
                        </Text>
                      </View>
                    </View>

                    {ord.deliveryAddress && (
                      <View style={styles.addressRow}>
                        <Ionicons name="location-outline" size={12} color="#64748b" />
                        <Text style={styles.addressText} numberOfLines={1}>
                          {ord.deliveryAddress}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.cardFooter}>
                    <Text style={styles.timeText}>
                      Placed {new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} •{' '}
                      {new Date(ord.createdAt).toLocaleDateString()}
                    </Text>
                    <View style={styles.paymentPill}>
                      <Text style={styles.paymentText}>
                        Payment: {ord.paymentStatus || 'PENDING'}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Order Detail Drawer Modal */}
      {selectedOrder && (
        <Modal visible transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.detailCard}>
              <View style={styles.detailHeader}>
                <View>
                  <Text style={styles.detailTitle}>Order #{selectedOrder.orderNumber || selectedOrder.id.slice(0, 8)}</Text>
                  <Text style={styles.detailSubtitle}>{selectedOrder.restaurantName || 'Restaurant'}</Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedOrder(null)} style={styles.closeBtn}>
                  <Ionicons name="close" size={20} color="#64748b" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.detailBody} showsVerticalScrollIndicator={false}>
                {isOrderException(selectedOrder).isException && (
                  <View style={[styles.exceptionBanner, { marginBottom: 12, paddingVertical: 8, paddingHorizontal: 12 }]}>
                    <Ionicons name="alert-circle" size={16} color="#b91c1c" />
                    <Text style={[styles.exceptionBannerText, { fontSize: 13 }]}>
                      Operational Attention: {isOrderException(selectedOrder).reason}
                    </Text>
                  </View>
                )}

                <View style={styles.detailSection}>
                  <Text style={styles.sectionHeader}>Customer & Fulfillment</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Customer:</Text>
                    <Text style={styles.detailValue}>{selectedOrder.customerName || 'Customer on file'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Phone:</Text>
                    <Text style={styles.detailValue}>{selectedOrder.customerPhone || '-'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Type:</Text>
                    <Text style={styles.detailValue}>{selectedOrder.fulfillmentType || 'Delivery'}</Text>
                  </View>
                  {selectedOrder.deliveryAddress && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Address:</Text>
                      <Text style={styles.detailValue}>{selectedOrder.deliveryAddress}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.sectionHeader}>Items Ordered</Text>
                  {(selectedOrder.items || []).map((it, idx) => (
                    <View key={idx} style={styles.itemRow}>
                      <Text style={styles.itemQty}>{it.quantity || 1}x</Text>
                      <Text style={styles.itemName}>{it.itemNameSnapshot || 'Dish'}</Text>
                      <Text style={styles.itemPrice}>{formatTzs((it.priceTzsSnapshot || 0) * (it.quantity || 1))}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.sectionHeader}>Financial Summary</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Subtotal:</Text>
                    <Text style={styles.detailValue}>{formatTzs(selectedOrder.subtotalTzs || 0)}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Delivery Fee:</Text>
                    <Text style={styles.detailValue}>{formatTzs(selectedOrder.deliveryFeeTzs || 0)}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Platform Commission:</Text>
                    <Text style={styles.detailValue}>{formatTzs(selectedOrder.platformCommissionTzs || 0)}</Text>
                  </View>
                  <View style={[styles.detailRow, { borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 6, marginTop: 4 }]}>
                    <Text style={[styles.detailLabel, { fontWeight: '800', color: '#0f172a' }]}>Total:</Text>
                    <Text style={[styles.detailValue, { fontWeight: '800', color: '#ea580c', fontSize: 15 }]}>
                      {formatTzs(selectedOrder.totalTzs || 0)}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Payment Status:</Text>
                    <Text style={[styles.detailValue, { fontWeight: '700' }]}>{selectedOrder.paymentStatus || 'PENDING'}</Text>
                  </View>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.sectionHeader}>Lifecycle Timestamps</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Created:</Text>
                    <Text style={styles.detailValue}>{new Date(selectedOrder.createdAt).toLocaleString()}</Text>
                  </View>
                  {selectedOrder.confirmedAt && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Confirmed:</Text>
                      <Text style={styles.detailValue}>{new Date(selectedOrder.confirmedAt).toLocaleString()}</Text>
                    </View>
                  )}
                  {selectedOrder.completedAt && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Completed:</Text>
                      <Text style={styles.detailValue}>{new Date(selectedOrder.completedAt).toLocaleString()}</Text>
                    </View>
                  )}
                </View>
              </ScrollView>

              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setSelectedOrder(null)}>
                <Text style={styles.modalCloseBtnText}>Close Drawer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  headerRow: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
    flexWrap: 'wrap',
  },
  statusPills: {
    flexDirection: 'row',
    gap: Spacing.xs,
    paddingRight: Spacing.md,
  },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radii.full,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pillActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  pillTextActive: {
    color: '#ffffff',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    minWidth: 220,
    gap: 6,
  },
  searchInput: {
    fontSize: 12,
    color: '#0f172a',
    flex: 1,
    padding: 0,
  },
  listContainer: {
    padding: Spacing.lg,
    paddingTop: 0,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.xs,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#94a3b8',
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: Spacing.md,
    flex: 1,
    minWidth: 320,
    maxWidth: 480,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderNumber: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  restaurantName: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.sm,
  },
  statusTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardBody: {
    gap: Spacing.xs,
    paddingVertical: 4,
  },
  dishRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dishName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
    flex: 1,
  },
  servingsBadge: {
    fontSize: 11,
    color: '#94a3b8',
  },
  metaGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    padding: Spacing.sm,
    borderRadius: Radii.sm,
    marginTop: 4,
  },
  metaItem: {
    gap: 2,
  },
  metaLabel: {
    fontSize: 10,
    color: '#64748b',
    textTransform: 'uppercase',
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  addressText: {
    fontSize: 11,
    color: '#64748b',
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: Spacing.sm,
    marginTop: 2,
  },
  timeText: {
    fontSize: 10,
    color: '#94a3b8',
  },
  paymentPill: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.sm,
  },
  paymentText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },
  cardException: {
    borderColor: '#fca5a5',
    backgroundColor: '#fffdfd',
  },
  exceptionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fee2e2',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: Radii.sm,
  },
  exceptionBannerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b91c1c',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  detailCard: {
    backgroundColor: '#ffffff',
    borderRadius: Radii.xl,
    padding: Spacing.lg,
    maxWidth: 540,
    width: '100%',
    maxHeight: '85%',
    gap: Spacing.md,
    ...Shadows.lg,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: Spacing.sm,
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  detailSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: Radii.full,
    backgroundColor: '#f1f5f9',
  },
  detailBody: {
    gap: Spacing.sm,
  },
  detailSection: {
    backgroundColor: '#f8fafc',
    borderRadius: Radii.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 13,
    color: '#64748b',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
    maxWidth: '65%',
    textAlign: 'right',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 3,
  },
  itemQty: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ea580c',
    width: 24,
  },
  itemName: {
    fontSize: 13,
    color: '#0f172a',
    flex: 1,
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  modalCloseBtn: {
    backgroundColor: '#0f172a',
    paddingVertical: 12,
    borderRadius: Radii.md,
    alignItems: 'center',
  },
  modalCloseBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});

