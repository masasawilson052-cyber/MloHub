import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  const { data: user, error: userErr } = await admin.auth.admin.createUser({
    email: `diag_${Date.now()}@test.com`,
    password: 'Password123!',
    email_confirm: true,
  });
  console.log('User created:', user?.user?.id, 'error:', userErr);

  const { data: signIn, error: signErr } = await client.auth.signInWithPassword({
    email: user!.user!.email!,
    password: 'Password123!',
  });
  console.log('SignIn session exists:', !!signIn.session, 'error:', signErr);

  // create restaurant and order
  const restId = `rest_diag_${Date.now()}`;
  await admin.from('restaurants').insert({
    id: restId,
    name: 'Diag Rest',
    slug: restId,
  });

  const ordId = `ord_diag_${Date.now()}`;
  await admin.from('orders').insert({
    id: ordId,
    order_number: `ORD-${Date.now()}`,
    user_id: user!.user!.id,
    restaurant_id: restId,
    status: 'COMPLETED',
    subtotal_tzs: 1000,
    total_tzs: 1000,
    dining_option: 'Delivery',
  });

  const { data, error } = await client.rpc('get_review_eligibility', {
    p_source_type: 'ORDER',
    p_source_id: ordId,
  });
  console.log('RPC get_review_eligibility:', data, 'error:', error);

  const { data: subData, error: subError } = await client.rpc('submit_verified_review_secure', {
    p_source_type: 'ORDER',
    p_source_id: ordId,
    p_overall_rating: 5,
    p_comment: 'Good food',
  });
  console.log('RPC submit_verified_review_secure:', subData, 'error:', subError);
}

main().catch(console.error);
