import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Colors, Spacing, Radii } from '../../constants/theme';
import { DishDiscoveryResult } from '../../types/discovery';
import { formatTzs, formatDistance } from '../../utils/formatters';
import { DishCard } from './DishCard';

interface NoResultsViewProps {
  queryText?: string;
  maxBudget?: number;
  maxDistanceKm?: number;
  onIncreaseBudget?: () => void;
  onExpandDistance?: () => void;
  onClearFilters?: () => void;
  similarDishes?: DishDiscoveryResult[];
}

export const NoResultsView: React.FC<NoResultsViewProps> = ({
  queryText,
  maxBudget,
  maxDistanceKm,
  onIncreaseBudget,
  onExpandDistance,
  onClearFilters,
  similarDishes = [],
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🔍</Text>
      <Text style={styles.title}>No matching food found</Text>

      <Text style={styles.message}>
        We couldn't find {queryText ? `"${queryText}"` : 'dishes'}
        {maxBudget ? ` under ${formatTzs(maxBudget)}` : ''}
        {maxDistanceKm ? ` within ${formatDistance(maxDistanceKm)}` : ''}.
      </Text>

      {/* Action Chips */}
      <View style={styles.actionsRow}>
        {maxBudget && onIncreaseBudget ? (
          <TouchableOpacity style={styles.actionChip} onPress={onIncreaseBudget}>
            <Text style={styles.actionChipText}>💰 Increase Budget</Text>
          </TouchableOpacity>
        ) : null}

        {maxDistanceKm && maxDistanceKm < 10 && onExpandDistance ? (
          <TouchableOpacity style={styles.actionChip} onPress={onExpandDistance}>
            <Text style={styles.actionChipText}>📍 Expand Radius (10 km)</Text>
          </TouchableOpacity>
        ) : null}

        {onClearFilters ? (
          <TouchableOpacity style={[styles.actionChip, styles.clearChip]} onPress={onClearFilters}>
            <Text style={[styles.actionChipText, styles.clearChipText]}>↺ Clear All Filters</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Similar Dishes Section */}
      {similarDishes.length > 0 ? (
        <View style={styles.similarSection}>
          <Text style={styles.similarTitle}>Similar Dishes You Might Enjoy:</Text>
          {similarDishes.slice(0, 3).map((dish) => (
            <DishCard key={dish.menuItemId} dish={dish} showCompareButton={false} />
          ))}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  icon: {
    fontSize: 48,
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: Colors.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.lg,
    maxWidth: 320,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: Spacing.xl,
  },
  actionChip: {
    backgroundColor: Colors.primaryMuted,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  actionChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  clearChip: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
  },
  clearChipText: {
    color: '#b91c1c',
  },
  similarSection: {
    width: '100%',
    marginTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: Spacing.lg,
  },
  similarTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
});
