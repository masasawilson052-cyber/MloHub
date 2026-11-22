import React from 'react';
import { View, Text } from 'react-native';
import { useLanguage, formatItemCount } from '../../context/LanguageContext';
import { ThemeColors } from '../../theme/palettes';
import { PriceText } from '../ui/PriceText';
import { CartItem } from '../../services/cart/cartCore';
import { createOrderReviewStyles } from './orderReviewStyles';

export interface CheckoutItemsListProps {
  colors: ThemeColors;
  items: CartItem[];
  totalItems: number;
}

export const CheckoutItemsList: React.FC<CheckoutItemsListProps> = ({
  colors,
  items,
  totalItems,
}) => {
  const { language, t } = useLanguage();
  const styles = createOrderReviewStyles(colors);

  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionLabel}>
        {t('checkoutItemsOrdered')} ({formatItemCount(totalItems, language)})
      </Text>
      {items.map((it) => (
        <View key={it.dishId} style={styles.itemSummaryRow}>
          <Text style={styles.itemSummaryQty}>{it.quantity}x</Text>
          <Text style={styles.itemSummaryName} numberOfLines={1}>
            {it.dishName}
          </Text>
          <PriceText amountTzs={it.priceTzs * it.quantity} size="sm" />
        </View>
      ))}
    </View>
  );
};
