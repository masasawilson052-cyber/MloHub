# MloHub Themes & Password Recovery — Production Checklist

This checklist separates items that are **code-verified in the repository** (`VERIFIED`) from external hosted infrastructure settings that must be applied in the **Supabase Dashboard / DNS / SMTP Provider** (`REQUIRES DASHBOARD ACTION`).

---

## 1. Repository & Application Code (`VERIFIED`)

| Item | Status | Verification Proof |
| :--- | :--- | :--- |
| **Fresh-install default theme is `LIGHT`** | `VERIFIED` | `theme/palettes.ts` (`migrateAndLoadThemePreference` returns `'LIGHT'` when storage is empty) & `context/ThemeContext.tsx` (`getInitialSyncWebMode()` returns `'LIGHT'`). |
| **Returning user preference persistence (`mlohub_theme_mode`)** | `VERIFIED` | `theme/palettes.ts` & `context/ThemeContext.tsx` persist `'LIGHT'`, `'DARK'`, or `'SYSTEM'` and migrate legacy `mlohub_admin_theme_mode`. |
| **Zero Light-flash on native startup** | `VERIFIED` | `app/_layout.tsx` holds `SplashScreen.preventAutoHideAsync()` until `isThemeHydrated` is `true` (with a 1200ms safety fallback) and syncs native `Appearance.setColorScheme` + `SystemUI.setBackgroundColorAsync`. |
| **Global top-right `ThemeQuickSwitcher` across all portals** | `VERIFIED` | Mounted in `app/(tabs)/_layout.tsx` (Customer Mobile across all 6 tabs), `components/navigation/CustomerDesktopNav.tsx`, `components/restaurant/RestaurantPortalHeader.tsx`, and `components/admin/AdminHeader.tsx`. |
| **Zero light-only structural surfaces in Dark mode** | `VERIFIED` | Enforced by `tests/themeVisualClosure.test.ts` across Customer, Restaurant, Admin, and Auth screens. |
| **Supabase client explicit PKCE flow (`flowType: 'pkce'`)** | `VERIFIED` | `lib/supabase.ts` sets `flowType: 'pkce'` on `createClient(...)`. |
| **Web + Native password recovery URL & PKCE code handling** | `VERIFIED` | `utils/authUrls.ts` (`getPasswordResetRedirectUrl`, `extractPkceCodeFromResetInput`) and `app/auth/reset-password.tsx` (`expo-linking` + `useLocalSearchParams` + single `exchangeCodeForSession`). |
| **Strict recovery session gating** | `VERIFIED` | `app/auth/reset-password.tsx` only unlocks on `event === 'PASSWORD_RECOVERY'` or valid PKCE `exchangeCodeForSession(code)` — ordinary `SIGNED_IN` / `getSession()` sessions cannot unlock password reset. |
| **Local Supabase CLI config (`supabase/config.toml`)** | `VERIFIED` | `minimum_password_length = 10`, `additional_redirect_urls` includes web + `mlohub://auth/reset-password`, `[local_smtp]` sets `sender_name = "MloHub"`, and `[auth.email.template.recovery]` points to `./supabase/templates/recovery.html`. |

---

## 2. Hosted Supabase Dashboard & Production SMTP (`REQUIRES DASHBOARD ACTION`)

Because `supabase/config.toml` only governs the local Supabase CLI stack (`supabase start`), the following settings **must be configured manually** in the hosted Supabase project (`https://supabase.com/dashboard/project/jjqjTP...`):

| Hosted Setting | Status | Required Dashboard Configuration |
| :--- | :--- | :--- |
| **Authentication → URL Configuration → Site URL** | `REQUIRES DASHBOARD ACTION` | Set **Site URL** to `https://mlohub.expo.app` |
| **Authentication → URL Configuration → Redirect URLs** | `REQUIRES DASHBOARD ACTION` | Add exact allow-listed URLs:<br/>• `https://mlohub.expo.app/auth/reset-password`<br/>• `mlohub://auth/reset-password`<br/>• `http://127.0.0.1:5512/auth/reset-password`<br/>• `http://localhost:5512/auth/reset-password` |
| **Authentication → Providers → Email → Minimum Password Length** | `REQUIRES DASHBOARD ACTION` | Set **Minimum password length** to `10` characters to match `supabase/config.toml` and client validation. |
| **Authentication → Email Templates → Reset Password** | `REQUIRES DASHBOARD ACTION` | Set **Subject heading** to `Reset your MloHub password` and paste the contents of `supabase/templates/recovery.html` into the **Message body (HTML)** editor. |
| **Project Settings → Authentication → SMTP Settings** | `REQUIRES DASHBOARD ACTION` | Enable **Custom SMTP** with production credentials:<br/>• **Sender email**: `no-reply@mlohub.co.tz`<br/>• **Sender name**: `MloHub`<br/>• **Host / Port / Username / API Key**: Production transactional email provider (e.g., Resend / SendGrid / Postmark) with verified SPF, DKIM, and DMARC records for `mlohub.co.tz`. |
