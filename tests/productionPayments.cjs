const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript'),{createHmac}=require('node:crypto');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,file);
const {ClickPesaGateway}=require('../supabase/functions/_shared/payments/ClickPesaGateway.ts');
const {PaymentGatewayFactory}=require('../supabase/functions/_shared/payments/PaymentGatewayFactory.ts');
let passed=0;async function check(name,run){await run();passed++;console.log('PASS',name);}
const config={clientId:'test-client',apiKey:'test-key',checksumKey:'test-checksum-key'};
const gateway=new ClickPesaGateway(config);
const base={event:'PAYMENT RECEIVED',data:{id:'provider-1',status:'SUCCESS',orderReference:'MH1234',collectedAmount:'12000',collectedCurrency:'TZS',clientId:'test-client'}};
const signed=async p=>JSON.stringify({...p,checksum:await ClickPesaGateway.checksum(config.checksumKey,p),checksumMethod:'canonical'});
async function main(){
await check('Canonical checksum matches independent crypto calculation',async()=>{assert.equal(await ClickPesaGateway.checksum('key',{z:2,a:{y:1,b:2}}),createHmac('sha256','key').update('{"a":{"b":2,"y":1},"z":2}').digest('hex'));});
await check('Documented nested callback verified',async()=>{const r=await gateway.verifyWebhook(await signed(base),{});assert.equal(r.isValid,true);assert.equal(r.status,'PAID');assert.equal(r.amountTzs,12000);});
await check('Tampering and legacy header-only signatures rejected',async()=>{const valid=await signed(base);assert.equal((await gateway.verifyWebhook(valid.replace('12000','22000'),{})).isValid,false);assert.equal((await gateway.verifyWebhook(JSON.stringify(base),{'x-clickpesa-signature':'legacy'})).isValid,false);});
await check('Foreign currency and merchant callbacks rejected',async()=>{for(const update of [{collectedCurrency:'USD'},{clientId:'different-client'}])assert.equal((await gateway.verifyWebhook(await signed({...base,data:{...base.data,...update}}),{})).isValid,false);});
await check('Payout event cannot settle a customer collection',async()=>{assert.equal((await gateway.verifyWebhook(await signed({...base,event:'PAYOUT INITIATED'}),{})).isValid,false);});
await check('Callback event ID stable for replay handling',async()=>{const body=await signed(base);assert.equal((await gateway.verifyWebhook(body,{})).eventId,(await gateway.verifyWebhook(body,{})).eventId);});
await check('Failed callback does not become paid',async()=>{const r=await gateway.verifyWebhook(await signed({event:'PAYMENT FAILED',data:{...base.data,status:'FAILED'}}),{});assert.equal(r.isValid,true);assert.equal(r.status,'FAILED');});
const originalFetch=global.fetch;let sent;
try{
global.fetch=async(url,options)=>{if(String(url).endsWith('/generate-token'))return new Response(JSON.stringify({success:true,token:'Bearer valid-token'}));assert.equal(options.headers.Authorization,'Bearer valid-token');if(options.method==='POST'){assert.equal(url,'https://api.clickpesa.com/third-parties/payments/initiate-ussd-push-request');sent=JSON.parse(options.body);return new Response(JSON.stringify({id:'provider-1',orderReference:'MH1234',status:'PROCESSING'}));}assert.equal(url,'https://api.clickpesa.com/third-parties/payments/MH1234');return new Response(JSON.stringify([base.data]));};
await check('Real API endpoints, bearer header, normalized phone and payload checksum',async()=>{const r=await gateway.initiateUssdPush({amount:12000,currency:'TZS',orderReference:'MH1234',phoneNumber:'0754123456',methodCode:'MPESA',paymentType:'ORDER_FULL'});assert.equal(r.success,true);assert.equal(r.status,'PENDING');assert.equal(sent.phoneNumber,'255754123456');const {checksum,...payload}=sent;assert.equal(checksum,await ClickPesaGateway.checksum(config.checksumKey,payload));});
await check('Query parses array and validates merchant reference',async()=>{assert.equal((await gateway.queryStatus('provider-1','MH1234')).status,'PAID');assert.equal((await gateway.queryStatus('wrong-provider','MH1234')).success,false);});
await check('Invalid amount/reference/card request rejected before provider contact',async()=>{const r={amount:12000,currency:'TZS',orderReference:'MH1234',phoneNumber:'0754123456',methodCode:'MPESA',paymentType:'ORDER_FULL'};for(const change of [{amount:-1},{orderReference:'x'.repeat(21)},{methodCode:'CARD'}])await assert.rejects(()=>gateway.initiateUssdPush({...r,...change}));});
await check('Malformed success response cannot fabricate payment ID',async()=>{global.fetch=async()=>new Response('{}');assert.equal((await gateway.initiateUssdPush({amount:12000,currency:'TZS',orderReference:'MH1234',phoneNumber:'0754123456',methodCode:'MPESA',paymentType:'ORDER_FULL'})).success,false);});
}finally{global.fetch=originalFetch;}
await check('Unimplemented refund reports no movement of money',async()=>{const r=await gateway.refund({amountTzs:12000});assert.equal(r.success,false);assert.equal(r.status,'FAILED');assert.equal(r.refundReference,'');});
await check('Production forbids sandbox even when opt-in is set',async()=>{process.env.NODE_ENV='production';process.env.MLOHUB_ALLOW_SANDBOX_PAYMENTS='true';assert.throws(()=>PaymentGatewayFactory.getGateway('sandbox'));assert.throws(()=>PaymentGatewayFactory.getGateway('selcom'));});
console.log(`PRODUCTION PAYMENT CONTRACT: ${passed} groups passed; all HTTP responses mocked, no real payments made.`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
