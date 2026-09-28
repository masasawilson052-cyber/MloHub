import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';
import { MenuRepository } from '../../repositories/menus.repository';
import { MenuModifierGroup } from '../../types/domain';

import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

import {
  MeasuredRect,
  ModifierOptionSelection,
  validateModifierSelections,
  buildDefaultModifierSelections,
  computeCustomizationPricing,
} from '../../services/cart/cartCore';

export type { MeasuredRect, ModifierOptionSelection };
export {
  validateModifierSelections,
  buildDefaultModifierSelections,
  computeCustomizationPricing,
};

export interface CustomizationMotionContext {
  sourceRect?: MeasuredRect | null;
  imageRef?: React.RefObject<View | null>;
  imageUrl?: string;
}

export type CustomizationConfirmMotionContext = CustomizationMotionContext;

export function measureViewRect(
  ref?: React.RefObject<View | null>
): Promise<MeasuredRect | null> {
  return new Promise((resolve) => {
    const node: any = ref?.current;
    if (!node) {
      resolve(null);
      return;
    }

    let settled = false;
    const finish = (rect: MeasuredRect | null) => {
      if (!settled) {
        settled = true;
        resolve(rect);
      }
    };

    const timeoutId = setTimeout(() => finish(null), 120);

    try {
      if (typeof node.measureInWindow === 'function') {
        node.measureInWindow((x: number, y: number, width: number, height: number) => {
          clearTimeout(timeoutId);
          if (
            typeof x === 'number' &&
            typeof y === 'number' &&
            width > 0 &&
            height > 0 &&
            Number.isFinite(x) &&
            Number.isFinite(y)
          ) {
            finish({ x, y, width, height });
          } else {
            finish(null);
          }
        });
        return;
      }

      if (typeof node.getBoundingClientRect === 'function') {
        clearTimeout(timeoutId);
        const rect = node.getBoundingClientRect();
        if (rect && rect.width > 0 && rect.height > 0) {
          finish({
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height,
          });
          return;
        }
      }
    } catch {
      // Ignore measurement errors and resolve null
    }

    clearTimeout(timeoutId);
    finish(null);
  });
}

export interface CustomizableMenuItem {
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
  notes?: string;
}

export interface MenuItemCustomizationModalProps {
  visible: boolean;
  onClose: () => void;
  initialModifierGroups?: MenuModifierGroup[];
  initialSelectedOptionIds?: Record<string, string[]>;
  initialQuantity?: number;
  menuItem: CustomizableMenuItem | null;
  onAddToCart: (
    customizedItem: {
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
    },
    motionContext?: CustomizationMotionContext
  ) => void | Promise<unknown>;
}

