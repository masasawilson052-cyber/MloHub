import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { Shadows } from '../../theme/shadows';
import { Typography } from '../../theme/typography';
import { formatTzs } from '../../utils/formatters';
import { MenuItem, MenuCategory } from '../../types/domain';
import { Button } from '../ui/Button';
import { FreshnessBadge } from '../ui/FreshnessBadge';
import { EmptyState } from '../ui/EmptyState';

export interface MenuManagerProps {
  items: MenuItem[];
  categories: MenuCategory[];
  onAddNewDish: () => void;
  onEditDish: (item: MenuItem) => void;
  onArchiveDish: (itemId: string) => Promise<void>;
  onToggleAvailability: (itemId: string, isAvailable: boolean) => Promise<void>;
  onBulkSetAvailability: (itemIds: string[], isAvailable: boolean) => Promise<void>;
  onVerifyFullMenu: () => Promise<void>;
  onVerifySingleDish: (itemId: string) => Promise<void>;
  onOpenCategoriesManager: () => void;
  language?: 'en' | 'sw';
}

export const MenuManager: React.FC<MenuManagerProps> = ({
  items,
  categories,
  onAddNewDish,
  onEditDish,
  onArchiveDish,
  onToggleAvailability,
  onBulkSetAvailability,
  onVerifyFullMenu,
  onVerifySingleDish,
  onOpenCategoriesManager,
  language = 'en',
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [isVerifyingFull, setIsVerifyingFull] = useState(false);

  const filteredItems = items.filter((item) => {
    if (selectedCategory !== 'ALL' && item.categoryId !== selectedCategory) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.name.toLowerCase().includes(q) || (item.nameSw && item.nameSw.toLowerCase().includes(q));
      const matchDesc = item.description && item.description.toLowerCase().includes(q);
      if (!matchName && !matchDesc) return false;
    }
    return true;
  });

  const toggleSelectItem = (id: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedItemIds.length === filteredItems.length) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(filteredItems.map((i) => i.id));
    }
  };

  const handleBulkAvailability = async (isAvailable: boolean) => {
    if (selectedItemIds.length === 0) return;
    try {
      await onBulkSetAvailability(selectedItemIds, isAvailable);
      setSelectedItemIds([]);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update availability.');
    }
  };

  const handleFullMenuVerify = async () => {
    try {
      setIsVerifyingFull(true);
      await onVerifyFullMenu();
      Alert.alert(
        language === 'sw' ? 'Menyu Imethibitishwa! ✓' : 'Menu Verified Fresh! ✓',
        language === 'sw'
          ? 'Bei na vyakula vyote vimesasishwa kuwa FRESH kwenye utafutaji wa wateja wa MloHub.'
          : 'All menu items and prices have been verified and marked FRESH in MloHub customer discovery.'
      );
    } catch (err: any) {
      Alert.alert('Verification Failed', err?.message || 'Failed to verify menu.');
    } finally {
      setIsVerifyingFull(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Operating Control Bar */}
      <View style={styles.topControlBar}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder={language === 'sw' ? 'Tafuta chakula kwa jina...' : 'Search dishes by name...'}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.topActionsRow}>
          <TouchableOpacity
            style={styles.categoriesBtn}
            onPress={onOpenCategoriesManager}
            accessibilityRole="button"
          >
            <Ionicons name="folder-outline" size={16} color={Colors.textPrimary} />
            <Text style={styles.categoriesBtnText}>
              {language === 'sw' ? 'Makundi' : 'Categories'}
            </Text>
          </TouchableOpacity>

          <Button
            title={isVerifyingFull ? 'Verifying...' : 'Verify Menu Freshness ✓'}
            onPress={handleFullMenuVerify}
            loading={isVerifyingFull}
            variant="outline"
            size="sm"
            style={styles.verifyMenuBtn}
          />

          <Button
            title="+ Add New Dish"
            onPress={onAddNewDish}
            variant="primary"
            size="sm"
          />
        </View>
      </View>

      {/* Category Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.catChipsContainer}
      >
        <TouchableOpacity
          style={[styles.catFilterChip, selectedCategory === 'ALL' && styles.catFilterChipActive]}
          onPress={() => setSelectedCategory('ALL')}
        >
          <Text style={[styles.catFilterText, selectedCategory === 'ALL' && styles.catFilterTextActive]}>
            All Dishes ({items.length})
          </Text>
        </TouchableOpacity>

        {categories.map((cat) => {
          const count = items.filter((i) => i.categoryId === cat.id).length;
          const isActive = selectedCategory === cat.id;

          return (
            <TouchableOpacity
              key={cat.id}
              style={[styles.catFilterChip, isActive && styles.catFilterChipActive]}
              onPress={() => setSelectedCategory(cat.id)}
            >
              <Text style={[styles.catFilterText, isActive && styles.catFilterTextActive]}>
                {language === 'sw' ? cat.nameSw || cat.nameEn : cat.nameEn} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Bulk Action Bar (Visible when items selected) */}
      {selectedItemIds.length > 0 && (
        <View style={styles.bulkActionBar}>
          <View style={styles.bulkInfo}>
            <Text style={styles.bulkCountText}>
              {selectedItemIds.length} dishes selected
            </Text>
            <TouchableOpacity onPress={handleSelectAll}>
              <Text style={styles.bulkSelectAllText}>
                {selectedItemIds.length === filteredItems.length ? 'Deselect All' : 'Select All'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.bulkButtonsRow}>
            <TouchableOpacity
              style={[styles.bulkBtn, { backgroundColor: '#DCFCE7' }]}
              onPress={() => handleBulkAvailability(true)}
            >
              <Text style={[styles.bulkBtnText, { color: '#15803D' }]}>Mark Available</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bulkBtn, { backgroundColor: '#FEE2E2' }]}
              onPress={() => handleBulkAvailability(false)}
            >
              <Text style={[styles.bulkBtnText, { color: '#DC2626' }]}>Mark Sold Out</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Dishes List */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.dishesList}
      >
        {filteredItems.length === 0 ? (
          <EmptyState
            title="No Menu Items Found"
            message="Add your restaurant's popular dishes so customers can discover them nearby."
            icon="restaurant-outline"
            actionTitle="+ Add First Dish"
            onAction={onAddNewDish}
          />
        ) : (
          filteredItems.map((dish) => {
            const isSelected = selectedItemIds.includes(dish.id);
            const categoryObj = categories.find((c) => c.id === dish.categoryId);
            const isFresh = (Date.now() - new Date(dish.updatedAt || dish.createdAt).getTime()) <= 7 * 24 * 60 * 60 * 1000;

            return (
              <View key={dish.id} style={[styles.dishCard, !dish.isAvailable && styles.dishCardSoldOut]}>
                <View style={styles.dishCardMain}>
                  {/* Select Checkbox */}
                  <TouchableOpacity
                    style={[styles.checkbox, isSelected && styles.checkboxActive]}
                    onPress={() => toggleSelectItem(dish.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    {isSelected && <Ionicons name="checkmark" size={14} color={Colors.white} />}
                  </TouchableOpacity>

                  {/* Dish Info */}
                  <View style={styles.dishDetails}>
                    <View style={styles.dishTitleRow}>
                      <Text style={styles.dishName}>{dish.nameEn || dish.name}</Text>
                      {dish.nameSw && dish.nameSw !== dish.nameEn && (
                        <Text style={styles.dishNameSw}>({dish.nameSw})</Text>
                      )}
                    </View>

                    <View style={styles.metaPillsRow}>
                      <View style={styles.catPill}>
                        <Text style={styles.catPillText}>
                          {categoryObj?.nameEn || 'Special'}
                        </Text>
                      </View>
                      <FreshnessBadge tier={isFresh ? 'FRESH' : 'AGING'} />
                      <Text style={styles.prepTimeText}>⏱️ {dish.preparationMinutes}m</Text>
                    </View>
                  </View>

                  {/* Price & Availability Actions */}
                  <View style={styles.priceActionCol}>
                    <Text style={styles.priceText}>{formatTzs(dish.basePrice || dish.priceTzs)}</Text>

                    {/* Quick Availability Toggle */}
                    <TouchableOpacity
                      style={[styles.availPill, dish.isAvailable ? styles.availOn : styles.availOff]}
                      onPress={() => onToggleAvailability(dish.id, !dish.isAvailable)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.availText, dish.isAvailable ? styles.availTextOn : styles.availTextOff]}>
                        {dish.isAvailable ? 'Available ✓' : 'Sold Out ✕'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Bottom Actions Row */}
                <View style={styles.dishCardBottom}>
                  <TouchableOpacity
                    style={styles.verifyDishBtn}
                    onPress={() => onVerifySingleDish(dish.id)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="shield-checkmark-outline" size={14} color={Colors.primary} />
                    <Text style={styles.verifyDishBtnText}>Verify Price Today</Text>
                  </TouchableOpacity>

                  <View style={styles.rightCardActions}>
                    <TouchableOpacity
                      style={styles.editBtn}
                      onPress={() => onEditDish(dish)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="pencil-outline" size={15} color={Colors.textSecondary} />
                      <Text style={styles.editBtnText}>Edit</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.archiveBtn}
                      onPress={() =>
                        Alert.alert(
                          'Archive Dish?',
                          `Are you sure you want to archive ${dish.name}? It will no longer appear in customer discovery.`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Archive', style: 'destructive', onPress: () => onArchiveDish(dish.id) },
                          ]
                        )
                      }
                      activeOpacity={0.8}
                    >
                      <Ionicons name="trash-outline" size={15} color={Colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.md,
    maxWidth: 1000,
    width: '100%',
    alignSelf: 'center',
  },
  topControlBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.sm,
    height: 42,
    flex: 1,
    minWidth: 220,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    ...Typography.Body,
  },
  topActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  categoriesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.md,
    paddingHorizontal: 12,
    height: 38,
  },
  categoriesBtnText: {
    ...Typography.Caption,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  verifyMenuBtn: {
    borderColor: Colors.primary,
  },
  catChipsContainer: {
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  catFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radii.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  catFilterChipActive: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryDark,
  },
  catFilterText: {
    ...Typography.Caption,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  catFilterTextActive: {
    color: Colors.white,
  },
  bulkActionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.sm,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.primary,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  bulkInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bulkCountText: {
    ...Typography.BodyMedium,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  bulkSelectAllText: {
    ...Typography.Caption,
    color: Colors.textMuted,
    textDecorationLine: 'underline',
  },
  bulkButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  bulkBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.sm,
  },
  bulkBtnText: {
    ...Typography.Caption,
    fontWeight: '700',
  },
  dishesList: {
    gap: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  dishCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  dishCardSoldOut: {
    opacity: 0.65,
    backgroundColor: '#FAF9F6',
  },
  dishCardMain: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  checkboxActive: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryDark,
  },
  dishDetails: {
    flex: 1,
  },
  dishTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  dishName: {
    ...Typography.H3,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  dishNameSw: {
    ...Typography.Body,
    fontSize: 13,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  metaPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  catPill: {
    backgroundColor: Colors.surfaceSecondary,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radii.sm,
  },
  catPillText: {
    ...Typography.Caption,
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  prepTimeText: {
    ...Typography.Caption,
    color: Colors.textMuted,
    fontSize: 11,
  },
  priceActionCol: {
    alignItems: 'flex-end',
    marginLeft: Spacing.sm,
  },
  priceText: {
    ...Typography.H3,
    fontWeight: '800',
    color: Colors.primaryDark,
    marginBottom: 4,
  },
  availPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.full,
  },
  availOn: {
    backgroundColor: '#DCFCE7',
  },
  availOff: {
    backgroundColor: '#FEE2E2',
  },
  availText: {
    ...Typography.Caption,
    fontSize: 10.5,
    fontWeight: '700',
  },
  availTextOn: {
    color: '#15803D',
  },
  availTextOff: {
    color: '#DC2626',
  },
  dishCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: Spacing.xs,
    marginTop: Spacing.sm,
  },
  verifyDishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  verifyDishBtnText: {
    ...Typography.Caption,
    color: Colors.primary,
    fontWeight: '600',
  },
  rightCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editBtnText: {
    ...Typography.Caption,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  archiveBtn: {
    padding: 2,
  },
});
