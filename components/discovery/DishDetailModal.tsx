import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radii, Spacing, Shadows } from '../../constants/theme';
import { formatTzs } from '../../utils/formatters';
import { useCart } from '../../context/CartContext';
import { useLanguage } from '../../context/LanguageContext';

export interface DishDetailItem {
  id: string;
  name: string;
  nameSw?: string;
  desc?: string;
  priceNum: number;
  imageUrl?: string;
  rating?: number;
  reviews?: number;
  restaurantId: string;
  restaurantName: string;
  branchId?: string;
  branchName?: string;
  dietaryTags?: string[];
}

interface DishDetailModalProps {
  visible: boolean;
  dish: DishDetailItem | null;
  onClose: () => void;
}

export const DishDetailModal: React.FC<DishDetailModalProps> = ({
  visible,
  dish,
  onClose,
}) => {
  const { language } = useLanguage();
  const { addToCart } = useCart();
  const [quantity, setQuantity] = useState(1);

  if (!dish) return null;

  const displayName = language === 'sw' && dish.nameSw ? dish.nameSw : dish.name;
  const totalPrice = dish.priceNum * quantity;

  const handleAddToCart = () => {
    if (!dish.branchId) return;
    for (let i = 0; i < quantity; i++) {
      addToCart({
        dishId: dish.id,
        dishName: dish.name,
        dishNameSwahili: dish.nameSw,
        restaurantId: dish.restaurantId,
        restaurantName: dish.restaurantName,
        branchId: dish.branchId,
        branchName: dish.branchName,
        priceTzs: dish.priceNum,
        imageUrl: dish.imageUrl,
      });
    }
    setQuantity(1);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Close button */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={20} color={Colors.brandInk} />
          </TouchableOpacity>

          {/* Dish Image */}
          <View style={styles.imageBox}>
            {dish.imageUrl ? (
              <Image source={{ uri: dish.imageUrl }} style={styles.dishImage} resizeMode="cover" />
            ) : (
              <View style={styles.placeholderBox}>
                <Text style={styles.placeholderEmoji}>🍲</Text>
              </View>
            )}
          </View>

          <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
            {/* Header info */}
            <View style={styles.headerInfo}>
              <Text style={styles.dishTitle}>{displayName}</Text>
              <Text style={styles.restaurantName}>{dish.restaurantName}</Text>

              {/* Rating if available */}
              {dish.rating && dish.rating > 0 ? (
                <View style={styles.ratingRow}>
                  <Text style={styles.starIcon}>★</Text>
                  <Text style={styles.ratingText}>{dish.rating.toFixed(1)}</Text>
                  {dish.reviews && dish.reviews > 0 ? (
                    <Text style={styles.reviewsText}>({dish.reviews} {language === 'sw' ? 'maoni' : 'reviews'})</Text>
                  ) : null}
                </View>
              ) : null}

              {/* Price */}
              <Text style={styles.priceText}>{formatTzs(dish.priceNum)}</Text>

              {/* Dietary Tags if canonical data exists */}
              {dish.dietaryTags && dish.dietaryTags.length > 0 ? (
                <View style={styles.tagsRow}>
                  {dish.dietaryTags.map((tag) => (
                    <View key={tag} style={styles.tagPill}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {/* Description */}
              {dish.desc ? (
                <View style={styles.descSection}>
                  <Text style={styles.descTitle}>{language === 'sw' ? 'Maelezo' : 'Description'}</Text>
                  <Text style={styles.descBody}>{dish.desc}</Text>
                </View>
              ) : null}
            </View>
          </ScrollView>

          {/* Quantity and Add to Cart Action Footer */}
          <View style={styles.footerBar}>
            <View style={styles.qtyControl}>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Decrease quantity"
              >
                <Ionicons name="remove" size={18} color={quantity <= 1 ? Colors.subtle : Colors.brandInk} />
              </TouchableOpacity>
              <Text style={styles.qtyText}>{quantity}</Text>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => setQuantity(quantity + 1)}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Increase quantity"
              >
                <Ionicons name="add" size={18} color={Colors.brandInk} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.addCartBtn, !Boolean(dish.branchId) && { opacity: 0.5, backgroundColor: Colors.subtle }]}
              onPress={handleAddToCart}
              disabled={!Boolean(dish.branchId)}
              activeOpacity={0.88}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={!Boolean(dish.branchId) ? "Branch unavailable" : "Add to cart"}
            >
              <Text style={styles.addCartText}>
                {!Boolean(dish.branchId)
                  ? (language === 'sw' ? 'Tawi Halipatikani' : 'Branch Unavailable')
                  : (language === 'sw' ? `Ongeza • ${formatTzs(totalPrice)}` : `Add to Cart • ${formatTzs(totalPrice)}`)}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radii.xxl,
    borderTopRightRadius: Radii.xxl,
    maxHeight: '85%',
    position: 'relative',
    ...Shadows.lg,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageBox: {
    height: 220,
    width: '100%',
    borderTopLeftRadius: Radii.xxl,
    borderTopRightRadius: Radii.xxl,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceSecondary,
  },
  dishImage: {
    width: '100%',
    height: '100%',
  },
  placeholderBox: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderEmoji: {
    fontSize: 56,
  },
  contentScroll: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  headerInfo: {
    gap: 6,
    paddingBottom: Spacing.xl,
  },
  dishTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.brandInk,
    fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
  },
  restaurantName: {
    fontSize: 13,
    color: Colors.muted,
    fontWeight: '600',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  starIcon: {
    color: '#f59e0b',
    fontSize: 14,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.brandInk,
  },
  reviewsText: {
    fontSize: 12,
    color: Colors.muted,
  },
  priceText: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.primary,
    marginTop: 4,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  tagPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.full,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.muted,
  },
  descSection: {
    marginTop: Spacing.md,
    gap: 4,
  },
  descTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.brandInk,
  },
  descBody: {
    fontSize: 13,
    color: Colors.muted,
    lineHeight: 19,
  },
  footerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    backgroundColor: Colors.surface,
  },
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radii.full,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.brandInk,
    paddingHorizontal: 12,
  },
  addCartBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: Radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
  },
  addCartText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '800',
  },
});
