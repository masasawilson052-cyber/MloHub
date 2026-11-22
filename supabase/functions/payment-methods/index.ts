import { corsHeadersFor } from '../_shared/cors.ts';
import { getEnabledPaymentMethodCodes } from '../_shared/payments/enabledMethods.ts';

Deno.serve(async (req: Request) => {
  const corsHeaders = corsHeadersFor(req);
  const jsonHeaders = {
    ...corsHeaders,
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    });
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
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

  const enabledMethods = getEnabledPaymentMethodCodes();

  return new Response(
    JSON.stringify({
      success: true,
      enabledMethods,
    }),
    {
      status: 200,
      headers: jsonHeaders,
    }
  );
});
