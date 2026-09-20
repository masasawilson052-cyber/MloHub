import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { Shadows } from '../../theme/shadows';
import { Typography } from '../../theme/typography';
import { RestaurantEntity } from '../../db/types';
import { Button } from '../ui/Button';
import { StorageService } from '../../services/StorageService';
import { BranchOperationsRepository } from '../../repositories/branchOperations.repository';

export type OperatingOverride = 'OPEN' | 'BUSY' | 'PAUSED' | 'CLOSED';

export interface DaySchedule {
  day: string;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

export interface RestaurantSettingsProps {
  restaurant: RestaurantEntity;
  branches: { id: string; name: string; address?: string; phone?: string; isActive: boolean }[];
  onSaveProfile: (updates: Partial<RestaurantEntity>) => Promise<void>;
  onUpdateOperatingStatus: (status: OperatingOverride) => Promise<void>;
  language?: 'en' | 'sw';
}

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const DEFAULT_WEEKLY_SCHEDULE: DaySchedule[] = [
  { day: 'Monday', isOpen: true, openTime: '08:00', closeTime: '22:00' },
  { day: 'Tuesday', isOpen: true, openTime: '08:00', closeTime: '22:00' },
  { day: 'Wednesday', isOpen: true, openTime: '08:00', closeTime: '22:00' },
  { day: 'Thursday', isOpen: true, openTime: '08:00', closeTime: '22:00' },
  { day: 'Friday', isOpen: true, openTime: '08:00', closeTime: '23:00' },
  { day: 'Saturday', isOpen: true, openTime: '09:00', closeTime: '23:00' },
  { day: 'Sunday', isOpen: true, openTime: '09:00', closeTime: '21:00' },
];

export const RestaurantSettings: React.FC<RestaurantSettingsProps> = ({
  restaurant,
  branches,
  onSaveProfile,
  onUpdateOperatingStatus,
  language = 'en',
}) => {
  const [operatingStatus, setOperatingStatus] = useState<OperatingOverride>(
    restaurant.isOpen ? 'OPEN' : 'CLOSED'
  );
  const [name, setName] = useState(restaurant.name || '');
  const [phone, setPhone] = useState(restaurant.phone || '');
  const [neighborhood, setNeighborhood] = useState(restaurant.neighborhood || '');
  const [schedule, setSchedule] = useState<DaySchedule[]>(DEFAULT_WEEKLY_SCHEDULE);
  const [isSaving, setIsSaving] = useState(false);

  // Load branch operational status and hours via Pack 4F BranchOperationsRepository
  useEffect(() => {
    if (branches.length > 0) {
      const primaryBranchId = branches[0].id;
      BranchOperationsRepository.getBranchOperationalStatus(primaryBranchId)
        .then((st) => {
          if (st?.mode) {
            setOperatingStatus(st.mode as OperatingOverride);
          }
        })
        .catch((e) => console.warn('[RestaurantSettings] getBranchOperationalStatus error:', e));

      BranchOperationsRepository.getOperatingHours(primaryBranchId)
        .then((hours) => {
          if (hours && hours.length > 0) {
            const mapped = DAYS_OF_WEEK.map((dayName, dayIdx) => {
              const h = hours.find((x) => x.dayOfWeek === dayIdx);
              if (h) {
                return {
                  day: dayName,
                  isOpen: !h.isClosed,
                  openTime: h.opensAt ? h.opensAt.substring(0, 5) : '08:00',
                  closeTime: h.closesAt ? h.closesAt.substring(0, 5) : '22:00',
                };
              }
              return {
                day: dayName,
                isOpen: true,
                openTime: '08:00',
                closeTime: '22:00',
              };
            });
            setSchedule(mapped);
          }
        })
        .catch((e) => console.warn('[RestaurantSettings] getOperatingHours error:', e));
    }
  }, [branches]);

  // Media state
  const [logoUrl, setLogoUrl] = useState(restaurant.logoUrl || '');
  const [coverImageUrl, setCoverImageUrl] = useState(restaurant.coverImageUrl || '');
  const [foodSpotPhotos, setFoodSpotPhotos] = useState<string[]>(restaurant.foodSpotPhotos || []);
  const [uploadingTarget, setUploadingTarget] = useState<'logo' | 'cover' | 'gallery' | null>(null);

  const handleUploadLogo = async () => {
    try {
      setUploadingTarget('logo');
      const picked = await StorageService.pickAndValidateImage({ aspect: [1, 1], quality: 0.8 });
      if (!picked) return;

      const uploaded = await StorageService.uploadRestaurantLogo({
        restaurantId: restaurant.id,
        fileUri: picked.uri,
        mimeType: picked.mimeType,
      });

      const oldLogo = logoUrl;
      setLogoUrl(uploaded.publicUrl);
      await onSaveProfile({ logoUrl: uploaded.publicUrl });

      if (oldLogo) {
        await StorageService.deleteMedia(oldLogo);
      }
      Alert.alert('Logo Updated', 'Restaurant logo has been successfully updated.');
    } catch (err: any) {
      Alert.alert('Upload Error', err?.message || 'Failed to upload logo.');
    } finally {
      setUploadingTarget(null);
    }
  };

  const handleRemoveLogo = async () => {
    if (!logoUrl) return;
    try {
      setUploadingTarget('logo');
      const oldLogo = logoUrl;
      setLogoUrl('');
      await onSaveProfile({ logoUrl: '' });
      await StorageService.deleteMedia(oldLogo);
      Alert.alert('Logo Removed', 'Restaurant logo has been removed.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to remove logo.');
    } finally {
      setUploadingTarget(null);
    }
  };

  const handleUploadCover = async () => {
    try {
      setUploadingTarget('cover');
      const picked = await StorageService.pickAndValidateImage({ aspect: [16, 9], quality: 0.8 });
      if (!picked) return;

      const uploaded = await StorageService.uploadRestaurantCover({
        restaurantId: restaurant.id,
        fileUri: picked.uri,
        mimeType: picked.mimeType,
      });

      const oldCover = coverImageUrl;
      setCoverImageUrl(uploaded.publicUrl);
      await onSaveProfile({ coverImageUrl: uploaded.publicUrl });

      if (oldCover) {
        await StorageService.deleteMedia(oldCover);
      }
      Alert.alert('Cover Banner Updated', 'Restaurant cover banner has been successfully updated.');
    } catch (err: any) {
      Alert.alert('Upload Error', err?.message || 'Failed to upload cover banner.');
    } finally {
      setUploadingTarget(null);
    }
  };

  const handleRemoveCover = async () => {
    if (!coverImageUrl) return;
    try {
      setUploadingTarget('cover');
      const oldCover = coverImageUrl;
      setCoverImageUrl('');
      await onSaveProfile({ coverImageUrl: '' });
      await StorageService.deleteMedia(oldCover);
      Alert.alert('Cover Removed', 'Restaurant cover image has been removed.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to remove cover image.');
    } finally {
      setUploadingTarget(null);
    }
  };

  const handleAddGalleryPhoto = async () => {
    if (foodSpotPhotos.length >= 12) {
      Alert.alert('Gallery Limit Reached', 'A maximum of 12 food spot photos is allowed.');
      return;
    }

    try {
      setUploadingTarget('gallery');
      const picked = await StorageService.pickAndValidateImage({ aspect: [4, 3], quality: 0.8 });
      if (!picked) return;

      const uploaded = await StorageService.uploadRestaurantPhoto({
        restaurantId: restaurant.id,
        fileUri: picked.uri,
        mimeType: picked.mimeType,
      });

      const updated = [...foodSpotPhotos, uploaded.publicUrl];
      setFoodSpotPhotos(updated);
      await onSaveProfile({ foodSpotPhotos: updated });
      Alert.alert('Photo Added', 'Food spot gallery photo has been added.');
    } catch (err: any) {
      Alert.alert('Upload Error', err?.message || 'Failed to upload gallery photo.');
    } finally {
      setUploadingTarget(null);
    }
  };

  const handleRemoveGalleryPhoto = async (index: number) => {
    const photoToRemove = foodSpotPhotos[index];
    if (!photoToRemove) return;

    try {
      setUploadingTarget('gallery');
      const updated = foodSpotPhotos.filter((_, i) => i !== index);
      setFoodSpotPhotos(updated);
      await onSaveProfile({ foodSpotPhotos: updated });
      await StorageService.deleteMedia(photoToRemove);
      Alert.alert('Photo Removed', 'Gallery photo removed.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to remove gallery photo.');
    } finally {
      setUploadingTarget(null);
    }
  };

  const handleStatusChange = async (newStatus: OperatingOverride) => {
    setOperatingStatus(newStatus);
    await onUpdateOperatingStatus(newStatus);
    Alert.alert('Status Updated', `Operational state set to: ${newStatus}`);
  };

  const handleSaveAll = async () => {
    try {
      setIsSaving(true);
      await onSaveProfile({
        name,
        phone,
        neighborhood,
        logoUrl,
        coverImageUrl,
        foodSpotPhotos,
      });

      if (branches.length > 0) {
        const primaryBranchId = branches[0].id;
        const hoursToSave = schedule.map((d, index) => {
          const dayIndex = DAYS_OF_WEEK.indexOf(d.day);
          return {
            dayOfWeek: dayIndex >= 0 ? dayIndex : index,
            opensAt: d.openTime ? `${d.openTime}:00` : '08:00:00',
            closesAt: d.closeTime ? `${d.closeTime}:00` : '22:00:00',
            isClosed: !d.isOpen,
          };
        });
        await BranchOperationsRepository.upsertOperatingHours(primaryBranchId, hoursToSave);
      }

      Alert.alert('Settings Saved', 'Restaurant profile and operational settings saved.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleDayOpen = (index: number) => {
    setSchedule((prev) =>
      prev.map((d, i) => (i === index ? { ...d, isOpen: !d.isOpen } : d))
    );
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
      {/* 1. Operating Status Override (Task 39) */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Ionicons name="flash-outline" size={20} color={Colors.primary} />
          <View>
            <Text style={styles.sectionTitle}>Live Kitchen Operating Status</Text>
            <Text style={styles.sectionSub}>Temporary status override shown to diners on MloHub</Text>
          </View>
        </View>

        <View style={styles.statusOptionsRow}>
          {[
            { id: 'OPEN', label: 'Open ✓', color: '#15803D', bg: '#DCFCE7' },
            { id: 'BUSY', label: 'Busy (Rush)', color: '#D97706', bg: '#FEF3C7' },
            { id: 'PAUSED', label: 'Paused ⏸', color: '#B45309', bg: '#FFF7ED' },
            { id: 'CLOSED', label: 'Closed ✕', color: '#DC2626', bg: '#FEE2E2' },
          ].map((st) => (
            <TouchableOpacity
              key={st.id}
              style={[
                styles.statusPill,
                operatingStatus === st.id && { backgroundColor: st.bg, borderColor: st.color, borderWidth: 1.5 },
              ]}
              onPress={() => handleStatusChange(st.id as OperatingOverride)}
            >
              <Text
                style={[
                  styles.statusPillText,
                  operatingStatus === st.id && { color: st.color, fontWeight: '800' },
                ]}
              >
                {st.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* 2. Restaurant Profile */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Ionicons name="storefront-outline" size={20} color={Colors.primary} />
          <View>
            <Text style={styles.sectionTitle}>Restaurant Information</Text>
            <Text style={styles.sectionSub}>Public culinary profile and contact information</Text>
          </View>
        </View>

        <View style={styles.formGrid}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Restaurant Name</Text>
            <TextInput style={styles.textInput} value={name} onChangeText={setName} />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Official Phone / WhatsApp</Text>
            <TextInput style={styles.textInput} value={phone} onChangeText={setPhone} />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Primary Neighborhood</Text>
            <TextInput style={styles.textInput} value={neighborhood} onChangeText={setNeighborhood} />
          </View>
        </View>
      </View>

      {/* 2b. Restaurant Branding & Media (Task 3G) */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Ionicons name="images-outline" size={20} color={Colors.primary} />
          <View>
            <Text style={styles.sectionTitle}>
              {language === 'sw' ? 'Picha na Nembo ya Mgahawa' : 'Restaurant Branding & Media'}
            </Text>
            <Text style={styles.sectionSub}>
              {language === 'sw'
                ? 'Pakia nembo, picha ya juu (cover), na picha za eneo la chakula (gallery)'
                : 'Upload official logo, cover banner, and food spot gallery photos'}
            </Text>
          </View>
        </View>

        {/* Logo & Cover Row */}
        <View style={styles.mediaRow}>
          {/* Logo Card */}
          <View style={styles.mediaCol}>
            <Text style={styles.inputLabel}>
              {language === 'sw' ? 'Nembo ya Mgahawa (Logo)' : 'Restaurant Logo (1:1)'}
            </Text>
            <View style={styles.logoBox}>
              {logoUrl ? (
                <Image source={{ uri: logoUrl }} style={styles.logoImage} resizeMode="cover" />
              ) : (
                <View style={styles.logoPlaceholder}>
                  <Ionicons name="storefront-outline" size={36} color="#94a3b8" />
                </View>
              )}
            </View>
            <View style={styles.mediaButtonRow}>
              <TouchableOpacity
                style={styles.mediaSmallBtn}
                onPress={handleUploadLogo}
                disabled={uploadingTarget !== null}
              >
                <Ionicons name="cloud-upload-outline" size={14} color={Colors.primary} />
                <Text style={styles.mediaSmallBtnText}>
                  {logoUrl ? (language === 'sw' ? 'Badilisha' : 'Replace') : (language === 'sw' ? 'Weka Nembo' : 'Upload')}
                </Text>
              </TouchableOpacity>
              {logoUrl ? (
                <TouchableOpacity
                  style={[styles.mediaSmallBtn, styles.mediaDeleteBtn]}
                  onPress={handleRemoveLogo}
                  disabled={uploadingTarget !== null}
                >
                  <Ionicons name="trash-outline" size={14} color="#ef4444" />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {/* Cover Card */}
          <View style={[styles.mediaCol, { flex: 1.5 }]}>
            <Text style={styles.inputLabel}>
              {language === 'sw' ? 'Picha ya Juu (Cover Banner 16:9)' : 'Cover Banner (16:9)'}
            </Text>
            <View style={styles.coverBox}>
              {coverImageUrl ? (
                <Image source={{ uri: coverImageUrl }} style={styles.coverImage} resizeMode="cover" />
              ) : (
                <View style={styles.coverPlaceholder}>
                  <Ionicons name="image-outline" size={36} color="#94a3b8" />
                </View>
              )}
            </View>
            <View style={styles.mediaButtonRow}>
              <TouchableOpacity
                style={styles.mediaSmallBtn}
                onPress={handleUploadCover}
                disabled={uploadingTarget !== null}
              >
                <Ionicons name="cloud-upload-outline" size={14} color={Colors.primary} />
                <Text style={styles.mediaSmallBtnText}>
                  {coverImageUrl ? (language === 'sw' ? 'Badilisha' : 'Replace') : (language === 'sw' ? 'Weka Cover' : 'Upload')}
                </Text>
              </TouchableOpacity>
              {coverImageUrl ? (
                <TouchableOpacity
                  style={[styles.mediaSmallBtn, styles.mediaDeleteBtn]}
                  onPress={handleRemoveCover}
                  disabled={uploadingTarget !== null}
                >
                  <Ionicons name="trash-outline" size={14} color="#ef4444" />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>

        {/* Food Spot Gallery */}
        <View style={styles.gallerySection}>
          <View style={styles.galleryHeaderRow}>
            <View>
              <Text style={styles.inputLabel}>
                {language === 'sw' ? 'Picha za Mgahawa & Chakula' : 'Food Spot Gallery Photos'}
              </Text>
              <Text style={styles.galleryCountText}>
                {foodSpotPhotos.length} / 12 {language === 'sw' ? 'picha' : 'photos'}
              </Text>
            </View>
            {foodSpotPhotos.length < 12 && (
              <TouchableOpacity
                style={styles.addPhotoBtn}
                onPress={handleAddGalleryPhoto}
                disabled={uploadingTarget !== null}
              >
                <Ionicons name="add-circle-outline" size={16} color="#ffffff" />
                <Text style={styles.addPhotoBtnText}>
                  {language === 'sw' ? 'Ongeza Picha' : 'Add Photo'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.galleryGrid}>
            {foodSpotPhotos.map((photo, idx) => (
              <View key={`${photo}-${idx}`} style={styles.galleryThumbWrapper}>
                <Image source={{ uri: photo }} style={styles.galleryThumb} resizeMode="cover" />
                <TouchableOpacity
                  style={styles.galleryThumbRemoveBtn}
                  onPress={() => handleRemoveGalleryPhoto(idx)}
                  disabled={uploadingTarget !== null}
                >
                  <Ionicons name="close-circle" size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ))}
            {foodSpotPhotos.length === 0 && (
              <View style={styles.emptyGalleryBox}>
                <Ionicons name="images-outline" size={28} color="#94a3b8" />
                <Text style={styles.emptyGalleryText}>
                  {language === 'sw'
                    ? 'Bado hakuna picha za ziada za mgahawa'
                    : 'No additional spot photos uploaded yet'}
                </Text>
              </View>
            )}
          </View>
        </View>

        {uploadingTarget && (
          <View style={styles.uploadIndicatorRow}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.uploadIndicatorText}>
              {language === 'sw' ? 'Inapakia picha kwenye wingu...' : 'Uploading image to cloud storage...'}
            </Text>
          </View>
        )}
      </View>

      {/* 3. Opening Hours Schedule Editor (Task 38) */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Ionicons name="time-outline" size={20} color={Colors.primary} />
          <View>
            <Text style={styles.sectionTitle}>Weekly Opening Hours</Text>
            <Text style={styles.sectionSub}>Daily operation schedule for discovery & order dispatch</Text>
          </View>
        </View>

        <View style={styles.scheduleList}>
          {schedule.map((item, idx) => (
            <View key={item.day} style={styles.dayRow}>
              <View style={styles.dayLeft}>
                <Switch
                  value={item.isOpen}
                  onValueChange={() => toggleDayOpen(idx)}
                  trackColor={{ false: '#E2E8F0', true: '#BBF7D0' }}
                  thumbColor={item.isOpen ? Colors.primary : '#94A3B8'}
                />
                <Text style={[styles.dayText, !item.isOpen && styles.dayTextClosed]}>
                  {item.day}
                </Text>
              </View>

              {item.isOpen ? (
                <View style={styles.hoursRow}>
                  <Text style={styles.hoursText}>{item.openTime} — {item.closeTime}</Text>
                </View>
              ) : (
                <View style={styles.closedPill}>
                  <Text style={styles.closedPillText}>Closed</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      </View>

      {/* 4. Branch Management (Task 37) */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Ionicons name="business-outline" size={20} color={Colors.primary} />
          <View>
            <Text style={styles.sectionTitle}>Branches & Locations ({branches.length})</Text>
            <Text style={styles.sectionSub}>Manage multi-branch operations and pricing zones</Text>
          </View>
        </View>

        <View style={styles.branchList}>
          {branches.map((b) => (
            <View key={b.id} style={styles.branchRow}>
              <View>
                <Text style={styles.branchName}>{b.name}</Text>
                <Text style={styles.branchAddress}>{b.address || 'Dar es Salaam, Tanzania'}</Text>
              </View>
              <View style={styles.branchActiveBadge}>
                <Text style={styles.branchActiveText}>{b.isActive ? 'Active ✓' : 'Inactive'}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* 5. Notification Dispatch Policy */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Ionicons name="notifications-outline" size={20} color={Colors.primary} />
          <View>
            <Text style={styles.sectionTitle}>
              {language === 'sw' ? 'Arifa za Jikoni na Uendeshaji' : 'Kitchen & Dispatch Notifications'}
            </Text>
            <Text style={styles.sectionSub}>
              {language === 'sw'
                ? 'Arifa za maagizo mapya na nafasi za meza zinasimamiwa na mfumo mkuu wa SMS na Push.'
                : 'Order alerts, reservations, and customer reviews are automatically dispatched to active staff via SMS and Push.'}
            </Text>
          </View>
        </View>
      </View>

      {/* Save Settings CTA */}
      <Button
        title={isSaving ? 'Saving Changes...' : 'Save All Settings'}
        onPress={handleSaveAll}
        loading={isSaving}
        variant="primary"
        size="lg"
        fullWidth={true}
        style={{ marginBottom: Spacing.xl }}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: Spacing.md,
    maxWidth: 900,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.md,
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.H3,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  sectionSub: {
    ...Typography.Caption,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  statusOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  statusPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radii.md,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: 110,
    alignItems: 'center',
  },
  statusPillText: {
    ...Typography.Caption,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  formGrid: {
    gap: Spacing.sm,
  },
  inputGroup: {
    gap: 4,
  },
  inputLabel: {
    ...Typography.Caption,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  textInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.md,
    padding: Spacing.sm,
    ...Typography.Body,
    backgroundColor: Colors.white,
  },
  scheduleList: {
    gap: 8,
  },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  dayLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dayText: {
    ...Typography.BodyMedium,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  dayTextClosed: {
    color: Colors.textMuted,
  },
  hoursRow: {
    backgroundColor: Colors.surfaceSecondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.sm,
  },
  hoursText: {
    ...Typography.Caption,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  closedPill: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.sm,
  },
  closedPillText: {
    ...Typography.Caption,
    color: Colors.error,
    fontWeight: '700',
  },
  branchList: {
    gap: 8,
  },
  branchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surfaceSecondary,
    padding: Spacing.sm,
    borderRadius: Radii.md,
  },
  branchName: {
    ...Typography.BodyMedium,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  branchAddress: {
    ...Typography.Caption,
    color: Colors.textMuted,
  },
  branchActiveBadge: {
    backgroundColor: Colors.primaryMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.full,
  },
  branchActiveText: {
    ...Typography.Caption,
    fontSize: 11,
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  notifRows: {
    gap: 12,
  },
  notifRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notifLabel: {
    ...Typography.BodyMedium,
    color: Colors.textPrimary,
  },
  mediaRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  mediaCol: {
    flex: 1,
  },
  logoBox: {
    width: 100,
    height: 100,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceSecondary,
    marginBottom: 8,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  logoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverBox: {
    height: 100,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceSecondary,
    marginBottom: 8,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaButtonRow: {
    flexDirection: 'row',
    gap: 6,
  },
  mediaSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.sm,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  mediaDeleteBtn: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  mediaSmallBtnText: {
    ...Typography.Caption,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  gallerySection: {
    marginTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: Spacing.md,
  },
  galleryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  galleryCountText: {
    ...Typography.Caption,
    color: Colors.textMuted,
  },
  addPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.sm,
  },
  addPhotoBtnText: {
    ...Typography.Caption,
    fontWeight: '700',
    color: Colors.white,
  },
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  galleryThumbWrapper: {
    position: 'relative',
    width: 80,
    height: 80,
    borderRadius: Radii.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  galleryThumb: {
    width: '100%',
    height: '100%',
  },
  galleryThumbRemoveBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: Colors.white,
    borderRadius: 10,
  },
  emptyGalleryBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    gap: 6,
  },
  emptyGalleryText: {
    ...Typography.Caption,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  uploadIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    padding: 8,
    borderRadius: Radii.sm,
    backgroundColor: '#EFF6FF',
  },
  uploadIndicatorText: {
    ...Typography.Caption,
    color: '#1D4ED8',
    fontWeight: '600',
  },
});
