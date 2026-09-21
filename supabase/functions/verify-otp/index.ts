// @ts-ignore
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { corsHeaders } from '../_shared/cors.ts';

function normalizePhone(raw: string): string {
  const digits = (raw || '').replace(/[^0-9]/g, '');
  if (digits.startsWith('255') && digits.length === 12) return `+${digits}`;
  if (digits.startsWith('0') && digits.length === 10) return `+255${digits.substring(1)}`;
  if (digits.length === 9) return `+255${digits}`;
  return `+${digits}`;
}

async function hmacSha256(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  try {
    const { phone, otp } = await req.json();

    if (!otp || otp.trim().length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: 'Verification code is required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normPhone = normalizePhone(phone);

    // @ts-ignore
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    // @ts-ignore
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    // @ts-ignore
    const pepper = Deno.env.get('SMS_OTP_PEPPER');
    if (!pepper) {
      console.error('SMS_OTP_PEPPER is not configured.');
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Verification service is not configured.',
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch active unverified challenge
    const { data: challenges, error: fetchErr } = await supabase
      .from('otp_challenges')
      .select('*')
      .eq('phone', normPhone)
      .eq('is_verified', false)
      .is('invalidated_at', null)
      .order('created_at', { ascending: false })
      .limit(1);

    if (fetchErr || !challenges || challenges.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'No active OTP verification code found. Please request a new code.',
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const challenge = challenges[0];

    // Expiry check
    if (new Date(challenge.expires_at).getTime() < Date.now()) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Verification code has expired (5-minute window). Please request a new code.',
        }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Attempt lockout check
    if (challenge.attempts_count >= challenge.max_attempts) {
      return new Response(
        JSON.stringify({
          success: false,
          isLockedOut: true,
          message: 'Maximum verification attempts exceeded. Code has been permanently locked out.',
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Increment attempt count
    const { data: claimed, error: claimError } = await supabase
      .from('otp_challenges')
      .update({ attempts_count: challenge.attempts_count + 1 })
      .eq('id', challenge.id).eq('attempts_count', challenge.attempts_count)
      .eq('is_verified', false).is('invalidated_at', null).select('id');
    if (claimError || !claimed?.length) throw new Error('Verification changed. Please retry.');

    // Compute expected hash and compare in constant time
    const expectedHash = await hmacSha256(`${otp.trim()}:${normPhone}`, pepper);
    const isMatch = timingSafeCompare(expectedHash, challenge.otp_hash);

    if (!isMatch) {
      const remaining = Math.max(0, challenge.max_attempts - (challenge.attempts_count + 1));
      return new Response(
        JSON.stringify({
          success: false,
          attemptsRemaining: remaining,
          message:
            remaining > 0
              ? `Incorrect verification code. ${remaining} attempt(s) remaining.`
              : 'Maximum attempts exceeded. Code locked out.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark challenge verified
    const { data: verified, error: verifiedError } = await supabase
      .from('otp_challenges').update({ is_verified: true })
      .eq('id', challenge.id).eq('is_verified', false).is('invalidated_at', null).select('id');
    if (verifiedError || !verified?.length) throw new Error('This verification has already been used or replaced.');

    // Update profiles with phone_verified_at
    const nowIso = new Date().toISOString();
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ is_phone_verified: true, phone_verified_at: nowIso })
      .eq('phone', normPhone);
    if (profileError) throw new Error('Phone verification could not be saved. Please contact support.');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Phone number verified successfully.',
        phoneVerifiedAt: nowIso,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, message: err?.message || 'Server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
