import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Badge } from '../ui/Badge';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, lightColors } from '../../theme/palettes';
import { Spacing, Radii, Shadows } from '../../constants/theme';
import { FoodImage } from '../ui/FoodImage';

let colors: ThemeColors = lightColors;

interface RestaurantHeaderProps {
  restaurant: {
    id: string;
    name: string;
    cuisine?: string;
    address?: string;
    neighborhood?: string;
    rating?: number;
    reviews?: number;
    logoUrl?: string;
    logo_url?: string;
    coverImageUrl?: string;
    cover_image_url?: string;
    coverCardUrl?: string;
    cover_card_url?: string;
    foodSpotPhotos?: string[];
    sellerTier?: string;
    seller_tier?: string;
    isVerified?: boolean;
    bgGradient?: string[];
  };
  supportsReservations: boolean;
  onOpenReserveModal: () => void;
}

import { getRestaurantInitials } from '../../utils/deliveryZoneMatcher';

export { getRestaurantInitials };

export const RestaurantHeader: React.FC<RestaurantHeaderProps> = ({
  restaurant,
  supportsReservations,
  onOpenReserveModal,
}) => {
  const router = useRouter();
  const { t, language } = useLanguage();
  const { colors: _tc } = useTheme();
  colors = _tc;
  const styles = createStyles(colors);

  const coverImage =
    restaurant.coverImageUrl ||
    restaurant.cover_image_url ||
    restaurant.foodSpotPhotos?.[0];

  const logoImage = restaurant.logoUrl || restaurant.logo_url;
  const isBasicSeller =
    restaurant.sellerTier === 'BASIC_SELLER' ||
    restaurant.seller_tier === 'BASIC_SELLER';

  return (
    <View style={styles.container}>
      {/* Banner Cover Visual */}
      <View
        style={[
          styles.visualBanner,
          {
            backgroundColor: restaurant.bgGradient
              ? restaurant.bgGradient[0]
              : colors.card,
          },
        ]}
      >
        {coverImage ? (
          <FoodImage
            source={coverImage}
            cardSource={restaurant.coverCardUrl || restaurant.cover_card_url}
            targetWidth={1200}
            style={[StyleSheet.absoluteFill, { opacity: 0.85 }]}
            priority="high"
            alt={`${restaurant.name} cover`}
          />
        ) : null}

        {/* Logo circle: Logo image or Initials in circle (No emoji) */}
        <View style={styles.logoCircle}>
          {logoImage ? (
            <FoodImage
              source={logoImage}
              targetWidth={400}
              style={styles.logoImage}
              priority="high"
              alt={`${restaurant.name} logo`}
            />
          ) : (
            <Text style={styles.logoInitials}>
              {getRestaurantInitials(restaurant.name)}
            </Text>
          )}
        </View>
      </View>

      {/* Main Header Info Card */}
      <View style={styles.infoCard}>
        {/* Verification Badge */}
        <View style={styles.badgeRow}>
          <Badge
            label={
              isBasicSeller
                ? t('mamaNtilie').toUpperCase()
                : language === 'sw'
                ? 'MGAHAWA ULIOHAKIKISHWA'
                : 'VERIFIED RESTAURANT'
            }
            variant={isBasicSeller ? 'neutral' : 'success'}
            size="sm"
          />
        </View>

        {/* Restaurant Name & Cuisine/Location */}
        <Text style={styles.name} accessibilityRole="header">
          {restaurant.name}
        </Text>
        <Text style={styles.cuisineAndArea}>
          {[restaurant.cuisine, restaurant.neighborhood || restaurant.address]
            .filter(Boolean)
            .join(' • ')}
        </Text>

        {/* Rating and Reviews */}
        <View style={styles.ratingRow}>
          {restaurant.rating && restaurant.rating > 0 ? (
            <>
              <Text style={styles.ratingStar}>
                ★ {typeof restaurant.rating === 'number' ? restaurant.rating.toFixed(1) : restaurant.rating}
              </Text>
              <Text style={styles.ratingReviews}>
                {restaurant.reviews
                  ? `(${restaurant.reviews} ${language === 'sw' ? 'maoni' : 'reviews'})`
                  : language === 'sw'
                  ? '(MloHub Imethibitishwa)'
                  : '(Verified)'}
              </Text>
            </>
          ) : (
            <Text style={styles.ratingNew}>
              ✨ {language === 'sw' ? 'Mkahawa Mpya' : 'Fresh Listing'}
            </Text>
          )}
        </View>

        {/* Action CTAs: Reserve a table (only if supportsReservations) and Custom Meal */}
        <View style={styles.actionRow}>
          {supportsReservations && (
            <TouchableOpacity
              style={styles.reserveBtn}
              onPress={onOpenReserveModal}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t('reserveTableBtn')}
            >
              <Ionicons
                name="calendar-outline"
                size={16}
                color={colors.primaryDark}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.reserveBtnText}>{t('reserveTableBtn')}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.customMealBtn, !supportsReservations && { flex: 1 }]}
            onPress={() => router.push('/(tabs)/custom')}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={language === 'sw' ? 'Omba Mlo Maalum' : 'Request Custom Meal'}
          >
            <Ionicons
              name="flame-outline"
              size={16}
              color={colors.onPrimary}
              style={{ marginRight: 6 }}
            />
            <Text style={styles.customMealBtnText}>
              {language === 'sw' ? 'Mlo Maalum' : 'Custom Dish'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      width: '100%',
    },
    visualBanner: {
      height: 180,
      width: '100%',
      position: 'relative',
      justifyContent: 'flex-end',
      paddingLeft: Spacing.md,
      paddingBottom: 16,
    },
    logoCircle: {
      width: 68,
      height: 68,
      borderRadius: Radii.full,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.card,
      ...Shadows.md,
      overflow: 'hidden',
    },
    logoImage: {
      width: '100%',
      height: '100%',
    },
    logoInitials: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.primary,
      letterSpacing: 0.5,
    },
    infoCard: {
      backgroundColor: colors.card,
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
    },
    name: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.textPrimary,
      letterSpacing: -0.5,
      marginBottom: 4,
    },
    cuisineAndArea: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 6,
    },
    ratingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: Spacing.md,
    },
    ratingStar: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.warning,
    },
    ratingReviews: {
      fontSize: 12,
      color: colors.textMuted,
    },
    ratingNew: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginTop: 2,
    },
    reserveBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceInteractive,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.md,
      height: 42,
      paddingHorizontal: Spacing.sm,
    },
    reserveBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.primaryDark,
    },
    customMealBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      borderRadius: Radii.md,
      height: 42,
      paddingHorizontal: Spacing.sm,
    },
    customMealBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.onPrimary,
    },
  });
