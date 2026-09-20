import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { DishDiscoveryResult } from '../../types/discovery';
import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';
import { formatTzs, formatDistance, formatFreshnessBadge } from '../../utils/formatters';
import { useCart } from '../../context/CartContext';
import { TrustService } from '../../services/TrustService';
import { TrustExplanationModal } from '../trust/TrustExplanationModal';
import { ReportDiscrepancyModal } from '../trust/ReportDiscrepancyModal';

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
  const router = useRouter();
  const [imageError, setImageError] = useState(false);
  const [showTrustModal, setShowTrustModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const { addToCart, items } = useCart();

  const cartItem = items.find((i) => i.dishId === dish.menuItemId);
  const isDishInCart = Boolean(cartItem);

  const trustAssessment = TrustService.computeDishTrust({
    dishId: dish.menuItemId,
    dishName: dish.dishName,
    restaurantId: dish.restaurantId,
    branchId: dish.branchId,
    lastVerifiedAt: dish.lastPriceVerifiedAt || dish.lastMenuVerifiedAt,
    isAvailable: dish.isAvailable,
  });

  const freshnessBadge = formatFreshnessBadge(dish.freshnessTier);

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

  return (
    <TouchableOpacity
      style={[styles.card, !isAvailable && styles.cardUnavailable]}
      onPress={handleCardPress}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={`${dish.dishName} at ${dish.restaurantName}, ${formatTzs(dish.priceTzs)}, ${formatDistance(dish.distanceKm)} away`}
    >
      {/* Visual / Image Section */}
      <View style={styles.imageContainer}>
        {dish.imageUrl && !imageError ? (
          <Image
            source={{ uri: dish.imageUrl }}
            style={styles.image}
            resizeMode="cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <View style={styles.placeholderContainer}>
            <Text style={styles.placeholderEmoji}>🍲</Text>
            <Text style={styles.placeholderText}>MloHub Dish</Text>
          </View>
        )}

        {/* Top Badges: Trust & Availability */}
        <View style={styles.topBadgesRow}>
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
            accessibilityLabel={`Trust indicator: ${trustAssessment.badgeLabel}. Tap for verification details.`}
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
              🛡️ {trustAssessment.badgeLabel}
            </Text>
          </TouchableOpacity>

          {isAvailable ? (
            <View style={[styles.availPill, isLowStock && styles.lowStockPill]}>
              <View style={[styles.availDot, isLowStock && styles.lowStockDot]} />
              <Text style={[styles.availText, isLowStock && styles.lowStockText]}>
                {isLowStock ? 'Low Stock' : 'Available'}
              </Text>
            </View>
          ) : (
            <View style={styles.unavailPill}>
              <Text style={styles.unavailText}>Sold Out</Text>
            </View>
          )}
        </View>

        {/* Distance Tag on Image Bottom */}
        <View style={styles.distanceTag}>
          <Text style={styles.distanceText}>📍 {formatDistance(dish.distanceKm)}</Text>
        </View>
      </View>

      {/* Content Section */}
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <View style={styles.titleCol}>
            <Text style={styles.dishName} numberOfLines={1}>
              {dish.dishName}
            </Text>
            {dish.dishNameSw && dish.dishNameSw !== dish.dishName ? (
              <Text style={styles.dishNameSw} numberOfLines={1}>
                {dish.dishNameSw}
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
          <Text style={styles.dotSeparator}>•</Text>
          <Text style={styles.neighborhood} numberOfLines={1}>
            {dish.neighborhood}
          </Text>
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
              <Text style={styles.newBadgeText}>New</Text>
            </View>
          )}

          <View style={styles.actionBtnsRow}>
            {showCompareButton && onToggleCompare ? (
              <TouchableOpacity
                style={[styles.compareBtn, isCompared && styles.compareBtnActive]}
                onPress={() => onToggleCompare(dish)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={`Compare ${dish.dishName}`}
              >
                <Text style={[styles.compareBtnText, isCompared && styles.compareBtnTextActive]}>
                  {isCompared ? '✓ Comp' : '+ Comp'}
                </Text>
              </TouchableOpacity>
            ) : null}

            {isAvailable ? (
              <TouchableOpacity
                style={[styles.addOrderBtn, isDishInCart && styles.addOrderBtnInCart]}
                onPress={() =>
                  addToCart({
                    dishId: dish.menuItemId,
                    dishName: dish.dishName,
                    dishNameSwahili: dish.dishNameSw,
                    restaurantId: dish.restaurantId,
                    restaurantName: dish.restaurantName,
                    branchId: dish.branchId,
                    branchName: dish.branchName,
                    priceTzs: dish.priceTzs,
                    imageUrl: dish.imageUrl,
                  })
                }
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={`Add ${dish.dishName} to order`}
              >
                <Text style={[styles.addOrderBtnText, isDishInCart && styles.addOrderBtnTextInCart]}>
                  {isDishInCart ? `✓ ${cartItem?.quantity}` : '+ Add'}
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
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
    backgroundColor: '#f1f5f3',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e6ede8',
  },
  placeholderEmoji: {
    fontSize: 40,
  },
  placeholderText: {
    fontSize: 12,
    color: Colors.subtle,
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
    color: '#065f46',
  },
  lowStockPill: {
    backgroundColor: '#fffbeb',
  },
  lowStockDot: {
    backgroundColor: '#f59e0b',
  },
  lowStockText: {
    color: '#b45309',
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
    color: '#b91c1c',
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
    color: '#ffffff',
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
    color: Colors.text,
  },
  dishNameSw: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.muted,
    marginTop: 1,
  },
  priceText: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.primary,
  },
  restaurantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  restaurantName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.muted,
    maxWidth: '65%',
  },
  dotSeparator: {
    marginHorizontal: 6,
    color: Colors.subtle,
    fontSize: 12,
  },
  neighborhood: {
    fontSize: 12,
    color: Colors.subtle,
    fontWeight: '500',
    flexShrink: 1,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  ratingBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starIcon: {
    color: '#f59e0b',
    fontSize: 14,
    marginRight: 3,
  },
  ratingNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    marginRight: 4,
  },
  reviewsCount: {
    fontSize: 12,
    color: Colors.subtle,
  },
  newBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.muted,
  },
  compareBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radii.sm,
    backgroundColor: Colors.borderLight,
  },
  compareBtnActive: {
    backgroundColor: Colors.primaryMuted,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  compareBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text,
  },
  compareBtnTextActive: {
    color: Colors.primaryDark,
  },
  actionBtnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addOrderBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radii.sm,
    backgroundColor: Colors.primary,
  },
  addOrderBtnInCart: {
    backgroundColor: Colors.primaryMuted,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  addOrderBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  addOrderBtnTextInCart: {
    color: Colors.primaryDark,
  },
  trustPillPositive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  trustPillWarning: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  trustPillCritical: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  trustPillNeutral: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  trustPillText: {
    fontWeight: '700',
  },
  trustTextPositive: {
    color: '#15803D',
  },
  trustTextWarning: {
    color: '#B45309',
  },
  trustTextCritical: {
    color: '#B91C1C',
  },
  trustTextNeutral: {
    color: '#475569',
  },
});
