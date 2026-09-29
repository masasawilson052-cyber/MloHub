import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeadersFor } from '../_shared/cors.ts';

function maskIdentifier(
  identifier: string,
  type: 'MOBILE_MONEY' | 'BANK_ACCOUNT'
): string {
  const clean = identifier.trim();

  if (type === 'MOBILE_MONEY') {
    return '***' + clean.slice(-3);
  }

  return '****' + clean.slice(-4);
}

Deno.serve(async (req: Request) => {
  const corsHeaders = corsHeadersFor(req);
  const reply = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return reply(405, { success: false, error: 'METHOD_NOT_ALLOWED' });

  try {
    const auth = req.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) {
      return reply(401, { success: false, error: 'UNAUTHORIZED', message: 'Missing Authorization header.' });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return reply(500, { success: false, error: 'SERVER_CONFIGURATION_ERROR' });
    }

    // 1. Authenticate user via JWT
    const token = auth.slice(7);
    const authClient = createClient(supabaseUrl, anonKey || serviceRoleKey, {
      global: { headers: { Authorization: auth } },
    });

    const { data: { user }, error: userErr } = await authClient.auth.getUser(token);
    if (userErr || !user) {
      return reply(401, { success: false, error: 'INVALID_SESSION', message: 'User session is invalid or expired.' });
    }

    // 2. Parse and validate input payload
    const body = await req.json().catch(() => ({}));
    const {
      restaurantId,
      destinationType,
      provider,
      accountIdentifier,
      accountName,
      isDefault = false,
    } = body;

    if (!restaurantId || typeof restaurantId !== 'string') {
      return reply(400, { success: false, error: 'INVALID_RESTAURANT_ID', message: 'restaurantId is required.' });
    }

    if (destinationType !== 'MOBILE_MONEY' && destinationType !== 'BANK_ACCOUNT') {
      return reply(400, {
        success: false,
        error: 'INVALID_DESTINATION_TYPE',
        message: 'destinationType must be MOBILE_MONEY or BANK_ACCOUNT.',
      });
    }

    if (!provider || typeof provider !== 'string') {
      return reply(400, { success: false, error: 'INVALID_PROVIDER', message: 'provider is required.' });
    }

    if (!accountIdentifier || typeof accountIdentifier !== 'string' || accountIdentifier.trim().length < 6) {
      return reply(400, {
        success: false,
        error: 'INVALID_ACCOUNT_IDENTIFIER',
        message: 'Valid account identifier is required.',
      });
    }

    if (!accountName || typeof accountName !== 'string' || accountName.trim().length === 0) {
      return reply(400, { success: false, error: 'INVALID_ACCOUNT_NAME', message: 'accountName is required.' });
    }

    // Privileged admin client to verify membership and perform atomic secure insert
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // 3. Verify restaurant membership & permissions
    // Payout destination changes: OWNER preferred, or financial MANAGER.
    const { data: member, error: memberErr } = await adminClient
      .from('restaurant_members')
      .select('role, permissions, is_active')
      .eq('restaurant_id', restaurantId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    const isPlatformAdmin = user.app_metadata?.role === 'SUPER_ADMIN' || user.app_metadata?.role === 'ADMIN';

    if (!isPlatformAdmin) {
      if (memberErr || !member) {
        return reply(403, {
          success: false,
          error: 'FORBIDDEN',
          message: 'Caller is not an active member of the specified restaurant.',
        });
      }

      const isOwner = member.role === 'OWNER';
      const perms = Array.isArray(member.permissions) ? member.permissions : [];
      const isFinanceManager =
        member.role === 'MANAGER' &&
        (perms.includes('ALL') || perms.includes('FINANCE') || perms.includes('MANAGE_FINANCE'));

      if (!isOwner && !isFinanceManager) {
        return reply(403, {
          success: false,
          error: 'FORBIDDEN',
          message: 'Only the restaurant OWNER or permitted financial MANAGER can manage payout destinations.',
        });
      }
    }

    // 4. Server-Side Masking (Client never decides masked value)
    const masked = maskIdentifier(accountIdentifier, destinationType);

    // 5. Store destination atomically inside secure database RPC
    // Note: Do NOT log accountIdentifier!
    const { data: rpcResult, error: rpcErr } = await adminClient.rpc(
      'create_payout_destination_secure',
      {
        p_restaurant_id: restaurantId,
        p_destination_type: destinationType,
        p_provider: provider.trim(),
        p_masked_identifier: masked,
        p_account_name: accountName.trim(),
        p_raw_identifier: accountIdentifier.trim(),
        p_is_default: Boolean(isDefault),
        p_created_by: user.id,
      }
    );

    if (rpcErr || !rpcResult?.success) {
      return reply(400, {
        success: false,
        error: 'FAILED_TO_STORE_DESTINATION',
        message: 'Failed to atomically store payout destination and credentials.',
      });
    }

    return reply(200, {
      success: true,
      destinationId: rpcResult.destination_id,
      maskedIdentifier: masked,
    });
  } catch (err: any) {
    return reply(500, {
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Payout destination was not saved.',
    });
  }
});
