// @ts-ignore
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { corsHeaders } from '../_shared/cors.ts';

// Tanzanian Telecom Prefixes & Carrier Detection
function detectCarrier(subscriber9: string): string {
  const p = subscriber9.substring(0, 2);
  if (['74', '75', '76'].includes(p)) return 'Vodacom M-Pesa';
  if (['68', '69', '78', '79'].includes(p)) return 'Airtel Money';
  if (['65', '67', '71'].includes(p)) return 'Mixx by Yas (Tigo)';
  if (['61', '62'].includes(p)) return 'HaloPesa (Halotel)';
  if (p === '73') return 'TTCL';
  if (p === '77') return 'Zantel';
  return 'Unknown';
}

function normalizePhone(raw: string) {
  const digits = (raw || '').replace(/[^0-9]/g, '');
  let sub9 = '';
  if (digits.startsWith('255') && digits.length === 12) {
    sub9 = digits.substring(3);
  } else if (digits.startsWith('0') && digits.length === 10) {
    sub9 = digits.substring(1);
  } else if (digits.length === 9 && (digits.startsWith('6') || digits.startsWith('7'))) {
    sub9 = digits;
  } else {
    return { valid: false, error: 'Invalid Tanzanian phone length' };
  }

  const carrier = detectCarrier(sub9);
  return {
    valid: carrier !== 'Unknown',
    e164: `+255${sub9}`,
    carrierDigits: `255${sub9}`,
    carrier,
    masked: `+255 ${sub9.substring(0, 2)} ••• ${sub9.substring(5)}`,
  };
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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  try {
    const { phone, purpose = 'CUSTOMER_VERIFICATION', language = 'sw' } = await req.json();

    const norm = normalizePhone(phone);
    if (!norm.valid || !norm.e164) {
      return new Response(
        JSON.stringify({ success: false, error: norm.error || 'Invalid Tanzanian phone number' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase Service Role client
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
          error: 'SERVER_CONFIGURATION_ERROR',
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
    // @ts-ignore
    const smsProvider = (Deno.env.get('SMS_PROVIDER') || '').toLowerCase();
    if (!['beem', 'nextsms'].includes(smsProvider)) throw new Error('A real SMS_PROVIDER (beem or nextsms) must be configured.');
    if (smsProvider === 'beem' && (!Deno.env.get('BEEM_API_KEY') || !Deno.env.get('BEEM_SECRET_KEY'))) throw new Error('SMS credentials are missing.');
    if (smsProvider === 'nextsms' && (!Deno.env.get('NEXTSMS_USERNAME') || !Deno.env.get('NEXTSMS_PASSWORD'))) throw new Error('SMS credentials are missing.');

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Check Rate Limiting (60s cooldown)
    const { data: recentChallenges } = await supabase
      .from('otp_challenges')
      .select('id, created_at, invalidated_at')
      .eq('phone', norm.e164)
      .is('invalidated_at', null)
      .order('created_at', { ascending: false })
      .limit(1);

    if (recentChallenges && recentChallenges.length > 0) {
      const elapsed = Date.now() - new Date(recentChallenges[0].created_at).getTime();
      if (elapsed < 60000) {
        const remaining = Math.ceil((60000 - elapsed) / 1000);
        return new Response(
          JSON.stringify({
            success: false,
            error: `Please wait ${remaining}s before requesting a new code.`,
            cooldownRemainingSeconds: remaining,
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 2. Invalidate all older unverified challenges for this phone
    await supabase
      .from('otp_challenges')
      .update({ invalidated_at: new Date().toISOString() })
      .eq('phone', norm.e164)
      .eq('is_verified', false)
      .is('invalidated_at', null);

    // 3. Generate Cryptographic 6-digit OTP
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    const rawOtp = (100000 + (array[0] % 900000)).toString();

    // 4. Compute Salted & Peppered HMAC-SHA256 Hash
    const otpHash = await hmacSha256(`${rawOtp}:${norm.e164}`, pepper);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // 5. Insert new challenge record
    const challengeId = `otp_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const { error: dbError } = await supabase.from('otp_challenges').insert({
      id: challengeId,
      phone: norm.e164,
      otp_hash: otpHash,
      purpose,
      attempts_count: 0,
      max_attempts: 5,
      is_verified: false,
      expires_at: expiresAt,
    });

    if (dbError) {
      return new Response(
        JSON.stringify({ success: false, error: 'Database error saving challenge' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Deliver via configured SMS Gateway
    let messageId = '';
    let deliveryStatus = 'SENT';

    const smsText =
      language === 'sw'
        ? `Habari! Namba yako ya uthibitisho ya MloHub (${purpose}) ni [ ${rawOtp} ]. Inatumika kwa dakika 5 tu. Usitoe kwa mtu yeyote.`
        : `Hello! Your MloHub verification code (${purpose}) is [ ${rawOtp} ]. Valid for 5 minutes only. Do not share with anyone.`;

    if (smsProvider === 'nextsms') {
      // @ts-ignore
      const username = Deno.env.get('NEXTSMS_USERNAME');
      // @ts-ignore
      const password = Deno.env.get('NEXTSMS_PASSWORD');
      // @ts-ignore
      const senderId = Deno.env.get('NEXTSMS_SENDER_ID') || 'MLOHUB';

      if (username && password) {
        const auth = btoa(`${username}:${password}`);
        const res = await fetch('https://messaging-service.co.tz/api/sms/v1/text/single', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ from: senderId, to: norm.carrierDigits, text: smsText }),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok || d?.messages?.[0]?.status?.groupId !== 1 || !d?.messages?.[0]?.messageId) throw new Error('SMS provider rejected the request. Please retry later.');
        messageId = d.messages[0].messageId;
      }
    } else if (smsProvider === 'beem') {
      // @ts-ignore
      const apiKey = Deno.env.get('BEEM_API_KEY');
      // @ts-ignore
      const secretKey = Deno.env.get('BEEM_SECRET_KEY');
      // @ts-ignore
      const senderId = Deno.env.get('BEEM_SENDER_ID') || 'INFO';

      if (apiKey && secretKey) {
        const auth = btoa(`${apiKey}:${secretKey}`);
        const res = await fetch('https://apisms.beem.africa/v1/send', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            source_addr: senderId,
            schedule_time: '',
            encoding: 0,
            message: smsText,
            recipients: [{ recipient_id: '1', dest_addr: norm.carrierDigits }],
          }),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok || !(d?.code === 100 || d?.successful === true || d?.data?.valid > 0) || !(d?.request_id || d?.message_id)) throw new Error('SMS provider rejected the request. Please retry later.');
        messageId = String(d.request_id || d.message_id);
      }
    }

    if (!messageId) throw new Error('SMS was not accepted by the provider.');
    // 7. Log to sms_logs
    await supabase.from('sms_logs').insert({
      id: `sms_log_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`,
      recipient: norm.e164,
      carrier: norm.carrier,
      template_id: `OTP_${purpose}`,
      provider: smsProvider.toUpperCase(),
      provider_message_id: messageId,
      status: deliveryStatus,
    });

    return new Response(
      JSON.stringify({
        success: true,
        carrierName: norm.carrier,
        maskedPhone: norm.masked,
        message:
          language === 'sw'
            ? `Msimbo umetumwa kwa njia ya SMS kupitia ${norm.carrier}.`
            : `Verification code dispatched via ${norm.carrier}.`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
