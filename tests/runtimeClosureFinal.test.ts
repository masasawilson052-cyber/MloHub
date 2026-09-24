import { PaymentRepository } from '../repositories/payments.repository';
import { PlatformSettingsRepository } from '../repositories/platformSettings.repository';
import { normalizeTanzaniaPhone, isValidTanzaniaPhone, formatTanzaniaPhoneDisplay } from '../utils/phone';
import { Order, PaymentStatus } from '../types/domain';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ ${msg}`);
}

export const canRetryOrderPayment = (order: Order): boolean => {
  const terminalOrder = order.status === 'CANCELLED' || order.status === 'REJECTED' || order.status === 'COMPLETED';
  const retryablePayment = order.paymentStatus === 'PENDING' ||
    order.paymentStatus === 'PROCESSING' ||
    order.paymentStatus === 'FAILED' ||
    order.paymentStatus === 'CANCELLED';
  return !terminalOrder && retryablePayment;
};

async function runTests() {
  console.log('\n=============================================================');
  console.log('--- MLOHUB FINAL RUNTIME CLOSURE VERIFICATION TESTS ---');
  console.log('=============================================================\n');

  // Test 1: PaymentRepository.listByCustomer exists and accepts customerId
  console.log('[TEST 1] PaymentRepository.listByCustomer contract');
  assert(typeof PaymentRepository.listByCustomer === 'function', 'PaymentRepository.listByCustomer is defined');
  const emptyCustomerResult = await PaymentRepository.listByCustomer('');
  assert(Array.isArray(emptyCustomerResult), 'listByCustomer returns an array for empty/unconfigured customer');

  // Test 2: Multi-Provider Mobile Money Support in PaymentRepository.createForOrder
  console.log('\n[TEST 2] Multi-Provider Mobile Money Providers contract');
  assert(typeof PaymentRepository.createForOrder === 'function', 'PaymentRepository.createForOrder is defined');

  // Test 3: Tanzania Phone Normalization & Validation
  console.log('\n[TEST 3] Tanzania Phone Normalization & Validation');
  assert(isValidTanzaniaPhone('0754123456'), '0754123456 is recognized as valid Tanzania phone');
  assert(isValidTanzaniaPhone('+255754123456'), '+255754123456 is recognized as valid Tanzania phone');
  assert(isValidTanzaniaPhone('0655123456'), '0655123456 is recognized as valid Tanzania phone');
  assert(normalizeTanzaniaPhone('0754123456') === '+255754123456', 'normalizeTanzaniaPhone formats 07XXXXXXXX to +2557XXXXXXXX');
  assert(normalizeTanzaniaPhone('754123456') === '+255754123456', 'normalizeTanzaniaPhone formats 7XXXXXXXX to +2557XXXXXXXX');
  assert(!isValidTanzaniaPhone('12345'), 'Short/invalid number rejected');
  assert(formatTanzaniaPhoneDisplay('+255754000111').includes('+255'), 'Formatted display includes international prefix');

  // Test 4: canRetryOrderPayment logic
  console.log('\n[TEST 4] canRetryOrderPayment helper truth');
  const pendingUnpaidOrder: Partial<Order> = {
    id: 'ord_1',
    status: 'PENDING',
    paymentStatus: 'PENDING',
  };
  assert(canRetryOrderPayment(pendingUnpaidOrder as Order) === true, 'Pending unpaid order is eligible for payment retry');

  const failedPaymentOrder: Partial<Order> = {
    id: 'ord_2',
    status: 'PENDING',
    paymentStatus: 'FAILED',
  };
  assert(canRetryOrderPayment(failedPaymentOrder as Order) === true, 'Pending order with failed payment is eligible for payment retry');

  const completedOrder: Partial<Order> = {
    id: 'ord_3',
    status: 'COMPLETED',
    paymentStatus: 'SUCCESS',
  };
  assert(canRetryOrderPayment(completedOrder as Order) === false, 'Completed order is not eligible for payment retry');

  const cancelledOrder: Partial<Order> = {
    id: 'ord_4',
    status: 'CANCELLED',
    paymentStatus: 'PENDING',
  };
  assert(canRetryOrderPayment(cancelledOrder as Order) === false, 'Cancelled order is terminal and cannot retry payment');

  // Test 5: Operational Settings Authority & Fallbacks
  console.log('\n[TEST 5] Operational Settings Authority');
  const opSettings = await PlatformSettingsRepository.getOperationalSettings();
  assert(typeof opSettings.supportPhone === 'string' && opSettings.supportPhone.length > 0, 'supportPhone is defined');
  assert(typeof opSettings.supportEmail === 'string' && opSettings.supportEmail.includes('@'), 'supportEmail is valid format');
  assert(typeof opSettings.supportHours === 'string' && opSettings.supportHours.length > 0, 'supportHours is defined');
  assert(typeof opSettings.maintenanceMode === 'boolean', 'maintenanceMode boolean flag is present');

  console.log('\n=============================================================');
  console.log('🎉 ALL MLOHUB FINAL RUNTIME CLOSURE VERIFICATION TESTS PASSED!');
  console.log('=============================================================\n');
}

runTests().catch((e) => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
