/**
 * ============================================================================
 * MLOHUB IMAGE SIZING, RESOLUTION & FAST 3G PERFORMANCE TEST SUITE
 * ============================================================================
 * Tests:
 * 1. resolveSizedImageUrl behavior with imageTransformsEnabled true & false
 * 2. Card (400px) and Header (1200px) sizing parameters
 * 3. Local assets, data/blob URLs, and empty/null URL safety
 * 4. StorageService tightened dimensions (menu 1200, cover 1600, logo/avatar 512)
 * 5. Localized error messages in English and Swahili
 * 6. Storefront components integration with FoodImage
 * ============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';
import { resolveSizedImageUrl, IMAGE_SIZES } from '../utils/imageUrlResolver';
import {
  runtimeConfig,
  setRuntimeConfigForTesting,
  resetRuntimeConfigForTesting,
} from '../lib/runtimeConfig';
import {
  TARGET_MAX_DIMENSIONS,
  getImageErrorMessage,
  StorageService,
} from '../services/StorageService';

export async function runImageUrlSizingTestSuite(): Promise<{ passed: number; failed: number }> {
  console.log('\n================================================================');
  console.log('🧪 MLOHUB IMAGE RESOLUTION, SIZING & 3G PERFORMANCE SUITE');
  console.log('================================================================');

  let passed = 0;
  let failed = 0;

  function record(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✓ ${msg}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${msg}`);
      failed++;
      throw new Error(`Assertion failed: ${msg}`);
    }
  }

  // --------------------------------------------------------------------------
  // Scenario 1: Empty and Edge-Case URL Safety
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 1: Empty & Edge-Case URL Handling ---');

  record(resolveSizedImageUrl('') === '', 'Empty string returns empty string');
  record(resolveSizedImageUrl(null as any) === '', 'Null returns empty string');
  record(resolveSizedImageUrl(undefined as any) === '', 'Undefined returns empty string');
  record(resolveSizedImageUrl('   ') === '', 'Whitespace-only returns empty string');

  const localAsset = '/assets/icon.png';
  record(resolveSizedImageUrl(localAsset) === localAsset, 'Local asset path returned untouched');

  const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  record(resolveSizedImageUrl(dataUri) === dataUri, 'Data URI returned untouched');

  const blobUri = 'blob:http://localhost:3000/1234-5678';
  record(resolveSizedImageUrl(blobUri) === blobUri, 'Blob URI returned untouched');

  // --------------------------------------------------------------------------
  // Scenario 2: Image Transformation Flag Behavior (No Double Requests)
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 2: Image Transformation Flag Behavior ---');

  const testSupabaseUrl =
    'https://rrebkpeumvqffuwtqvje.supabase.co/storage/v1/object/public/mlohub-media/restaurants/rest-1/cover/sample.jpg';

  // Default: imageTransformsEnabled should be false on standard project (403 FeatureNotEnabled guard)
  const originalFlag = runtimeConfig.imageTransformsEnabled;

  try {
    // Test with imageTransformsEnabled = false
    setRuntimeConfigForTesting({ imageTransformsEnabled: false } as any);
    const resolvedWhenDisabled = resolveSizedImageUrl(testSupabaseUrl, { width: IMAGE_SIZES.CARD });
    record(
      resolvedWhenDisabled === testSupabaseUrl,
      'When transforms are disabled, returns original URL directly (no double requests, avoids 403)'
    );

    // Test with imageTransformsEnabled = true
    setRuntimeConfigForTesting({ imageTransformsEnabled: true } as any);
    const resolvedCard = resolveSizedImageUrl(testSupabaseUrl, { width: IMAGE_SIZES.CARD });
    record(
      resolvedCard.includes('/storage/v1/render/image/public/') &&
        resolvedCard.includes('width=400') &&
        resolvedCard.includes('resize=cover'),
      'When transforms are enabled, rewires /object/ to /render/image/ with width=400 for cards'
    );

    const resolvedHeader = resolveSizedImageUrl(testSupabaseUrl, { width: IMAGE_SIZES.HEADER });
    record(
      resolvedHeader.includes('/storage/v1/render/image/public/') &&
        resolvedHeader.includes('width=1200'),
      'When transforms are enabled, rewires /object/ to /render/image/ with width=1200 for headers'
    );
  } finally {
    resetRuntimeConfigForTesting();
  }

  // --------------------------------------------------------------------------
  // Scenario 3: Tightened StorageService Dimension Limits
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 3: Tightened StorageService Dimension Limits ---');

  record(
    TARGET_MAX_DIMENSIONS.menu === 1200,
    'Menu items max dimension tightened to 1,200 px'
  );
  record(
    TARGET_MAX_DIMENSIONS.cover === 1600,
    'Restaurant cover max dimension tightened to 1,600 px'
  );
  record(
    TARGET_MAX_DIMENSIONS.gallery === 1200,
    'Restaurant gallery max dimension tightened to 1,200 px'
  );
  record(
    TARGET_MAX_DIMENSIONS.logo === 512,
    'Restaurant logo max dimension tightened to 512 px'
  );
  record(
    TARGET_MAX_DIMENSIONS.avatar === 512,
    'User avatar max dimension tightened to 512 px'
  );

  // --------------------------------------------------------------------------
  // Scenario 4: Localized Error Messages (LanguageContext Alignment)
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 4: Localized Error Messages (EN & SW) ---');

  const enLarge = getImageErrorMessage('imageUploadTooLarge', 'en');
  const swLarge = getImageErrorMessage('imageUploadTooLarge', 'sw');
  record(
    enLarge.includes('500 KB limit') && !enLarge.includes('Picha'),
    'imageUploadTooLarge English is clean and unmixed'
  );
  record(
    swLarge.includes('500 KB') && swLarge.includes('Picha inazidi'),
    'imageUploadTooLarge Swahili is clean and unmixed'
  );

  const enGallery = getImageErrorMessage('imageGalleryPermissionDenied', 'en');
  const swGallery = getImageErrorMessage('imageGalleryPermissionDenied', 'sw');
  record(
    enGallery.includes('Permission to access device photo gallery was denied.'),
    'imageGalleryPermissionDenied English matches design'
  );
  record(
    swGallery.includes('Ruhusa ya kufungua picha haijatolewa.'),
    'imageGalleryPermissionDenied Swahili matches design'
  );

  // --------------------------------------------------------------------------
  // Scenario 5: Component Invariants & FoodImage Adoption
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 5: FoodImage Adoption Invariants ---');

  const foodImageSrc = fs.readFileSync(
    path.join(__dirname, '..', 'components', 'ui', 'FoodImage.tsx'),
    'utf8'
  );
  record(
    foodImageSrc.includes("from 'expo-image'") &&
      foodImageSrc.includes("cachePolicy=\"memory-disk\"") &&
      foodImageSrc.includes('transition='),
    'FoodImage wraps expo-image with memory-disk caching and transition fade-in'
  );

  const dishCardSrc = fs.readFileSync(
    path.join(__dirname, '..', 'components', 'discovery', 'DishCard.tsx'),
    'utf8'
  );
  record(
    dishCardSrc.includes('<FoodImage') && !dishCardSrc.includes("from 'react-native'\nimport { Image }"),
    'DishCard adopts FoodImage for fast caching and placeholder fallback'
  );

  const restCardSrc = fs.readFileSync(
    path.join(__dirname, '..', 'components', 'RestaurantCard.tsx'),
    'utf8'
  );
  record(
    restCardSrc.includes('<FoodImage') && restCardSrc.includes('coverCardUrl'),
    'RestaurantCard adopts FoodImage with coverCardUrl support'
  );

  const restHeaderSrc = fs.readFileSync(
    path.join(__dirname, '..', 'components', 'restaurant-page', 'RestaurantHeader.tsx'),
    'utf8'
  );
  record(
    restHeaderSrc.includes('<FoodImage') && restHeaderSrc.includes('targetWidth={1200}'),
    'RestaurantHeader uses FoodImage sized for 1200px storefront cover'
  );

  const menuSectionSrc = fs.readFileSync(
    path.join(__dirname, '..', 'components', 'restaurant-page', 'MenuSection.tsx'),
    'utf8'
  );
  record(
    menuSectionSrc.includes('<FoodImage') && menuSectionSrc.includes('photoCardUrl'),
    'MenuSection uses FoodImage with photoCardUrl support'
  );

  console.log('\n================================================================');
  console.log(`✓ ALL IMAGE SIZING & 3G PERFORMANCE TESTS PASSED: ${passed} checks`);
  console.log('================================================================\n');

  return { passed, failed };
}
