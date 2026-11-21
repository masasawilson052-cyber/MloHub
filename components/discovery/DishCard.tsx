import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DishDiscoveryResult } from '../../types/discovery';
import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';
import { formatTzs, formatDistance, formatFreshnessBadge } from '../../utils/formatters';
import { useCart } from '../../context/CartContext';
import { useCartInteraction } from '../../hooks/useCartInteraction';
import { TrustService } from '../../services/TrustService';
import { TrustExplanationModal } from '../trust/TrustExplanationModal';
import { ReportDiscrepancyModal } from '../trust/ReportDiscrepancyModal';
import { useLanguage } from '../../context/LanguageContext';

import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

interface DishCardProps {
  dish: DishDiscoveryResult;
  onPress?: () => void;
  onToggleCompare?: (dish: DishDiscoveryResult) => void;
  isCompared?: boolean;
  showCompareButton?: boolean;
}

export const DishCard: React.FC<DishCardProps> = ({
  dish,
  onPress,
  onToggleCompare,
  isCompared = false,
  showCompareButton = true,
}) => {
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);
  const router = useRouter();
  const { language, t, getTrustBadgeLabel } = useLanguage();
  const isSwahili = language === 'sw';
  const [imageError, setImageError] = useState(false);
  const [showTrustModal, setShowTrustModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const { items } = useCart();
  const { requestAddToCart, isDishAddPending } = useCartInteraction();
  const dishImageRef = useRef<View | null>(null);

  const dishCartQuantity = items
    .filter((i) => i.dishId === dish.menuItemId)
    .reduce((sum, i) => sum + i.quantity, 0);
  const isDishInCart = dishCartQuantity > 0;
  const isAddPending = isDishAddPending(dish.menuItemId);

  const trustAssessment = TrustService.computeDishTrust({
    dishId: dish.menuItemId,
    dishName: dish.dishName,
    restaurantId: dish.restaurantId,
    branchId: dish.branchId,
    lastVerifiedAt: dish.lastPriceVerifiedAt || dish.lastMenuVerifiedAt,
    isAvailable: dish.isAvailable,
  });

  const showTrustPill = TrustService.shouldShowBadgeOnCard(trustAssessment.badgeCode);
  const translatedTrustLabel = getTrustBadgeLabel(trustAssessment.badgeCode);

  const freshnessBadge = formatFreshnessBadge(dish.freshnessTier);

  // Language name inversion: Swahili shows name_sw title and name_en underneath; English does the reverse.
  const primaryDishName = isSwahili
    ? (dish.dishNameSw || dish.dishName)
    : (dish.dishName || dish.dishNameSw || '');
  const secondaryDishName = isSwahili
    ? (dish.dishName && dish.dishName.trim().toLowerCase() !== primaryDishName.trim().toLowerCase() ? dish.dishName : undefined)
    : (dish.dishNameSw && dish.dishNameSw.trim().toLowerCase() !== primaryDishName.trim().toLowerCase() ? dish.dishNameSw : undefined);

  // Restaurant & Area deduplication: When restaurant name and area/neighborhood are identical, show once.
  const showNeighborhood = Boolean(
    dish.neighborhood &&
    dish.neighborhood.trim().toLowerCase() !== dish.restaurantName.trim().toLowerCase()
  );

  const handleCardPress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push({
        pathname: '/restaurant/[id]',
        params: {
          id: dish.restaurantId,
          highlightDishId: dish.menuItemId,
        },
      });
    }
  };

  const isAvailable = dish.isAvailable;
  const isLowStock = dish.stockStatus === 'LOW_STOCK';
  const hasRealImage = Boolean(dish.imageUrl && !imageError);

  return (
    <TouchableOpacity
      style={[styles.card, !isAvailable && styles.cardUnavailable]}
      onPress={handleCardPress}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={`${primaryDishName} ${t('cardAccessibilityAt')} ${dish.restaurantName}, ${formatTzs(dish.priceTzs)}${dish.distanceKm != null ? `, ${formatDistance(dish.distanceKm)} ${t('cardAccessibilityAway')}` : ''}`}
    >
      {/* Visual / Image Section */}
      <View style={styles.imageContainer}>
        {hasRealImage ? (
          <View ref={dishImageRef} collapsable={false} style={styles.image}>
            <Image
              source={{ uri: dish.imageUrl }}
              style={styles.image}
              resizeMode="cover"
              onError={() => setImageError(true)}
            />
          </View>
        ) : (
          <View style={styles.placeholderContainer}>
            <Text style={styles.placeholderEmoji}>🍲</Text>
            <Text style={styles.placeholderText}>{t('mlohubDishPlaceholder')}</Text>
          </View>
        )}

        {/* Top Badges: Trust & Availability */}
        <View style={[styles.topBadgesRow, !showTrustPill && styles.topBadgesRowRightOnly]}>
          {showTrustPill ? (
            <TouchableOpacity
              style={[
                styles.badgePill,
                trustAssessment.badgeTone === 'positive' && styles.trustPillPositive,
                trustAssessment.badgeTone === 'warning' && styles.trustPillWarning,
                trustAssessment.badgeTone === 'critical' && styles.trustPillCritical,
                trustAssessment.badgeTone === 'neutral' && styles.trustPillNeutral,
              ]}
              onPress={(e) => {
                e.stopPropagation();
                setShowTrustModal(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${t('trustIndicatorLabel')}: ${translatedTrustLabel}. ${t('trustTapForDetails')}`}
            >
              <Text
                style={[
                  styles.badgePillText,
                  trustAssessment.badgeTone === 'positive' && styles.trustTextPositive,
                  trustAssessment.badgeTone === 'warning' && styles.trustTextWarning,
                  trustAssessment.badgeTone === 'critical' && styles.trustTextCritical,
                  trustAssessment.badgeTone === 'neutral' && styles.trustTextNeutral,
                ]}
              >
                🛡️ {translatedTrustLabel}
              </Text>
            </TouchableOpacity>
          ) : null}

          {isAvailable ? (
            <View style={[styles.availPill, isLowStock && styles.lowStockPill]}>
              <View style={[styles.availDot, isLowStock && styles.lowStockDot]} />
              <Text style={[styles.availText, isLowStock && styles.lowStockText]}>
                {isLowStock ? t('lowStockBadge') : t('availableBadge')}
              </Text>
            </View>
          ) : (
            <View style={styles.unavailPill}>
              <Text style={styles.unavailText}>{t('soldOutBadge')}</Text>
            </View>
          )}
        </View>

        {/* Distance Tag on Image Bottom */}
        {dish.distanceKm != null ? (
          <View style={styles.distanceTag}>
            <Text style={styles.distanceText}>📍 {formatDistance(dish.distanceKm)}</Text>
          </View>
        ) : null}
      </View>

      {/* Content Section */}
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <View style={styles.titleCol}>
            <Text style={styles.dishName} numberOfLines={1}>
              {primaryDishName}
            </Text>
            {secondaryDishName ? (
              <Text style={styles.dishNameSw} numberOfLines={1}>
                {secondaryDishName}
              </Text>
            ) : null}
          </View>

          {/* Price */}
          <Text style={styles.priceText}>{formatTzs(dish.priceTzs)}</Text>
        </View>

        {/* Restaurant & Branch Line */}
        <View style={styles.restaurantRow}>
          <Text style={styles.restaurantName} numberOfLines={1}>
            {dish.restaurantName}
          </Text>
          {showNeighborhood ? (
            <>
              <Text style={styles.dotSeparator}>•</Text>
              <Text style={styles.neighborhood} numberOfLines={1}>
                {dish.neighborhood}
              </Text>
            </>
          ) : null}
        </View>

        {/* Footer: Rating, Reviews & Compare Action */}
        <View style={styles.footerRow}>
          {dish.restaurantRating && dish.restaurantRating > 0 ? (
            <View style={styles.ratingBox}>
              <Text style={styles.starIcon}>★</Text>
              <Text style={styles.ratingNumber}>{dish.restaurantRating.toFixed(1)}</Text>
              {dish.reviewCount && dish.reviewCount > 0 ? (
                <Text style={styles.reviewsCount}>({dish.reviewCount})</Text>
              ) : null}
            </View>
          ) : (
            <View style={styles.ratingBox}>
              <Text style={styles.newBadgeText}>{t('newDishBadge')}</Text>
            </View>
          )}

          <View style={styles.actionBtnsRow}>
            {showCompareButton && onToggleCompare ? (
              <TouchableOpacity
                style={[styles.compareBtn, isCompared && styles.compareBtnActive]}
                onPress={(e) => {
                  e?.stopPropagation?.();
                  onToggleCompare(dish);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={`${t('compareActionAccessibility')}: ${primaryDishName}`}
              >
                <Ionicons
                  name={isCompared ? 'checkmark' : 'swap-horizontal'}
                  size={13}
                  color={isCompared ? colors.primary : colors.textPrimary}
                  style={styles.compareBtnIcon}
                />
                <Text
                  style={[styles.compareBtnText, isCompared && styles.compareBtnTextActive]}
                  numberOfLines={1}
                >
                  {t('compareAction')}
                </Text>
              </TouchableOpacity>
            ) : null}

            {isAvailable && Boolean(dish.branchId) ? (
              <TouchableOpacity
                style={[
                  styles.addOrderBtn,
                  isDishInCart && styles.addOrderBtnInCart,
                  isAddPending && { opacity: 0.65 },
                ]}
                disabled={isAddPending}
                onPress={(e) => {
                  e?.stopPropagation?.();
                  if (isAddPending) return;
                  void requestAddToCart(
                    {
                      dishId: dish.menuItemId,
                      dishName: dish.dishName,
                      dishNameSwahili: dish.dishNameSw,
                      description: dish.description,
                      restaurantId: dish.restaurantId,
                      restaurantName: dish.restaurantName,
                      branchId: dish.branchId,
                      branchName: dish.branchName,
                      priceTzs: dish.priceTzs,
                      imageUrl: hasRealImage ? dish.imageUrl : undefined,
                    },
                    {
                      sourceRef: dishImageRef,
                    }
                  );
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={`${t('addOrderActionAccessibility')}: ${primaryDishName}`}
              >
                <Text style={[styles.addOrderBtnText, isDishInCart && styles.addOrderBtnTextInCart]}>
                  {isAddPending ? '...' : isDishInCart ? `✓ ${dishCartQuantity}` : t('addOrderAction')}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>

      <TrustExplanationModal
        visible={showTrustModal}
        onClose={() => setShowTrustModal(false)}
        dishAssessment={trustAssessment}
        onOpenReportModal={() => setShowReportModal(true)}
      />

      <ReportDiscrepancyModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        restaurantId={dish.restaurantId}
        restaurantName={dish.restaurantName}
        branchId={dish.branchId}
        dishId={dish.menuItemId}
        dishName={dish.dishName}
        listedPrice={dish.priceTzs}
      />
    </TouchableOpacity>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: colors.divider,
    marginBottom: Spacing.md,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  cardUnavailable: {
    opacity: 0.68,
  },
  imageContainer: {
    height: 140,
    width: '100%',
    position: 'relative',
    backgroundColor: colors.surfaceInteractive,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.cardElevated,
  },
  placeholderEmoji: {
    fontSize: 40,
  },
  placeholderText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
    marginTop: 4,
  },
  topBadgesRow: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
    right: Spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topBadgesRowRightOnly: {
    justifyContent: 'flex-end',
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.full,
    borderWidth: 1,
  },
  badgePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  availPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.full,
  },
  availDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
    marginRight: 5,
  },
  availText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.success,
  },
  lowStockPill: {
    backgroundColor: colors.warningSoft,
  },
  lowStockDot: {
    backgroundColor: '#f59e0b',
  },
  lowStockText: {
    color: colors.warning,
  },
  unavailPill: {
    backgroundColor: 'rgba(254, 226, 226, 0.95)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.full,
  },
  unavailText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.danger,
  },
  distanceTag: {
    position: 'absolute',
    bottom: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: 'rgba(20, 40, 30, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.sm,
  },
  distanceText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.onPrimary,
  },
  body: {
    padding: Spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  titleCol: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  dishName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  dishNameSw: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
    marginTop: 1,
  },
  priceText: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.primary,
  },
  restaurantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  restaurantName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    maxWidth: '65%',
  },
  dotSeparator: {
    marginHorizontal: 6,
    color: colors.textMuted,
    fontSize: 12,
  },
  neighborhood: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
    flexShrink: 1,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  ratingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  starIcon: {
    color: colors.warning,
    fontSize: 14,
    marginRight: 3,
  },
  ratingNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginRight: 4,
  },
  reviewsCount: {
    fontSize: 12,
    color: colors.textMuted,
  },
  newBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  compareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: Radii.sm,
    backgroundColor: colors.divider,
  },
  compareBtnIcon: {
    marginRight: 1,
  },
  compareBtnActive: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  compareBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  compareBtnTextActive: {
    color: colors.primary,
  },
  actionBtnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  addOrderBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radii.sm,
    backgroundColor: colors.primary,
  },
  addOrderBtnInCart: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  addOrderBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  addOrderBtnTextInCart: {
    color: colors.primary,
  },
  trustPillPositive: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
  },
  trustPillWarning: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warning,
  },
  trustPillCritical: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
  },
  trustPillNeutral: {
    backgroundColor: colors.surfaceInteractive,
    borderColor: colors.border,
  },
  trustPillText: {
    fontWeight: '700',
  },
  trustTextPositive: {
    color: colors.success,
  },
  trustTextWarning: {
    color: colors.warning,
  },
  trustTextCritical: {
    color: colors.danger,
  },
  trustTextNeutral: {
    color: colors.textSecondary,
  },
});
let styles = createStyles(lightColors);
