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
import { BranchRepository } from '../../repositories/branches.repository';
import { BranchManager } from './BranchManager';
import { RestaurantBranch } from '../../types/domain';

import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

export type OperatingOverride = 'OPEN' | 'BUSY' | 'PAUSED' | 'CLOSED';

export interface DaySchedule {
  day: string;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

export interface RestaurantSettingsProps {
  restaurant: RestaurantEntity;
  branches: RestaurantBranch[] | any[];
  selectedBranchId?: string;
  onSaveProfile: (updates: Partial<RestaurantEntity>) => Promise<void>;
  onUpdateOperatingStatus: (status: OperatingOverride) => Promise<void>;
  onBranchUpdated?: () => Promise<void> | void;
  language?: 'en' | 'sw';
}

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const getStandardOperatingSchedule = (): DaySchedule[] => [
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
  selectedBranchId,
  onSaveProfile,
  onUpdateOperatingStatus,
  onBranchUpdated,
  language = 'en',
}) => {
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);
  const activeBranch = branches.find(b => b.id === selectedBranchId) || null;
  const activeBranchId = activeBranch?.id;

  const [hasConfiguredHours, setHasConfiguredHours] = useState(false);
  const [operatingStatus, setOperatingStatus] = useState<OperatingOverride>(
    restaurant.isOpen ? 'OPEN' : 'CLOSED'
  );
  const [name, setName] = useState(restaurant.name || '');
  const [phone, setPhone] = useState(restaurant.phone || '');
  const [neighborhood, setNeighborhood] = useState(restaurant.neighborhood || '');
  const [schedule, setSchedule] = useState<DaySchedule[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingHours, setIsSavingHours] = useState(false);
  const [isSavingInfo, setIsSavingInfo] = useState(false);

  // Load branch operational status and hours via BranchOperationsRepository
  useEffect(() => {
    if (!activeBranchId) {
      setHasConfiguredHours(false);
      setSchedule([]);
      return;
    }

    BranchOperationsRepository.getBranchOperationalStatus(activeBranchId)
      .then((st) => {
        if (st?.mode) {
          setOperatingStatus(st.mode as OperatingOverride);
        }
      })
      .catch((e) => console.warn('[RestaurantSettings] getBranchOperationalStatus error:', e));

    BranchOperationsRepository.getOperatingHours(activeBranchId)
      .then((hours) => {
        if (hours && hours.length > 0) {
          setHasConfiguredHours(true);
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
              isOpen: false,
              openTime: '08:00',
              closeTime: '22:00',
            };
          });
          setSchedule(mapped);
        } else {
          setHasConfiguredHours(false);
          setSchedule([]);
        }
      })
      .catch((e) => {
        console.warn('[RestaurantSettings] getOperatingHours error:', e);
        setHasConfiguredHours(false);
        setSchedule([]);
      });
  }, [activeBranchId]);

  // Media state
  const [logoUrl, setLogoUrl] = useState(restaurant.logoUrl || '');
  const [coverImageUrl, setCoverImageUrl] = useState(restaurant.coverImageUrl || '');
  const [foodSpotPhotos, setFoodSpotPhotos] = useState<string[]>(restaurant.foodSpotPhotos || []);
  const [uploadingTarget, setUploadingTarget] = useState<'logo' | 'cover' | 'gallery' | null>(null);

  // Synchronize state when restaurant or activeBranch updates from server
  useEffect(() => {
    setName(restaurant.name || '');
    setPhone(restaurant.phone || activeBranch?.phone || restaurant.payoutPhoneNumber || '');
    setNeighborhood(restaurant.neighborhood || '');
    setLogoUrl(restaurant.logoUrl || '');
    setCoverImageUrl(restaurant.coverImageUrl || '');
    setFoodSpotPhotos(
      Array.isArray(restaurant.foodSpotPhotos)
        ? restaurant.foodSpotPhotos
        : (restaurant.foodSpotPhotos ? [restaurant.foodSpotPhotos] : [])
    );
  }, [restaurant, activeBranch]);

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

      if (activeBranchId) {
        if (phone) {
          await BranchRepository.update(activeBranchId, { phone } as any).catch((e) =>
            console.warn('[RestaurantSettings] Branch phone sync notice:', e)
          );
        }
        const hoursToSave = schedule.map((d, index) => {
          const dayIndex = DAYS_OF_WEEK.indexOf(d.day);
          return {
            dayOfWeek: dayIndex >= 0 ? dayIndex : index,
            opensAt: d.openTime ? `${d.openTime}:00` : '08:00:00',
            closesAt: d.closeTime ? `${d.closeTime}:00` : '22:00:00',
            isClosed: !d.isOpen,
          };
        });
        await BranchOperationsRepository.upsertOperatingHours(activeBranchId, hoursToSave);

        // Also sync to branch entity so restaurant_branches.opening_hours is populated
        const hoursObj: Record<string, string> = {};
        schedule.forEach((s) => {
          if (s.isOpen) {
            hoursObj[s.day.toLowerCase()] = `${s.openTime}-${s.closeTime}`;
          }
        });
        await BranchRepository.update(activeBranchId, { openingHours: hoursObj }).catch((e) =>
          console.warn('[RestaurantSettings] BranchRepository.update hours error:', e)
        );

        setHasConfiguredHours(true);
      }

      if (onBranchUpdated) {
        await onBranchUpdated();
      }

      Alert.alert('Settings Saved', 'Restaurant profile and operational settings saved.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveHoursOnly = async () => {
    if (!activeBranchId) {
      Alert.alert(
        language === 'sw' ? 'Tawi Linahitajika' : 'Branch Required',
        language === 'sw'
          ? 'Tafadhali chagua au sajili tawi kwanza kabla ya kuhifadhi masaa.'
          : 'Please select or add a branch before saving hours.'
      );
      return;
    }

    try {
      setIsSavingHours(true);
      const scheduleToSave = schedule.length > 0 ? schedule : getStandardOperatingSchedule();
      const hoursToSave = scheduleToSave.map((d, index) => {
        const dayIndex = DAYS_OF_WEEK.indexOf(d.day);
        return {
          dayOfWeek: dayIndex >= 0 ? dayIndex : index,
          opensAt: d.openTime ? `${d.openTime}:00` : '08:00:00',
          closesAt: d.closeTime ? `${d.closeTime}:00` : '22:00:00',
          isClosed: !d.isOpen,
        };
      });
      await BranchOperationsRepository.upsertOperatingHours(activeBranchId, hoursToSave);

      const hoursObj: Record<string, string> = {};
      scheduleToSave.forEach((s) => {
        if (s.isOpen) {
          hoursObj[s.day.toLowerCase()] = `${s.openTime}-${s.closeTime}`;
        }
      });
      await BranchRepository.update(activeBranchId, { openingHours: hoursObj }).catch((e) =>
        console.warn('[RestaurantSettings] BranchRepository.update hours error:', e)
      );

      if (schedule.length === 0) {
        setSchedule(scheduleToSave);
      }
      setHasConfiguredHours(true);

      if (onBranchUpdated) {
        await onBranchUpdated();
      }

      Alert.alert(
        language === 'sw' ? 'Masaa Yamehifadhiwa!' : 'Hours Saved!',
        language === 'sw'
          ? 'Masaa ya kazi ya tawi yamehifadhiwa kikamilifu. Hatua ya 3 sasa imekamilika!'
          : 'Branch operating hours saved successfully. Step 3 is now complete!'
      );
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save hours.');
    } finally {
      setIsSavingHours(false);
    }
  };

  const handleSaveInfoOnly = async () => {
    try {
      setIsSavingInfo(true);
      await onSaveProfile({
        name,
        phone,
        neighborhood,
      });

      if (activeBranchId && phone) {
        await BranchRepository.update(activeBranchId, { phone } as any).catch((e) =>
          console.warn('[RestaurantSettings] Branch phone sync notice:', e)
        );
      }

      if (onBranchUpdated) {
        await onBranchUpdated();
      }

      Alert.alert(
        language === 'sw' ? 'Taarifa Zimehifadhiwa' : 'Information Saved',
        language === 'sw'
          ? 'Jina la mgahawa, namba ya simu/WhatsApp, na eneo vimehifadhiwa kikamilifu.'
          : 'Restaurant name, contact phone/WhatsApp, and neighborhood saved successfully.'
      );
    } catch (err: any) {
      Alert.alert(
        language === 'sw' ? 'Hitilafu' : 'Error',
        err?.message || (language === 'sw' ? 'Imeshindikana kuhifadhi taarifa.' : 'Failed to save information.')
      );
    } finally {
      setIsSavingInfo(false);
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
          <Ionicons name="flash-outline" size={20} color={colors.primary} />
          <View>
            <Text style={styles.sectionTitle}>Live Kitchen Operating Status</Text>
            <Text style={styles.sectionSub}>Temporary status override shown to diners on MloHub</Text>
          </View>
        </View>

        <View style={styles.statusOptionsRow}>
          {[
            { id: 'OPEN', label: 'Open ✓', color: colors.success, bg: colors.successSoft },
            { id: 'BUSY', label: 'Busy (Rush)', color: colors.warning, bg: colors.warningSoft },
            { id: 'PAUSED', label: 'Paused ⏸', color: colors.warning, bg: colors.warningSoft },
            { id: 'CLOSED', label: 'Closed ✕', color: colors.danger, bg: colors.dangerSoft },
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
          <Ionicons name="storefront-outline" size={20} color={colors.primary} />
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

          <TouchableOpacity
            style={[styles.saveInfoBtn, isSavingInfo && { opacity: 0.6 }]}
            onPress={handleSaveInfoOnly}
            disabled={isSavingInfo}
            activeOpacity={0.8}
          >
            {isSavingInfo ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <>
                <Ionicons name="checkmark-done" size={16} color={colors.onPrimary} />
                <Text style={styles.saveInfoBtnText}>
                  {language === 'sw' ? 'Hifadhi Taarifa za Mgahawa' : 'Save Restaurant Info'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* 2b. Restaurant Branding & Media (Task 3G) */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Ionicons name="images-outline" size={20} color={colors.primary} />
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
                  <Ionicons name="storefront-outline" size={36} color={colors.textMuted} />
                </View>
              )}
            </View>
            <View style={styles.mediaButtonRow}>
              <TouchableOpacity
                style={styles.mediaSmallBtn}
                onPress={handleUploadLogo}
                disabled={uploadingTarget !== null}
              >
                <Ionicons name="cloud-upload-outline" size={14} color={colors.primary} />
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
                  <Ionicons name="image-outline" size={36} color={colors.textMuted} />
                </View>
              )}
            </View>
            <View style={styles.mediaButtonRow}>
              <TouchableOpacity
                style={styles.mediaSmallBtn}
                onPress={handleUploadCover}
                disabled={uploadingTarget !== null}
              >
                <Ionicons name="cloud-upload-outline" size={14} color={colors.primary} />
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
                <Ionicons name="add-circle-outline" size={16} color={colors.onPrimary} />
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
                <Ionicons name="images-outline" size={28} color={colors.textMuted} />
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
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.uploadIndicatorText}>
              {language === 'sw' ? 'Inapakia picha kwenye wingu...' : 'Uploading image to cloud storage...'}
            </Text>
          </View>
        )}
      </View>

      {/* 3. Branch Management (Task 37 & P0 Closure) */}
      <BranchManager
        restaurantId={restaurant.id}
        branches={branches}
        onBranchUpdated={onBranchUpdated || (() => {})}
        language={language}
      />

      {/* 4. Opening Hours Schedule Editor (Task 38) */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Ionicons name="time-outline" size={20} color={colors.primary} />
          <View>
            <Text style={styles.sectionTitle}>
              {language === 'sw' ? 'Masaa ya Kazi ya Kila Wiki' : 'Weekly Opening Hours'}
            </Text>
            <Text style={styles.sectionSub}>
              {activeBranch
                ? (language === 'sw' ? `Ratiba ya tawi: ${activeBranch.name} (${activeBranch.address || 'Address not configured'})` : `Schedule for branch: ${activeBranch.name} (${activeBranch.address || 'Address not configured'})`)
                : (language === 'sw' ? 'Chagua tawi ili kusanidi masaa' : 'Select a branch to configure hours')}
            </Text>
          </View>
        </View>

        {!activeBranch ? (
          <View style={{ padding: Spacing.md, backgroundColor: colors.appBackground, borderRadius: Radii.md, alignItems: 'center' }}>
            <Ionicons name="information-circle-outline" size={24} color={colors.primary} style={{ marginBottom: 4 }} />
            <Text style={{ fontSize: 13, color: colors.textMuted, textAlign: 'center' }}>
              {language === 'sw'
                ? 'Tafadhali chagua au sajili tawi hapo juu ili kusanidi ratiba ya masaa ya kazi.'
                : 'Please select or add an operating branch above to configure working hours.'}
            </Text>
          </View>
        ) : !hasConfiguredHours && schedule.length === 0 ? (
          <View style={{ padding: Spacing.md, backgroundColor: colors.appBackground, borderRadius: Radii.md, alignItems: 'center' }}>
            <Text style={{ fontSize: 13, color: colors.textMuted, textAlign: 'center', marginBottom: Spacing.sm }}>
              {language === 'sw'
                ? 'Hakuna masaa ya kazi yaliyowekwa kwenye hifadhidata kwa tawi hili.'
                : 'No operating hours are currently configured for this branch.'}
            </Text>
            <TouchableOpacity
              style={{ backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radii.md }}
              onPress={() => {
                setSchedule(getStandardOperatingSchedule());
                setHasConfiguredHours(true);
              }}
            >
              <Text style={{ color: colors.onPrimary, fontWeight: '700', fontSize: 12 }}>
                {language === 'sw' ? 'Weka Ratiba ya Kawaida' : 'Set Standard Hours'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.scheduleList}>
            {schedule.map((item, idx) => (
              <View key={item.day} style={styles.dayRow}>
                <View style={styles.dayLeft}>
                  <Switch
                    value={item.isOpen}
                    onValueChange={() => toggleDayOpen(idx)}
                    trackColor={{ false: colors.border, true: '#BBF7D0' }}
                    thumbColor={item.isOpen ? colors.primary : colors.textMuted}
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

            <TouchableOpacity
              style={[styles.saveHoursBtn, isSavingHours && { opacity: 0.7 }]}
              onPress={handleSaveHoursOnly}
              disabled={isSavingHours}
            >
              {isSavingHours ? (
                <ActivityIndicator size="small" color={colors.onPrimary} />
              ) : (
                <Ionicons name="checkmark-circle-outline" size={18} color={colors.onPrimary} />
              )}
              <Text style={styles.saveHoursBtnText}>
                {isSavingHours
                  ? (language === 'sw' ? 'Inahifadhi Masaa...' : 'Saving Hours...')
                  : (language === 'sw' ? 'Hifadhi Masaa ya Kazi ya Tawi' : 'Save Branch Operating Hours')}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 5. Notification Dispatch Policy */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Ionicons name="notifications-outline" size={20} color={colors.primary} />
          <View>
            <Text style={styles.sectionTitle}>
              {language === 'sw' ? 'Arifa za Jikoni na Uendeshaji' : 'Kitchen & Dispatch Notifications'}
            </Text>
            <Text style={styles.sectionSub}>
              {language === 'sw'
                ? 'Arifa za maagizo mapya na nafasi za meza zinasimamiwa na dashibodi ya uendeshaji ya MloHub.'
                : 'Order alerts, reservations, and updates are monitored in real time via the MloHub kitchen operations portal.'}
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

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    padding: Spacing.md,
    maxWidth: 900,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.md,
  },
  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: colors.divider,
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
    color: colors.textPrimary,
  },
  sectionSub: {
    ...Typography.Caption,
    color: colors.textSecondary,
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
    backgroundColor: colors.surfaceInteractive,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 110,
    alignItems: 'center',
  },
  statusPillText: {
    ...Typography.Caption,
    fontWeight: '700',
    color: colors.textSecondary,
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
    color: colors.textSecondary,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: Radii.md,
    padding: Spacing.sm,
    ...Typography.Body,
    backgroundColor: colors.card,
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
    borderBottomColor: colors.divider,
  },
  dayLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dayText: {
    ...Typography.BodyMedium,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  dayTextClosed: {
    color: colors.textMuted,
  },
  hoursRow: {
    backgroundColor: colors.surfaceInteractive,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.sm,
  },
  hoursText: {
    ...Typography.Caption,
    fontWeight: '700',
    color: colors.primary,
  },
  closedPill: {
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.sm,
  },
  closedPillText: {
    ...Typography.Caption,
    color: colors.danger,
    fontWeight: '700',
  },
  saveInfoBtn: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    borderRadius: Radii.md,
    marginTop: Spacing.xs,
    alignSelf: 'flex-end',
  },
  saveInfoBtnText: {
    color: colors.onPrimary,
    fontWeight: '700',
    fontSize: 13,
  },
  saveHoursBtn: {
    backgroundColor: '#16a34a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radii.md,
    marginTop: Spacing.sm,
  },
  saveHoursBtnText: {
    color: colors.onPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
  branchList: {
    gap: 8,
  },
  branchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceInteractive,
    padding: Spacing.sm,
    borderRadius: Radii.md,
  },
  branchName: {
    ...Typography.BodyMedium,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  branchAddress: {
    ...Typography.Caption,
    color: colors.textMuted,
  },
  branchActiveBadge: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.full,
  },
  branchActiveText: {
    ...Typography.Caption,
    fontSize: 11,
    color: colors.primary,
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
    color: colors.textPrimary,
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
    borderColor: colors.border,
    overflow: 'hidden',
    backgroundColor: colors.surfaceInteractive,
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
    borderColor: colors.border,
    overflow: 'hidden',
    backgroundColor: colors.surfaceInteractive,
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
    backgroundColor: colors.surfaceInteractive,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mediaDeleteBtn: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
  },
  mediaSmallBtnText: {
    ...Typography.Caption,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  gallerySection: {
    marginTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
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
    color: colors.textMuted,
  },
  addPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.sm,
  },
  addPhotoBtnText: {
    ...Typography.Caption,
    fontWeight: '700',
    color: colors.onPrimary,
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
    borderColor: colors.border,
  },
  galleryThumb: {
    width: '100%',
    height: '100%',
  },
  galleryThumbRemoveBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: colors.card,
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
    color: colors.textMuted,
    textAlign: 'center',
  },
  uploadIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    padding: 8,
    borderRadius: Radii.sm,
    backgroundColor: colors.infoSoft,
  },
  uploadIndicatorText: {
    ...Typography.Caption,
    color: colors.info,
    fontWeight: '600',
  },
});
let styles = createStyles(lightColors);
