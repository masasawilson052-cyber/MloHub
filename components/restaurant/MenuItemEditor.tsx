import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { Shadows } from '../../theme/shadows';
import { Typography } from '../../theme/typography';
import { MenuItem, MenuCategory } from '../../types/domain';
import { Button } from '../ui/Button';
import {
  StorageService,
  generateUuid,
  PickedImageResult,
  MediaUploadResult,
} from '../../services/StorageService';

export interface BranchPriceOverride {
  branchId: string;
  branchName: string;
  customPriceTzs?: number;
}

export interface MenuItemEditorProps {
  visible: boolean;
  item: MenuItem | null; // null means new item
  restaurantId?: string;
  categories: MenuCategory[];
  branches?: { id: string; name: string }[];
  branchOverrides?: BranchPriceOverride[];
  onSave: (savedItem: Partial<MenuItem>, branchOverrides?: BranchPriceOverride[]) => Promise<void>;
  onClose: () => void;
  language?: 'en' | 'sw';
}

const AVAILABLE_DIETARY_TAGS = ['Halal', 'Vegetarian', 'Vegan', 'High Protein', 'Gluten-Free', 'Spicy'];

export const MenuItemEditor: React.FC<MenuItemEditorProps> = ({
  visible,
  item,
  restaurantId,
  categories,
  branches = [],
  branchOverrides = [],
  onSave,
  onClose,
  language = 'en',
}) => {
  const [nameEn, setNameEn] = useState(item?.nameEn || item?.name || '');
  const [nameSw, setNameSw] = useState(item?.nameSw || '');
  const [descEn, setDescEn] = useState(item?.descriptionEn || item?.description || '');
  const [descSw, setDescSw] = useState(item?.descriptionSw || '');
  const [categoryId, setCategoryId] = useState(item?.categoryId || (categories[0]?.id || ''));
  const [basePriceTzs, setBasePriceTzs] = useState(String(item?.basePrice || item?.priceTzs || '10000'));
  const [prepTime, setPrepTime] = useState(String(item?.preparationMinutes || '20'));
  const [photoUrl, setPhotoUrl] = useState(item?.photoUrl || item?.imageUrl || '');
  const [previewUri, setPreviewUri] = useState<string | null>(item?.photoUrl || item?.imageUrl || null);
  const [pendingImage, setPendingImage] = useState<PickedImageResult | null>(null);
  const [isPhotoRemoved, setIsPhotoRemoved] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [dietaryTags, setDietaryTags] = useState<string[]>(item?.dietaryTags || ['Halal']);
  const [spiceLevel, setSpiceLevel] = useState<'Mild' | 'Medium' | 'Hot' | 'Very Hot'>(
    (item?.spiceLevel as any) || 'Mild'
  );
  const [isAvailable, setIsAvailable] = useState(item?.isAvailable ?? true);

  // Branch overrides state
  const [localBranchPrices, setLocalBranchPrices] = useState<{ [branchId: string]: string }>(() => {
    const init: { [branchId: string]: string } = {};
    branchOverrides.forEach((b) => {
      if (b.customPriceTzs) init[b.branchId] = String(b.customPriceTzs);
    });
    return init;
  });

  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!visible) return null;

  const toggleTag = (tag: string) => {
    setDietaryTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handlePickPhoto = async () => {
    try {
      setErrorMsg(null);
      setUploadStatus(language === 'sw' ? 'Inachagua picha...' : 'Selecting image...');
      const picked = await StorageService.pickAndValidateImage({ aspect: [16, 9], quality: 0.8 });
      if (picked) {
        setPendingImage(picked);
        setPreviewUri(picked.uri);
        setIsPhotoRemoved(false);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to select image.');
    } finally {
      setUploadStatus(null);
    }
  };

  const handleRemovePhoto = () => {
    setPendingImage(null);
    setPreviewUri(null);
    setIsPhotoRemoved(true);
  };

  const handleSave = async () => {
    if (!nameEn.trim()) {
      setErrorMsg('Please enter dish name (English).');
      return;
    }
    const parsedBase = parseInt(basePriceTzs.replace(/[^0-9]/g, ''), 10);
    if (isNaN(parsedBase) || parsedBase <= 0) {
      setErrorMsg('Please enter a valid base price in TZS.');
      return;
    }

    let uploadedMedia: MediaUploadResult | null = null;
    const oldPhotoUrl = item?.photoUrl || item?.imageUrl;
    let finalPhotoUrl = isPhotoRemoved ? '' : (photoUrl.trim() || undefined);

    try {
      setIsSaving(true);
      setErrorMsg(null);

      // Upload newly picked photo if present
      if (pendingImage && restaurantId) {
        setUploadStatus(language === 'sw' ? 'Inapakia picha kwenye wingu...' : 'Uploading image to cloud storage...');
        const targetItemId = item?.id || generateUuid();
        uploadedMedia = await StorageService.uploadMenuItemPhoto({
          restaurantId,
          menuItemId: targetItemId,
          fileUri: pendingImage.uri,
          mimeType: pendingImage.mimeType,
        });
        finalPhotoUrl = uploadedMedia.publicUrl;
      }

      setUploadStatus(language === 'sw' ? 'Inahifadhi mabadiliko...' : 'Saving menu changes...');

      const partialItem: Partial<MenuItem> = {
        id: item?.id,
        name: nameEn.trim(),
        nameEn: nameEn.trim(),
        nameSw: nameSw.trim() || undefined,
        description: descEn.trim() || undefined,
        descriptionEn: descEn.trim() || undefined,
        descriptionSw: descSw.trim() || undefined,
        categoryId: categoryId || undefined,
        basePrice: parsedBase,
        priceTzs: parsedBase,
        photoUrl: finalPhotoUrl || undefined,
        imageUrl: finalPhotoUrl || undefined,
        preparationMinutes: parseInt(prepTime, 10) || 20,
        dietaryTags,
        spiceLevel,
        isAvailable,
      };

      const updatedOverrides: BranchPriceOverride[] = branches.map((b) => ({
        branchId: b.id,
        branchName: b.name,
        customPriceTzs: localBranchPrices[b.id]
          ? parseInt(localBranchPrices[b.id].replace(/[^0-9]/g, ''), 10)
          : undefined,
      }));

      await onSave(partialItem, updatedOverrides);

      // Safe replacement: delete previous owned media only after DB persistence succeeds
      if ((pendingImage || isPhotoRemoved) && oldPhotoUrl) {
        await StorageService.deleteMedia(oldPhotoUrl);
      }

      onClose();
    } catch (err: any) {
      // Orphan cleanup: if DB save failed after new upload, delete newly uploaded object
      if (uploadedMedia) {
        await StorageService.cleanupOrphan(uploadedMedia.storagePath);
      }
      setErrorMsg(err?.message || 'Failed to save menu item.');
    } finally {
      setIsSaving(false);
      setUploadStatus(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>
                {item ? (language === 'sw' ? 'Hariri Chakula' : 'Edit Dish') : (language === 'sw' ? 'Ongeza Chakula Kipya' : 'Add New Dish')}
              </Text>
              <Text style={styles.headerSub}>
                {language === 'sw' ? 'Sasisha maelezo, bei ya matawi na uthibitisho' : 'Manage dish information, branch pricing and availability'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {errorMsg && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color="#DC2626" />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
            {/* Dish Names */}
            <View style={styles.fieldRow}>
              <View style={styles.fieldCol}>
                <Text style={styles.fieldLabel}>Dish Name (English) *</Text>
                <TextInput
                  style={styles.textInput}
                  value={nameEn}
                  onChangeText={setNameEn}
                  placeholder="e.g. Chicken Biryani"
                />
              </View>
              <View style={styles.fieldCol}>
                <Text style={styles.fieldLabel}>Jina la Kiswahili</Text>
                <TextInput
                  style={styles.textInput}
                  value={nameSw}
                  onChangeText={setNameSw}
                  placeholder="mf. Biriani ya Kuku"
                />
              </View>
            </View>

            {/* Category & Base Price */}
            <View style={styles.fieldRow}>
              <View style={styles.fieldCol}>
                <Text style={styles.fieldLabel}>Menu Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catChipsRow}>
                  {categories.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.catChip, categoryId === c.id && styles.catChipActive]}
                      onPress={() => setCategoryId(c.id)}
                    >
                      <Text style={[styles.catChipText, categoryId === c.id && styles.catChipTextActive]}>
                        {language === 'sw' ? c.nameSw || c.nameEn : c.nameEn}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.fieldCol}>
                <Text style={styles.fieldLabel}>Base Price (TZS) *</Text>
                <TextInput
                  style={styles.textInput}
                  value={basePriceTzs}
                  onChangeText={setBasePriceTzs}
                  keyboardType="numeric"
                  placeholder="11000"
                />
              </View>
            </View>

            {/* Branch-Specific Pricing (Task 16) */}
            {branches.length > 1 && (
              <View style={styles.branchSection}>
                <View style={styles.branchSectionHeader}>
                  <Ionicons name="git-branch-outline" size={16} color={Colors.primary} />
                  <Text style={styles.branchSectionTitle}>
                    {language === 'sw' ? 'Bei Maalum kwa Matawi (Branch Overrides)' : 'Branch-Specific Pricing'}
                  </Text>
                </View>
                <Text style={styles.branchSectionSub}>
                  Leave blank to use the standard base price for that branch.
                </Text>

                <View style={styles.branchInputsGrid}>
                  {branches.map((b) => (
                    <View key={b.id} style={styles.branchPriceRow}>
                      <Text style={styles.branchNameText}>{b.name}</Text>
                      <TextInput
                        style={styles.branchPriceInput}
                        value={localBranchPrices[b.id] || ''}
                        onChangeText={(val) =>
                          setLocalBranchPrices((prev) => ({ ...prev, [b.id]: val }))
                        }
                        placeholder={basePriceTzs || '11000'}
                        keyboardType="numeric"
                      />
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Preparation Time & Spice Level */}
            <View style={styles.fieldRow}>
              <View style={styles.fieldCol}>
                <Text style={styles.fieldLabel}>Est. Prep Time (Mins)</Text>
                <TextInput
                  style={styles.textInput}
                  value={prepTime}
                  onChangeText={setPrepTime}
                  keyboardType="numeric"
                  placeholder="20"
                />
              </View>
              <View style={styles.fieldCol}>
                <Text style={styles.fieldLabel}>Spice Level</Text>
                <View style={styles.spiceRow}>
                  {(['Mild', 'Medium', 'Hot', 'Very Hot'] as const).map((level) => (
                    <TouchableOpacity
                      key={level}
                      style={[styles.spicePill, spiceLevel === level && styles.spicePillActive]}
                      onPress={() => setSpiceLevel(level)}
                    >
                      <Text style={[styles.spicePillText, spiceLevel === level && styles.spicePillTextActive]}>
                        {level}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* Dietary Tags */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Dietary Tags</Text>
              <View style={styles.tagsRow}>
                {AVAILABLE_DIETARY_TAGS.map((tag) => {
                  const isSelected = dietaryTags.includes(tag);
                  return (
                    <TouchableOpacity
                      key={tag}
                      style={[styles.tagPill, isSelected && styles.tagPillActive]}
                      onPress={() => toggleTag(tag)}
                    >
                      <Text style={[styles.tagPillText, isSelected && styles.tagPillTextActive]}>
                        {isSelected ? `✓ ${tag}` : `+ ${tag}`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Descriptions */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Description (English)</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={descEn}
                onChangeText={setDescEn}
                multiline
                numberOfLines={3}
                placeholder="Fragrant basmati rice served with tender chicken..."
              />
            </View>

            {/* Dish Photo Picker & Preview */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>
                {language === 'sw' ? 'Picha ya Chakula' : 'Dish Photo'}
              </Text>

              {previewUri ? (
                <View style={styles.photoPreviewCard}>
                  <Image source={{ uri: previewUri }} style={styles.photoPreviewImage} resizeMode="cover" />
                  <View style={styles.photoActionsRow}>
                    <TouchableOpacity
                      style={styles.photoActionBtn}
                      onPress={handlePickPhoto}
                      disabled={isSaving}
                    >
                      <Ionicons name="camera-outline" size={16} color={Colors.textPrimary} />
                      <Text style={styles.photoActionText}>
                        {language === 'sw' ? 'Badilisha Picha' : 'Replace Photo'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.photoActionBtn, styles.photoDeleteBtn]}
                      onPress={handleRemovePhoto}
                      disabled={isSaving}
                    >
                      <Ionicons name="trash-outline" size={16} color="#ef4444" />
                      <Text style={[styles.photoActionText, { color: '#ef4444' }]}>
                        {language === 'sw' ? 'Ondoa Picha' : 'Remove Photo'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.photoEmptyPlaceholder}>
                  <View style={styles.photoPlaceholderCircle}>
                    <Ionicons name="image-outline" size={28} color="#94a3b8" />
                  </View>
                  <Text style={styles.photoPlaceholderText}>
                    {language === 'sw'
                      ? 'Hakuna picha iliyochaguliwa (itafananishwa na alama ya sahani)'
                      : 'No photo selected (neutral dish icon will display)'}
                  </Text>
                  <TouchableOpacity
                    style={styles.photoSelectBtn}
                    onPress={handlePickPhoto}
                    disabled={isSaving}
                  >
                    <Ionicons name="cloud-upload-outline" size={18} color="#ffffff" />
                    <Text style={styles.photoSelectBtnText}>
                      {language === 'sw' ? 'Chagua Picha' : 'Select Photo'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {uploadStatus && (
                <View style={styles.uploadProgressRow}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                  <Text style={styles.uploadProgressText}>{uploadStatus}</Text>
                </View>
              )}
            </View>

            {/* Quick Availability Toggle */}
            <View style={styles.availabilityRow}>
              <View>
                <Text style={styles.availTitle}>Kitchen Availability</Text>
                <Text style={styles.availSub}>
                  {isAvailable
                    ? 'Currently active and discoverable on MloHub customer app'
                    : 'Marked unavailable / out of stock'}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.togglePill, isAvailable ? styles.toggleOn : styles.toggleOff]}
                onPress={() => setIsAvailable(!isAvailable)}
              >
                <Text style={styles.toggleText}>{isAvailable ? 'Available ✓' : 'Sold Out ✕'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <Button
              title="Cancel"
              onPress={onClose}
              variant="outline"
              size="md"
              style={{ flex: 1 }}
            />
            <Button
              title={isSaving ? 'Saving Dish...' : 'Save & Publish Dish'}
              onPress={handleSave}
              loading={isSaving}
              variant="primary"
              size="md"
              style={{ flex: 2 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  modalContainer: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    maxWidth: 680,
    width: '100%',
    maxHeight: '92%',
    ...Shadows.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerTitle: {
    ...Typography.H3,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  headerSub: {
    ...Typography.Caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEE2E2',
    padding: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    borderRadius: Radii.sm,
  },
  errorText: {
    ...Typography.Caption,
    color: '#B91C1C',
    fontWeight: '600',
  },
  scrollBody: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  fieldCol: {
    flex: 1,
  },
  fieldContainer: {
    gap: 4,
  },
  fieldLabel: {
    ...Typography.Caption,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  textInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
    ...Typography.Body,
    backgroundColor: Colors.white,
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  catChipsRow: {
    gap: 6,
    paddingVertical: 4,
  },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radii.full,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  catChipActive: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primary,
  },
  catChipText: {
    ...Typography.Caption,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  catChipTextActive: {
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  branchSection: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radii.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  branchSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  branchSectionTitle: {
    ...Typography.Caption,
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  branchSectionSub: {
    ...Typography.Caption,
    color: Colors.textMuted,
    marginTop: 2,
    marginBottom: Spacing.sm,
  },
  branchInputsGrid: {
    gap: 8,
  },
  branchPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  branchNameText: {
    ...Typography.BodyMedium,
    color: Colors.textPrimary,
  },
  branchPriceInput: {
    width: 120,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: Colors.white,
    textAlign: 'right',
    ...Typography.BodyMedium,
  },
  spiceRow: {
    flexDirection: 'row',
    gap: 6,
  },
  spicePill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: Radii.sm,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  spicePillActive: {
    backgroundColor: '#FFEDD5',
    borderColor: '#F97316',
  },
  spicePillText: {
    ...Typography.Caption,
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  spicePillTextActive: {
    color: '#C2410C',
    fontWeight: '700',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.full,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  tagPillActive: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primary,
  },
  tagPillText: {
    ...Typography.Caption,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tagPillTextActive: {
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  availabilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.sm,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radii.md,
    marginTop: 6,
  },
  availTitle: {
    ...Typography.BodyMedium,
    fontWeight: '700',
  },
  availSub: {
    ...Typography.Caption,
    color: Colors.textMuted,
  },
  togglePill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radii.full,
  },
  toggleOn: {
    backgroundColor: '#DCFCE7',
  },
  toggleOff: {
    backgroundColor: '#FEE2E2',
  },
  toggleText: {
    ...Typography.Caption,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  photoPreviewCard: {
    borderRadius: Radii.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
  },
  photoPreviewImage: {
    width: '100%',
    height: 180,
  },
  photoActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: Spacing.sm,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  photoActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.sm,
    backgroundColor: Colors.surfaceSecondary,
  },
  photoDeleteBtn: {
    backgroundColor: '#FEE2E2',
  },
  photoActionText: {
    ...Typography.Caption,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  photoEmptyPlaceholder: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    borderRadius: Radii.md,
    padding: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceSecondary,
    gap: Spacing.xs,
  },
  photoPlaceholderCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  photoPlaceholderText: {
    ...Typography.Caption,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 8,
  },
  photoSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radii.md,
  },
  photoSelectBtnText: {
    ...Typography.Caption,
    fontWeight: '700',
    color: Colors.white,
  },
  uploadProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    padding: 8,
    borderRadius: Radii.sm,
    backgroundColor: '#EFF6FF',
  },
  uploadProgressText: {
    ...Typography.Caption,
    color: '#1D4ED8',
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
});