export const MenuItemCustomizationModal: React.FC<MenuItemCustomizationModalProps> = ({
  visible,
  onClose,
  initialModifierGroups,
  initialSelectedOptionIds,
  initialQuantity = 1,
  menuItem,
  onAddToCart,
}) => {
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);
  const { language } = useLanguage();
  const [modifierGroups, setModifierGroups] = useState<MenuModifierGroup[]>([]);
  const [selectedOptionIds, setSelectedOptionIds] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(initialQuantity > 0 ? initialQuantity : 1);
  const [specialNotes, setSpecialNotes] = useState('');
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [modifierLoadError, setModifierLoadError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageError, setImageError] = useState(false);
  const foodImageRef = useRef<View | null>(null);

  // Reset state and fetch modifier groups when menuItem changes
  useEffect(() => {
    if (!visible || !menuItem?.id) {
      setModifierGroups([]);
      setSelectedOptionIds({});
      setQuantity(1);
      setSpecialNotes('');
      setModifierLoadError(null);
      setIsSubmitting(false);
      setImageError(false);
      return;
    }

    setQuantity(initialQuantity && initialQuantity > 0 ? initialQuantity : 1);
    setSpecialNotes(menuItem.notes || '');
    setModifierLoadError(null);
    setIsSubmitting(false);
    setImageError(false);

    if (initialModifierGroups !== undefined) {
      const normalized = initialModifierGroups.map((g) => ({
        ...g,
        options: (g.options || []).filter((opt) => opt.isAvailable !== false),
      }));
      setModifierGroups(normalized);
      setSelectedOptionIds(
        buildDefaultModifierSelections(normalized, initialSelectedOptionIds)
      );
      setIsLoadingGroups(false);
      return;
    }

    let isMounted = true;
    setIsLoadingGroups(true);
    setModifierLoadError(null);

    async function loadModifiers() {
      try {
        if (!menuItem?.id) {
          if (isMounted) setIsLoadingGroups(false);
          return;
        }

        const groups = await MenuRepository.getModifiersForItem(menuItem.id);
        if (!isMounted) return;

        const normalized = (groups || []).map((g) => ({
          ...g,
          options: (g.options || []).filter((opt) => opt.isAvailable !== false),
        }));
        setModifierGroups(normalized);
        setSelectedOptionIds(
          buildDefaultModifierSelections(normalized, initialSelectedOptionIds)
        );
        setModifierLoadError(null);
      } catch (err: any) {
        if (!isMounted) return;
        console.warn('Exception loading modifiers:', err);
        setModifierGroups([]);
        setModifierLoadError(
          language === 'sw'
            ? 'Imeshindikana kupakia machaguo ya mlo huu. Tafadhali jaribu tena.'
            : 'Unable to load meal options.'
        );
      } finally {
        if (isMounted) setIsLoadingGroups(false);
      }
    }

    loadModifiers();

    return () => {
      isMounted = false;
    };
  }, [
    visible,
    menuItem?.id,
    initialModifierGroups,
    initialSelectedOptionIds,
    initialQuantity,
    reloadNonce,
    language,
  ]);

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

  // Calculate modifier price delta via shared cartCore
  const {
    selectedList,
    rpcPayload,
    unitPrice,
    totalPrice,
  } = useMemo(
    () =>
      computeCustomizationPricing(
        menuItem?.price || 0,
        modifierGroups,
        selectedOptionIds,
        quantity
      ),
    [menuItem?.price, modifierGroups, selectedOptionIds, quantity]
  );

  // Validation: check if all required groups are satisfied
  const isSatisfied = useMemo(
    () => validateModifierSelections(modifierGroups, selectedOptionIds),
    [modifierGroups, selectedOptionIds]
  );

  if (!visible || !menuItem) return null;

  const hasValidRealFoodImage = Boolean(menuItem.imageUrl && !imageError);
  const isConfirmDisabled =
    !isSatisfied || isLoadingGroups || Boolean(modifierLoadError) || isSubmitting;

  const handleConfirm = async () => {
    if (isSubmitting || isLoadingGroups || Boolean(modifierLoadError)) {
      return;
    }

    if (!isSatisfied) {
      Alert.alert(
        language === 'sw' ? 'Chagua Machaguo Muhimu' : 'Required Choices',
        language === 'sw'
          ? 'Tafadhali kamilisha machaguo yote yaliyowekwa alama ya lazima.'
          : 'Please select all required options before adding to cart.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const measuredRect = hasValidRealFoodImage ? await measureViewRect(foodImageRef) : null;
      const verifiedImageUrl = hasValidRealFoodImage ? menuItem.imageUrl : undefined;

      await onAddToCart(
        {
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
          imageUrl: verifiedImageUrl,
        },
        {
          sourceRect: measuredRect,
          imageRef: foodImageRef,
          imageUrl: verifiedImageUrl,
        }
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Real Food Image or Neutral MloHub Placeholder */}
          <View style={styles.heroMediaWrap}>
            {hasValidRealFoodImage ? (
              <View ref={foodImageRef} collapsable={false} style={styles.heroImageContainer}>
                <Image
                  source={{ uri: menuItem.imageUrl }}
                  style={styles.heroFoodImage}
                  resizeMode="cover"
                  onError={() => setImageError(true)}
                />
              </View>
            ) : (
              <View style={styles.heroPlaceholderContainer}>
                <Text style={styles.heroPlaceholderEmoji}>🍲</Text>
                <Text style={styles.heroPlaceholderLabel}>MloHub Dish</Text>
              </View>
            )}

            <TouchableOpacity
              onPress={onClose}
              style={styles.floatingCloseBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Close customization"
              disabled={isSubmitting}
            >
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName} numberOfLines={1}>{menuItem.name}</Text>
              <Text style={styles.restaurantName} numberOfLines={1}>{menuItem.restaurantName}</Text>
            </View>
            <Text style={styles.basePriceBadge}>TZS {menuItem.price.toLocaleString()}</Text>
          </View>

          <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {menuItem.description ? (
              <Text style={styles.itemDescription}>{menuItem.description}</Text>
            ) : null}

            {isLoadingGroups ? (
              <View style={styles.loaderWrap}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.loaderText}>
                  {language === 'sw' ? 'Inapakia machaguo ya mlo...' : 'Loading meal options...'}
                </Text>
              </View>
            ) : modifierLoadError ? (
              <View style={styles.errorCard}>
                <Ionicons name="alert-circle-outline" size={24} color={colors.danger} />
                <Text style={styles.errorTitle}>
                  {language === 'sw'
                    ? 'Imeshindikana kupakia machaguo ya mlo.'
                    : 'Unable to load meal options.'}
                </Text>
                <Text style={styles.errorSubtitle}>{modifierLoadError}</Text>
                <View style={styles.errorActionsRow}>
                  <TouchableOpacity
                    style={styles.retryBtn}
                    onPress={() => setReloadNonce((n) => n + 1)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.retryBtnText}>
                      {language === 'sw' ? 'Jaribu Tena' : 'Retry'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.cancelErrorBtn}
                    onPress={onClose}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.cancelErrorBtnText}>
                      {language === 'sw' ? 'Ghairi' : 'Cancel'}
                    </Text>
                  </TouchableOpacity>
                </View>
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
                                color={isChecked ? colors.primary : colors.muted}
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
                placeholderTextColor={colors.inputPlaceholder}
                maxLength={200}
                multiline
              />
            </View>
          </ScrollView>

          {/* Footer with Quantity & Add Button */}
          <View style={styles.footerRow}>
            <View style={styles.quantityPicker}>
              <TouchableOpacity
                style={[styles.qtyBtn, (quantity <= 1 || isSubmitting) && styles.qtyBtnDisabled]}
                onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1 || isSubmitting}
              >
                <Text style={styles.qtyBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.qtyText}>{quantity}</Text>
              <TouchableOpacity
                style={[styles.qtyBtn, isSubmitting && styles.qtyBtnDisabled]}
                onPress={() => setQuantity((q) => q + 1)}
                disabled={isSubmitting}
              >
                <Text style={styles.qtyBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.addBtn, isConfirmDisabled && styles.addBtnDisabled]}
              onPress={handleConfirm}
              disabled={isConfirmDisabled}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <View style={styles.addBtnContentRow}>
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                  <Text style={styles.addBtnText}>
                    {language === 'sw' ? 'Inaweka...' : 'Adding...'}
                  </Text>
                </View>
              ) : (
                <Text style={styles.addBtnText}>
                  {language === 'sw' ? 'Weka Kikapuni' : 'Add to Cart'} • TZS {totalPrice.toLocaleString()}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: colors.card,
    borderTopLeftRadius: Radii.xxl,
    borderTopRightRadius: Radii.xxl,
    maxHeight: '88%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  heroMediaWrap: {
    position: 'relative',
    width: '100%',
    height: 168,
    backgroundColor: colors.surfaceMuted,
    borderTopLeftRadius: Radii.xxl,
    borderTopRightRadius: Radii.xxl,
    overflow: 'hidden',
  },
  heroImageContainer: {
    width: '100%',
    height: '100%',
  },
  heroFoodImage: {
    width: '100%',
    height: '100%',
  },
  heroPlaceholderContainer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
    gap: 6,
  },
  heroPlaceholderEmoji: {
    fontSize: 40,
  },
  heroPlaceholderLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  floatingCloseBtn: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...Shadows.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: Spacing.sm,
  },
  basePriceBadge: {
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  restaurantName: {
    fontSize: 12,
    color: colors.textSecondary,
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
    color: colors.textMuted,
    lineHeight: 18,
    marginBottom: Spacing.md,
  },
  loaderWrap: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  loaderText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 8,
  },
  groupCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.textPrimary,
  },
  groupSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  reqBadge: {
    backgroundColor: colors.warningSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.full,
  },
  reqBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.warning,
  },
  reqBadgeDone: {
    backgroundColor: colors.successSoft,
  },
  reqBadgeDoneText: {
    color: colors.success,
  },
  optionsList: {
    gap: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionRowActive: {
    borderColor: colors.primary,
    backgroundColor: colors.successSoft,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionName: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  optionNameActive: {
    fontWeight: '600',
    color: colors.primary,
  },
  optionPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  optionPriceActive: {
    color: colors.primary,
  },
  notesGroup: {
    marginBottom: Spacing.lg,
  },
  notesLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  notesInput: {
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: Radii.md,
    padding: 10,
    fontSize: 13,
    color: colors.textPrimary,
    minHeight: 50,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  quantityPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceInteractive,
    borderRadius: Radii.full,
    padding: 4,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.card,
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
    color: colors.textPrimary,
  },
  qtyText: {
    fontSize: 15,
    fontWeight: '700',
    paddingHorizontal: 12,
    color: colors.textPrimary,
  },
  addBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  addBtnDisabled: {
    backgroundColor: colors.disabled,
  },
  addBtnContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.onPrimary,
  },
  errorCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: colors.danger,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    alignItems: 'center',
    gap: 6,
  },
  errorTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  errorActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 4,
  },
  retryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radii.full,
  },
  retryBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  cancelErrorBtn: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radii.full,
  },
  cancelErrorBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
});
let styles = createStyles(lightColors);
