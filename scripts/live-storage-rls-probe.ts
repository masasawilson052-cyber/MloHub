import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// A tiny 1x1 GIF / PNG dummy buffer for uploading
const DUMMY_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

async function main() {
  console.log('===========================================================');
  console.log('STARTING REAL STORAGE RLS & MEDIA PIPELINE PROBE');
  console.log('===========================================================');

  // 1. Setup Test Fixtures: Restaurant A and Restaurant B
  const restAId = 'rest_tenant_alpha_001';
  const restBId = 'rest_tenant_beta_002';

  const timestamp = Date.now();
  const { error: errRestUpsert } = await adminClient.from('restaurants').upsert([
    {
      id: restAId,
      name: 'Restaurant Alpha',
      slug: `restaurant-alpha-${timestamp}`,
      cuisine: 'Swahili Fusion',
      address: 'Mikocheni B, Dar es Salaam',
      min_price_tzs: 3000,
      max_price_tzs: 25000,
      distance_km: 1.0,
      is_open: true,
      is_verified: true,
      logo_url: null,
      cover_image_url: null,
      food_spot_photos: [],
    },
    {
      id: restBId,
      name: 'Restaurant Beta',
      slug: `restaurant-beta-${timestamp}`,
      cuisine: 'Coastal Seafood',
      address: 'Masaki, Dar es Salaam',
      min_price_tzs: 5000,
      max_price_tzs: 40000,
      distance_km: 2.5,
      is_open: true,
      is_verified: true,
      logo_url: null,
      cover_image_url: null,
      food_spot_photos: [],
    },
  ]);
  if (errRestUpsert) console.error('Error upserting restaurants:', errRestUpsert);

  // Create menu item for Restaurant A
  const menuItemAId = 'item_alpha_001';
  const { error: errMenuItemUpsert } = await adminClient.from('menu_items').upsert({
    id: menuItemAId,
    restaurant_id: restAId,
    name_en: 'Alpha Signature Burger',
    name_sw: 'Baga ya Alpha',
    price_tzs: 15000,
    photo_url: null,
    is_available: true,
  });
  if (errMenuItemUpsert) console.error('Menu item upsert error:', errMenuItemUpsert);

  // Create users in Supabase Auth
  const emailA = `usera_${timestamp}@test.com`;
  const emailB = `userb_${timestamp}@test.com`;
  const emailCust = `cust_${timestamp}@test.com`;
  const password = 'TestPassword123!';

  const { data: userAData, error: errA } = await adminClient.auth.admin.createUser({
    email: emailA,
    password,
    email_confirm: true,
    user_metadata: { phone: `+2557${Math.floor(10000000 + Math.random() * 90000000)}` },
  });
  if (errA || !userAData.user) throw new Error(`Failed to create User A: ${errA?.message}`);
  const userA = userAData.user;

  const { data: userBData, error: errB } = await adminClient.auth.admin.createUser({
    email: emailB,
    password,
    email_confirm: true,
    user_metadata: { phone: `+2557${Math.floor(10000000 + Math.random() * 90000000)}` },
  });
  if (errB || !userBData.user) throw new Error(`Failed to create User B: ${errB?.message}`);
  const userB = userBData.user;

  const { data: userCustData, error: errCust } = await adminClient.auth.admin.createUser({
    email: emailCust,
    password,
    email_confirm: true,
    user_metadata: { phone: `+2557${Math.floor(10000000 + Math.random() * 90000000)}` },
  });
  if (errCust || !userCustData.user) throw new Error(`Failed to create Customer: ${errCust?.message}`);
  const userCust = userCustData.user;

  // Add memberships to restaurant_members
  // User A -> Manager at Restaurant A
  const { error: insMemErrA } = await adminClient.from('restaurant_members').insert({
    user_id: userA.id,
    restaurant_id: restAId,
    role: 'MANAGER',
    permissions: ['MANAGE_RESTAURANT', 'MANAGE_MENU', 'VIEW_ORDERS'],
    is_active: true,
    status: 'ACTIVE',
  });
  if (insMemErrA) console.error('Insert Member A error:', insMemErrA);

  // User B -> Manager at Restaurant B
  const { error: insMemErrB } = await adminClient.from('restaurant_members').insert({
    user_id: userB.id,
    restaurant_id: restBId,
    role: 'MANAGER',
    permissions: ['MANAGE_RESTAURANT', 'MANAGE_MENU'],
    is_active: true,
    status: 'ACTIVE',
  });
  if (insMemErrB) console.error('Insert Member B error:', insMemErrB);

  console.log(`Provisioned Fixtures:`);
  console.log(`- Restaurant A: ${restAId} (User A: ${userA.id})`);
  console.log(`- Restaurant B: ${restBId} (User B: ${userB.id})`);
  console.log(`- Customer: (No membership, ${userCust.id})`);

  // Sign in each user to obtain authentic unprivileged client sessions
  const clientA = createClient(SUPABASE_URL, ANON_KEY);
  const { data: sessionA } = await clientA.auth.signInWithPassword({ email: emailA, password });
  if (!sessionA.session) throw new Error('Could not sign in User A');

  const clientB = createClient(SUPABASE_URL, ANON_KEY);
  const { data: sessionB } = await clientB.auth.signInWithPassword({ email: emailB, password });
  if (!sessionB.session) throw new Error('Could not sign in User B');

  const clientCust = createClient(SUPABASE_URL, ANON_KEY);
  const { data: sessionCust } = await clientCust.auth.signInWithPassword({ email: emailCust, password });
  if (!sessionCust.session) throw new Error('Could not sign in Customer');

  console.log('\n--- EXECUTING REAL STORAGE RLS CHECKS ---');

  const { data: memberRow, error: errMember } = await adminClient
    .from('restaurant_members')
    .select('*')
    .eq('user_id', userA.id);
  console.log('User A member row in DB:', JSON.stringify(memberRow), 'err:', errMember?.message);

  // Check has_restaurant_permission directly from DB
  const { data: permCheck, error: errPerm } = await adminClient.rpc('has_restaurant_permission', {
    p_user_id: userA.id,
    p_restaurant_id: restAId,
    p_permission: 'MANAGE_RESTAURANT',
  });
  console.log(`Direct DB Permission Check for User A: ${permCheck} (err: ${errPerm?.message})`);

  // Check can_manage_storage_media
  const pathA1 = `restaurants/${restAId}/logo/logo1_${timestamp}.png`;
  const { error: errA_uploadA } = await clientA.storage
    .from('mlohub-media')
    .upload(pathA1, DUMMY_PNG_BUFFER, { contentType: 'image/png' });
  const test1Pass = !errA_uploadA;
  console.log(`1. User A -> Restaurant A path upload: ${test1Pass ? 'PASS' : 'FAIL: ' + errA_uploadA?.message}`);
  if (!test1Pass) throw new Error('Test 1 failed');

  // 2. User A -> B path upload: DENIED
  const pathB_probe = `restaurants/${restBId}/logo/hacked_${timestamp}.png`;
  const { error: errA_uploadB } = await clientA.storage
    .from('mlohub-media')
    .upload(pathB_probe, DUMMY_PNG_BUFFER, { contentType: 'image/png' });
  const test2Pass = !!errA_uploadB;
  console.log(`2. User A -> Restaurant B path upload: ${test2Pass ? 'DENIED (PASS)' : 'UNEXPECTED ALLOW (FAIL)'}`);
  if (!test2Pass) throw new Error('Test 2 failed: User A uploaded to Restaurant B');

  // 3. User B -> B path upload: PASS
  const pathB1 = `restaurants/${restBId}/logo/logo1_${timestamp}.png`;
  const { error: errB_uploadB } = await clientB.storage
    .from('mlohub-media')
    .upload(pathB1, DUMMY_PNG_BUFFER, { contentType: 'image/png' });
  const test3Pass = !errB_uploadB;
  console.log(`3. User B -> Restaurant B path upload: ${test3Pass ? 'PASS' : 'FAIL: ' + errB_uploadB?.message}`);
  if (!test3Pass) throw new Error('Test 3 failed');

  // 4. User A -> B path delete: DENIED
  const { data: delBData, error: errA_delB } = await clientA.storage
    .from('mlohub-media')
    .remove([pathB1]);
  // In Supabase storage, unauthorized remove returns error or empty deleted list
  const test4Pass = !!errA_delB || (delBData && delBData.length === 0);
  console.log(`4. User A -> Restaurant B path delete: ${test4Pass ? 'DENIED (PASS)' : 'UNEXPECTED DELETE (FAIL)'}`);
  if (!test4Pass) throw new Error('Test 4 failed: User A deleted Restaurant B media');

  // 5. Customer -> restaurant path upload: DENIED
  const pathA_cust = `restaurants/${restAId}/gallery/cust_${timestamp}.png`;
  const { error: errCust_upload } = await clientCust.storage
    .from('mlohub-media')
    .upload(pathA_cust, DUMMY_PNG_BUFFER, { contentType: 'image/png' });
  const test5Pass = !!errCust_upload;
  console.log(`5. Customer -> Restaurant path upload: ${test5Pass ? 'DENIED (PASS)' : 'UNEXPECTED ALLOW (FAIL)'}`);
  if (!test5Pass) throw new Error('Test 5 failed: Customer uploaded to restaurant path');

  // 6. Unauthenticated -> restaurant path upload: DENIED
  const pathA_anon = `restaurants/${restAId}/gallery/anon_${timestamp}.png`;
  const { error: errAnon_upload } = await anonClient.storage
    .from('mlohub-media')
    .upload(pathA_anon, DUMMY_PNG_BUFFER, { contentType: 'image/png' });
  const test6Pass = !!errAnon_upload;
  console.log(`6. Unauthenticated -> Restaurant path upload: ${test6Pass ? 'DENIED (PASS)' : 'UNEXPECTED ALLOW (FAIL)'}`);
  if (!test6Pass) throw new Error('Test 6 failed: Unauthenticated uploaded to restaurant path');

  // 7. Owner/authorized manager -> own replacement: PASS
  const pathA_cover = `restaurants/${restAId}/cover/cover1_${timestamp}.png`;
  const { error: errCover1 } = await clientA.storage
    .from('mlohub-media')
    .upload(pathA_cover, DUMMY_PNG_BUFFER, { contentType: 'image/png' });
  if (errCover1) throw new Error(`Initial cover upload failed: ${errCover1.message}`);

  const { error: errCoverReplace } = await clientA.storage
    .from('mlohub-media')
    .update(pathA_cover, DUMMY_PNG_BUFFER, { contentType: 'image/png', upsert: true });
  const test7Pass = !errCoverReplace;
  console.log(`7. Authorized manager -> own media replacement (update): ${test7Pass ? 'PASS' : 'FAIL: ' + errCoverReplace?.message}`);
  if (!test7Pass) throw new Error('Test 7 failed');

  // 8. Profile user -> own profiles/{auth.uid()} path: PASS
  const ownProfilePath = `profiles/${userCust.id}/avatar1_${timestamp}.png`;
  const { error: errCust_ownProfile } = await clientCust.storage
    .from('mlohub-media')
    .upload(ownProfilePath, DUMMY_PNG_BUFFER, { contentType: 'image/png' });
  const test8Pass = !errCust_ownProfile;
  console.log(`8. Profile user -> own profiles/{auth.uid()} path: ${test8Pass ? 'PASS' : 'FAIL: ' + errCust_ownProfile?.message}`);
  if (!test8Pass) throw new Error('Test 8 failed');

  // 9. Profile user -> another user's profile path: DENIED
  const otherProfilePath = `profiles/${userA.id}/avatar_imposter_${timestamp}.png`;
  const { error: errCust_otherProfile } = await clientCust.storage
    .from('mlohub-media')
    .upload(otherProfilePath, DUMMY_PNG_BUFFER, { contentType: 'image/png' });
  const test9Pass = !!errCust_otherProfile;
  console.log(`9. Profile user -> another user's profile path: ${test9Pass ? 'DENIED (PASS)' : 'UNEXPECTED ALLOW (FAIL)'}`);
  if (!test9Pass) throw new Error('Test 9 failed');

  console.log('\n--- VERIFYING DB MEDIA PERSISTENCE ---');
  // 10. Menu item upload & persistence
  const menuPath = `restaurants/${restAId}/menu/${menuItemAId}/dish_${timestamp}.png`;
  const { error: errMenuUpload } = await clientA.storage
    .from('mlohub-media')
    .upload(menuPath, DUMMY_PNG_BUFFER, { contentType: 'image/png' });
  if (errMenuUpload) throw new Error(`Menu photo upload failed: ${errMenuUpload.message}`);

  const menuPublicUrl = clientA.storage.from('mlohub-media').getPublicUrl(menuPath).data.publicUrl;
  const updateRes = await clientA
    .from('menu_items')
    .update({ photo_url: menuPublicUrl })
    .eq('id', menuItemAId)
    .select();
  console.log('clientA menu_items update result:', JSON.stringify(updateRes));

  const { data: updatedItem } = await adminClient
    .from('menu_items')
    .select('id, photo_url')
    .eq('id', menuItemAId)
    .single();
  console.log('adminClient fetched updatedItem:', JSON.stringify(updatedItem));

  const menuDbMatches = updatedItem?.photo_url === menuPublicUrl;
  console.log(`10a. menu_items.photo_url matches uploaded storage public URL: ${menuDbMatches ? 'PASS' : 'FAIL'}`);
  if (!menuDbMatches) throw new Error('Menu item photo_url DB mismatch');

  // Restaurant branding persistence
  const logoUrl = clientA.storage.from('mlohub-media').getPublicUrl(pathA1).data.publicUrl;
  const coverUrl = clientA.storage.from('mlohub-media').getPublicUrl(pathA_cover).data.publicUrl;
  const galleryPhotos = [logoUrl, coverUrl];

  const { error: errRestDb } = await clientA
    .from('restaurants')
    .update({
      logo_url: logoUrl,
      cover_image_url: coverUrl,
      food_spot_photos: galleryPhotos,
    })
    .eq('id', restAId);
  if (errRestDb) throw new Error(`Restaurant DB update failed: ${errRestDb.message}`);

  const { data: updatedRest } = await adminClient
    .from('restaurants')
    .select('id, logo_url, cover_image_url, food_spot_photos')
    .eq('id', restAId)
    .single();

  const brandingPass =
    updatedRest?.logo_url === logoUrl &&
    updatedRest?.cover_image_url === coverUrl &&
    Array.isArray(updatedRest?.food_spot_photos) &&
    updatedRest?.food_spot_photos.length === 2;
  console.log(`10b. restaurants branding & gallery persistence: ${brandingPass ? 'PASS' : 'FAIL'}`);
  if (!brandingPass) throw new Error('Restaurant branding DB update mismatch');

  console.log('\n--- VERIFYING REPLACEMENT FAILURE SAFETY ---');
  // Scenario A: Real replacement flow
  // 1. Old image exists (pathA1)
  // 2. Upload new image
  const pathA1_new = `restaurants/${restAId}/logo/logo2_replaced_${timestamp}.png`;
  const { error: errA_new } = await clientA.storage
    .from('mlohub-media')
    .upload(pathA1_new, DUMMY_PNG_BUFFER, { contentType: 'image/png' });
  if (errA_new) throw new Error(`Replacement upload failed: ${errA_new.message}`);

  const newLogoUrl = clientA.storage.from('mlohub-media').getPublicUrl(pathA1_new).data.publicUrl;
  // 3. DB update succeeds
  await clientA.from('restaurants').update({ logo_url: newLogoUrl }).eq('id', restAId);
  // 4. Remove old image
  await clientA.storage.from('mlohub-media').remove([pathA1]);

  // Verify old image is deleted and new image exists
  const { data: listAfterReplace } = await adminClient.storage
    .from('mlohub-media')
    .list(`restaurants/${restAId}/logo`);
  const namesAfterReplace = listAfterReplace?.map((f) => f.name) || [];
  const replacementPass =
    !namesAfterReplace.includes(`logo1_${timestamp}.png`) &&
    namesAfterReplace.includes(`logo2_replaced_${timestamp}.png`);
  console.log(`11. Safe Replacement Flow: Old removed after DB success: ${replacementPass ? 'PASS' : 'FAIL'}`);
  if (!replacementPass) throw new Error('Replacement flow check failed');

  // Scenario B: Simulated DB failure rollback / cleanup
  // 1. Old image exists (pathA1_new)
  // 2. Upload tentative new image
  const pathA1_attempt3 = `restaurants/${restAId}/logo/logo3_failed_db_${timestamp}.png`;
  await clientA.storage
    .from('mlohub-media')
    .upload(pathA1_attempt3, DUMMY_PNG_BUFFER, { contentType: 'image/png' });

  // 3. Simulate DB failure:
  const dbFailed = true;
  if (dbFailed) {
    // Trigger orphan cleanup
    await clientA.storage.from('mlohub-media').remove([pathA1_attempt3]);
  }

  // 4. Verify tentative image cleaned up and old image remains intact
  const { data: listAfterFailedDb } = await adminClient.storage
    .from('mlohub-media')
    .list(`restaurants/${restAId}/logo`);
  const namesAfterFailedDb = listAfterFailedDb?.map((f) => f.name) || [];
  const orphanCleanupPass =
    !namesAfterFailedDb.includes(`logo3_failed_db_${timestamp}.png`) &&
    namesAfterFailedDb.includes(`logo2_replaced_${timestamp}.png`);
  console.log(`12. Orphan Cleanup Flow: Tentative image removed on DB failure: ${orphanCleanupPass ? 'PASS' : 'FAIL'}`);
  if (!orphanCleanupPass) throw new Error('Orphan cleanup check failed');

  console.log('\n===========================================================');
  console.log('ALL REAL STORAGE RLS & MEDIA PIPELINE PROBES PASSED (100%)');
  console.log('===========================================================');
}

main().catch((err) => {
  console.error('\nPROBE ERROR:', err);
  process.exit(1);
});
