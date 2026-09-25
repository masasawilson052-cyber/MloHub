import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { Shadows } from '../../theme/shadows';
import { Typography } from '../../theme/typography';
import { MenuCategory } from '../../types/domain';
import { Button } from '../ui/Button';

import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

export interface CategoryManagerProps {
  visible: boolean;
  categories: MenuCategory[];
  onAddCategory: (nameEn: string, nameSw?: string) => Promise<void>;
  onArchiveCategory: (categoryId: string) => Promise<void>;
  onClose: () => void;
  language?: 'en' | 'sw';
}

export const CategoryManager: React.FC<CategoryManagerProps> = ({
  visible,
  categories,
  onAddCategory,
  onArchiveCategory,
  onClose,
  language = 'en',
}) => {
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);
  const [newCatNameEn, setNewCatNameEn] = useState('');
  const [newCatNameSw, setNewCatNameSw] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!visible) return null;

  const handleAddCategory = async () => {
    if (!newCatNameEn.trim()) {
      setErrorMsg('Please enter category name in English.');
      return;
    }
    try {
      setIsAdding(true);
      setErrorMsg(null);
      await onAddCategory(newCatNameEn.trim(), newCatNameSw.trim() || undefined);
      setNewCatNameEn('');
      setNewCatNameSw('');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to add category.');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>
                {language === 'sw' ? 'Simamia Makundi ya Menyu' : 'Manage Menu Categories'}
              </Text>
              <Text style={styles.modalSub}>
                Organize your dishes into sections (e.g. Biryani, Grills, Drinks)
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {errorMsg && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color="#DC2626" />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          {/* Add New Category Input Row */}
          <View style={styles.addCard}>
            <Text style={styles.addCardTitle}>Create New Category</Text>
            <View style={styles.addInputsRow}>
              <TextInput
                style={[styles.textInput, { flex: 1 }]}
                placeholder="Category Name (e.g. Grills & Choma)"
                value={newCatNameEn}
                onChangeText={setNewCatNameEn}
              />
              <TextInput
                style={[styles.textInput, { flex: 1 }]}
                placeholder="Jina la Kiswahili (mf. Nyama Choma)"
                value={newCatNameSw}
                onChangeText={setNewCatNameSw}
              />
            </View>
            <Button
              title={isAdding ? 'Creating...' : '+ Add Category'}
              onPress={handleAddCategory}
              loading={isAdding}
              variant="primary"
              size="sm"
              style={{ alignSelf: 'flex-end', marginTop: 8 }}
            />
          </View>

          {/* Existing Categories List */}
          <Text style={styles.existingTitle}>Current Categories ({categories.length})</Text>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.catList}>
            {categories.map((cat, index) => (
              <View key={cat.id} style={styles.catRow}>
                <View style={styles.catIndexBadge}>
                  <Text style={styles.catIndexText}>{index + 1}</Text>
                </View>
                <View style={styles.catNameCol}>
                  <Text style={styles.catNameEn}>{cat.nameEn}</Text>
                  {cat.nameSw && <Text style={styles.catNameSw}>{cat.nameSw}</Text>}
                </View>

                <TouchableOpacity
                  style={styles.trashBtn}
                  onPress={() =>
                    Alert.alert(
                      'Archive Category?',
                      `Are you sure you want to archive "${cat.nameEn}"? Dishes in this category will remain available under other specials.`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Archive', style: 'destructive', onPress: () => onArchiveCategory(cat.id) },
                      ]
                    )
                  }
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.error} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>

          <View style={styles.modalFooter}>
            <Button title="Done" onPress={onClose} variant="secondary" size="md" fullWidth={true} />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  modalCard: {
    backgroundColor: colors.card,
    borderRadius: Radii.lg,
    maxWidth: 540,
    width: '100%',
    maxHeight: '85%',
    padding: Spacing.lg,
    ...Shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    ...Typography.H3,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  modalSub: {
    ...Typography.Caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.dangerSoft,
    padding: Spacing.xs,
    borderRadius: Radii.sm,
    marginBottom: Spacing.sm,
  },
  errorText: {
    ...Typography.Caption,
    color: colors.danger,
    fontWeight: '600',
  },
  addCard: {
    backgroundColor: colors.surfaceInteractive,
    padding: Spacing.md,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: colors.divider,
    marginBottom: Spacing.md,
  },
  addCardTitle: {
    ...Typography.Caption,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  addInputsRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    backgroundColor: colors.card,
    ...Typography.Body,
    fontSize: 13,
  },
  existingTitle: {
    ...Typography.Caption,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  catList: {
    gap: 6,
    paddingBottom: Spacing.md,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: Radii.md,
  },
  catIndexBadge: {
    width: 24,
    height: 24,
    borderRadius: Radii.full,
    backgroundColor: colors.surfaceInteractive,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  catIndexText: {
    ...Typography.Caption,
    fontWeight: '700',
    fontSize: 11,
    color: colors.textSecondary,
  },
  catNameCol: {
    flex: 1,
  },
  catNameEn: {
    ...Typography.BodyMedium,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  catNameSw: {
    ...Typography.Caption,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  trashBtn: {
    padding: 6,
  },
  modalFooter: {
    marginTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: Spacing.sm,
  },
});
let styles = createStyles(lightColors);
