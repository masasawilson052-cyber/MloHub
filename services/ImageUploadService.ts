import * as ImagePicker from 'expo-image-picker';

export interface ImagePickResult {
  canceled: boolean;
  uri?: string;
  base64?: string;
  width?: number;
  height?: number;
}

export class ImageUploadService {
  /**
   * Request media library permissions and let user pick a photo from gallery
   */
  static async pickImageFromGallery(): Promise<ImagePickResult> {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Ruhusa ya kufungua picha haijatolewa (Permission to access gallery was denied).');
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
      base64: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return { canceled: true };
    }

    const asset = result.assets[0];
    return {
      canceled: false,
      uri: asset.uri,
      base64: asset.base64 ?? undefined,
      width: asset.width,
      height: asset.height,
    };
  }

  /**
   * Request camera permissions and let user snap a photo of food / restaurant
   */
  static async snapPhotoWithCamera(): Promise<ImagePickResult> {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Ruhusa ya kufungua kamera haijatolewa (Permission to access camera was denied).');
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
      base64: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return { canceled: true };
    }

    const asset = result.assets[0];
    return {
      canceled: false,
      uri: asset.uri,
      base64: asset.base64 ?? undefined,
      width: asset.width,
      height: asset.height,
    };
  }

  /**
   * Upload image to Supabase Storage bucket and return the public URL (delegated to StorageService)
   */
  static async uploadImageToCloud(
    uri: string,
    folder: 'dishes' | 'restaurants' | 'logos' | 'licenses' = 'dishes',
    fileName?: string
  ): Promise<string> {
    const { StorageService } = require('./StorageService');
    const cleanFileName = fileName || `${folder}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`;
    const filePath = `restaurants/legacy/${folder}/${cleanFileName}`;
    const result = await StorageService.uploadBlob(filePath, uri, 'image/jpeg');
    return result.publicUrl;
  }
}
