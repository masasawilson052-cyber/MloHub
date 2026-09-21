import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { directionsUrl } from '../utils/directions';
import { ClickPesaGateway } from '../supabase/functions/_shared/payments/ClickPesaGateway';
import { SandboxPaymentGateway } from '../supabase/functions/_shared/payments/SandboxPaymentGateway';
import { PaymentGatewayFactory } from '../supabase/functions/_shared/payments/PaymentGatewayFactory';

async function main() {
  let passed = 0;
  const check = (label: string, action: () => void) => { action(); passed++; console.log('PASS', label); };
  check('Coordinates generate a valid directions destination', () => assert.equal(new URL(directionsUrl({lat:-6.77,lng:39.2})).searchParams.get('destination'), '-6.77,39.2'));
  check('Missing coordinates use an encoded address', () => assert.equal(new URL(directionsUrl({name:'Kitchen & Cafe',address:'Sinza'})).searchParams.get('destination'), 'Kitchen & Cafe, Sinza'));
  check('Invalid coordinates do not appear in directions', () => assert.ok(!directionsUrl({lat:NaN,lng:200,name:'Kitchen'}).includes('NaN')));
  check('No fabricated place ID is generated', () => assert.ok(!directionsUrl({name:'Kitchen'}).includes('place_id')));
  check('No location fails clearly', () => assert.throws(() => directionsUrl({})));
  const body = JSON.stringify({eventId:'audit-event',eventType:'payment.success',providerReference:'audit-ref',amount:100,currency:'TZS',timestamp:'2026-09-21T00:00:00Z'});
  const expected = createHmac('sha256', SandboxPaymentGateway.SANDBOX_WEBHOOK_SECRET).update(body).digest('hex');
  const calculated = await ClickPesaGateway.computeHmacSha256(SandboxPaymentGateway.SANDBOX_WEBHOOK_SECRET, body);
  check('HMAC matches independent Node crypto output', () => assert.equal(calculated, expected));
  const gateway = new SandboxPaymentGateway();
  for (const signature of ['', 'mlohub_cp_sec_993847291048_prod', SandboxPaymentGateway.SANDBOX_WEBHOOK_SECRET]) {
    const result = await gateway.verifyWebhook(body, {'x-clickpesa-signature':signature});
    check('Missing or legacy signature rejected', () => assert.equal(result.isValid,false));
  }
  check('Correct signed webhook accepted', () => assert.equal(calculated,expected));
  assert.equal((await gateway.verifyWebhook(body, {'x-clickpesa-signature':expected})).isValid,true);
  const altered = await gateway.verifyWebhook(body.replace('100','200'), {'x-clickpesa-signature':expected});
  check('Altered payment body rejected', () => assert.equal(altered.isValid,false));
  const saved = {...process.env};
  try {
    process.env.NODE_ENV='production'; delete process.env.PAYMENT_PROVIDER; delete process.env.MLOHUB_ALLOW_SANDBOX_PAYMENTS;
    PaymentGatewayFactory.resetInstances();
    check('Unconfigured provider fails closed', () => assert.throws(() => PaymentGatewayFactory.getGateway()));
    process.env.PAYMENT_PROVIDER='sandobx';
    check('Misspelled provider fails closed', () => assert.throws(() => PaymentGatewayFactory.getGateway()));
    process.env.PAYMENT_PROVIDER='sandbox';
    check('Sandbox requires explicit server opt-in', () => assert.throws(() => PaymentGatewayFactory.getGateway()));
    process.env.MLOHUB_ALLOW_SANDBOX_PAYMENTS='true';
    check('Explicit sandbox is available', () => assert.equal(PaymentGatewayFactory.getGateway().provider,'sandbox'));
  } finally { for (const k of ['NODE_ENV','PAYMENT_PROVIDER','MLOHUB_ALLOW_SANDBOX_PAYMENTS']) { if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k]; } }
  console.log(`FINAL REPAIR BEHAVIOR: ${passed} passed`);
}
main().catch(error => { console.error(error); process.exitCode=1; });
