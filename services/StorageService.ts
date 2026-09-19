import { supabase } from '../lib/supabase';

// Lazy load ImagePicker to allow isomorphic execution in Node.js test runners
let imagePickerModule: any = null;
function getImagePicker(): any {
  if (!imagePickerModule) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    imagePickerModule = require('expo-image-picker');
  }
  return imagePickerModule;
}

// Lazy load ImageManipulator to allow isomorphic execution in Node.js test runners
let imageManipulatorModule: any = null;
function getImageManipulator(): any {
  if (!imageManipulatorModule) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      imageManipulatorModule = require('expo-image-manipulator');
    } catch {
      imageManipulatorModule = null;
    }
  }
  return imageManipulatorModule;
}

export const MEDIA_BUCKET = 'mlohub-media';

export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export type MediaTargetKind = 'logo' | 'cover' | 'gallery' | 'menu' | 'avatar';

export const TARGET_MAX_DIMENSIONS: Record<MediaTargetKind, number> = {
  logo: 1000,
  avatar: 1000,
  menu: 1600,
  gallery: 1600,
  cover: 2000,
};

export interface MediaUploadResult {
  publicUrl: string;
  storagePath: string;
}

export interface PickedImageResult {
  uri: string;
  mimeType: string;
  fileSizeBytes?: number;
  width?: number;
  height?: number;
}

