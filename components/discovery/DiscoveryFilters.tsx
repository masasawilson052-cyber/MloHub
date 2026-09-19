import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Colors, Spacing, Radii } from '../../constants/theme';
import { DiscoveryQuery } from '../../types/discovery';

interface DiscoveryFiltersProps {
  filters: DiscoveryQuery;
  onChangeFilters: (updated: DiscoveryQuery) => void;
  onClearFilters: () => void;
  activeCount: number;
}

export const DiscoveryFilters: React.FC<DiscoveryFiltersProps> = ({
  filters,
  onChangeFilters,
  onClearFilters,
  activeCount,
}) => {
  const budgetOptions = [
    { label: 'Any Budget', value: undefined },
    { label: '≤ 6K', value: 6000 },
    { label: '≤ 10K', value: 10000 },
    { label: '≤ 12K', value: 12000 },
    { label: '≤ 15K', value: 15000 },
    { label: '≤ 25K', value: 25000 },
  ];

  const distanceOptions = [
    { label: '1 km', value: 1.0 },
    { label: '3 km', value: 3.0 },
    { label: '5 km', value: 5.0 },
    { label: '10 km', value: 10.0 },
    { label: 'Any Distance', value: undefined },
  ];

  const neighborhoodOptions = [
    'All',
    'Mikocheni',
    'Sinza',
    'Mwenge',
    'Masaki',
    'Kariakoo',
    'Oysterbay',
  ];

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionHeader}>Filters {activeCount > 0 ? `(${activeCount})` : ''}</Text>
        {activeCount > 0 ? (
          <TouchableOpacity onPress={onClearFilters} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.clearBtnText}>Clear All</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Budget Row */}
      <View style={styles.filterGroup}>
        <Text style={styles.groupLabel}>Maximum Budget</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
          {budgetOptions.map((opt) => {
            const isSelected = filters.maxPriceTzs === opt.value;
            return (
              <TouchableOpacity
                key={opt.label}
                style={[styles.chip, isSelected && styles.chipActive]}
                onPress={() => onChangeFilters({ ...filters, maxPriceTzs: opt.value })}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                  {isSelected && opt.value ? '✓ ' : ''}{opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Distance Radius Row */}
      <View style={styles.filterGroup}>
        <Text style={styles.groupLabel}>Distance Radius</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
          {distanceOptions.map((opt) => {
            const isSelected = filters.maxDistanceKm === opt.value;
            return (
              <TouchableOpacity
                key={opt.label}
                style={[styles.chip, isSelected && styles.chipActive]}
                onPress={() => onChangeFilters({ ...filters, maxDistanceKm: opt.value })}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                  {isSelected && opt.value ? '✓ ' : ''}{opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Neighborhood Fallback */}
      <View style={styles.filterGroup}>
        <Text style={styles.groupLabel}>Neighborhood</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
          {neighborhoodOptions.map((n) => {
            const isSelected = (filters.neighborhood || 'All') === n;
            return (
              <TouchableOpacity
                key={n}
                style={[styles.chip, isSelected && styles.chipActive]}
                onPress={() => onChangeFilters({ ...filters, neighborhood: n === 'All' ? undefined : n })}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                  {isSelected && n !== 'All' ? '✓ ' : ''}{n}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Toggles: Open Now & Available Now */}
      <View style={styles.togglesRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, filters.openNow && styles.toggleBtnActive]}
          onPress={() => onChangeFilters({ ...filters, openNow: !filters.openNow })}
        >
          <Text style={[styles.toggleText, filters.openNow && styles.toggleTextActive]}>
            {filters.openNow ? '✓ Open Now' : 'Open Now'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toggleBtn, filters.availableOnly && styles.toggleBtnActive]}
          onPress={() => onChangeFilters({ ...filters, availableOnly: !filters.availableOnly })}
        >
          <Text style={[styles.toggleText, filters.availableOnly && styles.toggleTextActive]}>
            {filters.availableOnly ? '✓ In Stock Only' : 'Include Sold Out'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toggleBtn, filters.minRating === 4.5 && styles.toggleBtnActive]}
          onPress={() =>
            onChangeFilters({ ...filters, minRating: filters.minRating === 4.5 ? undefined : 4.5 })
          }
        >
          <Text style={[styles.toggleText, filters.minRating === 4.5 && styles.toggleTextActive]}>
            {filters.minRating === 4.5 ? '✓ ★ 4.5+' : '★ 4.5+'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.error,
  },
  filterGroup: {
    marginBottom: Spacing.sm,
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.muted,
    marginBottom: 6,
  },
  chipsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.full,
    backgroundColor: '#f1f5f2',
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#e2e7e3',
  },
  chipActive: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.muted,
  },
  chipTextActive: {
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  togglesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: Spacing.xs,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radii.sm,
    backgroundColor: '#f1f5f2',
    borderWidth: 1,
    borderColor: '#e2e7e3',
  },
  toggleBtnActive: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primary,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  toggleTextActive: {
    color: Colors.primaryDark,
  },
});
