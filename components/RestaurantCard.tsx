import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform } from 'react-native';
import { Restaurant } from '../types/domain';
import { Colors, Spacing, Radii, Shadows } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { runtimeConfig } from '../lib/runtimeConfig';

import { useTheme } from '../context/ThemeContext';
import { ThemeColors, lightColors } from '../theme/palettes';

let colors: ThemeColors = lightColors;

interface RestaurantCardProps {
  restaurant: Restaurant;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onViewMenu: () => void;
  onReserve: () => void;
  onOrderAhead?: () => void;
}

export const RestaurantCard: React.FC<RestaurantCardProps> = ({
  restaurant,
  isFavorite,
  onToggleFavorite,
  onViewMenu,
  onReserve,
  onOrderAhead,
}) => {
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);
  const { t, language } = useLanguage();
  const coverImage = (restaurant as any).coverImageUrl || (restaurant as any).foodSpotPhotos?.[0];
  const isBasicSeller = (restaurant as any).sellerTier === 'BASIC_SELLER';

  return (
    <View style={styles.card}>
      {/* Top Visual Box */}
      <View
        style={[
          styles.visualHeader,
          { backgroundColor: restaurant.bgGradient ? restaurant.bgGradient[0] : '#113a26' },
        ]}
      >
        {coverImage ? (
          <Image
            source={{ uri: coverImage }}
            style={[StyleSheet.absoluteFill, { opacity: 0.9 }]}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.emojiCircle}>
            <Text style={styles.emoji}>{restaurant.emoji || '🍲'}</Text>
          </View>
        )}

        {/* Top Badges */}
        <View style={styles.badgeRow}>
          {/* SPECIALIST / TIER BADGE */}
          <View style={[styles.specialistTagBadge, isBasicSeller && { backgroundColor: colors.successSoft }]}>
            <Text style={[styles.specialistTagText, isBasicSeller && { color: colors.success }]}>
              {isBasicSeller
                ? (language === 'sw' ? '🍲 Mama Lishe' : '🍲 Basic Seller')
                : (language === 'sw' ? (restaurant.specialistBadgeSw || '👑 Rasmi') : (restaurant.specialistBadge || '👑 Verified'))}
            </Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              { backgroundColor: restaurant.isOpen ? colors.primary : colors.muted },
            ]}
          >
            <Text style={styles.statusBadgeText}>
              {restaurant.isOpen ? t('openBadge') : t('closedBadge')}
            </Text>
          </View>
        </View>

        {/* Favorite Heart Button */}
        <TouchableOpacity
          style={styles.favBtn}
          onPress={onToggleFavorite}
          activeOpacity={0.8}
          accessibilityLabel={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Text style={styles.favHeart}>{isFavorite ? '❤️' : '🤍'}</Text>
        </TouchableOpacity>
      </View>

      {/* Content Info */}
      <View style={styles.content}>
        {/* Name and Rating */}
        <View style={styles.headerRow}>
          <View style={styles.titleWrap}>
            <Text style={styles.name}>{restaurant.name}</Text>
            <Text style={styles.cuisine}>{restaurant.cuisine}</Text>
          </View>

          {restaurant.rating && restaurant.rating > 0 ? (
            <View style={styles.ratingBox}>
              <View style={styles.ratingPill}>
                <Text style={styles.star}>★</Text>
                <Text style={styles.ratingText}>{restaurant.rating.toFixed(1)}</Text>
              </View>
              {restaurant.reviews && restaurant.reviews > 0 ? (
                <Text style={styles.reviewCount}>
                  {restaurant.reviews} {language === 'sw' ? 'maoni' : 'reviews'}
                </Text>
              ) : null}
            </View>
          ) : (
            <View style={styles.ratingPill}>
              <Text style={styles.ratingText}>New</Text>
            </View>
          )}
        </View>

        {/* Distance & Prep Time & Neighborhood */}
        <View style={styles.metaRow}>
          {(restaurant.neighborhood || restaurant.distance) ? (
            <View style={styles.metaItem}>
              <Text style={styles.metaIcon}>📍</Text>
              <Text style={styles.metaText}>{restaurant.neighborhood || restaurant.distance}</Text>
            </View>
          ) : null}
          {restaurant.time ? (
            <>
              {(restaurant.neighborhood || restaurant.distance) ? <Text style={styles.metaDot}>•</Text> : null}
              <View style={styles.metaItem}>
                <Text style={styles.metaIcon}>⏱</Text>
                <Text style={styles.metaText}>{restaurant.time}</Text>
              </View>
            </>
          ) : null}
        </View>

        {/* Specialty highlight */}
        {restaurant.specialty ? (
          <Text style={styles.specialty} numberOfLines={2}>
            ✨ {restaurant.specialty}
          </Text>
        ) : null}

        {/* Footer with Price and CTAs */}
        <View style={styles.footerRow}>
          <View>
            <Text style={styles.priceLabel}>{t('mealsFrom')}</Text>
            <Text style={styles.priceValue}>{restaurant.price}</Text>
          </View>

          <View style={styles.actionBtns}>
            {((restaurant as any).reservationsEnabled ||
              (restaurant as any).reservations_enabled ||
              restaurant.branches?.some((b) => b.reservationsEnabled)) && (
              <TouchableOpacity
                style={styles.reserveBtn}
                onPress={onReserve}
                activeOpacity={0.8}
              >
                <Text style={styles.reserveBtnText}>{t('reserveBtn')}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.menuBtn,
                !((restaurant as any).reservationsEnabled ||
                  (restaurant as any).reservations_enabled ||
                  restaurant.branches?.some((b) => b.reservationsEnabled)) && { flex: 1, paddingHorizontal: 16 },
              ]}
              onPress={onViewMenu}
              activeOpacity={0.8}
            >
              <Text style={styles.menuBtnText}>{t('viewMenuBtn')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: Radii.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
    ...Shadows.md,
  },
  visualHeader: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  emojiCircle: {
    width: 68,
    height: 68,
    borderRadius: Radii.full,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  emoji: {
    fontSize: 34,
  },
  badgeRow: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  specialistTagBadge: {
    backgroundColor: '#113a26',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: Radii.full,
    ...Shadows.sm,
  },
  specialistTagText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#e8c468',
    letterSpacing: 0.2,
  },
  statusBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: Radii.full,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.onPrimary,
  },
  favBtn: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  favHeart: {
    fontSize: 16,
  },
  content: {
    padding: Spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleWrap: {
    flex: 1,
    paddingRight: Spacing.sm,
  },
  name: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
  },
  cuisine: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  ratingBox: {
    alignItems: 'flex-end',
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: Radii.sm,
    gap: 3,
  },
  star: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '900',
  },
  ratingText: {
    color: colors.warning,
    fontSize: 11,
    fontWeight: '900',
  },
  reviewCount: {
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    gap: 6,
    flexWrap: 'wrap',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaIcon: {
    fontSize: 10,
  },
  metaText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  metaDot: {
    color: colors.border,
    fontSize: 10,
  },
  orderAheadPill: {
    backgroundColor: colors.successSoft,
    paddingVertical: 1,
    paddingHorizontal: 6,
    borderRadius: Radii.sm,
    borderWidth: 0.5,
    borderColor: colors.success,
  },
  orderAheadText: {
    fontSize: 9.5,
    color: colors.success,
    fontWeight: '800',
  },
  specialty: {
    fontSize: 11,
    color: colors.textPrimary,
    marginTop: Spacing.xs,
    fontStyle: 'italic',
    lineHeight: 15,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  priceLabel: {
    fontSize: 9,
    color: colors.textMuted,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  priceValue: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.primary,
  },
  actionBtns: {
    flexDirection: 'row',
    gap: 6,
  },
  reserveBtn: {
    backgroundColor: colors.primarySoft,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reserveBtnText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  menuBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuBtnText: {
    color: colors.onPrimary,
    fontSize: 11,
    fontWeight: '800',
  },
});
let styles = createStyles(lightColors);
