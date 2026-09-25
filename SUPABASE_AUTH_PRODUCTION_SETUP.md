# MloHub — Hosted Supabase Auth & Branded Password Recovery Setup

This checklist documents the exact **Hosted Supabase Dashboard** configuration required so that:
1. Password recovery emails open `https://mlohub.expo.app/auth/reset-password` on any mobile phone or laptop (never `127.0.0.1`).
2. Emails display **MloHub** as the sender name instead of `Supabase Auth`.
3. Emails use the branded **MloHub** HTML templates and subject lines.

> **Important Truth Notice**: Hosted Supabase Dashboard settings (`URL Configuration`, `Email Templates`, and `Custom SMTP`) live in your remote Supabase project (`rrebkpeumvqffuwtqvje`) and must be applied in the Supabase Dashboard by an authorized project administrator.

---

## Step 1 — URL Configuration (Critical for Mobile & Cross-Device Reset)

1. Open the **Supabase Dashboard** for your project.
2. Navigate to **Authentication** → **URL Configuration**.
3. Set **Site URL** to:
   ```text
   https://mlohub.expo.app
   ```
4. Under **Redirect URLs**, add:
   ```text
   https://mlohub.expo.app/auth/reset-password
   https://mlohub.expo.app/**
   mlohub://auth/reset-password
   ```
5. *(Optional — Local Same-Computer Development Only)*:
   ```text
   http://127.0.0.1:5512/**
   http://localhost:5512/**
   ```
6. Click **Save**.

> Why this matters: If `https://mlohub.expo.app/auth/reset-password` is not in the Redirect URLs allowlist, or if Site URL is set to `http://127.0.0.1:5512`, Supabase Auth will fall back to the Site URL and generate `127.0.0.1` links that fail with `ERR_CONNECTION_REFUSED` when opened on a phone.

---

## Step 2 — Branded Recovery & Security Email Templates

1. In the **Supabase Dashboard**, navigate to **Authentication** → **Email Templates**.
2. Select **Reset Password**:
   - **Subject heading**:
     ```text
     Reset your MloHub password
     ```
   - **Message body (Source HTML)**:
     Copy and paste the contents of [`supabase/templates/recovery.html`](./supabase/templates/recovery.html).
   - Ensure the button link uses `{{ .ConfirmationURL }}`.
   - Click **Save**.
3. Apply the matching MloHub templates for consistency across all security emails:
   - **Confirm signup**:
     - Subject: `Confirm your MloHub account`
     - Body: [`supabase/templates/confirmation.html`](./supabase/templates/confirmation.html)
   - **Change Email Address**:
     - Subject: `Confirm your MloHub email change`
     - Body: [`supabase/templates/email_change.html`](./supabase/templates/email_change.html)
   - **Invite user**:
     - Subject: `You have been invited to MloHub`
     - Body: [`supabase/templates/invite.html`](./supabase/templates/invite.html)
   - **Password Changed Notification** (if enabled under Security Notifications):
     - Subject: `Your MloHub password was changed`
     - Body: [`supabase/templates/password_changed_notification.html`](./supabase/templates/password_changed_notification.html)

---

## Step 3 — Custom SMTP Settings (Required for Sender Name: `MloHub`)

Email HTML templates cannot change the `From:` display name. Without Custom SMTP, Supabase's built-in mail service sends as `Supabase Auth`.

1. In the **Supabase Dashboard**, navigate to **Authentication** → **SMTP Settings** (or **Project Settings** → **Authentication** → **SMTP Settings**).
2. Enable **Custom SMTP**.
3. Configure your verified transactional email provider (e.g., Resend, Brevo, SendGrid, Amazon SES, Postmark, or Zoho Mail):
   - **Sender name**:
     ```text
     MloHub
     ```
   - **Sender email**:
     Use an email address on a domain MloHub owns and has verified with your SMTP provider (for example `security@mlohub.co.tz` or `no-reply@mlohub.co.tz`).
   - **Host / Port / Username / Password**:
     Enter the SMTP credentials from your email provider directly in the Supabase Dashboard.
4. **Security Rule**:
   - Never place `SMTP_PASSWORD`, `RESEND_API_KEY`, `BREVO_API_KEY`, `SENDGRID_API_KEY`, or any SMTP credentials in `.env`, `EXPO_PUBLIC_*`, or client code.

---

## Step 4 — End-to-End Verification on Mobile Phone

1. Open MloHub → **Sign In** → **Forgot password?**.
2. Enter your email address and tap **Send Reset Link**.
3. Verify the screen shows **Check Your Email** with the generic privacy-safe notice.
4. Open the email on your mobile phone:
   - **Sender**: `MloHub` (once Custom SMTP is active)
   - **Subject**: `Reset your MloHub password`
   - **CTA Button**: `Reset My Password`
5. Tap **Reset My Password**:
   - Browser opens `https://mlohub.expo.app/auth/reset-password` (never `127.0.0.1`).
   - MloHub automatically exchanges the recovery code and immediately displays **Create New Password**.
6. Enter a new password (10+ characters), confirm it, and tap **Update Password**.
7. Verify **Password Updated** appears, recovery session is signed out, and you can sign in with the new password while the old password is rejected.
