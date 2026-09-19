import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const jsonHeaders = {
  ...corsHeaders,
  'Content-Type': 'application/json',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'METHOD_NOT_ALLOWED',
      }),
      {
        status: 405,
        headers: jsonHeaders,
      }
    );
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'UNAUTHORIZED',
        }),
        {
          status: 401,
          headers: jsonHeaders,
        }
      );
    }

    const {
      paymentId,
    } = await req.json();

    if (!paymentId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'PAYMENT_ID_REQUIRED',
        }),
        {
          status: 400,
          headers: jsonHeaders,
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const userClient = createClient(
      supabaseUrl,
      anonKey,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );

    const token = authHeader.replace(
      'Bearer ',
      ''
    );
    const {
      data: { user },
    } = await userClient.auth.getUser(
      token
    );

    if (!user) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'INVALID_SESSION',
        }),
        {
          status: 401,
          headers: jsonHeaders,
        }
      );
    }

    const {
      data: payment,
      error,
    } = await userClient
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .eq('user_id', user.id)
      .single();

    if (error || !payment) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'PAYMENT_NOT_FOUND',
        }),
        {
          status: 404,
          headers: jsonHeaders,
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        payment,
      }),
      {
        status: 200,
        headers: jsonHeaders,
      }
    );
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'PAYMENT_STATUS_FAILED',
      }),
      {
        status: 500,
        headers: jsonHeaders,
      }
    );
  }
});
