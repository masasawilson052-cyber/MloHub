import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { OrderRepository } from '../../repositories/orders.repository';
import { PaymentRepository } from '../../repositories/payments.repository';
import { RefundsRepository } from '../../repositories/refunds.repository';
import { ReviewRepository } from '../../repositories/reviews.repository';
import { RealtimeEventEngine } from '../../db/realtime/eventEngine';
import { RealtimeService } from '../../services/RealtimeService';
import { Order, OrderStatus } from '../../types/domain';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Status } from '../../components/ui/Status';
import { Price } from '../../components/ui/Price';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatTzs } from '../../utils/formatters';
import { OrderTrackingTimeline } from '../../components/checkout/OrderTrackingTimeline';

const ACTIVE_STATUSES: OrderStatus[] = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY'];
const PAST_STATUSES: OrderStatus[] = ['COMPLETED', 'CANCELLED', 'REJECTED'];

export default function OrdersScreen() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const { user, isAuthenticated } = useAuth();
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;

  const [activeTab, setActiveTab] = useState<'active' | 'past'>('active');
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [refundStatuses, setRefundStatuses] = useState<Record<string, string>>({});
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [reviewOrder, setReviewOrder] = useState<Order | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  const fetchOrders = useCallback(async () => {
    if (!isAuthenticated || !user?.id) {
      setOrders([]);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      const customerOrders = await OrderRepository.listOrdersForCustomer(user.id);
      setOrders(customerOrders);
      const refunds = await RefundsRepository.listByCustomer(user.id);
      setRefundStatuses(refunds.reduce<Record<string, string>>((result, refund) => {
        if (refund.orderId && !result[refund.orderId]) result[refund.orderId] = refund.status;
        return result;
      }, {}));
    } catch (err) {
      console.warn('Could not load orders:', err);
      setOrders([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Real-time update subscription
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    const unsubRealtime = RealtimeService.subscribeToCustomerOrders(
      user.id,
      () => {
        fetchOrders();
      }
    );

    const unsubLocal = RealtimeEventEngine.subscribe(
      `orders:customer:${user.id}`,
      () => {
        fetchOrders();
      }
    );

    return () => {
      unsubRealtime();
      unsubLocal();
    };
  }, [isAuthenticated, user?.id, fetchOrders]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchOrders();
  };

  const retryPayment = async (order: Order) => {
    if (!user?.phone) {
      Alert.alert('Phone number required', 'Add a mobile-money phone number to your profile before paying.');
      return;
    }
    setIsActionLoading(true);
    try {
      const result = await PaymentRepository.createForOrder({
        orderId: order.id,
        methodCode: 'MPESA',
        payerPhone: user.phone,
        idempotencyKey: `order_payment_${order.id}`,
      });
      Alert.alert(
        result.success ? 'Payment started' : 'Payment failed',
        result.success ? 'Check your phone and approve the mobile-money request.' : (result.error || 'Could not start payment.')
      );
      if (result.success) await fetchOrders();
    } catch (error: any) {
      Alert.alert('Payment failed', error?.message || 'Could not start payment.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const submitReview = async () => {
    if (!reviewOrder) return;
    setIsActionLoading(true);
    try {
      await ReviewRepository.submitVerifiedReview({
        sourceType: 'ORDER',
        sourceId: reviewOrder.id,
        overallRating: reviewRating,
        comment: reviewComment.trim() || undefined,
      });
      Alert.alert('Review submitted', 'Thank you for reviewing your verified order.');
      setReviewOrder(null);
      setReviewComment('');
      setReviewRating(5);
    } catch (error: any) {
      Alert.alert('Review failed', error?.message || 'This order is not currently eligible for review.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const activeOrders = orders.filter((o) =>
    ACTIVE_STATUSES.includes(o.status as OrderStatus)
  );

  const pastOrders = orders.filter((o) =>
    PAST_STATUSES.includes(o.status as OrderStatus) ||
    (!ACTIVE_STATUSES.includes(o.status as OrderStatus) && !PAST_STATUSES.includes(o.status as OrderStatus))
  );

  const displayedOrders = activeTab === 'active' ? activeOrders : pastOrders;

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'PENDING':
        return {
          status: 'PENDING',
          label: language === 'sw' ? 'Imepokelewa' : 'Order Placed',
        };
      case 'ACCEPTED':
        return {
          status: 'BUSY',
          label: language === 'sw' ? 'Imekubaliwa na Jikoni' : 'Accepted by Kitchen',
        };
      case 'PREPARING':
        return {
          status: 'BUSY',
          label: language === 'sw' ? 'Inapikwa' : 'Preparing Meal',
        };
      case 'READY':
        return {
          status: 'SUCCESS',
          label: language === 'sw' ? 'Tayari Kuchukua / Kutumwa' : 'Ready for Handover',
        };
      case 'COMPLETED':
        return {
          status: 'SUCCESS',
          label: language === 'sw' ? 'Imekamilika' : 'Completed',
        };
      case 'CANCELLED':
      case 'REJECTED':
        return {
          status: 'CLOSED',
          label: language === 'sw' ? 'Imeghairiwa' : 'Cancelled',
        };
      default:
        return {
          status: 'AVAILABLE',
          label: status,
        };
    }
  };

  const getFulfillmentLabel = (type?: string) => {
    switch (type) {
      case 'Delivery':
        return language === 'sw' ? 'Uletewe na Mgahawa' : 'Restaurant Delivery';
      case 'Dine-In':
        return language === 'sw' ? 'Kula Mgahawani' : 'Dine In';
      case 'Takeaway':
      case 'Pickup':
        return language === 'sw' ? 'Chukua Mwenyewe' : 'Self Pickup';
      default:
        return type || 'Standard';
    }
  };

  // Unauthenticated Guard Screen
  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('tabOrders')}</Text>
        </View>
        <View style={styles.unauthContainer}>
          <View style={styles.unauthCard}>
            <View style={styles.iconCircle}>
              <Ionicons name="receipt-outline" size={32} color={Colors.primary} />
            </View>
            <Text style={styles.unauthTitle}>
              {language === 'sw' ? 'Fuatilia Oda Zako' : 'Track Your Orders'}
            </Text>
            <Text style={styles.unauthSub}>
              {language === 'sw'
                ? 'Ingia kwenye akaunti yako kuona maendeleo ya maagizo, stakabadhi na vyakula ulivyoagiza.'
                : 'Sign in to view real-time kitchen progress, order history, and official digital receipts.'}
            </Text>
            <Button
              title={language === 'sw' ? 'Ingia kwenye Akaunti' : 'Sign In'}
              onPress={() => router.push('/auth/login?type=customer')}
              variant="primary"
              size="lg"
              fullWidth={true}
              style={{ marginTop: Spacing.md }}
            />
            <Button
              title={language === 'sw' ? 'Gundua Vyakula' : 'Explore Dishes'}
              onPress={() => router.push('/(tabs)')}
              variant="outline"
              size="md"
              fullWidth={true}
              style={{ marginTop: Spacing.sm }}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{t('tabOrders')}</Text>
          <Text style={styles.headerSub}>
            {language === 'sw' ? 'Maagizo ya jikoni na historia ya oda' : 'Live kitchen tracking & order history'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.refreshIconBtn}
          onPress={onRefresh}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessible={true}
          accessibilityLabel="Refresh orders"
        >
          <Ionicons name="refresh-outline" size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Segmented Control */}
      <View style={styles.tabBarContainer}>
        <SegmentedControl<'active' | 'past'>
          options={[
            {
              value: 'active',
              label: `${language === 'sw' ? 'Zinazoendelea' : 'Active Orders'}${
                activeOrders.length > 0 ? ` (${activeOrders.length})` : ''
              }`,
            },
            {
              value: 'past',
              label: `${language === 'sw' ? 'Zilizopita' : 'Past Orders'}${
                pastOrders.length > 0 ? ` (${pastOrders.length})` : ''
              }`,
            },
          ]}
          selectedValue={activeTab}
          onValueChange={(val: 'active' | 'past') => setActiveTab(val)}
        />
      </View>

      {/* Main Content Area */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>
            {language === 'sw' ? 'Inapakia maagizo...' : 'Loading orders...'}
          </Text>
        </View>
      ) : displayedOrders.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyScroll}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
        >
          <EmptyState
            icon={activeTab === 'active' ? 'restaurant-outline' : 'receipt-outline'}
            title={
              activeTab === 'active'
                ? language === 'sw' ? 'Hakuna oda inayoendelea' : 'No Active Orders'
                : language === 'sw' ? 'Hakuna historia ya oda' : 'No Order History'
            }
            message={
              activeTab === 'active'
                ? language === 'sw'
                  ? 'Je, unatamani chakula gani sasa? Gundua vyakula halisi kutoka kwa migahawa iliyo wazi.'
                  : 'Hungry? Discover authentic dishes prepared fresh by local verified kitchens.'
                : language === 'sw'
                ? 'Utakapokamilisha maagizo yako, stakabadhi na maelezo yote yatahifadhiwa hapa.'
                : 'When you place and complete orders, your digital receipts and reordering options will appear here.'
            }
            actionTitle={
              activeTab === 'active'
                ? language === 'sw' ? 'Gundua Vyakula' : 'Explore Dishes'
                : undefined
            }
            onAction={
              activeTab === 'active'
                ? () => router.push('/(tabs)')
                : undefined
            }
          />
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.listContainer,
            isLargeScreen && styles.largeListContainer,
          ]}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        >
          {displayedOrders.map((order) => {
            const statusConfig = getStatusConfig(order.status);

            return (
              <View key={order.id} style={styles.orderCard}>
                {/* Order Top Bar */}
                <View style={styles.orderCardHeader}>
                  <View style={styles.orderIdentityCol}>
                    <Text style={styles.restaurantName} numberOfLines={1}>
                      {order.restaurantName || 'Restaurant Kitchen'}
                    </Text>
                    <Text style={styles.orderNumberText}>
                      #{order.orderNumber || order.id.slice(0, 8)}
                    </Text>
                  </View>
                  <Status status={statusConfig.status} label={statusConfig.label} />
                </View>

                {/* Fulfillment and Date Metadata */}
                <View style={styles.metaRow}>
                  <View style={styles.metaBadge}>
                    <Ionicons name="bicycle-outline" size={12} color={Colors.primary} />
                    <Text style={styles.metaBadgeText}>
                      {getFulfillmentLabel(order.fulfillmentType)}
                    </Text>
                  </View>
                  <Text style={styles.dateText}>
                    {new Date(order.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>

                {/* Items Preview */}
                <View style={styles.itemsBox}>
                  {(order.items || []).map((item, idx) => (
                    <View key={item.id || idx} style={styles.itemRow}>
                      <Text style={styles.itemQuantity}>{item.quantity}x</Text>
                      <Text style={styles.itemName} numberOfLines={1}>
                        {item.itemNameSnapshot || 'Dish'}
                      </Text>
                      <Price amountTzs={item.subtotal || 0} size="sm" />
                    </View>
                  ))}
                </View>

                {/* Card Footer with Total and CTA */}
                <View style={styles.orderCardFooter}>
                  <View>
                    <Text style={styles.totalLabel}>
                      {language === 'sw' ? 'Jumla ya Malipo' : 'Total Amount'}
                    </Text>
                    <Price amountTzs={order.totalTzs} size="md" />
                    {refundStatuses[order.id] ? (
                      <Text style={styles.refundStatusText}>
                        {language === 'sw' ? 'Marejesho' : 'Refund'}: {refundStatuses[order.id]}
                      </Text>
                    ) : null}
                  </View>

                  <View style={styles.cardActionsRow}>
                    <TouchableOpacity
                      style={styles.detailsBtn}
                      onPress={() => setSelectedOrder(order)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="document-text-outline" size={14} color={Colors.primary} />
                      <Text style={styles.detailsBtnText}>
                        {language === 'sw' ? 'Stakabadhi' : 'Receipt'}
                      </Text>
                    </TouchableOpacity>

                    {activeTab === 'active' && (
                      <TouchableOpacity
                        style={styles.trackBtn}
                        onPress={() => setSelectedOrder(order)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="time-outline" size={14} color="#FFFFFF" />
                        <Text style={styles.trackBtnText}>
                          {language === 'sw' ? 'Fuatilia' : 'Track'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Order Detail / Digital Receipt Modal */}
      {selectedOrder && (
        <Modal
          visible={true}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setSelectedOrder(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalSheet, isLargeScreen && styles.largeModalSheet]}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>
                    {language === 'sw' ? 'Maelezo ya Oda' : 'Order Details & Receipt'}
                  </Text>
                  <Text style={styles.modalSub}>
                    #{selectedOrder.orderNumber || selectedOrder.id}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setSelectedOrder(null)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={22} color={Colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                {/* Kitchen Status Progression Timeline */}
                <View style={styles.timelineCard}>
                  <Text style={styles.timelineTitle}>
                    {language === 'sw' ? 'Hali ya Jikoni' : 'Kitchen Status Progression'}
                  </Text>
                  {selectedOrder.estimatedPrepMinutes ? (
                    <Text style={{ fontSize: 12, color: '#64748B', marginBottom: Spacing.sm }}>
                      {language === 'sw'
                        ? `Muda wa maandalizi: takriban dakika ${selectedOrder.estimatedPrepMinutes}`
                        : `Estimated preparation: ~${selectedOrder.estimatedPrepMinutes} mins`}
                    </Text>
                  ) : null}
                  <OrderTrackingTimeline
                    status={selectedOrder.status}
                    estimatedMinutes={selectedOrder.estimatedPrepMinutes}
                  />
                </View>

                {/* Detailed Breakdown */}
                <View style={styles.breakdownCard}>
                  <Text style={styles.breakdownHeading}>
                    {language === 'sw' ? 'Orodha ya Vyakula' : 'Ordered Items'}
                  </Text>
                  {(selectedOrder.items || []).map((item, idx) => (
                    <View key={item.id || idx} style={styles.breakdownRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.breakdownItemName}>
                          {item.quantity}x {item.itemNameSnapshot}
                        </Text>
                        {item.specialNotes ? (
                          <Text style={styles.breakdownItemNote}>
                            Note: {item.specialNotes}
                          </Text>
                        ) : null}
                      </View>
                      <Text style={styles.breakdownItemPrice}>
                        {formatTzs(item.subtotal || 0)}
                      </Text>
                    </View>
                  ))}

                  <View style={styles.divider} />

                  <View style={styles.financialRow}>
                    <Text style={styles.financialLabel}>
                      {language === 'sw' ? 'Jumla Ndogo' : 'Subtotal'}
                    </Text>
                    <Text style={styles.financialVal}>
                      {formatTzs(selectedOrder.subtotalTzs)}
                    </Text>
                  </View>

                  <View style={styles.financialRow}>
                    <Text style={styles.financialLabel}>
                      {language === 'sw' ? 'Gharama ya Huduma' : 'Platform Service Fee'}
                    </Text>
                    <Text style={styles.financialVal}>
                      {formatTzs(selectedOrder.serviceFeeTzs)}
                    </Text>
                  </View>

                  {selectedOrder.deliveryFeeTzs > 0 && (
                    <View style={styles.financialRow}>
                      <Text style={styles.financialLabel}>
                        {language === 'sw' ? 'Gharama ya Usafiri' : 'Restaurant Delivery Fee'}
                      </Text>
                      <Text style={styles.financialVal}>
                        {formatTzs(selectedOrder.deliveryFeeTzs)}
                      </Text>
                    </View>
                  )}

                  <View style={[styles.financialRow, styles.grandTotalRow]}>
                    <Text style={styles.grandTotalLabel}>
                      {language === 'sw' ? 'Jumla Kuu' : 'Total Paid'}
                    </Text>
                    <Text style={styles.grandTotalVal}>
                      {formatTzs(selectedOrder.totalTzs)}
                    </Text>
                  </View>
                </View>

                {/* Delivery / Fulfillment Note */}
                <View style={styles.infoNoticeCard}>
                  <Ionicons name="information-circle-outline" size={18} color={Colors.primary} />
                  <Text style={styles.infoNoticeText}>
                    {selectedOrder.fulfillmentType === 'Delivery'
                      ? language === 'sw'
                        ? 'Uwasilishaji unasimamiwa moja kwa moja na mgahawa husika.'
                        : 'Delivery is fulfilled directly by the restaurant team. No third-party couriers.'
                      : language === 'sw'
                      ? 'Tafadhali chukua oda yako kaunta ya mgahawa ukionyesha namba hii ya oda.'
                      : 'Please show this digital receipt and order number at the restaurant counter.'}
                  </Text>
                </View>
              </ScrollView>

              <View style={styles.modalFooter}>
                {selectedOrder.paymentStatus !== 'SUCCESS' && selectedOrder.paymentStatus !== 'REFUNDED' && (
                  <Button
                    title={selectedOrder.paymentStatus === 'FAILED' ? 'Retry Payment' : 'Complete Payment'}
                    onPress={() => retryPayment(selectedOrder)}
                    variant="outline"
                    size="md"
                    fullWidth={true}
                    disabled={isActionLoading}
                    loading={isActionLoading}
                    style={{ marginBottom: Spacing.sm }}
                  />
                )}
                {selectedOrder.status === 'COMPLETED' && (
                  <Button
                    title="Rate & Review"
                    onPress={() => { setReviewOrder(selectedOrder); setSelectedOrder(null); }}
                    variant="outline"
                    size="md"
                    fullWidth={true}
                    style={{ marginBottom: Spacing.sm }}
                  />
                )}
                <Button
                  title={language === 'sw' ? 'Funga' : 'Close Receipt'}
                  onPress={() => setSelectedOrder(null)}
                  variant="primary"
                  size="md"
                  fullWidth={true}
                />
              </View>
            </View>
          </View>
        </Modal>
      )}

      {reviewOrder && (
        <Modal visible animationType="slide" transparent onRequestClose={() => setReviewOrder(null)}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalSheet, isLargeScreen && styles.largeModalSheet]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Rate & Review</Text>
                <TouchableOpacity onPress={() => setReviewOrder(null)}>
                  <Ionicons name="close" size={22} color={Colors.text} />
                </TouchableOpacity>
              </View>
              <Text style={styles.reviewPrompt}>{reviewOrder.restaurantName || 'Restaurant'}</Text>
              <View style={styles.ratingRow}>
                {[1, 2, 3, 4, 5].map((rating) => (
                  <TouchableOpacity key={rating} onPress={() => setReviewRating(rating)}>
                    <Ionicons name={rating <= reviewRating ? 'star' : 'star-outline'} size={30} color="#D97706" />
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                value={reviewComment}
                onChangeText={setReviewComment}
                placeholder="Share your experience"
                multiline
                style={styles.reviewInput}
                maxLength={1000}
              />
              <Button title="Submit Review" onPress={submitReview} variant="primary" size="md" fullWidth disabled={isActionLoading} loading={isActionLoading} />
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAF8F3', // Warm Ivory
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#142033', // Brand Ink
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  refreshIconBtn: {
    width: 38,
    height: 38,
    borderRadius: Radii.full,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2DED4',
  },
  tabBarContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: 14,
    color: '#64748B',
  },
  emptyScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  listContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl + 40,
    gap: Spacing.md,
  },
  largeListContainer: {
    maxWidth: 720,
    alignSelf: 'center',
    width: '100%',
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#E2DED4',
    ...Shadows.sm,
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  orderIdentityCol: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  restaurantName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#142033',
  },
  orderNumberText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: Spacing.sm,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F5F3ED',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.full,
  },
  metaBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#142033',
  },
  dateText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  itemsBox: {
    backgroundColor: '#FAF8F3',
    borderRadius: Radii.md,
    padding: Spacing.sm,
    gap: 6,
    marginBottom: Spacing.md,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemQuantity: {
    fontSize: 13,
    fontWeight: '700',
    color: '#142033',
    width: 24,
  },
  itemName: {
    flex: 1,
    fontSize: 13,
    color: '#334155',
    marginRight: Spacing.sm,
  },
  orderCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F5F3ED',
    paddingTop: Spacing.sm,
  },
  totalLabel: {
    fontSize: 11,
    color: '#64748B',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  refundStatusText: {
    fontSize: 11,
    color: '#0F766E',
    marginTop: 4,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  cardActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F5F3ED',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radii.full,
  },
  detailsBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#142033',
  },
  trackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#142033',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radii.full,
  },
  trackBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  reviewPrompt: {
    fontSize: 16,
    fontWeight: '700',
    color: '#142033',
    marginBottom: Spacing.md,
  },
  ratingRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  reviewInput: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: '#E2DED4',
    borderRadius: Radii.md,
    padding: Spacing.md,
    textAlignVertical: 'top',
    color: '#142033',
    marginBottom: Spacing.md,
  },
  unauthContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  unauthCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radii.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#E2DED4',
    ...Shadows.md,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F5F3ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  unauthTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#142033',
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  unauthSub: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 32, 51, 0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    maxHeight: '88%',
    paddingBottom: Spacing.lg,
  },
  largeModalSheet: {
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
    borderRadius: Radii.xl,
    marginBottom: Spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F3ED',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#142033',
  },
  modalSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F3ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    paddingHorizontal: Spacing.lg,
  },
  timelineCard: {
    backgroundColor: '#FAF8F3',
    borderRadius: Radii.lg,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  timelineTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#142033',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  timelineSteps: {
    gap: 12,
  },
  timelineStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timelineDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E2DED4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineDotDone: {
    backgroundColor: '#246B39',
  },
  timelineDotCurrent: {
    backgroundColor: '#142033',
  },
  timelineStepText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  timelineStepTextCurrent: {
    color: '#142033',
    fontWeight: '700',
  },
  breakdownCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radii.lg,
    padding: Spacing.md,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: '#E2DED4',
  },
  breakdownHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#142033',
    marginBottom: Spacing.sm,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  breakdownItemName: {
    fontSize: 13,
    color: '#142033',
    fontWeight: '500',
  },
  breakdownItemNote: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
  },
  breakdownItemPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: '#142033',
  },
  divider: {
    height: 1,
    backgroundColor: '#F5F3ED',
    marginVertical: Spacing.sm,
  },
  financialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 3,
  },
  financialLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  financialVal: {
    fontSize: 12,
    fontWeight: '600',
    color: '#142033',
  },
  grandTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#E2DED4',
    paddingTop: 6,
    marginTop: 6,
  },
  grandTotalLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#142033',
  },
  grandTotalVal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#C8482A',
  },
  infoNoticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#F5F3ED',
    padding: Spacing.md,
    borderRadius: Radii.md,
    marginTop: Spacing.md,
  },
  infoNoticeText: {
    flex: 1,
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
  },
  modalFooter: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
});
