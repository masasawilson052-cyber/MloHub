import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { Badge } from '../ui/Badge';
import { PriceText } from '../ui/PriceText';
import { FreshnessBadge } from '../ui/FreshnessBadge';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, lightColors } from '../../theme/palettes';
import { Spacing, Radii, Shadows } from '../../constants/theme';
import { FoodImage } from '../ui/FoodImage';

let colors: ThemeColors = lightColors;

export interface MenuItem {
  id: string;
  name: string;
  nameSw?: string;
  desc?: string;
  price: string;
  priceNum: number;
  popular?: boolean;
  category: string;
  categoryId?: string;
  imageUrl?: string;
  photoUrl?: string;
  photoCardUrl?: string;
  imageCardUrl?: string;
  isAvailable?: boolean;
  freshnessTier?: string;
  verificationTier?: string;
}

export interface CategoryItem {
  id: string;
  name: string;
  nameEn?: string;
  nameSw?: string;
}

export interface MenuSectionProps {
  categories: string[];
  dbCategories?: CategoryItem[];
  menuItems: MenuItem[];
  highlightedDish?: MenuItem | null;
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  onAddToCart: (dish: MenuItem, sourceRef?: React.RefObject<View | null>) => void;
  isDishAddPending: (dishId: string) => boolean;
  getItemCartQuantity: (dishId: string) => number;
  restaurant: any;
  selectedBranch?: any;
  scrollViewRef?: React.RefObject<ScrollView | null>;
}

