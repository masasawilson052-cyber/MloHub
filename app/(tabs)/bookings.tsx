import React, { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Restaurant } from '../../types/domain';
import { ReservationModal } from '../../components/ReservationModal';
import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';
import { useMloHubDB } from '../../context/DbContext';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';

type BookingStatusTab = 'UPCOMING' | 'PAST' | 'CANCELLED';

export default function BookingsScreen() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;
  const { reservations, restaurants, cancelReservation } = useMloHubDB();

  const [activeTab, setActiveTab] = useState<BookingStatusTab>('UPCOMING');
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);

  const filteredReservations = reservations.filter((r) => {
    const st = (r.status || '').toLowerCase();
    if (activeTab === 'UPCOMING') {
      return (
        st === 'pending' ||
        st === 'pending_restaurant_approval' ||
        st === 'awaiting_deposit' ||
        st === 'confirmed' ||
        st === 'seated'
      );
    } else if (activeTab === 'PAST') {
      return st === 'completed';
    } else if (activeTab === 'CANCELLED') {
      return st === 'cancelled' || st === 'rejected' || st === 'no_show' || st === 'expired';
    }
    return false;
  });

  const handleDirections = (address: string) => {
    const encoded = encodeURIComponent(address + ', Dar es Salaam');
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encoded}`);
  };

  const handleCancelBooking = (id: string) => {
    Alert.alert(
      language === 'sw' ? 'Sitisha Uhifadhi' : 'Cancel Reservation',
      language === 'sw'
        ? 'Je, una uhakika unataka kusitisha uhifadhi huu?'
        : 'Are you sure you want to cancel this table reservation?',
      [
        { text: language === 'sw' ? 'Hapana' : 'Keep', style: 'cancel' },
        {
          text: language === 'sw' ? 'Ndio, Sitisha' : 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelReservation(id);
              Alert.alert(
                language === 'sw' ? 'Uhifadhi Umesitishwa' : 'Reservation Cancelled',
                language === 'sw' ? 'Nafasi yako imesitishwa kikamilifu.' : 'Your reservation was cancelled successfully.'
              );
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to cancel reservation');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isLargeScreen && styles.largeScreenContainer,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>
            {language === 'sw' ? 'Nafasi za Meza' : 'Table Bookings'}
          </Text>
          <Text style={styles.subtitle}>
            {language === 'sw'
              ? 'Dhibiti nafasi zako za meza zilizothibitishwa migahawani'
              : 'Manage your dining reservations and table bookings'}
          </Text>
        </View>

        {/* Reservation Segmented Control: Upcoming | Past | Cancelled */}
        <View style={styles.segmentedContainer}>
          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'UPCOMING' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('UPCOMING')}
            accessible={true}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'UPCOMING' }}
          >
            <Text style={[styles.segmentText, activeTab === 'UPCOMING' && styles.segmentTextActive]}>
              {language === 'sw' ? 'Zinazokuja' : 'Upcoming'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'PAST' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('PAST')}
            accessible={true}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'PAST' }}
          >
            <Text style={[styles.segmentText, activeTab === 'PAST' && styles.segmentTextActive]}>
              {language === 'sw' ? 'Zilizopita' : 'Past'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'CANCELLED' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('CANCELLED')}
            accessible={true}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'CANCELLED' }}
          >
            <Text style={[styles.segmentText, activeTab === 'CANCELLED' && styles.segmentTextActive]}>
              {language === 'sw' ? 'Zilizositishwa' : 'Cancelled'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* CONTENT: TABLE RESERVATIONS */}
        <View style={styles.contentSection}>
          {filteredReservations.map((b) => {
            const st = (b.status || '').toLowerCase();
            const isConfirmed = st === 'confirmed';
            const isPending = st === 'pending' || st === 'pending_restaurant_approval';
            const isCompleted = st === 'completed';

            return (
              <View key={b.id} style={styles.bookingCard}>
                <View style={styles.bookingHeader}>
                  <View style={styles.emojiBadge}>
                    <Ionicons name="restaurant" size={20} color={Colors.primary} />
                  </View>
                  <View style={styles.bookingInfo}>
                    <Text style={styles.restaurantName}>{b.restaurantName || 'Restaurant'}</Text>
                    <Text style={styles.addressText}>{b.specialNotes || b.address || 'Table Reservation'}</Text>
                  </View>
                  <Badge
                    label={isConfirmed ? 'Confirmed' : isPending ? 'Pending' : isCompleted ? 'Completed' : 'Cancelled'}
                    variant={isConfirmed ? 'success' : isPending ? 'warning' : 'neutral'}
                    size="sm"
                  />
                </View>

                <View style={styles.bookingMeta}>
                  <View style={styles.metaRow}>
                    <Ionicons name="calendar-outline" size={15} color={Colors.muted} />
                    <Text style={styles.metaVal}>{b.reservationDate} at {b.timeSlot}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Ionicons name="people-outline" size={15} color={Colors.muted} />
                    <Text style={styles.metaVal}>{b.guestsCount} {language === 'sw' ? 'Watu' : 'Guests'}</Text>
                  </View>
                </View>

                {/* Actions Row */}
                <View style={styles.bookingActionsRow}>
                  {b.address ? (
                    <TouchableOpacity
                      style={styles.actionPillBtn}
                      onPress={() => handleDirections(b.address || '')}
                    >
                      <Ionicons name="navigate-outline" size={14} color={Colors.brandInk} style={{ marginRight: 4 }} />
                      <Text style={styles.actionPillText}>{language === 'sw' ? 'Mwelekeo' : 'Directions'}</Text>
                    </TouchableOpacity>
                  ) : null}

                  {(isConfirmed || isPending) && (
                    <TouchableOpacity
                      style={[styles.actionPillBtn, styles.cancelPillBtn]}
                      onPress={() => handleCancelBooking(b.id)}
                    >
                      <Ionicons name="close-outline" size={14} color={Colors.error} style={{ marginRight: 4 }} />
                      <Text style={[styles.actionPillText, styles.cancelPillText]}>
                        {language === 'sw' ? 'Sitisha' : 'Cancel'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}

          {filteredReservations.length === 0 && (
            <EmptyState
              title={
                activeTab === 'UPCOMING'
                  ? language === 'sw' ? 'Hakuna nafasi inayokuja' : 'No upcoming reservations'
                  : activeTab === 'PAST'
                  ? language === 'sw' ? 'Hakuna historia ya meza' : 'No past reservations'
                  : language === 'sw' ? 'Hakuna meza zilizositishwa' : 'No cancelled reservations'
              }
              description={
                activeTab === 'UPCOMING'
                  ? language === 'sw'
                    ? 'Huna nafasi ya meza iliyohifadhiwa. Weka meza kwenye mgahawa unaoupenda sasa.'
                    : 'Book a table for your next meal, family dinner or special occasion.'
                  : language === 'sw'
                  ? 'Historia yako ya meza zilizopita itaonekana hapa.'
                  : 'Your completed dining table history will be listed here.'
              }
              icon="calendar-outline"
              actionLabel={language === 'sw' ? 'Weka Meza Sasa' : 'Book a Table'}
              onAction={() => {
                if (restaurants && restaurants.length > 0) {
                  setSelectedRestaurant(restaurants[0] as any);
                }
              }}
              style={styles.emptyStateContainer}
            />
          )}

          {/* Book Nearby Restaurants Section */}
          <View style={styles.nearbySection}>
            <Text style={styles.sectionHeading}>
              {language === 'sw' ? 'Weka Meza Kwenye Migahawa Hii' : 'Book a Table Nearby'}
            </Text>
            <View style={styles.restaurantList}>
              {restaurants && restaurants.length > 0 ? (
                restaurants.slice(0, 4).map((r) => (
                  <View key={r.id} style={styles.restaurantRow}>
                    <View style={styles.restaurantInfo}>
                      <Text style={styles.rName}>{r.emoji || '🍽️'} {r.name}</Text>
                      <Text style={styles.rSub}>{r.cuisine} • {r.distance || 'Dar es Salaam'}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.bookNowBtn}
                      onPress={() => setSelectedRestaurant(r as any)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.bookNowText}>
                        {language === 'sw' ? 'Weka Meza' : 'Book Table'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))
              ) : null}
            </View>
          </View>
        </View>
      </ScrollView>

      <ReservationModal
        visible={selectedRestaurant !== null}
        restaurant={selectedRestaurant}
        onClose={() => setSelectedRestaurant(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 100,
  },
  largeScreenContainer: {
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: Colors.brandInk,
    fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
  },
  subtitle: {
    fontSize: 13,
    color: Colors.muted,
    marginTop: 4,
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radii.xl,
    padding: 4,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: Radii.lg,
  },
  segmentBtnActive: {
    backgroundColor: Colors.surface,
    ...Shadows.sm,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.muted,
  },
  segmentTextActive: {
    color: Colors.brandInk,
    fontWeight: '800',
  },
  contentSection: {
    gap: Spacing.md,
  },
  bookingCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  bookingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  emojiBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  bookingInfo: {
    flex: 1,
  },
  restaurantName: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.brandInk,
  },
  addressText: {
    fontSize: 12,
    color: Colors.muted,
    marginTop: 2,
  },
  bookingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: Spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaVal: {
    fontSize: 13,
    color: Colors.brandInk,
    fontWeight: '600',
  },
  bookingActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
  },
  actionPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radii.full,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  actionPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.brandInk,
  },
  cancelPillBtn: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
  },
  cancelPillText: {
    color: Colors.error,
  },
  emptyStateContainer: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.xl,
    paddingVertical: Spacing.xxl,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  nearbySection: {
    marginTop: Spacing.xl,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.brandInk,
    marginBottom: Spacing.md,
  },
  restaurantList: {
    gap: Spacing.sm,
  },
  restaurantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: Radii.xl,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  restaurantInfo: {
    flex: 1,
  },
  rName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.brandInk,
  },
  rSub: {
    fontSize: 12,
    color: Colors.muted,
    marginTop: 2,
  },
  bookNowBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: Radii.full,
  },
  bookNowText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '800',
  },
});
