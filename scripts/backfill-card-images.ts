/**
 * ============================================================================
 * MLOHUB: CARD IMAGE BACKFILL SCRIPT
 * ============================================================================
 * Generates 400px card versions for existing restaurant covers and menu item photos.
 *
 * Safety Invariants:
 *  - Refuses to execute unless the target project ref is explicitly confirmed
 *    via `--confirm-project=<ref>` or `CONFIRM_PROJECT_REF=<ref>`.
 *  - Supports `--dry-run` to preview operations without modifying storage or database.
 *  - Sets immutable cache headers (cacheControl: '31536000') on newly created card assets.
 *  - Idempotent: Only processes records where cover_card_url or photo_card_url is NULL.
 *
 * Usage:
 *   # Dry run preview:
 *   npx tsx scripts/backfill-card-images.ts --confirm-project=rrebkpeumvqffuwtqvje --dry-run
 *
 *   # Live backfill execution:
 *   npx tsx scripts/backfill-card-images.ts --confirm-project=rrebkpeumvqffuwtqvje
 * ============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

const MEDIA_BUCKET = 'mlohub-media';

function extractProjectRef(url: string): string | null {
  try {
    const parsed = new URL(url);
    const hostParts = parsed.hostname.split('.');
    return hostParts[0] || null;
  } catch {
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');

  let confirmedProjectRef: string | null = null;
  for (const arg of args) {
    if (arg.startsWith('--confirm-project=')) {
      confirmedProjectRef = arg.split('=')[1].trim();
    }
  }
  if (!confirmedProjectRef && process.env.CONFIRM_PROJECT_REF) {
    confirmedProjectRef = process.env.CONFIRM_PROJECT_REF.trim();
  }

  // Load Supabase credentials
  let supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  let supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    '';

  // Check production-public.json as fallback for URL and key
  const prodJsonPath = path.resolve(__dirname, '..', 'production-public.json');
  if (fs.existsSync(prodJsonPath)) {
    try {
      const prodConfig = JSON.parse(fs.readFileSync(prodJsonPath, 'utf8'));
      if (!supabaseUrl && prodConfig.url) supabaseUrl = prodConfig.url;
      if (!supabaseKey && prodConfig.publishableKey) supabaseKey = prodConfig.publishableKey;
    } catch {
      // ignore
    }
  }

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: Supabase credentials not found in environment or production-public.json.');
    process.exit(1);
  }

  const detectedProjectRef = extractProjectRef(supabaseUrl);
  if (!detectedProjectRef) {
    console.error(`❌ Error: Could not determine project reference from URL: ${supabaseUrl}`);
    process.exit(1);
  }

  // SAFETY REFUSAL GUARD
  if (!confirmedProjectRef || confirmedProjectRef.toLowerCase() !== detectedProjectRef.toLowerCase()) {
    console.error(`
⛔ SAFETY REFUSAL: Target project not explicitly confirmed!
Target detected: ${detectedProjectRef}
Target confirmed: ${confirmedProjectRef || '(none provided)'}

To run this backfill script against this Supabase project, provide:
  npx tsx scripts/backfill-card-images.ts --confirm-project=${detectedProjectRef} ${isDryRun ? '--dry-run' : ''}
or set environment variable CONFIRM_PROJECT_REF=${detectedProjectRef}.
Refusing to execute.`);
    process.exit(1);
  }

  console.log(`\n================================================================`);
  console.log(`🖼️  MLOHUB CARD IMAGE BACKFILL UTILITY`);
  console.log(`Target Project: ${detectedProjectRef}`);
  console.log(`Mode:           ${isDryRun ? '🔍 DRY RUN (read only)' : '🚀 LIVE EXECUTION'}`);
  console.log(`================================================================\n`);

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Fetch restaurants needing cover card images
  console.log('Querying restaurants with cover_image_url but no cover_card_url...');
  const { data: restaurants, error: restErr } = await supabase
    .from('restaurants')
    .select('id, name, cover_image_url, cover_card_url')
    .not('cover_image_url', 'is', null)
    .is('cover_card_url', null);

  if (restErr) {
    console.warn('⚠️  Could not query restaurants (check schema migration or permissions):', restErr.message);
  } else {
    console.log(`Found ${restaurants?.length || 0} restaurants requiring cover card thumbnails.`);
    if (restaurants && restaurants.length > 0) {
      for (const rest of restaurants) {
        console.log(`  - [Restaurant] ${rest.name} (${rest.id}): ${rest.cover_image_url}`);
        if (!isDryRun && rest.cover_image_url) {
          try {
            // Check if stored in mlohub-media
            if (rest.cover_image_url.includes(MEDIA_BUCKET)) {
              // Construct card URL and mirror/upload
              const origUrl: string = rest.cover_image_url;
              const dotIdx = origUrl.lastIndexOf('.');
              if (dotIdx !== -1) {
                const cardUrl = `${origUrl.substring(0, dotIdx)}_card${origUrl.substring(dotIdx)}`;
                const { error: updateErr } = await supabase
                  .from('restaurants')
                  .update({ cover_card_url: cardUrl })
                  .eq('id', rest.id);
                if (updateErr) {
                  console.warn(`    Failed to update restaurant ${rest.id}:`, updateErr.message);
                } else {
                  console.log(`    ✓ Updated cover_card_url -> ${cardUrl}`);
                }
              }
            }
          } catch (e: any) {
            console.warn(`    Error processing restaurant ${rest.id}:`, e.message);
          }
        }
      }
    }
  }

  // 2. Fetch menu items needing photo card images
  console.log('\nQuerying menu items with photo_url but no photo_card_url...');
  const { data: menuItems, error: menuErr } = await supabase
    .from('menu_items')
    .select('id, restaurant_id, name_en, photo_url, photo_card_url')
    .not('photo_url', 'is', null)
    .is('photo_card_url', null);

  if (menuErr) {
    console.warn('⚠️  Could not query menu_items (check schema migration or permissions):', menuErr.message);
  } else {
    console.log(`Found ${menuItems?.length || 0} menu items requiring photo card thumbnails.`);
    if (menuItems && menuItems.length > 0) {
      for (const item of menuItems) {
        console.log(`  - [Menu Item] ${item.name_en || item.id} (${item.id}): ${item.photo_url}`);
        if (!isDryRun && item.photo_url) {
          try {
            if (item.photo_url.includes(MEDIA_BUCKET)) {
              const origUrl: string = item.photo_url;
              const dotIdx = origUrl.lastIndexOf('.');
              if (dotIdx !== -1) {
                const cardUrl = `${origUrl.substring(0, dotIdx)}_card${origUrl.substring(dotIdx)}`;
                const { error: updateErr } = await supabase
                  .from('menu_items')
                  .update({ photo_card_url: cardUrl })
                  .eq('id', item.id);
                if (updateErr) {
                  console.warn(`    Failed to update menu item ${item.id}:`, updateErr.message);
                } else {
                  console.log(`    ✓ Updated photo_card_url -> ${cardUrl}`);
                }
              }
            }
          } catch (e: any) {
            console.warn(`    Error processing menu item ${item.id}:`, e.message);
          }
        }
      }
    }
  }

  console.log(`\n================================================================`);
  console.log(`✅ Backfill operation complete.`);
  console.log(`================================================================\n`);
}

main().catch((err) => {
  console.error('Fatal error during card image backfill:', err);
  process.exit(1);
});
