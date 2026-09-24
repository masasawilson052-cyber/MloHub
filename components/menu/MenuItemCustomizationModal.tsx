import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { MenuModifierGroup, MenuModifierOption } from '../../types/domain';

export interface ModifierOptionSelection {
  group_id: string;
  group_name: string;
  option_id: string;
  option_name: string;
  price_delta_tzs: number;
}

export interface MenuItemCustomizationModalProps {
  visible: boolean;
  onClose: () => void;
  menuItem: {
    id: string;
    name: string;
    nameSw?: string;
    description?: string;
    price: number;
    imageUrl?: string;
    restaurantId: string;
    restaurantName: string;
    branchId?: string;
    branchName?: string;
  } | null;
  onAddToCart: (customizedItem: {
    dishId: string;
    dishName: string;
    dishNameSwahili?: string;
    restaurantId: string;
    restaurantName: string;
    branchId?: string;
    branchName?: string;
    priceTzs: number;
    basePriceTzs: number;
    quantity: number;
    selectedModifiers: ModifierOptionSelection[];
    rpcModifiersPayload: {
      group_id: string;
      option_ids: string[];
    }[];
    notes?: string;
    imageUrl?: string;
  }) => void;
}

export const MenuItemCustomizationModal: React.FC<MenuItemCustomizationModalProps> = ({
  visible,
  onClose,
  menuItem,
  onAddToCart,
}) => {
  const { t, language } = useLanguage();
  const [modifierGroups, setModifierGroups] = useState<MenuModifierGroup[]>([]);
  const [selectedOptionIds, setSelectedOptionIds] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);
  const [specialNotes, setSpecialNotes] = useState('');
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);

  // Reset state and fetch modifier groups when menuItem changes
  useEffect(() => {
    if (!visible || !menuItem?.id) {
      setModifierGroups([]);
      setSelectedOptionIds({});
      setQuantity(1);
      setSpecialNotes('');
      return;
    }

    let isMounted = true;
    setIsLoadingGroups(true);

    async function loadModifiers() {
      try {
        if (!isSupabaseConfigured() || !menuItem?.id) {
          if (isMounted) setIsLoadingGroups(false);
          return;
        }

        const { data, error } = await supabase
          .from('menu_modifier_groups')
          .select('*, options:menu_modifier_options(*)')
          .eq('menu_item_id', menuItem.id)
          .order('sort_order', { ascending: true });

        if (!isMounted) return;

        if (error) {
          console.warn('Failed to load menu modifier groups:', error.message);
          setModifierGroups([]);
        } else {
          const mapped = (data || []).map((grp: any) => ({
            id: grp.id,
            menuItemId: grp.menu_item_id,
            name: grp.name,
            minSelections: grp.min_selections ?? 0,
            maxSelections: grp.max_selections ?? 1,
            isRequired: grp.is_required ?? false,
            sortOrder: grp.sort_order ?? 0,
            createdAt: grp.created_at,
            options: (grp.options || [])
              .filter((opt: any) => opt.is_available !== false)
              .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
              .map((opt: any) => ({
                id: opt.id,
                groupId: opt.group_id,
                name: opt.name,
                priceDeltaTzs: opt.price_delta_tzs ?? 0,
                isAvailable: opt.is_available ?? true,
                sortOrder: opt.sort_order ?? 0,
                createdAt: opt.created_at,
              })),
          }));
          setModifierGroups(mapped);

          // Pre-select required single-select groups if minSelections === 1 and options exist
          const initialSelections: Record<string, string[]> = {};
          mapped.forEach((g: MenuModifierGroup) => {
            if (g.isRequired && g.minSelections === 1 && g.maxSelections === 1 && g.options.length > 0) {
              initialSelections[g.id] = [g.options[0].id];
            }
          });
          setSelectedOptionIds(initialSelections);
        }
      } catch (err: any) {
        if (!isMounted) return;
        console.warn('Exception loading modifiers:', err);
        setModifierGroups([]);
      } finally {
        if (isMounted) setIsLoadingGroups(false);
      }
    }

    loadModifiers();

    return () => {
      isMounted = false;
    };
  }, [visible, menuItem?.id]);

  const toggleOption = (groupId: string, optionId: string, maxSelections: number) => {
    setSelectedOptionIds((prev) => {
      const current = prev[groupId] || [];
      if (maxSelections === 1) {
        // Radio behavior
        return { ...prev, [groupId]: [optionId] };
      }

      // Checkbox behavior
      if (current.includes(optionId)) {
        return { ...prev, [groupId]: current.filter((id) => id !== optionId) };
      } else {
        if (current.length >= maxSelections) {
          Alert.alert(
            language === 'sw' ? 'Kikomo Kimefikiwa' : 'Selection Limit',
            language === 'sw'
              ? `Unaweza kuchagua hadi machaguo ${maxSelections} pekee kwa kundi hili.`
              : `You can only select up to ${maxSelections} options for this group.`
          );
          return prev;
        }
        return { ...prev, [groupId]: [...current, optionId] };
      }
    });
  };

  // Calculate modifier price delta
  const { totalModifierDelta, selectedList, rpcPayload } = useMemo(() => {
    let delta = 0;
    const list: ModifierOptionSelection[] = [];
    const payload: { group_id: string; option_ids: string[] }[] = [];

    modifierGroups.forEach((grp) => {
      const selectedIds = selectedOptionIds[grp.id] || [];
      if (selectedIds.length > 0) {
        payload.push({
          group_id: grp.id,
          option_ids: selectedIds,
        });

        selectedIds.forEach((optId) => {
          const opt = grp.options.find((o) => o.id === optId);
          if (opt) {
            delta += opt.priceDeltaTzs;
            list.push({
              group_id: grp.id,
              group_name: grp.name,
              option_id: opt.id,
              option_name: opt.name,
              price_delta_tzs: opt.priceDeltaTzs,
            });
          }
        });
      }
    });

    return { totalModifierDelta: delta, selectedList: list, rpcPayload: payload };
  }, [modifierGroups, selectedOptionIds]);

  const unitPrice = (menuItem?.price || 0) + totalModifierDelta;
  const totalPrice = unitPrice * quantity;

  // Validation: check if all required groups are satisfied
  const isSatisfied = useMemo(() => {
    for (const grp of modifierGroups) {
      const selectedCount = (selectedOptionIds[grp.id] || []).length;
      if (grp.isRequired && selectedCount === 0) {
        return false;
      }
      if (grp.minSelections > 0 && selectedCount < grp.minSelections) {
        return false;
      }
      if (selectedCount > grp.maxSelections) {
        return false;
      }
    }
    return true;
  }, [modifierGroups, selectedOptionIds]);

  if (!visible || !menuItem) return null;

  const handleConfirm = () => {
    if (!isSatisfied) {
      Alert.alert(
        language === 'sw' ? 'Chagua Machaguo Muhimu' : 'Required Choices',
        language === 'sw'
          ? 'Tafadhali kamilisha machaguo yote yaliyowekwa alama ya lazima.'
          : 'Please select all required options before adding to cart.'
      );
      return;
    }

    onAddToCart({
      dishId: menuItem.id,
      dishName: menuItem.name,
      dishNameSwahili: menuItem.nameSw,
      restaurantId: menuItem.restaurantId,
      restaurantName: menuItem.restaurantName,
      branchId: menuItem.branchId,
      branchName: menuItem.branchName,
      priceTzs: unitPrice,
      basePriceTzs: menuItem.price,
      quantity,
      selectedModifiers: selectedList,
      rpcModifiersPayload: rpcPayload,
      notes: specialNotes.trim() || undefined,
      imageUrl: menuItem.imageUrl,
    });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName} numberOfLines={1}>{menuItem.name}</Text>
              <Text style={styles.restaurantName} numberOfLines={1}>{menuItem.restaurantName}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {menuItem.description ? (
              <Text style={styles.itemDescription}>{menuItem.description}</Text>
            ) : null}

            {isLoadingGroups ? (
              <View style={styles.loaderWrap}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.loaderText}>
                  {language === 'sw' ? 'Inapakia machaguo ya mlo...' : 'Loading meal options...'}
                </Text>
              </View>
            ) : modifierGroups.length > 0 ? (
              modifierGroups.map((grp) => {
                const selected = selectedOptionIds[grp.id] || [];
                const isSingle = grp.maxSelections === 1;

                return (
                  <View key={grp.id} style={styles.groupCard}>
                    <View style={styles.groupHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.groupTitle}>{grp.name}</Text>
                        <Text style={styles.groupSubtitle}>
                          {isSingle
                            ? (grp.isRequired
                                ? (language === 'sw' ? 'Chagua moja (Lazima)' : 'Choose 1 (Required)')
                                : (language === 'sw' ? 'Chagua hadi 1' : 'Choose up to 1'))
                            : (language === 'sw'
                                ? `Chagua kati ya ${grp.minSelections} na ${grp.maxSelections}`
                                : `Choose ${grp.minSelections > 0 ? `min ${grp.minSelections}, ` : ''}up to ${grp.maxSelections}`)}
                        </Text>
                      </View>
                      {grp.isRequired && (
                        <View style={[styles.reqBadge, selected.length >= grp.minSelections && styles.reqBadgeDone]}>
                          <Text style={[styles.reqBadgeText, selected.length >= grp.minSelections && styles.reqBadgeDoneText]}>
                            {selected.length >= grp.minSelections
                              ? (language === 'sw' ? '✓ Tayari' : '✓ Selected')
                              : (language === 'sw' ? 'Lazima' : 'Required')}
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.optionsList}>
                      {grp.options.map((opt) => {
                        const isChecked = selected.includes(opt.id);
                        return (
                          <TouchableOpacity
                            key={opt.id}
                            style={[styles.optionRow, isChecked && styles.optionRowActive]}
                            onPress={() => toggleOption(grp.id, opt.id, grp.maxSelections)}
                            activeOpacity={0.7}
                          >
                            <View style={styles.optionLeft}>
                              <Ionicons
                                name={
                                  isSingle
                                    ? (isChecked ? 'radio-button-on' : 'radio-button-off')
                                    : (isChecked ? 'checkbox' : 'square-outline')
                                }
                                size={20}
                                color={isChecked ? Colors.primary : Colors.muted}
                                style={{ marginRight: 10 }}
                              />
                              <Text style={[styles.optionName, isChecked && styles.optionNameActive]}>
                                {opt.name}
                              </Text>
                            </View>
                            <Text style={[styles.optionPrice, isChecked && styles.optionPriceActive]}>
                              {opt.priceDeltaTzs > 0 ? `+TZS ${opt.priceDeltaTzs.toLocaleString()}` : (language === 'sw' ? 'Bure' : 'Free')}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              })
            ) : null}

            {/* Special Instructions Input */}
            <View style={styles.notesGroup}>
              <Text style={styles.notesLabel}>
                {language === 'sw' ? 'Maagizo Maalum ya Maandalizi (Hiari)' : 'Special Instructions (Optional)'}
              </Text>
              <TextInput
                style={styles.notesInput}
                value={specialNotes}
                onChangeText={setSpecialNotes}
                placeholder={language === 'sw' ? 'Mf. Punguza chumvi, pilipili pembeni...' : 'e.g. Less salt, chili on the side...'}
                placeholderTextColor={Colors.muted}
                maxLength={200}
                multiline
              />
            </View>
          </ScrollView>

          {/* Footer with Quantity & Add Button */}
          <View style={styles.footerRow}>
            <View style={styles.quantityPicker}>
              <TouchableOpacity
                style={[styles.qtyBtn, quantity <= 1 && styles.qtyBtnDisabled]}
                onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
              >
                <Text style={styles.qtyBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.qtyText}>{quantity}</Text>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => setQuantity((q) => q + 1)}
              >
                <Text style={styles.qtyBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.addBtn, !isSatisfied && styles.addBtnDisabled]}
              onPress={handleConfirm}
              disabled={!isSatisfied}
              activeOpacity={0.85}
            >
              <Text style={styles.addBtnText}>
                {language === 'sw' ? 'Weka Kikapuni' : 'Add to Cart'} • TZS {totalPrice.toLocaleString()}
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
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radii.xxl,
    borderTopRightRadius: Radii.xxl,
    maxHeight: '88%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    ...Shadows.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  itemName: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  restaurantName: {
    fontSize: 12,
    color: Colors.muted,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  scrollBody: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  itemDescription: {
    fontSize: 13,
    color: Colors.textMuted || '#4b5563',
    lineHeight: 18,
    marginBottom: Spacing.md,
  },
  loaderWrap: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  loaderText: {
    fontSize: 12,
    color: Colors.muted,
    marginTop: 8,
  },
  groupCard: {
    backgroundColor: '#f8faf9',
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  groupTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  groupSubtitle: {
    fontSize: 12,
    color: Colors.muted,
    marginTop: 2,
  },
  reqBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.full,
  },
  reqBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#d97706',
  },
  reqBadgeDone: {
    backgroundColor: '#d1fae5',
  },
  reqBadgeDoneText: {
    color: '#059669',
  },
  optionsList: {
    gap: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  optionRowActive: {
    borderColor: Colors.primary,
    backgroundColor: '#f0fdf4',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionName: {
    fontSize: 14,
    color: Colors.text,
  },
  optionNameActive: {
    fontWeight: '600',
    color: Colors.primaryDark,
  },
  optionPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.muted,
  },
  optionPriceActive: {
    color: Colors.primary,
  },
  notesGroup: {
    marginBottom: Spacing.lg,
  },
  notesLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 6,
  },
  notesInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: Radii.md,
    padding: 10,
    fontSize: 13,
    color: Colors.text,
    minHeight: 50,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  quantityPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: Radii.full,
    padding: 4,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  qtyBtnDisabled: {
    opacity: 0.4,
  },
  qtyBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  qtyText: {
    fontSize: 15,
    fontWeight: '700',
    paddingHorizontal: 12,
    color: Colors.text,
  },
  addBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  addBtnDisabled: {
    backgroundColor: '#9ca3af',
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.white,
  },
});
