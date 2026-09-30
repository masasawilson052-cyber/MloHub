import React, { useState, useMemo } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Platform,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import {
  useNotifications,
  Notification,
  NotificationCategory,
  NotificationType,
} from '../../context/NotificationContext';
import { useLanguage } from '../../context/LanguageContext';
import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';
import { runtimeConfig } from '../../lib/runtimeConfig';

import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

export default function NotificationsScreen() {
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);
  const router = useRouter();
  const { t, language } = useLanguage();
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;

  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    simulateIncomingNotification,
  } = useNotifications();

  // Active Category Filter Tab
  const [selectedCategory, setSelectedCategory] = useState<NotificationCategory>('all');

  // Interactive Action Modals State
  const [selectedReceiptNotif, setSelectedReceiptNotif] = useState<Notification | null>(null);
  const [selectedReservationNotif, setSelectedReservationNotif] = useState<Notification | null>(null);
  const [selectedRatingNotif, setSelectedRatingNotif] = useState<Notification | null>(null);
  const [ratingStars, setRatingStars] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Category Tabs Configuration
  const categoryTabs: { id: NotificationCategory; label: string; count: number }[] = [
    {
      id: 'all',
      label: t('notifTabAll'),
      count: notifications.length,
    },
    {
      id: 'reservation',
      label: t('notifTabReservations'),
      count: notifications.filter((n) => n.category === 'reservation').length,
    },
    {
      id: 'order',
      label: t('notifTabOrders'),
      count: notifications.filter((n) => n.category === 'order').length,
    },
    {
      id: 'payment',
      label: t('notifTabPayments'),
      count: notifications.filter((n) => n.category === 'payment').length,
    },
    {
      id: 'offer',
      label: t('notifTabOffers'),
      count: notifications.filter((n) => n.category === 'offer').length,
    },
  ];

  // Filtered list based on active tab
  const filteredNotifications = useMemo(() => {
    if (selectedCategory === 'all') return notifications;
    return notifications.filter((n) => n.category === selectedCategory);
  }, [notifications, selectedCategory]);

  // Icon, Color, & Badge Helper for Notification Types
  const getNotifMeta = (type: NotificationType) => {
    switch (type) {
      case 'reservation_confirmed':
        return { icon: 'calendar', color: colors.primary, bg: colors.primaryMuted, label: 'RESERVATION' };
      case 'reservation_pending':
        return { icon: 'time-outline', color: colors.warning, bg: colors.warningSoft, label: 'PENDING' };
      case 'reservation_cancelled':
        return { icon: 'close-circle-outline', color: colors.danger, bg: colors.dangerSoft, label: 'CANCELLED' };
      case 'reservation_reminder':
        return { icon: 'alarm-outline', color: colors.primary, bg: colors.accentLight, label: 'REMINDER' };
      case 'custom_meal_received':
        return { icon: 'mail-outline', color: colors.info, bg: colors.infoSoft, label: 'CUSTOM MEAL' };
      case 'custom_meal_accepted':
        return { icon: 'checkmark-circle-outline', color: colors.primary, bg: colors.primaryMuted, label: 'ACCEPTED' };
      case 'custom_meal_rejected':
        return { icon: 'alert-circle-outline', color: colors.warning, bg: colors.warningSoft, label: 'MEAL UPDATE' };
      case 'custom_meal_preparing':
        return { icon: 'restaurant-outline', color: colors.warning, bg: colors.warningSoft, label: 'KITCHEN' };
      case 'custom_meal_ready':
        return { icon: 'gift-outline', color: colors.primary, bg: colors.primaryMuted, label: 'ORDER READY' };
      case 'payment_success':
        return { icon: 'card-outline', color: colors.success, bg: colors.successSoft, label: 'PAYMENT' };
      case 'payment_failed':
        return { icon: 'warning-outline', color: colors.danger, bg: colors.dangerSoft, label: 'PAYMENT FAILED' };
      case 'review_reminder':
        return { icon: 'star-outline', color: colors.primary, bg: colors.accentLight, label: 'REVIEW' };
      case 'promotion':
        return { icon: 'pricetag-outline', color: colors.mutedViolet, bg: colors.violetLight, label: 'OFFER' };
      default:
        return { icon: 'notifications-outline', color: colors.textPrimary, bg: colors.surfaceInteractive, label: 'ALERT' };
    }
  };

  // Action Button Handler
  const handleCardAction = (notif: Notification) => {
    markAsRead(notif.id);

    switch (notif.actionType) {
      case 'view_receipt':
        setSelectedReceiptNotif(notif);
        break;
      case 'rate_restaurant':
        if (notif.restaurantId) {
          router.push(`/restaurant/${notif.restaurantId}`);
        } else {
          router.push('/(tabs)/orders');
        }
        break;
      case 'view_reservation':
        router.push('/(tabs)/bookings');
        break;
      case 'view_order':
        router.push('/(tabs)/orders');
        break;
      case 'get_directions':
        router.push('/(tabs)/bookings');
        break;
      case 'find_restaurant':
        if (notif.restaurantId) {
          router.push(`/restaurant/${notif.restaurantId}`);
        } else {
          router.push('/(tabs)');
        }
        break;
      case 'retry_payment':
        router.push('/(tabs)/orders');
        break;
      default:
        break;
    }
  };

  // Submit Restaurant Review
  const handleSubmitReview = () => {
    if (!selectedRatingNotif) return;
    showToast(
      language === 'sw'
        ? `✓ Asante kwa tathmini ya nyota ${ratingStars} kwa ${selectedRatingNotif.restaurantName}!`
        : `✓ Thank you for your ${ratingStars}-star rating for ${selectedRatingNotif.restaurantName}!`
    );
    setSelectedRatingNotif(null);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <View style={styles.topHeaderLeft}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </TouchableOpacity>
          <View>
            <View style={styles.titleWithBadge}>
              <Text style={styles.headerTitle}>{t('notifTitle')}</Text>
              {unreadCount > 0 && (
                <View style={styles.unreadCounterBadge}>
                  <Text style={styles.unreadCounterText}>{unreadCount}</Text>
                </View>
              )}
            </View>
            <Text style={styles.headerSub}>
              {unreadCount === 0
                ? language === 'sw' ? 'Taarifa zote zimesomwa' : 'All caught up'
                : language === 'sw' ? `${unreadCount} ambazo hazijasomwa` : `${unreadCount} unread notifications`}
            </Text>
          </View>
        </View>

        <View style={styles.topHeaderActions}>
          {unreadCount > 0 && (
            <TouchableOpacity style={styles.markAllBtn} onPress={markAllAsRead} activeOpacity={0.7}>
              <Text style={styles.markAllText}>{t('notifMarkAllRead')}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => router.push('/notifications/settings')}
            activeOpacity={0.7}
            accessibilityLabel="Notification Settings"
          >
            <Ionicons name="options-outline" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Toast Message */}
      {toastMessage && (
        <View style={styles.toastBanner}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      {/* Category Filter Chips */}
      <View style={styles.tabsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsScrollContent}
        >
          {categoryTabs.map((tab) => {
            const isSelected = selectedCategory === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tabChip, isSelected && styles.tabChipActive]}
                onPress={() => setSelectedCategory(tab.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabChipText, isSelected && styles.tabChipTextActive]}>
                  {tab.label}
                </Text>
                {tab.count > 0 && (
                  <View style={[styles.tabCountPill, isSelected && styles.tabCountPillActive]}>
                    <Text style={[styles.tabCountText, isSelected && styles.tabCountTextActive]}>
                      {tab.count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Notifications List */}
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isLargeScreen && styles.largeScreenContainer,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {filteredNotifications.length > 0 ? (
          filteredNotifications.map((notif) => {
            const meta = getNotifMeta(notif.type);
            const title = language === 'sw' ? notif.titleSw : notif.titleEn;
            const message = language === 'sw' ? notif.messageSw : notif.messageEn;
            const timeAgo = language === 'sw' ? notif.timeAgoSw : notif.timeAgoEn;

            return (
              <TouchableOpacity
                key={notif.id}
                style={[styles.card, !notif.isRead && styles.cardUnread]}
                onPress={() => markAsRead(notif.id)}
                activeOpacity={0.9}
              >
                {/* Unread Indicator Bar */}
                {!notif.isRead && <View style={styles.unreadBar} />}

                {/* Card Top Row */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <View style={[styles.iconBadge, { backgroundColor: meta.bg }]}>
                      <Ionicons name={meta.icon as any} size={17} color={meta.color} />
                    </View>

                    <View style={styles.titleWrap}>
                      <View style={styles.typeBadgeRow}>
                        <View style={[styles.typeBadge, { backgroundColor: meta.bg }]}>
                          <Text style={[styles.typeBadgeText, { color: meta.color }]}>
                            {meta.label}
                          </Text>
                        </View>
                        <Text style={styles.timeText}>{timeAgo}</Text>
                      </View>
                      <Text style={[styles.cardTitle, !notif.isRead && styles.cardTitleUnread]}>
                        {title}
                      </Text>
                    </View>
                  </View>

                  {!notif.isRead && <View style={styles.unreadDot} />}
                </View>

                {/* Body Message */}
                <Text style={styles.cardMessage}>{message}</Text>

                {/* Context Metadata Pill Row */}
                {(notif.restaurantName || notif.paymentAmount || notif.dishName || notif.guests) && (
                  <View style={styles.metadataRow}>
                    {notif.restaurantName && (
                      <View style={styles.metaPill}>
                        <Text style={styles.metaPillText}>📍 {notif.restaurantName}</Text>
                      </View>
                    )}
                    {notif.dishName && (
                      <View style={styles.metaPill}>
                        <Text style={styles.metaPillText}>🍽️ {notif.dishName}</Text>
                      </View>
                    )}
                    {notif.price && (
                      <View style={styles.metaPill}>
                        <Text style={styles.metaPillText}>💰 TZS {notif.price.toLocaleString()}</Text>
                      </View>
                    )}
                    {notif.paymentAmount && (
                      <View style={styles.metaPill}>
                        <Text style={styles.metaPillText}>
                          💳 TZS {notif.paymentAmount.toLocaleString()}
                        </Text>
                      </View>
                    )}
                    {notif.reservationTime && (
                      <View style={styles.metaPill}>
                        <Text style={styles.metaPillText}>⏱ {notif.reservationTime}</Text>
                      </View>
                    )}
                    {notif.guests && (
                      <View style={styles.metaPill}>
                        <Text style={styles.metaPillText}>👥 {notif.guests}</Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Cancellation Reason Notice */}
                {(notif.cancellationReasonEn || notif.cancellationReasonSw) && (
                  <View style={styles.reasonBox}>
                    <Text style={styles.reasonLabel}>
                      {language === 'sw' ? 'Sababu:' : 'Reason:'}
                    </Text>
                    <Text style={styles.reasonText}>
                      {language === 'sw' ? notif.cancellationReasonSw : notif.cancellationReasonEn}
                    </Text>
                  </View>
                )}

                {/* Card Action Button & Card Controls */}
                <View style={styles.cardFooter}>
                  {notif.actionType && (
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => handleCardAction(notif)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.actionBtnText}>
                        {notif.actionType === 'view_reservation' && t('notifActionViewReservation')}
                        {notif.actionType === 'view_order' && t('notifActionViewOrder')}
                        {notif.actionType === 'view_receipt' && t('notifActionViewReceipt')}
                        {notif.actionType === 'rate_restaurant' && t('notifActionRate')}
                        {notif.actionType === 'get_directions' && t('notifActionGetDirections')}
                        {notif.actionType === 'find_restaurant' && t('notifActionFindAnother')}
                        {notif.actionType === 'retry_payment' && t('notifActionRetryPayment')}
                        {' →'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  <View style={styles.cardControlActions}>
                    <TouchableOpacity
                      style={styles.controlIconBtn}
                      onPress={() => deleteNotification(notif.id)}
                      accessibilityLabel="Delete notification"
                    >
                      <Ionicons name="trash-outline" size={15} color={colors.subtle} />
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        ) : (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="notifications-off-outline" size={36} color={colors.subtle} />
            </View>
            <Text style={styles.emptyTitle}>{t('notifEmptyTitle')}</Text>
            <Text style={styles.emptySub}>{t('notifEmptySub')}</Text>
          </View>
        )}

        {/* Real-time Incoming Notification Simulator Button: Demo Mode Only */}
        {runtimeConfig.isDemo && (
          <TouchableOpacity
            style={styles.simBtn}
            onPress={() => {
              simulateIncomingNotification();
              showToast(
                language === 'sw'
                  ? '⚡ Taarifa mpya imepokelewa kwenye mfumo!'
                  : '⚡ New live notification pushed to device!'
              );
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="flash-outline" size={15} color={colors.primaryDark} />
            <Text style={styles.simBtnText}>{t('notifSimulateIncoming')}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* RECEIPT MODAL */}
      <Modal
        visible={selectedReceiptNotif !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedReceiptNotif(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.receiptTopCircle}>
              <Ionicons name="checkmark-done" size={28} color={colors.white} />
            </View>
            <Text style={styles.receiptTitle}>Official Payment Receipt</Text>

            {selectedReceiptNotif?.paymentAmount && selectedReceiptNotif?.referenceNumber ? (
              <>
                <Text style={styles.receiptAmount}>
                  TZS {selectedReceiptNotif.paymentAmount.toLocaleString()}
                </Text>
                <Text style={styles.receiptStatus}>STATUS: PAYMENT NOTIFIED</Text>

                <View style={styles.receiptDetailsBox}>
                  {selectedReceiptNotif.restaurantName && (
                    <View style={styles.receiptRow}>
                      <Text style={styles.receiptLabel}>Merchant / Restaurant</Text>
                      <Text style={styles.receiptVal}>{selectedReceiptNotif.restaurantName}</Text>
                    </View>
                  )}
                  {selectedReceiptNotif.paymentMethod && (
                    <View style={styles.receiptRow}>
                      <Text style={styles.receiptLabel}>Payment Method</Text>
                      <Text style={styles.receiptVal}>{selectedReceiptNotif.paymentMethod}</Text>
                    </View>
                  )}
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>Reference Number</Text>
                    <Text style={styles.receiptValMono}>{selectedReceiptNotif.referenceNumber}</Text>
                  </View>
                  {selectedReceiptNotif.createdAt && (
                    <View style={styles.receiptRow}>
                      <Text style={styles.receiptLabel}>Date & Time</Text>
                      <Text style={styles.receiptVal}>
                        {new Date(selectedReceiptNotif.createdAt).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                  )}
                </View>
              </>
            ) : (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <Text style={{ fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 20 }}>
                  Receipt details are unavailable for this notification.
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.modalPrimaryBtn}
              onPress={() => setSelectedReceiptNotif(null)}
            >
              <Text style={styles.modalPrimaryBtnText}>{t('doneBtn')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* RATING & REVIEW MODAL */}
      <Modal
        visible={selectedRatingNotif !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedRatingNotif(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.ratingIconCircle}>
              <Ionicons name="star" size={26} color={colors.accent} />
            </View>
            <Text style={styles.ratingModalTitle}>How Was Your Meal?</Text>
            <Text style={styles.ratingModalSub}>
              Rate your dining experience at{' '}
              <Text style={{ fontWeight: '800', color: colors.textPrimary }}>
                {selectedRatingNotif?.restaurantName}
              </Text>
            </Text>

            {/* 5-Star Interactive Selector */}
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setRatingStars(star)}
                  style={styles.starBtn}
                >
                  <Ionicons
                    name={star <= ratingStars ? 'star' : 'star-outline'}
                    size={32}
                    color={colors.accent}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.reviewInput}
              placeholder="Leave a short comment for the chef (optional)..."
              placeholderTextColor={colors.inputPlaceholder}
              multiline
              numberOfLines={3}
              value={reviewComment}
              onChangeText={setReviewComment}
            />

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setSelectedRatingNotif(null)}
              >
                <Text style={styles.modalCancelBtnText}>{t('discardBtn')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalPrimaryBtnRow}
                onPress={handleSubmitReview}
              >
                <Text style={styles.modalPrimaryBtnText}>Submit Review →</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* RESERVATION DETAIL MODAL */}
      <Modal
        visible={selectedReservationNotif !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedReservationNotif(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.resIconCircle}>
              <Ionicons name="calendar-outline" size={26} color={colors.primaryDark} />
            </View>
            <Text style={styles.receiptTitle}>Confirmed Table Booking</Text>
            <Text style={styles.resRestaurantName}>
              {selectedReservationNotif?.restaurantName}
            </Text>

            <View style={styles.receiptDetailsBox}>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Time Slot</Text>
                <Text style={styles.receiptVal}>
                  {selectedReservationNotif?.reservationTime || '07:00 PM'} ({selectedReservationNotif?.reservationDate || 'Today'})
                </Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Party Size</Text>
                <Text style={styles.receiptVal}>{selectedReservationNotif?.guests || '2 Guests'}</Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Location & Address</Text>
                <Text style={styles.receiptVal}>
                  {selectedReservationNotif?.address || 'Haile Selassie Rd, Oysterbay, Dar es Salaam'}
                </Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Guest Name</Text>
                <Text style={styles.receiptVal}>Frank Mlaki</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.modalPrimaryBtn}
              onPress={() => setSelectedReservationNotif(null)}
            >
              <Text style={styles.modalPrimaryBtnText}>{t('doneBtn')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.appBackground,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  topHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: Radii.full,
    backgroundColor: colors.appBackground,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.textPrimary,
    fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
  },
  unreadCounterBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radii.full,
  },
  unreadCounterText: {
    color: colors.onPrimary,
    fontSize: 10,
    fontWeight: '900',
  },
  headerSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  topHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  markAllBtn: {
    backgroundColor: colors.primarySoft,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: Radii.full,
  },
  markAllText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  settingsBtn: {
    width: 36,
    height: 36,
    borderRadius: Radii.full,
    backgroundColor: colors.appBackground,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  toastBanner: {
    backgroundColor: colors.primaryDark,
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
  },
  toastText: {
    color: colors.lime,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  tabsWrapper: {
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  tabsScrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: 8,
  },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radii.full,
    backgroundColor: colors.appBackground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  tabChipTextActive: {
    color: colors.onPrimary,
    fontWeight: '800',
  },
  tabCountPill: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radii.full,
  },
  tabCountPillActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  tabCountText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  tabCountTextActive: {
    color: colors.onPrimary,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 40,
  },
  largeScreenContainer: {
    maxWidth: 780,
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: Radii.xxl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
    overflow: 'hidden',
    ...Shadows.sm,
  },
  cardUnread: {
    backgroundColor: colors.card,
    borderColor: colors.primaryLight,
    ...Shadows.md,
  },
  unreadBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: colors.primary,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    flex: 1,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: Radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    flex: 1,
  },
  typeBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.sm,
  },
  typeBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  timeText: {
    fontSize: 10,
    color: colors.textMuted,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  cardTitleUnread: {
    fontWeight: '900',
    color: colors.textPrimary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: Radii.full,
    backgroundColor: colors.primary,
    marginTop: 6,
  },
  cardMessage: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
    marginTop: 2,
    marginBottom: 6,
  },
  metadataRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 4,
  },
  metaPill: {
    backgroundColor: colors.appBackground,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  metaPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  reasonBox: {
    backgroundColor: colors.dangerSoft,
    borderRadius: Radii.md,
    padding: Spacing.sm,
    marginVertical: 4,
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
  },
  reasonLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.danger,
    textTransform: 'uppercase',
  },
  reasonText: {
    fontSize: 11,
    color: colors.textPrimary,
    marginTop: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  actionBtn: {
    backgroundColor: colors.primarySoft,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: colors.primaryLight,
  },
  actionBtnText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '900',
  },
  cardControlActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 'auto',
  },
  controlIconBtn: {
    padding: 6,
  },
  emptyContainer: {
    backgroundColor: colors.card,
    borderRadius: Radii.xxl,
    padding: Spacing.xxl,
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    marginVertical: Spacing.xl,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: Radii.full,
    backgroundColor: colors.appBackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 320,
  },
  simBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primarySoft,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: Radii.xl,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    marginTop: Spacing.lg,
  },
  simBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.card,
    borderRadius: Radii.xxl,
    width: '100%',
    maxWidth: 400,
    padding: Spacing.xl,
    alignItems: 'center',
    ...Shadows.lg,
  },
  receiptTopCircle: {
    width: 56,
    height: 56,
    borderRadius: Radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  receiptTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.textPrimary,
    fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
  },
  receiptAmount: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.primary,
    marginVertical: 4,
  },
  receiptStatus: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.success,
    backgroundColor: colors.successSoft,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: Radii.full,
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
  },
  receiptDetailsBox: {
    width: '100%',
    backgroundColor: colors.appBackground,
    borderRadius: Radii.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginVertical: Spacing.sm,
    gap: 8,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptLabel: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  receiptVal: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  receiptValMono: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.primary,
    fontFamily: Platform.select({ ios: 'Courier', default: 'monospace' }),
  },
  modalPrimaryBtn: {
    width: '100%',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: Radii.xl,
    alignItems: 'center',
    marginTop: Spacing.md,
    ...Shadows.sm,
  },
  modalPrimaryBtnText: {
    color: colors.onPrimary,
    fontSize: 12,
    fontWeight: '900',
  },
  ratingIconCircle: {
    width: 52,
    height: 52,
    borderRadius: Radii.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  ratingModalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  ratingModalSub: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: Spacing.md,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: Spacing.sm,
  },
  starBtn: {
    padding: 4,
  },
  reviewInput: {
    width: '100%',
    backgroundColor: colors.appBackground,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    fontSize: 12,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 70,
    textAlignVertical: 'top',
    marginTop: Spacing.sm,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    width: '100%',
    marginTop: Spacing.md,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: colors.appBackground,
    paddingVertical: 12,
    borderRadius: Radii.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCancelBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  modalPrimaryBtnRow: {
    flex: 2,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: Radii.xl,
    alignItems: 'center',
    ...Shadows.sm,
  },
  resIconCircle: {
    width: 52,
    height: 52,
    borderRadius: Radii.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  resRestaurantName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
    marginTop: 2,
  },
});
let styles = createStyles(lightColors);
