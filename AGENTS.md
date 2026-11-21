# MloHub AI Agent Rules & Architecture Guide

This document is the authoritative guide that every AI assistant must read first before modifying any part of MloHub. Changes must stay safe, secure, responsive, and consistent.

---

## 1. Stack

- **Framework**: Expo SDK 57 (`~57.0.26`), React Native 0.86 (`0.86.3`), Expo Router (`~57.0.24`)
- **Languages**: TypeScript (`~6.0.3`, strict mode), React 19 (`19.2.3`), SQL (PostgreSQL), Deno (Supabase Edge Functions)
- **Backend & Database**: Supabase (Postgres with strict Row-Level Security, GoTrue Auth, Realtime, Storage)
- **Platform Strategy**: Unified cross-platform codebase targeting Web, Android, and iOS from one codebase, with dedicated native flavor builds (Customer, Restaurant Partner, Admin)

---

## 2. Folder Map

- `android/`: Android native project files, Gradle configuration, and native variant bridge modules.
- `app/`: Expo Router file-based screens and routes (customer tabs, auth, admin, partner, restaurant-portal).
- `assets/`: Static media, app icons, splash screens, and payment provider PNG logos.
- `components/`: Reusable modular UI components partitioned by domain (checkout, restaurant, admin, payments, ui).
- `config/`: Platform constants, ranking formulas, fee configurations, and trust rules.
- `constants/`: Global constants including payment methods, branch presets, and portal metadata.
- `context/`: React context providers (Auth, Theme, Language, Cart, CustomerLocation, Notifications).
- `db/`: Offline/local database abstractions, schema interfaces, and seed datasets.
- `demo/`: Standalone demo fixtures, mock accounts, and interactive showcase utilities.
- `hooks/`: Custom React hooks for responsive breakpoints, debouncing, and state helpers.
- `lib/`: Core helpers for Supabase clients, platform variant routing, storage adapters, and test bootstrap.
- `public/`: Web static assets, manifest, robots.txt, and favicons.
- `repositories/`: Data access layer interfacing Supabase tables, RPCs, and query models.
- `scripts/`: Build automation, preflight checks, logo conversion, and verification scripts.
- `services/`: Business logic, payment gateways, realtime subscriptions, and external API connectors.
- `supabase/`: Backend database migrations (`supabase/migrations/`) and Deno edge functions (`supabase/functions/`).
- `tests/`: Automated unit, integration, security, and closure test suites.
- `theme/`: Design system tokens (colors, typography, spacing, shadows, radii, motion).
- `types/`: Domain, auth, admin, realtime, and analytics TypeScript type definitions.
- `utils/`: Pure helper functions for formatting, phone normalization, geo-distance, and URLs.

---

## 3. Commands & Environments

- `npm run typecheck`: Runs `tsc --noEmit`. Must pass with 0 errors. No env vars required.
- `npm test`: Runs master test suite (`tsx tests/runAllSuites.ts`). Uses test bootstrap defaults (`lib/testEnv.ts`).
- `npm run build`: Exports web platform build (`expo export --platform web`). For production builds, run `npm run production:build` which requires `EXPO_PUBLIC_APP_ENV=production`, `EXPO_PUBLIC_SUPABASE_URL`, and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- `npm run e2e:*`: Executes domain-specific E2E suites (`e2e:orders`, `e2e:auth`, `e2e:pack4a`–`e2e:pack4f`, `e2e:all`).
  - **Required Env Vars**: `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (defaults to local `http://127.0.0.1:54321` via `lib/e2eBootstrap.js`).
  - Privileged backend flows also require `SUPABASE_SERVICE_ROLE_KEY`.

---

## 4. Hard Rules (Non-Negotiable)

1. **Server-Authoritative Pricing**: Prices and order totals are computed on the server (`create_order_secure`). Never trust totals from the app.
2. **Payment Gateway Isolation**: Payments only go through `supabase/functions` (`create-payment`, `payment-webhook`). Never call a gateway from the app.
3. **Strict Row-Level Security (RLS)**: Never weaken or remove row-level security. Every new table gets RLS plus explicit policies in a NEW migration. Never edit an old migration.
4. **Integer Currency**: All money is integer TZS.
5. **Bilingual Localization**: Every customer- or restaurant-facing text goes through the language system (English + Swahili). No hard-coded UI strings.
6. **Zero Client Secrets**: Nothing secret in `EXPO_PUBLIC_` variables. Only public endpoints and publishable anon keys may carry the `EXPO_PUBLIC_` prefix.
7. **Clean Production Builds**: Demo code and fixtures must never ship in the production build.
8. **File Size Limits**: New files stay under 400 lines. Don't add to files that are already over 800 lines; extract instead.
9. **Behavioral Testing**: Never write tests that only check a file contains some text. Tests must exercise behaviour.

---

## 5. Definition of Done

A task is complete only when:
1. `npm run typecheck` passes with zero errors.
2. The changed screen is checked on a 360 px phone width and a 1,280 px laptop width.
3. The commit message says what changed and why.
