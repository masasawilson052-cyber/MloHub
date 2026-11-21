import React, { useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Badge } from '../ui/Badge';
import { PriceText } from '../ui/PriceText';
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
  onAddToCart: (dish: MenuItem, sourceRef?: React.RefObject<View | null>) => void;
  isDishAddPending: (dishId: string) => boolean;
  getItemCartQuantity: (dishId: string) => number;
  restaurant: any;
  selectedBranch?: any;
  onSectionLayout?: (category: string, relativeY: number) => void;
}

export const MenuSection: React.FC<MenuSectionProps> = ({
  categories,
  dbCategories = [],
  menuItems,
  onAddToCart,
  isDishAddPending,
  getItemCartQuantity,
  restaurant,
  selectedBranch,
  onSectionLayout,
}) => {
  const { t, language } = useLanguage();
  const { colors: _tc } = useTheme();
  colors = _tc;
  const styles = createStyles(colors);

  const imageRefs = useRef<Record<string, React.RefObject<View | null>>>({});

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

  // Always render ALL categories in order (jumping rather than single-category filtering)
  const allCategoryNames = useMemo(() => {
    const definedOrder = categories.filter((c) => c !== 'All');
    const existingKeys = Object.keys(groupedMenu);
    const ordered = definedOrder.filter((c) => existingKeys.includes(c));
    const remaining = existingKeys.filter((c) => !ordered.includes(c));
    return [...ordered, ...remaining];
  }, [categories, groupedMenu]);

  return (
    <View style={styles.container}>
      <View style={styles.menuContainer}>
        {allCategoryNames.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {language === 'sw'
                ? 'Hakuna vyakula vinavyopatikana kwa sasa.'
                : 'No dishes available in this category.'}
            </Text>
          </View>
        ) : (
          allCategoryNames.map((catName) => {
            const items = groupedMenu[catName] || [];
            if (items.length === 0) return null;

            return (
              <View
                key={catName}
                style={styles.categoryGroup}
                onLayout={(e) => {
                  const relY = e.nativeEvent.layout.y;
                  onSectionLayout?.(catName, relY);
                }}
              >
                {/* Category Header with localized item count */}
                <View style={styles.categoryHeader}>
                  <Text style={styles.categoryTitle}>{catName}</Text>
                  <Text style={styles.categoryCount}>
                    {items.length} {items.length === 1 ? t('itemSingularCount') : t('itemsCount')}
                  </Text>
                </View>

                {/* Dish Cards in this Category */}
                <View style={styles.cardsList}>
                  {items.map((dish, dishIdx) => {
                    const cartQty = getItemCartQuantity(dish.id);
                    const inCart = cartQty > 0;
                    const isPending = isDishAddPending(dish.id);
                    const isSoldOut = dish.isAvailable === false;
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
