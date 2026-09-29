# MloHub focused closure report — 2026-09-28

Overall: PARTIAL. Source corrections delivered; not certified production-ready. No percentage is assigned. The approximate 15-minute target was exceeded during review, verification and packaging. No Administrator-platform work was started.

Baseline: MloHub_FINAL_INTERNATIONAL_REVIEW_2026-09-28_10-51-43.zip, located in the user's Downloads/MloHub_Expo 2 directory. Source was inspected directly. Existing historical reports are retained as baseline files and are not evidence of this pass's results.

## Checks actually run

| Check | Result and limits |
| --- | --- |
| npm run typecheck | PASS, including final source changes. |
| npm test | FAIL. Runs many existing suites, then stops in restaurantOnboardingTwoGate.test.ts because it expects an offline launch action to succeed. Those expectations are incompatible with fail-closed behavior. The full suite has not passed. Later changes also remove fabricated offline readiness and approval success; existing tests need corresponding revisions. |
| tsx tests/finalClosureFailClosed.test.ts | PASS. Tests unavailable payout create/default/disable, unavailable launch submission/approval/readiness, and eight customer visibility exclusions. Does not substitute for backend tests. |
| npm run security:test | Exit 0; 34 invariant checks passed. The live probe reports unreachable, despite printing CONNECTED in its summary. Live security verification is NOT established. |
| npm run production:check | Original command exited 0 while allMigrationsApplied=false. Fixed its exit condition and reran: exit 2. delivery_quotes, branch_delivery_pricing, api_rate_limits and security_events were unavailable. Read-only schema probes only. |
| npm run export:web | FAIL: production runtime requires a configured real Supabase instance. No secrets were copied into the project to bypass this. |
| npm run export:android | PASS at an intermediate revision. Subsequent repository/readiness and preflight changes passed final TypeScript checking, but export was not repeated. |

One initial typecheck invocation used the workspace parent and failed because package.json was absent; it was rerun successfully in the extracted project. Existing installed dependencies were reused through a workspace junction. No dependency install or modification was requested. Build outputs and the junction are excluded from delivery.

## Payment — PARTIAL
Existing payment authority/provider implementation preserved. Existing tests exercised webhook signatures, idempotency and paid-order financial calculations before the suite stopped. No real payment, refund, settlement or provider callback was performed. Provider contracts, credentials and end-to-end confirmation remain external acceptance items.

## Delivery — BLOCKED
Existing delivery implementation preserved. Production preflight cannot access required delivery_quotes and branch_delivery_pricing schema. Deploy and test migrations, fee quotation, service coverage and fulfillment before launch.

## Security — PARTIAL
Removed direct client fallback writes for restaurant archive, unarchive, suspension, reactivation and verification. Secure RPC errors now stop the action. Removed simulated verification-document upload/record success. New document insert policy requires pending, unreviewed metadata and owned application/restaurant linkage. Private merchant-verification storage and signed-access implementation retained; focused inspection found no public URL generation in MerchantVerificationService. This is not an exhaustive storage-policy or penetration audit. No legacy RestaurantCredentialsService was reintroduced.

## Restaurant Onboarding — PARTIAL
Two gates preserved. Server readiness now blocks absent operating hours, storefront image, verified contact, verified encrypted payout destination, confirmed delivery configuration and reviewed business/tax/food-operation documents. TIN text alone is insufficient. Logo remains a recommendation. Coordinates must be within geographic bounds and have an address. Readiness still evaluates existence of qualifying branch records rather than a comprehensive per-branch operational audit.

Approval requires GO_LIVE_REVIEW, rejects archived/suspended records, locks readiness source tables, reruns readiness and publishes within the transaction. Submission restricts starting states. Coarse table locks favor correctness but require staging concurrency/latency testing. Client readiness now maps actual server field names and does not fabricate offline 100% readiness. Verified phone requires the authenticated owner's confirmed phone to match an active branch's owner_phone; confirm this matches the intended business workflow.

