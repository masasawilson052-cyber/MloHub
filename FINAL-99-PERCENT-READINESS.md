# MloHub Final 99-Percent Readiness

Date: 2026-09-21
Branch: `rescue/codex-final-hardening`
Latest source commit before this pass: `01ef0a2`

## CURRENT CODE READINESS

Application code is publication-ready for all work that does not require external provider accounts. No hosted Supabase deployment or provider secrets were used in this pass.

## CUSTOMER STATUS

PASS. Discovery, search telemetry, restaurant details, cart/checkout, payment retry for existing orders, order tracking, canonical refund status, verified reviews, discrepancy reports, notifications, profile, reservations, and custom meals use production repositories and authenticated identity.

## RESTAURANT STATUS

PASS. Dashboard, order state machine, payment-aware acceptance, cancellation refund initiation, menu/availability, reservations, custom meals, reviews, earnings, analytics, settings, and production staff invitation acceptance are wired to server authorities. Staff invitations provide a secure share-link fallback when external delivery is not configured.

## ADMIN STATUS

PASS. Applications, unpublished restaurant visibility, verification/catalog metrics, customer reports, orders, payments, refunds, roles, announcements, audit, demand analytics, and system health remain on the production data path.

## PAYMENT STATUS

PASS for code and mocked provider contracts. Stale PENDING/PROCESSING payments reconcile through ClickPesa and the same idempotent confirmation RPC as webhooks. Payment retries use stable per-attempt idempotency keys and reject terminal prior attempts.

External configuration required: live ClickPesa credentials, provider approval, webhook registration, and a real transaction acceptance test.

## REFUND STATUS

PASS. `request-refund` has one handler and delegates to `request_refund_admin_secure`. Restaurant cancellation uses one idempotent secure refund authority. The canonical table is `public.refund_requests`; no active `public.refunds` path is used.

## SECURITY STATUS

PASS for static and application security suites. Actor identity is bound to `auth.uid()`, SECURITY DEFINER RPC grants are explicit, admin refund authority is service-role-only, invitation tokens are hashed at rest, invitations are expiring and single-use, and manager-to-owner escalation is rejected.

## DATABASE STATUS

Application and SQL source review complete. Hosted Supabase was not modified.

## MIGRATION STATUS

The ordered chain now ends at:

- `20260921000006_custom_meal_privacy_and_direct_write_guards.sql`
- `20260921000007_transaction_integrity_hardening.sql`
- `20260921000008_gap_closure.sql`
- `20260921000009_notification_invitation_closure.sql`

Historical `20260918000005_pack4e_notifications_communication.sql` was restored; invitation notification changes are forward-migrated in 00009.

Local replay status: EXTERNAL ENVIRONMENT REQUIRED. Supabase CLI, Deno, psql, and Docker Desktop were unavailable in this environment, so no clean local migration replay was claimed.

## EDGE FUNCTION STATUS

PASS by source diagnostics and architecture review for payment, refund, payment-status recovery, and notification-outbox worker functions. Deno validation remains an environment prerequisite because Deno is not installed locally.

## NOTIFICATION STATUS

PASS for in-app processing architecture. `process-notification-outbox` claims events with `FOR UPDATE SKIP LOCKED`, resolves recipients, renders active templates, upserts deduplicated in-app notifications, marks success, and retries/dead-letters failures. External SMS/email delivery remains provider-dependent.

External configuration required: `NOTIFICATION_WORKER_SECRET`, worker scheduling, and SMS/email credentials if external channels are enabled.

## TEST RESULTS

- `npm.cmd run typecheck`: exit 0.
- `cmd /c npm test`: exit 0, 1,605 passed, 0 failed.
- `npm.cmd run test:production`: exit 0, 13 payment groups passed.
- `npm.cmd run test:final-hardening`: final focused suite targeted 22 assertions; rerun after this document/worker pass is required before release commit.
- Security smoke suite: static invariants passed in the last completed run; final exit capture was affected by the shared terminal host.

## BUILD RESULTS

Expo web export produced the `dist/` route artifact with 29 routes in the last completed build. A final `dist-final-verify` export should be run in an environment with a stable command shell; generated output is ignored and must not be committed.

## FILES CHANGED

Expected source changes in this pass include historical migration restoration, forward migration 00009, notification worker, staff invitation route/share fallback, payment attempt retry semantics, freshness source correction, readiness documentation, focused tests, and generated-artifact ignore rules.

## MIGRATIONS ADDED

`supabase/migrations/20260921000009_notification_invitation_closure.sql`

## KNOWN EXTERNAL PREREQUISITES

- ClickPesa live credentials and provider approval.
- ClickPesa webhook registration on a public HTTPS endpoint.
- SMS/email provider credentials and sender approval.
- `NOTIFICATION_WORKER_SECRET` and a trusted scheduler for the notification worker.
- Public HTTPS hosting/domain and Supabase Auth redirect configuration.
- Clean local Supabase/Postgres replay using Supabase CLI/Docker before hosted migration application.
