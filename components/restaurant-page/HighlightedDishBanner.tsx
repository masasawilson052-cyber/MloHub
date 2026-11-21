import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { PriceText } from '../ui/PriceText';
import { FreshnessBadge } from '../ui/FreshnessBadge';
import { FoodImage } from '../ui/FoodImage';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { ThemeColors } from '../../theme/palettes';
import { Spacing, Radii } from '../../constants/theme';
import { MenuItem } from './MenuSection';

export interface HighlightedDishBannerProps {
  dish: MenuItem;
  onAddToCart: (dish: MenuItem, sourceRef?: React.RefObject<View | null>) => void;
  isPending: boolean;
}

export const HighlightedDishBanner: React.FC<HighlightedDishBannerProps> = ({
  dish,
  onAddToCart,
  isPending,
}) => {
  const { language } = useLanguage();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const dishRef = useRef<View | null>(null);

  const isSoldOut = dish.isAvailable === false;

  return (
    <View style={styles.highlightedSection}>
      <View style={styles.highlightedHeaderRow}>
        <Text style={styles.highlightedEyebrow}>
          {language === 'sw' ? 'CHAKULA ULICHOTAFUTA' : 'YOU SEARCHED FOR THIS DISH'}
        </Text>
        {dish.freshnessTier || dish.verificationTier ? (
          <FreshnessBadge
            tier={
              (dish.freshnessTier || dish.verificationTier) as any
            }
            size="sm"
          />
        ) : null}
      </View>
      <View style={styles.highlightedCard}>
        {dish.imageUrl || dish.photoUrl ? (
          <View ref={dishRef} collapsable={false} style={styles.dishThumbWrap}>
            <FoodImage
              source={dish.imageUrl || dish.photoUrl}
              cardSource={dish.photoCardUrl || dish.imageCardUrl}
              style={styles.dishThumb}
              priority="high"
              fallbackIconSize={24}
              alt={dish.name}
            />
          </View>
        ) : null}

        <View style={styles.dishInfoCol}>
          <Text style={styles.dishName}>{dish.name}</Text>
          {dish.desc ? (
            <Text style={styles.dishDesc} numberOfLines={2}>
              {dish.desc}
            </Text>
          ) : null}
          <PriceText
            amountTzs={dish.priceNum}
            size="sm"
            color={colors.primary}
            style={styles.priceRow}
          />
        </View>

        <TouchableOpacity
          style={[
            styles.addBtn,
            (isPending || isSoldOut) && { opacity: 0.65 },
          ]}
          disabled={isPending || isSoldOut}
          onPress={() => onAddToCart(dish, dishRef)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`Add ${dish.name} to order`}
        >
          <Text style={styles.addBtnText}>
            {isPending ? '...' : language === 'sw' ? '+ Ongeza' : '+ Add'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    highlightedSection: {
      marginHorizontal: Spacing.md,
      marginTop: Spacing.sm,
      marginBottom: Spacing.xs,
      padding: Spacing.sm,
      backgroundColor: colors.surfaceInteractive,
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderColor: colors.primary + '33',
    },
    highlightedHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.xs,
    },
    highlightedEyebrow: {
      fontSize: 10,
      fontWeight: '800',
      color: colors.primary,
      letterSpacing: 0.5,
    },
    highlightedCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    dishThumbWrap: {
      width: 56,
      height: 56,
      borderRadius: Radii.md,
      overflow: 'hidden',
    },
    dishThumb: {
      width: '100%',
      height: '100%',
    },
    dishInfoCol: {
      flex: 1,
      gap: 2,
    },
    dishName: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    dishDesc: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    priceRow: {
      marginTop: 2,
    },
    addBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: Spacing.sm + 2,
      paddingVertical: Spacing.xs + 2,
      borderRadius: Radii.md,
    },
    addBtnText: {
      color: colors.onPrimary || '#FFFFFF',
      fontSize: 12,
      fontWeight: '700',
    },
  });
