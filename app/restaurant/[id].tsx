import React, { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { RESTAURANTS, Restaurant } from '../../constants/data';
import { ReservationModal } from '../../components/ReservationModal';
import { GoogleMapView } from '../../components/GoogleMapView';
import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';
import { useMloHubDB } from '../../context/DbContext';

export default function RestaurantDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, language } = useLanguage();
  const { restaurants } = useMloHubDB();
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;

  const [isReserveModalOpen, setIsReserveModalOpen] = useState(false);
  const restaurant: Restaurant =
    (restaurants.find((r) => r.id === id) as any) ||
    RESTAURANTS.find((r) => r.id === id) ||
    RESTAURANTS[0];

  const coverImage = (restaurant as any).coverImageUrl || (restaurant as any).foodSpotPhotos?.[0];
  const isBasicSeller = (restaurant as any).sellerTier === 'BASIC_SELLER';

  const handleOpenGoogleMaps = () => {
    const lat = restaurant.lat;
    const lng = restaurant.lng;
    const label = encodeURIComponent(restaurant.name + ', Dar es Salaam');
    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${lat},${lng}`,
      android: `geo:0,0?q=${lat},${lng}(${label})`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${label}`,
    });

    Linking.openURL(url || `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>{language === 'sw' ? '← Rudi' : '← Back'}</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle} numberOfLines={1}>{restaurant.name}</Text>
        <TouchableOpacity style={styles.shareBtn}>
          <Text style={styles.shareText}>❤️</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isLargeScreen && styles.largeScreenContainer,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner Visual */}
        <View
          style={[
            styles.visualBanner,
            { backgroundColor: restaurant.bgGradient ? restaurant.bgGradient[0] : '#113a26' },
          ]}
        >
          {coverImage && (
            <Image
              source={{ uri: coverImage }}
              style={[StyleSheet.absoluteFillObject, { opacity: 0.6 }]}
              resizeMode="cover"
            />
          )}
          <View style={styles.emojiCircle}>
            <Text style={styles.emoji}>{restaurant.emoji || '🍲'}</Text>
          </View>
        </View>

        {/* Restaurant Header */}
        <View style={styles.headerCard}>
          <View style={styles.badgeRow}>
            <View
              style={[
                styles.verifiedBadge,
                isBasicSeller && { backgroundColor: '#eaf4ed' },
              ]}
            >
              <Text
                style={[
                  styles.verifiedText,
                  isBasicSeller && { color: '#113a26' },
                ]}
              >
                ★ {isBasicSeller
                  ? (language === 'sw' ? 'MAMA LISHE / BASIC SELLER' : 'BASIC FOOD SELLER')
                  : (language === 'sw' ? 'MGAHAWA ULIOHAKIKISHWA' : 'VERIFIED RESTAURANT')}
              </Text>
            </View>
            <View style={styles.openBadge}>
              <Text style={styles.openText}>
                {restaurant.isOpen ? t('openBadge') : t('closedBadge')}
              </Text>
            </View>
          </View>

          <Text style={styles.name}>{restaurant.name}</Text>
          <Text style={styles.cuisine}>{restaurant.cuisine} • {restaurant.address}</Text>

          {/* Quick Metrics */}
          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Text style={styles.metricStar}>★ {restaurant.rating}</Text>
              <Text style={styles.metricSub}>
                {restaurant.reviews} {language === 'sw' ? 'maoni' : 'reviews'}
              </Text>
            </View>
            <Text style={styles.divider}>|</Text>
            <View style={styles.metricItem}>
              <Text style={styles.metricVal}>⏱ {restaurant.time}</Text>
              <Text style={styles.metricSub}>
                {language === 'sw' ? 'Muda wa kupika' : 'Prep time'}
              </Text>
            </View>
            <Text style={styles.divider}>|</Text>
            <View style={styles.metricItem}>
              <Text style={styles.metricVal}>📍 {restaurant.distance}</Text>
              <Text style={styles.metricSub}>
                {language === 'sw' ? 'Kutoka hapa' : 'From you'}
              </Text>
            </View>
          </View>

          {/* Action CTAs */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.bookTableBtn}
              onPress={() => setIsReserveModalOpen(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.bookTableText}>🪑 {t('reserveBtn')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.customMealBtn}
              onPress={() => router.push('/(tabs)/custom')}
              activeOpacity={0.85}
            >
              <Text style={styles.customMealText}>
                ♨ {language === 'sw' ? 'Mlo Maalum' : 'Custom Dish'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Menu Section */}
        <Text style={styles.menuHeading}>
          {language === 'sw' ? 'Vyakula Maarufu kwenye Menyu' : 'Popular Menu Items'}
        </Text>
        <View style={styles.menuList}>
          {restaurant.menu.map((item) => (
            <View key={item.id} style={styles.menuCard}>
              <View style={styles.menuItemLeft}>
                <View style={styles.menuTitleRow}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  {item.popular && (
                    <View style={styles.popBadge}>
                      <Text style={styles.popBadgeText}>{t('topPickBadge')}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.itemDesc}>{item.desc}</Text>
              </View>
              <Text style={styles.itemPrice}>{item.price}</Text>
            </View>
          ))}
        </View>

        {/* GOOGLE MAPS LOCATION & DIRECTIONS SECTION */}
        <View style={styles.mapSectionCard}>
          <View style={styles.mapSectionHeader}>
            <View>
              <Text style={styles.mapSectionEyebrow}>
                {language === 'sw' ? 'ENEO NA MAELEKEZO' : 'LOCATION & DIRECTIONS'}
              </Text>
              <Text style={styles.mapSectionTitle}>
                {language === 'sw' ? 'Ramani ya Google Maps' : 'Google Maps Location'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.openMapsHeaderBtn}
              onPress={handleOpenGoogleMaps}
              activeOpacity={0.8}
            >
              <Ionicons name="navigate-outline" size={14} color={Colors.white} />
              <Text style={styles.openMapsHeaderText}>
                {language === 'sw' ? 'Elekea Huko' : 'Directions'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.mapAddressText}>📍 {restaurant.address}</Text>

          {/* Interactive Map Component */}
          <View style={styles.mapWrap}>
            <GoogleMapView
              restaurants={[restaurant]}
              selectedRestaurantId={restaurant.id}
              height={220}
            />
          </View>

          <TouchableOpacity
            style={styles.fullWidthDirectionsBtn}
            onPress={handleOpenGoogleMaps}
            activeOpacity={0.85}
          >
            <Ionicons name="map" size={16} color={Colors.white} />
            <Text style={styles.fullWidthDirectionsText}>
              {language === 'sw'
                ? '🧭 Fungua Google Maps kwa Maelekezo ya Barabara'
                : '🧭 Get Live Navigation via Google Maps'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Table Reservation Modal */}
      <ReservationModal
        visible={isReserveModalOpen}
        restaurant={restaurant}
        onClose={() => setIsReserveModalOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backBtn: {
    padding: 6,
  },
  backText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  topTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
    maxWidth: 200,
  },
  shareBtn: {
    padding: 6,
  },
  shareText: {
    fontSize: 16,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  largeScreenContainer: {
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
  },
  visualBanner: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiCircle: {
    width: 90,
    height: 90,
    borderRadius: Radii.full,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  emoji: {
    fontSize: 50,
  },
  headerCard: {
    backgroundColor: Colors.white,
    marginHorizontal: Spacing.lg,
    marginTop: -20,
    borderRadius: Radii.xxl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.md,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: Spacing.xs,
  },
  verifiedBadge: {
    backgroundColor: Colors.primaryMuted,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: Radii.full,
  },
  verifiedText: {
    fontSize: 9,
    fontWeight: '900',
    color: Colors.primaryDark,
  },
  openBadge: {
    backgroundColor: Colors.primary,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: Radii.full,
  },
  openText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.white,
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
    marginVertical: 4,
  },
  cuisine: {
    fontSize: 12,
    color: Colors.muted,
    marginBottom: Spacing.md,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: Colors.background,
    borderRadius: Radii.xl,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: Spacing.lg,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricStar: {
    fontSize: 13,
    fontWeight: '900',
    color: Colors.accent,
  },
  metricVal: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.text,
  },
  metricSub: {
    fontSize: 9,
    color: Colors.subtle,
    marginTop: 2,
  },
  divider: {
    color: Colors.border,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  bookTableBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: Radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  bookTableText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '900',
  },
  customMealBtn: {
    flex: 1,
    backgroundColor: Colors.primaryMuted,
    paddingVertical: 12,
    borderRadius: Radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  customMealText: {
    color: Colors.primaryDark,
    fontSize: 13,
    fontWeight: '900',
  },
  menuHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  menuList: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  menuCard: {
    backgroundColor: Colors.white,
    borderRadius: Radii.xl,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  menuItemLeft: {
    flex: 1,
    paddingRight: Spacing.md,
  },
  menuTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
  },
  popBadge: {
    backgroundColor: Colors.accentLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.sm,
  },
  popBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: Colors.accent,
  },
  itemDesc: {
    fontSize: 11,
    color: Colors.muted,
    lineHeight: 15,
  },
  itemPrice: {
    fontSize: 12,
    fontWeight: '900',
    color: Colors.primaryDark,
  },
  mapSectionCard: {
    backgroundColor: Colors.white,
    borderRadius: Radii.xxl,
    padding: Spacing.lg,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  mapSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  mapSectionEyebrow: {
    fontSize: 9,
    fontWeight: '900',
    color: Colors.primaryLight,
    letterSpacing: 0.5,
  },
  mapSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  openMapsHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1d6637',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: Radii.full,
  },
  openMapsHeaderText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: '800',
  },
  mapAddressText: {
    fontSize: 11,
    color: Colors.muted,
    marginBottom: Spacing.md,
  },
  mapWrap: {
    marginVertical: 4,
  },
  fullWidthDirectionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1d6637',
    paddingVertical: 12,
    borderRadius: Radii.xl,
    marginTop: Spacing.md,
    ...Shadows.sm,
  },
  fullWidthDirectionsText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '900',
  },
});
