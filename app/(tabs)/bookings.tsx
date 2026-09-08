import React, { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RESTAURANTS, Restaurant } from '../../constants/data';
import { ReservationModal } from '../../components/ReservationModal';
import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';

export default function BookingsScreen() {
  const { t, language } = useLanguage();
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;

  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);

  // Sample confirmed reservations list
  const activeBookings = [
    {
      id: 'b-1',
      restaurantName: 'Green Leaf Café',
      date: language === 'sw' ? 'Leo, 07:30 PM' : 'Today, 07:30 PM',
      guests: language === 'sw' ? 'Wageni 2 (Meza ya watu 2)' : '2 Guests (Table for 2)',
      status: t('confirmedStatus'),
      address: 'Haile Selassie Rd, Oysterbay',
      emoji: '🥗',
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isLargeScreen && styles.largeScreenContainer,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>{t('bookingsEyebrow')}</Text>
          <Text style={styles.title}>{t('bookingsTitle')}</Text>
        </View>

        {/* Active Reservations Card */}
        <Text style={styles.sectionHeading}>{t('upcomingBookingsHeading')}</Text>
        {activeBookings.map((b) => (
          <View key={b.id} style={styles.bookingCard}>
            <View style={styles.bookingHeader}>
              <View style={styles.emojiBadge}>
                <Text style={styles.emoji}>{b.emoji}</Text>
              </View>
              <View style={styles.bookingInfo}>
                <Text style={styles.restaurantName}>{b.restaurantName}</Text>
                <Text style={styles.addressText}>{b.address}</Text>
              </View>
              <View style={styles.statusPill}>
                <Text style={styles.statusText}>{b.status}</Text>
              </View>
            </View>

            <View style={styles.bookingMeta}>
              <Text style={styles.metaLabel}>{t('timeLabel')}: <Text style={styles.metaVal}>{b.date}</Text></Text>
              <Text style={styles.metaLabel}>{t('partyLabel')}: <Text style={styles.metaVal}>{b.guests}</Text></Text>
            </View>
          </View>
        ))}

        {/* Instant New Booking Section */}
        <Text style={[styles.sectionHeading, { marginTop: Spacing.xl }]}>
          {t('bookNearbyHeading')}
        </Text>
        <View style={styles.restaurantList}>
          {RESTAURANTS.map((r) => (
            <View key={r.id} style={styles.restaurantRow}>
              <View style={styles.restaurantInfo}>
                <Text style={styles.rName}>{r.emoji} {r.name}</Text>
                <Text style={styles.rSub}>{r.cuisine} • {r.distance}</Text>
              </View>
              <TouchableOpacity
                style={styles.bookNowBtn}
                onPress={() => setSelectedRestaurant(r)}
                activeOpacity={0.8}
              >
                <Text style={styles.bookNowText}>{t('bookTableBtn')}</Text>
              </TouchableOpacity>
            </View>
          ))}
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
    paddingBottom: 40,
  },
  largeScreenContainer: {
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '900',
    color: Colors.primaryLight,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
    fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  bookingCard: {
    backgroundColor: Colors.white,
    borderRadius: Radii.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  bookingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  emojiBadge: {
    width: 40,
    height: 40,
    borderRadius: Radii.md,
    backgroundColor: Colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 20,
  },
  bookingInfo: {
    flex: 1,
  },
  restaurantName: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
  },
  addressText: {
    fontSize: 11,
    color: Colors.muted,
  },
  statusPill: {
    backgroundColor: Colors.primaryMuted,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: Radii.full,
  },
  statusText: {
    color: Colors.primaryDark,
    fontSize: 10,
    fontWeight: '900',
  },
  bookingMeta: {
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    gap: 2,
  },
  metaLabel: {
    fontSize: 11,
    color: Colors.subtle,
  },
  metaVal: {
    fontWeight: '700',
    color: Colors.text,
  },
  restaurantList: {
    backgroundColor: Colors.white,
    borderRadius: Radii.xl,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  restaurantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  restaurantInfo: {
    flex: 1,
  },
  rName: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
  },
  rSub: {
    fontSize: 11,
    color: Colors.muted,
    marginTop: 2,
  },
  bookNowBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: Radii.lg,
  },
  bookNowText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '800',
  },
});