export function validateImageFile(params: {
  mimeType?: string;
  fileSizeBytes?: number;
  fileName?: string;
}): { valid: boolean; error?: string } {
  const mime = params.mimeType?.toLowerCase();
  if (mime) {
    if (!ALLOWED_MIME_TYPES.includes(mime as any)) {
      return {
        valid: false,
        error: `Unsupported image format (${mime}). Allowed formats: JPEG, PNG, WebP.`,
      };
    }
  }

  if (params.fileSizeBytes !== undefined && params.fileSizeBytes > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size exceeds maximum limit of 10 MB (${(params.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB).`,
    };
  }

  return { valid: true };
}

export function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getExtension(mimeType?: string, fileUri?: string): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/jpeg') return 'jpg';
  if (fileUri) {
    const cleanUri = fileUri.split('?')[0];
    const match = cleanUri.match(/\.([a-zA-Z0-9]+)$/);
    if (match) {
      const ext = match[1].toLowerCase();
      if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
        return ext === 'jpeg' ? 'jpg' : ext;
      }
    }
  }
  return 'jpg';
}

export function extractStoragePath(input: string): string | null {
  if (!input) return null;

  // Relative storage path directly (e.g., restaurants/rest-1/logo/uuid.jpg)
  if (input.startsWith('restaurants/') || input.startsWith('profiles/')) {
    return input;
  }

  // Full URL containing bucket name
  const bucketMarker = `/${MEDIA_BUCKET}/`;
  const idx = input.indexOf(bucketMarker);
  if (idx !== -1) {
    const path = input.substring(idx + bucketMarker.length).split('?')[0];
    if (path.startsWith('restaurants/') || path.startsWith('profiles/')) {
      return path;
    }
  }

  return null;
}

/**
 * Dimension resizing and compression using expo-image-manipulator.
 * Maintains aspect ratio, does not upscale smaller images, and compresses to ~0.82.
 */
export async function optimizeAndResizeImage(params: {
  uri: string;
  targetKind: MediaTargetKind;
  width?: number;
  height?: number;
  quality?: number;
}): Promise<{ uri: string; mimeType: string }> {
  const maxDim = TARGET_MAX_DIMENSIONS[params.targetKind] || 1600;
  const quality = params.quality ?? 0.82;
  const manipulator = getImageManipulator();

  if (!manipulator || !manipulator.manipulateAsync) {
    // In environments where expo-image-manipulator is unavailable (e.g. Node test runner)
    return { uri: params.uri, mimeType: 'image/jpeg' };
  }

  const w = params.width;
  const h = params.height;
  const actions: any[] = [];

  // Maintain aspect ratio. Do not upscale small images.
  if (w && h) {
    if (w > maxDim || h > maxDim) {
      if (w >= h) {
        actions.push({ resize: { width: maxDim } });
      } else {
        actions.push({ resize: { height: maxDim } });
      }
    }
  } else {
    // If dimensions not provided beforehand, bound width to maxDim
    actions.push({ resize: { width: maxDim } });
  }

  if (actions.length === 0) {
    // Small image within bounds: maintain original dimensions, only compress
    actions.push({});
  }

  const saveOptions: any = {
    compress: quality,
    format: manipulator.SaveFormat ? manipulator.SaveFormat.JPEG : 'jpeg',
  };

  const result = await manipulator.manipulateAsync(params.uri, actions, saveOptions);
  return {
    uri: result.uri,
    mimeType: 'image/jpeg',
  };
}

export class StorageService {
  /**
   * Request media permissions on demand and prompt user to pick an image from gallery
   */
  static async pickAndValidateImage(options?: {
    aspect?: [number, number];
    quality?: number;
  }): Promise<PickedImageResult | null> {
    const ImagePicker = getImagePicker();
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Permission to access device photo gallery was denied.');
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: options?.aspect || [4, 3],
      quality: options?.quality ?? 0.8,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    const asset = result.assets[0];
    const mimeType =
      asset.mimeType ||
      (asset.uri.endsWith('.png')
        ? 'image/png'
        : asset.uri.endsWith('.webp')
        ? 'image/webp'
        : 'image/jpeg');

    const validation = validateImageFile({
      mimeType,
      fileSizeBytes: asset.fileSize,
    });

    if (!validation.valid) {
      throw new Error(validation.error);
    }

    return {
      uri: asset.uri,
      mimeType,
      fileSizeBytes: asset.fileSize,
      width: asset.width,
      height: asset.height,
    };
  }

  /**
   * Core upload handler: converts URI to blob, enforces size & MIME checks, and uploads to Supabase Storage
   */
  static async uploadBlob(
    storagePath: string,
    fileUri: string,
    mimeType: string = 'image/jpeg'
  ): Promise<MediaUploadResult> {
    const res = await fetch(fileUri);
    const blob = await res.blob();

    const validation = validateImageFile({
      mimeType,
      fileSizeBytes: blob.size,
    });
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const { error } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(storagePath, blob, {
        contentType: mimeType,
        upsert: true,
        cacheControl: '3600',
      });

    if (error) {
      throw new Error(`Storage upload failed: ${error.message}`);
    }

    const publicUrl = StorageService.getPublicUrl(storagePath);
    return { publicUrl, storagePath };
  }

  /**
   * Upload Restaurant Logo:
   * Object path: restaurants/{restaurantId}/logo/{uuid}.{ext}
   * Target max dimension: 1000px
   */
  static async uploadRestaurantLogo(params: {
    restaurantId: string;
    fileUri: string;
    mimeType?: string;
    width?: number;
    height?: number;
  }): Promise<MediaUploadResult> {
    const optimized = await optimizeAndResizeImage({
      uri: params.fileUri,
      targetKind: 'logo',
      width: params.width,
      height: params.height,
    });
    const ext = getExtension(optimized.mimeType || params.mimeType, optimized.uri);
    const uuid = generateUuid();
    const storagePath = `restaurants/${params.restaurantId}/logo/${uuid}.${ext}`;
    return StorageService.uploadBlob(storagePath, optimized.uri, optimized.mimeType || 'image/jpeg');
  }

  /**
   * Upload Restaurant Cover:
   * Object path: restaurants/{restaurantId}/cover/{uuid}.{ext}
   * Target max dimension: 2000px
   */
  static async uploadRestaurantCover(params: {
    restaurantId: string;
    fileUri: string;
    mimeType?: string;
    width?: number;
    height?: number;
  }): Promise<MediaUploadResult> {
    const optimized = await optimizeAndResizeImage({
      uri: params.fileUri,
      targetKind: 'cover',
      width: params.width,
      height: params.height,
    });
    const ext = getExtension(optimized.mimeType || params.mimeType, optimized.uri);
    const uuid = generateUuid();
    const storagePath = `restaurants/${params.restaurantId}/cover/${uuid}.${ext}`;
    return StorageService.uploadBlob(storagePath, optimized.uri, optimized.mimeType || 'image/jpeg');
  }

  /**
   * Upload Restaurant Gallery Photo:
   * Object path: restaurants/{restaurantId}/gallery/{uuid}.{ext}
   * Target max dimension: 1600px
   */
  static async uploadRestaurantPhoto(params: {
    restaurantId: string;
    fileUri: string;
    mimeType?: string;
    width?: number;
    height?: number;
  }): Promise<MediaUploadResult> {
    const optimized = await optimizeAndResizeImage({
      uri: params.fileUri,
      targetKind: 'gallery',
      width: params.width,
      height: params.height,
    });
    const ext = getExtension(optimized.mimeType || params.mimeType, optimized.uri);
    const uuid = generateUuid();
    const storagePath = `restaurants/${params.restaurantId}/gallery/${uuid}.${ext}`;
    return StorageService.uploadBlob(storagePath, optimized.uri, optimized.mimeType || 'image/jpeg');
  }

  /**
   * Upload Menu Item Photo:
   * Object path: restaurants/{restaurantId}/menu/{menuItemId}/{uuid}.{ext}
   * Target max dimension: 1600px
   */
  static async uploadMenuItemPhoto(params: {
    restaurantId: string;
    menuItemId: string;
    fileUri: string;
    mimeType?: string;
    width?: number;
    height?: number;
  }): Promise<MediaUploadResult> {
    const optimized = await optimizeAndResizeImage({
      uri: params.fileUri,
      targetKind: 'menu',
      width: params.width,
      height: params.height,
    });
    const ext = getExtension(optimized.mimeType || params.mimeType, optimized.uri);
    const uuid = generateUuid();
    const storagePath = `restaurants/${params.restaurantId}/menu/${params.menuItemId}/${uuid}.${ext}`;
    return StorageService.uploadBlob(storagePath, optimized.uri, optimized.mimeType || 'image/jpeg');
  }

  /**
   * Upload User Profile Avatar:
   * Object path: profiles/{userId}/{uuid}.{ext}
   * Target max dimension: 1000px
   */
  static async uploadProfileAvatar(params: {
    userId: string;
    fileUri: string;
    mimeType?: string;
    width?: number;
    height?: number;
  }): Promise<MediaUploadResult> {
    const optimized = await optimizeAndResizeImage({
      uri: params.fileUri,
      targetKind: 'avatar',
      width: params.width,
      height: params.height,
    });
    const ext = getExtension(optimized.mimeType || params.mimeType, optimized.uri);
    const uuid = generateUuid();
    const storagePath = `profiles/${params.userId}/${uuid}.${ext}`;
    return StorageService.uploadBlob(storagePath, optimized.uri, optimized.mimeType || 'image/jpeg');
  }

  /**
   * Delete media object. Safely ignores non-storage external URLs (e.g. Unsplash, avatars).
   */
  static async deleteMedia(storagePathOrUrl?: string | null): Promise<boolean> {
    if (!storagePathOrUrl) return false;

    const storagePath = extractStoragePath(storagePathOrUrl);
    if (!storagePath) {
      // Not an owned MloHub media path, no deletion required
      return false;
    }

    const { error } = await supabase.storage.from(MEDIA_BUCKET).remove([storagePath]);
    if (error) {
      console.warn(`[StorageService] Failed to delete media at ${storagePath}:`, error);
      return false;
    }

    return true;
  }

  /**
   * Get public URL for a storage path
   */
  static getPublicUrl(storagePath: string): string {
    const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(storagePath);
    return data.publicUrl;
  }

  /**
   * Cleanup orphan object if subsequent database save fails
   */
  static async cleanupOrphan(storagePathOrUrl?: string | null): Promise<void> {
    if (!storagePathOrUrl) return;
    try {
      await StorageService.deleteMedia(storagePathOrUrl);
    } catch (err) {
      console.warn(`[StorageService] Failed to clean up orphan object:`, err);
    }
  }
}