export const MenuSection: React.FC<MenuSectionProps> = ({
  categories,
  dbCategories = [],
  menuItems,
  highlightedDish,
  selectedCategory,
  onSelectCategory,
  onAddToCart,
  isDishAddPending,
  getItemCartQuantity,
  restaurant,
  selectedBranch,
  scrollViewRef,
}) => {
  const { t, language } = useLanguage();
  const { colors: _tc } = useTheme();
  colors = _tc;
  const styles = createStyles(colors);

  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const imageRefs = useRef<Record<string, React.RefObject<View | null>>>({});
  const categoryOffsets = useRef<Record<string, number>>({});
  const highlightedRef = useRef<View | null>(null);

  const getImageRef = (dishId: string) => {
    if (!imageRefs.current[dishId]) {
      imageRefs.current[dishId] = React.createRef<View | null>();
    }
    return imageRefs.current[dishId];
  };

  // Group menu items by category
  const groupedMenu = useMemo(() => {
    const groups: Record<string, MenuItem[]> = {};
    for (const item of menuItems) {
      const cat = item.category || (language === 'sw' ? 'Vyakula' : 'Dishes');
      if (!groups[cat]) {
        groups[cat] = [];
      }
      groups[cat].push(item);
    }
    return groups;
  }, [menuItems, language]);

  // Categories to display
  const activeCategories = useMemo(() => {
    if (selectedCategory !== 'All') {
      return [selectedCategory];
    }
    return Object.keys(groupedMenu);
  }, [selectedCategory, groupedMenu]);

  const handleCategoryPress = (cat: string) => {
    onSelectCategory(cat);
    if (cat === 'All') {
      const topY = categoryOffsets.current['All'] ?? 0;
      if (scrollViewRef?.current) {
        scrollViewRef.current.scrollTo({ y: Math.max(0, topY - 10), animated: true });
      }
      return;
    }
    const targetY = categoryOffsets.current[cat];
    if (targetY != null && scrollViewRef?.current) {
      scrollViewRef.current.scrollTo({ y: Math.max(0, targetY - 60), animated: true });
    }
  };

  return (
    <View style={styles.container}>
      {/* Highlighted Dish from Discovery (Target Intent) */}
      {highlightedDish ? (
        <View style={styles.highlightedSection}>
          <View style={styles.highlightedHeaderRow}>
            <Text style={styles.highlightedEyebrow}>
              {language === 'sw' ? 'CHAKULA ULICHOTAFUTA' : 'YOU SEARCHED FOR THIS DISH'}
            </Text>
            {highlightedDish.freshnessTier || highlightedDish.verificationTier ? (
              <FreshnessBadge
                tier={
                  (highlightedDish.freshnessTier ||
                    highlightedDish.verificationTier) as any
                }
                size="sm"
              />
            ) : null}
          </View>
          <View style={styles.highlightedCard}>
            {(highlightedDish.imageUrl || highlightedDish.photoUrl) ? (
              <View ref={highlightedRef} collapsable={false} style={styles.dishThumbWrap}>
                <FoodImage
                  source={highlightedDish.imageUrl || highlightedDish.photoUrl}
                  cardSource={highlightedDish.photoCardUrl || highlightedDish.imageCardUrl}
                  style={styles.dishThumb}
                  priority="high"
                  fallbackIconSize={24}
                  alt={highlightedDish.name}
                />
              </View>
            ) : null}

            <View style={styles.dishInfoCol}>
              <Text style={styles.dishName}>{highlightedDish.name}</Text>
              {highlightedDish.desc ? (
                <Text style={styles.dishDesc} numberOfLines={2}>
                  {highlightedDish.desc}
                </Text>
              ) : null}
              <PriceText
                amountTzs={highlightedDish.priceNum}
                size="sm"
                color={colors.primary}
                style={styles.priceRow}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.addBtn,
                isDishAddPending(highlightedDish.id) && { opacity: 0.65 },
              ]}
              disabled={isDishAddPending(highlightedDish.id)}
              onPress={() => onAddToCart(highlightedDish, highlightedRef)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`Add ${highlightedDish.name} to order`}
            >
              <Text style={styles.addBtnText}>
                {isDishAddPending(highlightedDish.id) ? '...' : language === 'sw' ? '+ Ongeza' : '+ Add'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* Sticky Category Tabs Bar */}
      <View
        style={styles.stickyHeaderWrap}
        onLayout={(e) => {
          categoryOffsets.current['All'] = e.nativeEvent.layout.y;
        }}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryPillsRow}
        >
          {categories.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryPill, isActive && styles.categoryPillActive]}
                onPress={() => handleCategoryPress(cat)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`Category ${cat}`}
              >
                <Text
                  style={[
                    styles.categoryPillText,
                    isActive && styles.categoryPillTextActive,
                  ]}
                >
                  {cat === 'All' ? t('menuAllCategories') : cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Category Sections & Menu Cards */}
      <View style={styles.menuContainer}>
        {activeCategories.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {language === 'sw'
                ? 'Hakuna vyakula vinavyopatikana kwa sasa.'
                : 'No dishes available in this category.'}
            </Text>
          </View>
        ) : (
          activeCategories.map((catName) => {
            const items = groupedMenu[catName] || [];
            if (items.length === 0) return null;

            return (
              <View
                key={catName}
                style={styles.categoryGroup}
                onLayout={(e) => {
                  categoryOffsets.current[catName] = e.nativeEvent.layout.y;
                }}
              >
                {/* Category Header */}
                <View style={styles.categoryHeader}>
                  <Text style={styles.categoryTitle}>{catName}</Text>
                  <Text style={styles.categoryCount}>
                    {items.length} {language === 'sw' ? 'vyakula' : 'items'}
                  </Text>
                </View>

                {/* Dish Cards in this Category */}
                <View style={styles.cardsList}>
                  {items.map((dish, dishIdx) => {
                    const cartQty = getItemCartQuantity(dish.id);
                    const inCart = cartQty > 0;
                    const isPending = isDishAddPending(dish.id);
                    const isSoldOut = dish.isAvailable === false;
                    const hasRealImage =
                      Boolean(dish.imageUrl) && !brokenImages[dish.id];
                    const itemRef = getImageRef(dish.id);

                    return (
                      <TouchableOpacity
                        key={dish.id}
                        style={[styles.dishCard, isSoldOut && styles.dishCardSoldOut]}
                        activeOpacity={0.88}
                        onPress={() => {
                          if (isSoldOut || isPending) return;
                          onAddToCart(dish, itemRef);
                        }}
                        disabled={isSoldOut || isPending}
                        accessibilityRole="button"
                        accessibilityLabel={`${dish.name}, ${dish.price}`}
                      >
                        {(dish.imageUrl || dish.photoUrl) ? (
                          <View
                            ref={itemRef}
                            collapsable={false}
                            style={styles.dishThumbWrap}
                          >
                            <FoodImage
                              source={dish.imageUrl || dish.photoUrl}
                              cardSource={dish.photoCardUrl || dish.imageCardUrl}
                              style={styles.dishThumb}
                              priority={dishIdx < 4 ? 'high' : 'low'}
                              fallbackIconSize={24}
                              alt={dish.name}
                            />
                          </View>
                        ) : null}

                        <View style={styles.dishInfoCol}>
                          <View style={styles.dishNameRow}>
                            <Text style={styles.dishName}>{dish.name}</Text>
                            {dish.popular && !isSoldOut && (
                              <View style={styles.popBadge}>
                                <Text style={styles.popBadgeText}>
                                  {t('topPickBadge')}
                                </Text>
                              </View>
                            )}
                            {isSoldOut && (
                              <Badge
                                label={language === 'sw' ? 'Imeisha' : 'Sold Out'}
                                variant="error"
                                size="sm"
                              />
                            )}
                          </View>

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

                        {/* Add Button */}
                        <TouchableOpacity
                          style={[
                            styles.addBtn,
                            inCart && styles.addBtnInCart,
                            (isPending || isSoldOut) && { opacity: 0.65 },
                          ]}
                          disabled={isPending || isSoldOut}
                          onPress={(e) => {
                            e?.stopPropagation?.();
                            onAddToCart(dish, itemRef);
                          }}
                          activeOpacity={0.85}
                          accessibilityRole="button"
                          accessibilityLabel={`Add ${dish.name} to cart`}
                        >
                          <Text
                            style={[
                              styles.addBtnText,
                              inCart && styles.addBtnTextInCart,
                            ]}
                          >
                            {isSoldOut
                              ? language === 'sw'
                                ? 'Imeisha'
                                : 'Sold Out'
                              : isPending
                              ? '...'
                              : inCart
                              ? `✓ ${cartQty}`
                              : language === 'sw'
                              ? '+ Ongeza'
                              : '+ Add'}
                          </Text>
                        </TouchableOpacity>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          })
        )}
      </View>
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      width: '100%',
    },
    highlightedSection: {
      marginHorizontal: Spacing.md,
      marginTop: Spacing.xs,
      marginBottom: Spacing.sm,
      padding: Spacing.md,
      backgroundColor: colors.warningSoft,
      borderRadius: Radii.lg,
      borderWidth: 1.5,
      borderColor: colors.warning,
    },
    highlightedHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.xs,
    },
    highlightedEyebrow: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.warning,
      letterSpacing: 0.5,
    },
    highlightedCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: Radii.md,
      padding: Spacing.md,
      marginTop: 4,
    },
    stickyHeaderWrap: {
      position: (Platform.OS === 'web' ? 'sticky' : 'relative') as any,
      top: 0,
      zIndex: 100,
      backgroundColor: colors.card,
      paddingVertical: Spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      ...Shadows.sm,
    },
    categoryPillsRow: {
      paddingHorizontal: Spacing.md,
      gap: Spacing.xs,
    },
    categoryPill: {
      paddingHorizontal: Spacing.md,
      paddingVertical: 7,
      borderRadius: Radii.full,
      backgroundColor: colors.surfaceInteractive,
      borderWidth: 1,
      borderColor: colors.border,
    },
    categoryPillActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    categoryPillText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    categoryPillTextActive: {
      color: colors.onPrimary,
      fontWeight: '700',
    },
    menuContainer: {
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.sm,
    },
    emptyContainer: {
      paddingVertical: Spacing.xl,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 14,
      color: colors.textMuted,
    },
    categoryGroup: {
      marginBottom: Spacing.lg,
    },
    categoryHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: Spacing.sm,
      paddingBottom: 4,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    categoryTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    categoryCount: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: '500',
    },
    cardsList: {
      gap: Spacing.sm,
    },
    dishCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.card,
      borderRadius: Radii.md,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: colors.divider,
      ...Shadows.sm,
    },
    dishCardSoldOut: {
      opacity: 0.6,
    },
    dishThumbWrap: {
      width: 64,
      height: 64,
      borderRadius: Radii.md,
      overflow: 'hidden',
      backgroundColor: colors.surfaceInteractive,
      marginRight: Spacing.md,
      borderWidth: 1,
      borderColor: colors.divider,
    },
    dishThumb: {
      width: '100%',
      height: '100%',
    },
    dishInfoCol: {
      flex: 1,
      marginRight: Spacing.md,
    },
    dishNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
    },
    dishName: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    popBadge: {
      backgroundColor: colors.primarySoft,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: Radii.full,
    },
    popBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.accentDark,
    },
    dishDesc: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    priceRow: {
      marginTop: 4,
    },
    addBtn: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: Radii.sm,
      backgroundColor: colors.primary,
    },
    addBtnInCart: {
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    addBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.onPrimary,
    },
    addBtnTextInCart: {
      color: colors.primary,
    },
  });
