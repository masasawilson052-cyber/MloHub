import type { PaymentGateway } from './PaymentGateway.ts';
import { readPaymentEnvironment } from './environment.ts';
import { getCarrierDetails } from './paymentTypes.ts';
import type { InitiateUssdPushRequest, InitiateUssdPushResponse, WebhookVerificationResult, StatusQueryResponse, RefundGatewayRequest, RefundGatewayResponse, PaymentStatus } from './paymentTypes.ts';
// Documented contract: https://docs.clickpesa.com/home/checksum and /home/webhooks
export interface ClickPesaConfig { baseUrl?:string; clientId?:string; apiKey?:string; checksumKey?:string; webhookSecret?:string }
export class ClickPesaGateway implements PaymentGateway {
 readonly provider='clickpesa' as const;
 private readonly baseUrl:string;
 private readonly clientId:string;
 private readonly apiKey:string;
 private readonly checksumKey:string;
 private cachedToken=''; private tokenExpiresAt=0;
 constructor(config:ClickPesaConfig={}) {
  this.baseUrl=(config.baseUrl||readPaymentEnvironment('CLICKPESA_BASE_URL')||'https://api.clickpesa.com/third-parties').replace(/\/$/,'');
  this.clientId=config.clientId||readPaymentEnvironment('CLICKPESA_CLIENT_ID')||'';
  this.apiKey=config.apiKey||readPaymentEnvironment('CLICKPESA_API_KEY')||'';
  this.checksumKey=config.checksumKey||config.webhookSecret||readPaymentEnvironment('CLICKPESA_CHECKSUM_KEY')||'';
 }
 private assertConfigured() {
  if(this.baseUrl!=='https://api.clickpesa.com/third-parties')throw new Error('CLICKPESA_BASE_URL must be https://api.clickpesa.com/third-parties.');
  if(!this.clientId||!this.apiKey||!this.checksumKey)throw new Error('Configure ClickPesa client ID, API key, and checksum key on the server.');
 }
 static async computeHmacSha256(key:string,message:string):Promise<string>{
  if(!globalThis.crypto?.subtle)throw new Error('A cryptographic HMAC implementation is required.');
  const encoder=new TextEncoder();const imported=await crypto.subtle.importKey('raw',encoder.encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',imported,encoder.encode(message))),b=>b.toString(16).padStart(2,'0')).join('');
 }
 static canonicalize(value:any):any {
  if(value===null||typeof value!=='object')return value;
  if(Array.isArray(value))return value.map(v=>this.canonicalize(v));
  return Object.fromEntries(Object.keys(value).sort().map(key=>[key,this.canonicalize(value[key])]));
 }
 static checksum(key:string,payload:Record<string,unknown>){return this.computeHmacSha256(key,JSON.stringify(this.canonicalize(payload)));}
 private static equalHex(a:string,b:string){if(!/^[a-f0-9]{64}$/i.test(a)||a.length!==b.length)return false;let result=0;for(let i=0;i<a.length;i++)result|=a.toLowerCase().charCodeAt(i)^b.toLowerCase().charCodeAt(i);return result===0;}
 private static status(raw:unknown):PaymentStatus {switch(String(raw).toUpperCase()){case 'SUCCESS':case 'SETTLED':return 'PAID';case 'FAILED':return 'FAILED';case 'CANCELLED':return 'CANCELLED';case 'PROCESSING':return 'PROCESSING';default:return 'PENDING';}}
 async getAccessToken():Promise<string>{
  this.assertConfigured();if(this.cachedToken&&Date.now()<this.tokenExpiresAt)return this.cachedToken;
  const response=await fetch(`${this.baseUrl}/generate-token`,{method:'POST',headers:{'client-id':this.clientId,'api-key':this.apiKey},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error(`ClickPesa authorization failed (${response.status}).`);
  const data=await response.json();if(data.success!==true||typeof data.token!=='string'||!data.token.trim())throw new Error('Invalid ClickPesa authorization response.');
  this.cachedToken=data.token.startsWith('Bearer ')?data.token:`Bearer ${data.token}`;this.tokenExpiresAt=Date.now()+50*60*1000;return this.cachedToken;
 }
 async initiateUssdPush(request:InitiateUssdPushRequest):Promise<InitiateUssdPushResponse>{
  this.assertConfigured();
  if(!Number.isSafeInteger(request.amount)||request.amount<=0||request.currency!=='TZS')throw new Error('A positive whole TZS amount is required.');
  if(!/^[a-z0-9]{1,20}$/i.test(request.orderReference))throw new Error('Use a unique alphanumeric payment reference of at most 20 characters.');
  if(!['MPESA','AIRTEL_MONEY','MIXX_BY_YAS','HALOPESA'].includes(request.methodCode))throw new Error('USSD collection supports mobile money only.');
  let phone=request.phoneNumber.replace(/[^0-9]/g,'');if(/^0[67]\d{8}$/.test(phone))phone='255'+phone.slice(1);
  if(!/^255[67]\d{8}$/.test(phone))throw new Error('Enter a valid Tanzanian mobile-money phone number.');
  const payload={amount:String(request.amount),currency:'TZS',orderReference:request.orderReference,phoneNumber:phone};
  const checksum=await ClickPesaGateway.checksum(this.checksumKey,payload);
  const response=await fetch(`${this.baseUrl}/payments/initiate-ussd-push-request`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:await this.getAccessToken()},body:JSON.stringify({...payload,checksum}),signal:AbortSignal.timeout(25000)});
  const data=await response.json().catch(()=>({}));
  const valid=response.ok&&typeof data.id==='string'&&data.id.length>0&&data.orderReference===request.orderReference&&['PROCESSING','SUCCESS','SETTLED'].includes(data.status);
  const carrier=getCarrierDetails(request.methodCode);
  return {success:valid,provider:this.provider,gatewayReference:valid?data.id:'',merchantReference:request.orderReference,status:valid?'PENDING':'FAILED',amountTzs:request.amount,carrierName:carrier.name,ussdCode:carrier.ussd,carrierPromptText:valid?'Check your phone for the mobile-money prompt. Payment is confirmed only after the provider verifies it.':'',expiresAt:new Date(Date.now()+120000).toISOString(),rawResponse:data,error:valid?undefined:`ClickPesa did not accept the payment request (${response.status}).`};
 }
 async verifyWebhook(rawBody:string,_headers:Record<string,string|undefined>):Promise<WebhookVerificationResult>{
  const result:WebhookVerificationResult={isValid:false,provider:this.provider,eventId:'',merchantReference:'',gatewayReference:'',status:'FAILED',amountTzs:0,currency:'',timestamp:'',payerPhone:'',rawPayload:null,error:'Invalid ClickPesa callback.'};
  let payload:any;try{payload=JSON.parse(rawBody);}catch{return result;}
  if(!payload||typeof payload!=='object'||!this.checksumKey||typeof payload.checksum!=='string'||(payload.checksumMethod&&payload.checksumMethod!=='canonical'))return result;
  const unsigned={...payload};delete unsigned.checksum;delete unsigned.checksumMethod;
  if(!ClickPesaGateway.equalHex(payload.checksum,await ClickPesaGateway.checksum(this.checksumKey,unsigned)))return result;
  const data=payload.data;
  if(!['PAYMENT RECEIVED','PAYMENT FAILED'].includes(payload.event)||!data||typeof data.id!=='string'||typeof data.orderReference!=='string'||!data.orderReference||data.clientId!==this.clientId)return result;
  const status=ClickPesaGateway.status(data.status),amount=Number(data.collectedAmount),currency=data.collectedCurrency;
  if(payload.event==='PAYMENT RECEIVED'&&(status!=='PAID'||currency!=='TZS'||!Number.isSafeInteger(amount)||amount<=0))return result;
  if(payload.event==='PAYMENT FAILED'&&status!=='FAILED')return result;
  const eventId='cp_'+(await ClickPesaGateway.computeHmacSha256(this.checksumKey,`${data.id}:${data.orderReference}:${data.status}`)).slice(0,40);
  return {...result,isValid:true,eventId,merchantReference:data.orderReference,gatewayReference:data.id,status,amountTzs:Number.isFinite(amount)?amount:0,currency:currency||'',timestamp:data.updatedAt||data.createdAt||'',payerPhone:data.paymentPhoneNumber||'',rawPayload:payload,error:undefined};
 }
 async queryStatus(gatewayReference:string,merchantReference?:string):Promise<StatusQueryResponse>{
  if(!merchantReference)throw new Error('Merchant reference is required to query ClickPesa.');
  const response=await fetch(`${this.baseUrl}/payments/${encodeURIComponent(merchantReference)}`,{headers:{Authorization:await this.getAccessToken()},signal:AbortSignal.timeout(15000)});
  const data=await response.json().catch(()=>null);const rows=Array.isArray(data)?data:[];
  const item=rows.find((p:any)=>p.orderReference===merchantReference&&(!gatewayReference||p.id===gatewayReference)&&p.clientId===this.clientId);
  const amount=Number(item?.collectedAmount),status=ClickPesaGateway.status(item?.status);
  const success=response.ok&&Boolean(item)&&(status!=='PAID'||(item.collectedCurrency==='TZS'&&Number.isSafeInteger(amount)&&amount>0));
  return {success,status:success?status:'PENDING',amountTzs:success&&Number.isFinite(amount)?amount:0,gatewayReference:item?.id||gatewayReference,merchantReference,paidAt:status==='PAID'?item?.updatedAt:undefined,rawResponse:data,failureReason:success?undefined:'No matching verified ClickPesa payment was returned.'};
 }
 async refund(request:RefundGatewayRequest):Promise<RefundGatewayResponse>{
  return {success:false,refundReference:'',amountTzs:request.amountTzs,status:'FAILED',message:'Automated collection refunds are not enabled. Process and reconcile through the merchant provider workflow; no funds were sent by this request.'};
 }
}
