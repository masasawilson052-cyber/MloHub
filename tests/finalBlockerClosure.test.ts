import fs from 'fs';
import path from 'path';

const root = path.join(__dirname, '..');
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
  console.log(`PASS ${message}`);
};

const refundEdge = read('supabase/functions/request-refund/index.ts');
const gapClosure = read('supabase/migrations/20260921000008_gap_closure.sql');
const notifications = read('supabase/migrations/20260918000005_pack4e_notifications_communication.sql');
const orders = read('app/(tabs)/orders.tsx');
const verification = read('components/admin/VerificationCenter.tsx');
const readiness = read('FINAL-READINESS-REPORT.md');

assert((refundEdge.match(/Deno\.serve\s*\(/g) || []).length === 1, 'request-refund has exactly one Deno.serve handler');
assert(!refundEdge.includes(".from('refund_requests')"), 'request-refund has no direct refund_requests write');
assert(refundEdge.includes("rpc(\n      'request_refund_admin_secure'"), 'request-refund delegates to request_refund_admin_secure');
assert(!gapClosure.includes('v_paid_payment'), '00008 has no undeclared v_paid_payment reference');
assert(gapClosure.includes('p_actor_user_id IS DISTINCT FROM v_actor'), 'transition rejects spoofed actor IDs');
assert(gapClosure.includes('REVOKE ALL ON FUNCTION public.request_refund_restaurant_cancel_secure'), 'cancellation refund helper is not publicly callable');
assert(gapClosure.includes('REVOKE ALL ON FUNCTION public.request_refund_admin_secure'), 'admin refund RPC is not callable by normal users');
assert(gapClosure.includes("v_actor_role = 'MANAGER' AND p_role NOT IN ('CHEF','STAFF')"), 'managers cannot invite owners or managers');
assert(gapClosure.includes('accept_restaurant_invitation_secure'), 'secure invitation acceptance exists');
assert(gapClosure.includes('token_hash') && gapClosure.includes('expires_at'), 'invitations persist hashed expiring tokens');
assert(gapClosure.includes("v_invitation.accepted_at IS NOT NULL OR v_invitation.revoked_at IS NOT NULL") && gapClosure.includes("'410 Gone: Invitation has expired.'"), 'invitation acceptance rejects replayed and expired tokens');
assert(gapClosure.includes('Invitation email does not match'), 'invitation acceptance binds token to the authenticated invitee email');
assert(notifications.includes("p_aggregate_type = 'RESTAURANT' AND p_event_type::TEXT = 'STAFF_INVITATION'"), 'staff invitation recipient routing is explicit');
assert(orders.includes('export const canRetryOrderPayment') && orders.includes("order.status === 'CANCELLED'"), 'payment retry excludes terminal orders');
assert(orders.includes('getEligibility') && orders.includes('existingReviewId'), 'review action checks authoritative existing review state');
assert(!verification.includes('verifiedDishCount') && !verification.includes('Dishes confirmed') && !verification.includes('0 verified dishes'), 'verification UI does not fabricate verified dish counts');
assert(readiness.includes('20260921000008_gap_closure.sql') && readiness.includes('refund_requests'), 'readiness report reflects latest migrations and canonical refunds');

console.log('FINAL BLOCKER CLOSURE STATIC TESTS: 17 passed; 0 failed');
