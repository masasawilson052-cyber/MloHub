import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';
import { Order, OrderStatus } from '../../types/domain';
import { formatTzs } from '../../config/platformFees';

interface OrdersMonitorProps {
  orders: Order[];
  language?: 'en' | 'sw';
}

export const OrdersMonitor: React.FC<OrdersMonitorProps> = ({
  orders,
  language = 'en',
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const getItemSummary = (ord: Order): string => {
    if (ord.items && Array.isArray(ord.items) && ord.items.length > 0) {
      return ord.items.map((i) => `${i.quantity || 1}x ${i.itemNameSnapshot || 'Dish'}`).join(', ');
    }
    return `Order #${ord.orderNumber || ord.id.slice(0, 6)}`;
  };

  const filtered = orders.filter((ord) => {
    if (statusFilter !== 'ALL' && ord.status !== statusFilter) return false;

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
          {(['ALL', 'PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'] as const).map((st) => (
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
              const totalItems = ord.items?.reduce((sum, item) => sum + (item.quantity || 1), 0) || 1;

              return (
                <View key={ord.id} style={styles.card}>
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
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
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
});
