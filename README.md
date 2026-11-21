# MloHub

MloHub is a cross-platform food discovery, online ordering, and table reservation platform tailored for Dar es Salaam, Tanzania. It connects local diners with authentic restaurants, kitchen displays, and custom meal chef quotes across mobile and web interfaces.

---

## The Three Products

1. **Customer App** (`/`, `/(tabs)/*`):
   - Real-time restaurant discovery, categorized menus, and Swahili/English bilingual search across Dar es Salaam neighborhoods.
   - Interactive cart with server-authoritative delivery fee calculation, multi-carrier mobile money (M-Pesa, Airtel Money, Mixx by Yas, HaloPesa) and direct bank payments (CRDB SimBanking, NMB Mkononi).
   - Custom meal requests (*"Can't find it on the menu?"*), live quote bidding, and table bookings.

2. **Restaurant Partner Portal** (`/restaurant-portal`, `/partner`):
   - Kitchen display system (Kanban board: Accepted → Preparing → Ready → Completed).
   - Real-time order notifications with audio chime, menu management, stock availability toggles, and operating hours configuration.
   - Payout destination setup (Mobile Money / Bank Account) and net earnings ledger.

3. **Admin Portal** (`/admin`):
   - Platform operations, financial governance, merchant application verification, and audit logs.
   - 2-factor MFA challenge gating, settlement management, and real-time payment monitoring.

---

## Technology Stack

- **Frontend**: Expo SDK 57 (`~57.0.26`), React Native 0.86 (`0.86.3`), Expo Router (`~57.0.24`), TypeScript strict mode, React 19.
- **Backend & Database**: Supabase (PostgreSQL with strict Row-Level Security, GoTrue Auth, Realtime Postgres CDC, Storage).
- **Edge Functions**: Deno TypeScript functions (`supabase/functions/`) for server-side payment processing, payouts, SMS OTP, and delivery fee calculation.
- **Platforms**: Single unified codebase powering Web, Android, and iOS, with standalone Android product flavor APKs (`com.mlohub.app`, `com.mlohub.partner`, `com.mlohub.admin`).

---

## Folder Map

- `android/`: Android native project, Gradle configuration, and flavor variant modules.
- `app/`: Expo Router file-based screens and routes (customer tabs, auth, admin, partner).
- `assets/`: Static media, app icons, splash screens, and payment provider PNG logos.
- `components/`: Modular UI components organized by domain (checkout, restaurant, admin, payments, ui).
- `config/`: Platform constants, ranking formulas, fee structures, and trust rules.
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

## Setup & Environment

### 1. Prerequisites
- Node.js (v20+ recommended)
- npm

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Set your client-safe variables:
```ini
EXPO_PUBLIC_APP_ENV=development
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

> **Security Warning**: Never commit `.env` or any production secrets to Git. Only variables prefixed with `EXPO_PUBLIC_` are bundled into client code. Server-side keys (`SUPABASE_SERVICE_ROLE_KEY`, gateway secrets, SMS credentials) belong exclusively in Supabase Edge Function environment settings.

---

## Running the App

### Install Dependencies
```bash
npm install
```

### Start Local Development
- **Web**: `npm run web` (or `npx expo start --web`)
- **Android**: `npm run android`
- **iOS**: `npm run ios`
- **Expo Dev Server**: `npm start`

### Staging Demo Data Seed
Populate a staging Supabase project with 8 realistic Dar es Salaam restaurants, 72 verified dishes, operating hours, delivery zones, and test logins:
```bash
STAGING_SEED_CONFIRM=yes STAGING_DEFAULT_PASSWORD="YourPassword123!" npm run seed:staging
```
To reset only the seeded staging data:
```bash
STAGING_SEED_CONFIRM=yes npm run seed:staging -- --reset
```

---

## Testing & Quality

- **Typecheck**: `npm run typecheck` (runs `tsc --noEmit`)
- **Lint**: `npm run lint`
- **Unit & Security Tests**: `npm test` (runs `tsx tests/runAllSuites.ts`)
- **E2E Test Suites**:
  - `npm run e2e:orders` — Order pipeline and server authority tests
  - `npm run e2e:auth` — Real auth session tests
  - `npm run e2e:pack4a` — Custom meal workflow tests
  - `npm run e2e:pack4b` — Table reservation capacity tests
  - `npm run e2e:pack4c` — Financial authority and ledger tests
  - `npm run e2e:pack4d` — Reviews and trust metrics tests
  - `npm run e2e:pack4e` — Notifications and outbox tests
  - `npm run e2e:pack4f` — Restaurant operational flows tests
  - `npm run e2e:stage3` — Onboarding and registration tests
  - `npm run e2e:all` — Runs all E2E suites sequentially

---

## Build & Deployment

- **Web Export (Development)**: `npm run build`
- **Web Export (Production)**: `npm run production:build` (clears and compiles production web bundle to `dist-production/` and `dist/`)
- **Production Preflight Check**: `npm run production:check`
- **Production Preview**: `npm run production:preview`
- **Deploy to Production (Expo Hosting)**: `npm run deploy:prod` (builds fresh production web bundle and deploys via EAS Hosting to `https://mlohub.expo.app`)

---

## AI Agent Rules

All AI assistants and contributors must read and adhere to [AGENTS.md](AGENTS.md) (or [CLAUDE.md](CLAUDE.md)) before modifying this repository.