## Restaurant Operations — PARTIAL
Kitchen and Home/Orders/Kitchen/Menu/More navigation preserved. Source retains canonical RESTAURANT_NEW_PAID_ORDER emission on confirmed payment. Duplicate/retry notification behavior still requires live transactional testing; source inspection alone does not establish exactly-once delivery.

## Menu/Modifiers/Media — PARTIAL
Menu modifier editor and media workflows preserved. No broad rewrite. Full device interaction, upload permission, modifier pricing and order snapshot regression testing remains outstanding.

## Branch/Location — PARTIAL
Preset-only location selection replaced with current GPS through existing expo-location, optional native reverse geocoding, editable coordinates and full address, map preview link and explicit storefront entrance confirmation. No new dependency. It does not embed a draggable map; permission-denied and web users can enter exact coordinates. Uses theme action colors. Typechecked; no visual/device QA was available. Address/coordinate truth still requires merchant/admin verification.

## Finance/Payouts — BLOCKED pending backend deployment
New server-only RPC encrypts identifiers with pgcrypto AES-256 symmetric encryption using a Supabase Vault secret. No raw identifier is written by the replacement RPC to encrypted_account_reference. Legacy unprefixed records are encrypted transactionally and downgraded to PENDING_VERIFICATION. Creation no longer claims ownership verification. Service-role-only creation prevents caller spoofing through p_created_by; the Edge Function authenticates and authorizes the merchant first. Error responses no longer echo server exception details; masking cannot expose the full short identifier. Bank input maps to the existing BANK database enum.

Save/default/disable actions fail closed when unavailable. Real-mode financial summary errors no longer appear as a zero balance. Existing explicit demo fixtures remain; this was not a proof that every financial display is free of demo data.

Before applying migration 20260928000500_final_restaurant_closure.sql: provision a high-entropy secret named mlohub_payout_encryption_key in Supabase Vault (at least 32 characters); verify pgcrypto is installed in extensions and Vault is available. Never put the key in frontend config, source control or the patch. Existing raw rows make migration fail atomically if the key is absent. Back up the database and rehearse migration/rollback in staging. SQL was NOT executed or parsed against PostgreSQL in this pass.

Secure provider-worker decryption, key rotation, recovery procedures, destination ownership verification and real disbursement acceptance remain unimplemented/unverified. The patch deliberately leaves new destinations pending; payouts and launch submission remain blocked until authoritative verification exists. Do not manually mark them verified merely to bypass readiness.

## Restaurant UX — PARTIAL
Location action colors use MloHub tokens. Other theme/auth/cart workflows preserved. Customer service listing/detail and repository list/bookable use stricter published/verified/active/not-suspended checks. Missing-schema fallback no longer relaxes launch gates. A restrictive restaurant SELECT policy and updated existing security-definer discovery functions add the launch gate. Complete enumeration and live authorization testing of every customer query path remain outstanding; privileged historical-order/merchant access intentionally remains distinct.

## Remaining external blockers and application
1. Apply the patch to the exact baseline source using the supplied script; it refuses divergent source hashes, backs up replacements and stops on the first failed verification. The known legacy test failure will stop later checks. No automatic rollback is attempted; the backup records replaced and newly added paths.
2. Configure the Vault secret securely, test/deploy the new migration after all prior migrations, and deploy create-payout-destination. Copying source files alone does not change backend behavior. No deployment was performed.
3. Complete payout verification/decryption integration and actual provider tests; verify legal document requirements for the operating market.
4. Resolve missing backend schema and production web configuration. Update obsolete offline-success tests and run the complete suite, exports and device QA.

Delivery archives exclude .env files, dependency folders, Git metadata, caches, build outputs, logs and recognizable credential/key files. production-public.json is also excluded as environment-specific configuration; retain the existing local configuration. Historical source migrations are preserved; the new migration supersedes their vulnerable definitions only when deployed. These are reviewable source corrections, not a claim of full launch acceptance.
