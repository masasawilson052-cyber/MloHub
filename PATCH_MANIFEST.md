# Patch manifest

Baseline: MloHub_FINAL_INTERNATIONAL_REVIEW_2026-09-28_10-51-43.zip.

| File | Action | Reason |
| --- | --- | --- |
| repositories/payouts.repository.ts | ADD | Fail closed on payout actions and real-mode finance errors. |
| repositories/restaurants.repository.ts | ADD | Remove privileged fallbacks, enforce customer visibility, fix readiness mapping and offline false success. |
| services/RestaurantService.ts | ADD | Apply the strict customer listing and detail predicate. |
| supabase/migrations/20260928000500_final_restaurant_closure.sql | ADD | Server encryption, pending payout verification, document policies, atomic launch gates and discovery restrictions. |
| components/restaurant/BranchLocationPickerModal.tsx | ADD | GPS/manual exact address selection, map preview, explicit confirmation and theme tokens. |
| supabase/functions/create-payout-destination/index.ts | ADD | Prevent identifier exposure through masking and detailed server errors. |
| services/MerchantVerificationService.ts | ADD | Reject unavailable document upload/record persistence. |
| scripts/production-preflight.cjs | ADD | Exit nonzero when any required migration schema is unavailable. |
| tests/finalClosureFailClosed.test.ts | ADD | Targeted behavioral failure and customer visibility tests. |

Package-only additions: PATCH_MANIFEST.md (this list), MLOHUB_FINAL_CLOSURE_REPORT.md (findings and limitations), apply-mlohub-patch.ps1 (safe installer), patch-files.json (original and replacement SHA-256 hashes). These are not copied into the application by the installer.

Extract the patch ZIP into a separate directory. Run apply-mlohub-patch.ps1 -ProjectRoot with the absolute path to your existing MloHub project. It refuses modified baseline files and stops on verification failure. Configure and deploy the backend separately as described in the report.

