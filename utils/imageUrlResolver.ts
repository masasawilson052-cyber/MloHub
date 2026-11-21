/**
 * ============================================================================
 * MLOHUB IMAGE URL RESIZING & TRANSFORMATION RESOLVER
 * ============================================================================
 * Generates width-optimized image URLs when server-side transformation is enabled,
 * or safely preserves original URLs when transformation is disabled.
 *
 * Sizing Standards:
 * - Cards & thumbnails: 400 px
 * - Banners & storefront headers: 1,200 px
 */

import { runtimeConfig } from '../lib/runtimeConfig';

export const IMAGE_SIZES = {
  THUMBNAIL: 200,
  CARD: 400,
  HEADER: 1200,
} as const;

export interface SizedImageOptions {
  width?: number;
  quality?: number;
  format?: 'webp' | 'jpg';
}

/**
 * Returns an optimized sized URL if transformations are enabled, or the original URL.
 * Never performs double network requests.
 */
export function resolveSizedImageUrl(
  originalUrl?: string | null,
  options?: SizedImageOptions
): string {
  if (!originalUrl || typeof originalUrl !== 'string') {
    return '';
  }

  const cleanUrl = originalUrl.trim();
  if (!cleanUrl) return '';

  // Local require/assets, data URLs, or blob URLs are returned untouched
  if (
    cleanUrl.startsWith('data:') ||
    cleanUrl.startsWith('blob:') ||
    cleanUrl.startsWith('file:') ||
    cleanUrl.startsWith('/')
  ) {
    return cleanUrl;
  }

  // 1. Guard: If server-side image transformation is disabled on this Supabase project
  // (e.g. 403 FeatureNotEnabled on standard tier), return original URL directly.
  if (!runtimeConfig.imageTransformsEnabled) {
    return cleanUrl;
  }

  const targetWidth = options?.width || IMAGE_SIZES.CARD;
  const targetQuality = options?.quality || 75;

  // 2. Supabase Storage transformation syntax
  // Replaces /storage/v1/object/public/ with /storage/v1/render/image/public/
  if (cleanUrl.includes('/storage/v1/object/public/')) {
    const transformed = cleanUrl.replace(
      '/storage/v1/object/public/',
      '/storage/v1/render/image/public/'
    );
    const separator = transformed.includes('?') ? '&' : '?';
    return `${transformed}${separator}width=${targetWidth}&resize=cover&quality=${targetQuality}`;
  }

  // 3. Unsplash or standard CDN transformation support
  if (cleanUrl.includes('images.unsplash.com')) {
    const separator = cleanUrl.includes('?') ? '&' : '?';
    return `${cleanUrl}${separator}w=${targetWidth}&q=${targetQuality}&auto=format`;
  }

  return cleanUrl;
}
