export type Role = 'customer' | 'restaurant' | 'admin';
export type Status = 'Pending' | 'Accepted' | 'Preparing' | 'Ready' | 'Completed' | 'Cancelled';
export type Restaurant = {id:string;name:string;cuisine:string;area:string;address:string;phone:string;description:string;lat:number;lng:number;open:boolean;published:boolean;owner:string;emoji:string;hours:string};
export type Food = {id:string;restaurantId:string;name:string;description:string;category:string;price:number;available:boolean;photo:string;emoji:string};
export type Order = {id:string;restaurantId:string;items:{name:string;quantity:number;price:number}[];total:number;status:Status;payment:'Cash on pickup'|'Simulated mobile money';paymentStatus:'Due on pickup'|'Simulated paid'|'Simulated refunded';createdAt:string;customer:string;history:{status:Status;at:string}[]};
export type Application = {id:string;name:string;owner:string;phone:string;area:string;cuisine:string;address:string;status:'Pending'|'Approved'|'Rejected';reason?:string};
export type MealRequest = {id:string;restaurantId:string;description:string;people:number;budget:number;status:'Pending'|'Quoted'|'Accepted'|'Cancelled';quote?:number;orderId?:string};
export type Notice = {id:string;role:Role;text:string;at:string;read:boolean};
export type DemoState = {version:1;restaurants:Restaurant[];foods:Food[];orders:Order[];applications:Application[];requests:MealRequest[];notices:Notice[]};
export const STORE_KEY = 'mlohub_offline_showcase_v1';
export const money = (n:number) => `TZS ${Math.round(n).toLocaleString('en-US')}`;
const id = (prefix:string) => `${prefix}-${globalThis.crypto.randomUUID().slice(0,8)}`;
const now = () => new Date().toISOString();
const requireText = (s:string,label:string) => {if(!s?.trim())throw new Error(`${label} is required.`);};
const positive = (n:number,label:string) => {if(!Number.isSafeInteger(n)||n<=0)throw new Error(`${label} must be a positive whole number.`);};
function notice(s:DemoState,role:Role,text:string) {s.notices.unshift({id:id('note'),role,text,at:now(),read:false});s.notices=s.notices.slice(0,100);}
export function seedDemo():DemoState {
 const restaurants:Restaurant[]=[
  {id:'amina',name:'Mama Amina Kitchen',cuisine:'Swahili',area:'Mikocheni',address:'Old Bagamoyo Road, Mikocheni',phone:'+255 754 000 101',description:'Slow-cooked favourites, generous portions, and the taste of home.',lat:-6.7645,lng:39.245,open:true,published:true,owner:'Amina',emoji:'🍛',hours:'10:00–21:00'},
  {id:'kibo',name:'Kibo Green Table',cuisine:'Fresh & healthy',area:'Sinza',address:'Shekilango Road, Sinza',phone:'+255 754 000 102',description:'Fresh greens and comforting bowls made for a brighter day.',lat:-6.782,lng:39.228,open:true,published:true,owner:'Kibo',emoji:'🥗',hours:'09:00–20:00'},
  {id:'coast',name:'Coast & Grill',cuisine:'Grill',area:'Masaki',address:'Haile Selassie Road, Masaki',phone:'+255 754 000 103',description:'Smoky grills, coastal flavours, and meals worth sharing.',lat:-6.754,lng:39.277,open:true,published:true,owner:'Coast',emoji:'🍗',hours:'11:00–22:00'}];
 const foods:Food[]=[
  {id:'biryani',restaurantId:'amina',name:'Chicken biryani',description:'Fragrant rice, slow-cooked chicken, and fresh kachumbari.',category:'Signature meals',price:11000,available:true,photo:'',emoji:'🍛'},
  {id:'pilau',restaurantId:'amina',name:'Swahili beef pilau',description:'Warm spices, tender beef, and a little taste of Zanzibar.',category:'Signature meals',price:9000,available:true,photo:'',emoji:'🍲'},
  {id:'juice',restaurantId:'amina',name:'Fresh passion juice',description:'Freshly blended passion fruit, served chilled.',category:'Drinks',price:3000,available:true,photo:'',emoji:'🥤'},
  {id:'bowl',restaurantId:'kibo',name:'Garden harvest bowl',description:'Seasonal greens, avocado, chickpeas, and lemon dressing.',category:'Bowls',price:12000,available:true,photo:'',emoji:'🥗'},
  {id:'grill',restaurantId:'coast',name:'Coastal grilled chicken',description:'Charcoal-grilled chicken, coconut rice, and house salad.',category:'Grill',price:16000,available:true,photo:'',emoji:'🍗'},
  {id:'fish',restaurantId:'coast',name:'Catch of the day',description:'Grilled fish with lime, greens, and golden chips.',category:'Grill',price:18000,available:true,photo:'',emoji:'🐟'}];
 return {version:1,restaurants,foods,orders:[],applications:[],requests:[],notices:[]};
}
export function mutate(s:DemoState,action:(draft:DemoState)=>void):DemoState {const draft=JSON.parse(JSON.stringify(s)) as DemoState;action(draft);return draft;}
export function placeOrder(s:DemoState,restaurantId:string,cart:Record<string,number>,payment:Order['payment']):string {
 const r=s.restaurants.find(x=>x.id===restaurantId);if(!r?.open||!r.published)throw new Error('This restaurant is not accepting orders.');
 const items=Object.entries(cart).filter(([,q])=>q>0).map(([key,quantity])=>{positive(quantity,'Quantity');if(quantity>50)throw new Error('Maximum 50 portions per item.');const f=s.foods.find(x=>x.id===key);if(!f||f.restaurantId!==restaurantId||!f.available)throw new Error('An item is no longer available. Please update your bag.');positive(f.price,'Price');return {name:f.name,quantity,price:f.price};});
 if(!items.length)throw new Error('Add a meal to your bag first.');
 if(!['Cash on pickup','Simulated mobile money'].includes(payment))throw new Error('Choose a demo payment method.');
 const orderId=id('MLO').toUpperCase(),at=now();
 s.orders.unshift({id:orderId,restaurantId,items,total:items.reduce((t,i)=>t+i.price*i.quantity,0),status:'Pending',payment,paymentStatus:payment==='Cash on pickup'?'Due on pickup':'Simulated paid',createdAt:at,customer:'Demo customer',history:[{status:'Pending',at}]});
 notice(s,'customer',`Order ${orderId} is waiting for the kitchen.`);notice(s,'restaurant',`New order ${orderId} is ready to review.`);return orderId;
}
const next:Record<Status,Status[]>={Pending:['Accepted','Cancelled'],Accepted:['Preparing','Cancelled'],Preparing:['Ready'],Ready:['Completed'],Completed:[],Cancelled:[]};
export function transitionOrder(s:DemoState,orderId:string,status:Status,role:Role) {
 const o=s.orders.find(x=>x.id===orderId);if(!o)throw new Error('Order not found.');
 if(role==='customer'&&!(status==='Cancelled'&&o.status==='Pending'))throw new Error('Customer cancellation is available while the order is pending.');
 if(!next[o.status].includes(status))throw new Error(`Cannot move an order from ${o.status} to ${status}.`);
 o.status=status;o.history.push({status,at:now()});if(status==='Cancelled'&&o.paymentStatus==='Simulated paid')o.paymentStatus='Simulated refunded';
 notice(s,'customer',`Order ${orderId}: ${status.toLowerCase()}.`);notice(s,'restaurant',`Order ${orderId}: ${status.toLowerCase()}.`);
}
export function saveFood(s:DemoState,food:Food) {
 requireText(food.name,'Food name');requireText(food.category,'Category');positive(food.price,'Price');if(!s.restaurants.some(r=>r.id===food.restaurantId))throw new Error('Restaurant not found.');
 if(food.photo&&!/^data:image\/(png|jpeg|webp);base64,/.test(food.photo))throw new Error('Use a PNG, JPG, or WebP photo.');
 const old=s.foods.findIndex(f=>f.id===food.id);if(old>=0&&s.foods[old].restaurantId!==food.restaurantId)throw new Error('Wrong restaurant.');
 if(old>=0)s.foods[old]={...food};else s.foods.push({...food,id:food.id||id('food')});
 notice(s,'customer',`${s.restaurants.find(r=>r.id===food.restaurantId)?.name} updated its menu.`);
}
export function saveRestaurant(s:DemoState,r:Restaurant) {
 requireText(r.name,'Restaurant name');requireText(r.address,'Address');requireText(r.area,'Area');requireText(r.phone,'Contact phone');
 if(!Number.isFinite(r.lat)||Math.abs(r.lat)>90||!Number.isFinite(r.lng)||Math.abs(r.lng)>180)throw new Error('Enter valid latitude and longitude.');
 const index=s.restaurants.findIndex(x=>x.id===r.id);if(index<0)throw new Error('Restaurant not found.');s.restaurants[index]={...r};
 notice(s,'customer',`${r.name} updated its profile.`);
}
export function applyRestaurant(s:DemoState,a:Omit<Application,'id'|'status'>) {
 for(const key of ['name','owner','phone','area','cuisine','address'] as const)requireText(a[key],key);
 if(s.applications.some(x=>x.name.toLowerCase()===a.name.trim().toLowerCase()&&x.status!=='Rejected')||s.restaurants.some(x=>x.name.toLowerCase()===a.name.trim().toLowerCase()))throw new Error('This restaurant already exists or has a pending application.');
 s.applications.unshift({...a,id:id('app'),status:'Pending'});notice(s,'admin',`Restaurant application: ${a.name}.`);
}
export function decideApplication(s:DemoState,applicationId:string,approve:boolean) {
 const a=s.applications.find(x=>x.id===applicationId);if(!a||a.status!=='Pending')throw new Error('Application already reviewed.');
 a.status=approve?'Approved':'Rejected';
 if(approve)s.restaurants.push({id:id('restaurant'),name:a.name,owner:a.owner,phone:a.phone,area:a.area,cuisine:a.cuisine,address:a.address,description:'New to the MloHub neighbourhood.',lat:-6.7924,lng:39.2083,open:true,published:false,emoji:'🍽️',hours:'10:00–21:00'});
 notice(s,'restaurant',`${a.name}: application ${a.status.toLowerCase()}. Add a menu and publish when ready.`);notice(s,'customer',`${a.name}: application ${a.status.toLowerCase()}.`);
}
export function publishRestaurant(s:DemoState,restaurantId:string) {const r=s.restaurants.find(x=>x.id===restaurantId);if(!r)throw new Error('Restaurant not found.');if(!s.foods.some(f=>f.restaurantId===r.id&&f.available&&f.price>0))throw new Error('Add at least one available menu item with a valid price before publishing.');requireText(r.address,'Address');r.published=true;notice(s,'customer',`${r.name} is now available in discovery.`);}
export function requestMeal(s:DemoState,request:Omit<MealRequest,'id'|'status'>) {requireText(request.description,'Meal request');positive(request.people,'People');positive(request.budget,'Budget');if(!s.restaurants.some(r=>r.id===request.restaurantId&&r.published&&r.open))throw new Error('Restaurant is unavailable.');s.requests.unshift({...request,id:id('REQ'),status:'Pending'});notice(s,'restaurant','A new custom meal request is waiting.');}
export function quoteMeal(s:DemoState,requestId:string,quote:number) {positive(quote,'Quote');const r=s.requests.find(x=>x.id===requestId);if(!r||r.status!=='Pending')throw new Error('This request is no longer pending.');r.quote=quote;r.status='Quoted';notice(s,'customer',`Your custom meal quote is ${money(quote)}.`);}
export function acceptQuote(s:DemoState,requestId:string) {const r=s.requests.find(x=>x.id===requestId);if(!r||r.status!=='Quoted'||!r.quote)throw new Error('There is no active quote.');const restaurant=s.restaurants.find(x=>x.id===r.restaurantId);if(!restaurant?.open||!restaurant.published)throw new Error('Restaurant is unavailable.');const at=now(),orderId=id('MLO').toUpperCase();r.status='Accepted';r.orderId=orderId;s.orders.unshift({id:orderId,restaurantId:r.restaurantId,items:[{name:r.description,quantity:r.people,price:r.quote/r.people}],total:r.quote,status:'Pending',payment:'Cash on pickup',paymentStatus:'Due on pickup',createdAt:at,customer:'Demo customer',history:[{status:'Pending',at}]});notice(s,'restaurant',`Custom quote accepted. Order ${orderId} is pending.`);notice(s,'customer',`Quote accepted. Order ${orderId} created.`);}
export function cancelRequest(s:DemoState,requestId:string){const r=s.requests.find(x=>x.id===requestId);if(!r||!['Pending','Quoted'].includes(r.status))throw new Error('This request cannot be cancelled.');r.status='Cancelled';notice(s,'restaurant','A custom meal request was cancelled.');}
export type DemoOtp = {code:string;expires:number;attempts:number;verified:boolean};
export function createDemoOtp():DemoOtp {const a=new Uint32Array(1);crypto.getRandomValues(a);return {code:String(100000+a[0]%900000),expires:Date.now()+300000,attempts:0,verified:false};}
export function verifyDemoOtp(challenge:DemoOtp,code:string):DemoOtp {if(challenge.verified)throw new Error('This demo code has already been used.');if(Date.now()>challenge.expires)throw new Error('Code expired. Generate another demo code.');if(challenge.attempts>=5)throw new Error('Too many attempts. Generate another demo code.');return {...challenge,attempts:challenge.attempts+1,verified:code===challenge.code};}
