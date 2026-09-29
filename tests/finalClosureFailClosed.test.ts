import assert from 'node:assert/strict';
import { PayoutsRepository } from '../repositories/payouts.repository';
import { RestaurantRepository, isCustomerVisibleRestaurant } from '../repositories/restaurants.repository';
async function run() {
  const saved=await PayoutsRepository.addPayoutDestination({restaurantId:'test',destinationType:'MOBILE_MONEY',provider:'test',rawAccountIdentifier:'255700123456',accountName:'Test'});
  assert.equal(saved.success,false); assert.equal(saved.destinationId,undefined);
  assert.equal((await PayoutsRepository.setDefaultDestination('test','missing')).success,false);
  assert.equal((await PayoutsRepository.disableDestination('test','missing')).success,false);
  for (const method of ['publishRestaurant','submitForLaunchReview','approveLaunch','getLaunchReadiness'] as const) await assert.rejects(()=>RestaurantRepository[method]('test'));
  const visible:any={name:'Restaurant',isActive:true,isPublished:true,isVerified:true,verificationStatus:'VERIFIED',launchStatus:'PUBLISHED',isSuspended:false,archivedAt:null};
  assert.equal(isCustomerVisibleRestaurant(visible),true);
  for(const override of [{isActive:false},{isVerified:false},{isPublished:false},{launchStatus:'GO_LIVE_REVIEW'},{isSuspended:true},{archivedAt:'2026-09-28'},{verificationStatus:'SUSPENDED'},{name:'[DELETED] Shop'}])assert.equal(isCustomerVisibleRestaurant({...visible,...override}),false);
  console.log('PASS: payout failures, launch offline failures, and eight visibility exclusions');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
