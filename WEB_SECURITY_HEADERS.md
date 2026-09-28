# MloHub Production Web Security Headers Specification

## 1. Overview
This specification details the mandatory HTTP response headers for all web deployments of the MloHub platform (Web App, Customer Portal, Restaurant Portal, and Admin Portal). These headers mitigate common web vulnerabilities including Cross-Site Scripting (XSS), Clickjacking, Cross-Site Request Forgery (CSRF), MIME-sniffing, and SSL stripping.

---

## 2. Canonical Security Headers Matrix

| Header | Production Directive | Rationale & Protection |
| :--- | :--- | :--- |
| **`Content-Security-Policy`** | `default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://routes.googleapis.com https://*.selcom.net https://*.clickpesa.com; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self';` | Prevents cross-site script injection, restricts network data egress to authorized payment/map backends, and blocks unauthorized framing. |
| **`Strict-Transport-Security`** | `max-age=63072000; includeSubDomains; preload` | Enforces TLS 1.3 across all subdomains for 2 years (HSTS preload eligible). Prevents man-in-the-middle downgrade attacks. |
| **`X-Frame-Options`** | `DENY` | Completely blocks embedding MloHub inside `<iframe>`, `<frame>`, or `<object>`, neutralizing clickjacking attacks against user and admin portals. |
| **`X-Content-Type-Options`** | `nosniff` | Disables browser MIME-type sniffing, preventing executable file upload exploits and malicious script execution disguised as images. |
| **`Referrer-Policy`** | `strict-origin-when-cross-origin` | Protects sensitive URL parameters and session tokens by stripping paths when navigating cross-origin. |
| **`Permissions-Policy`** | `camera=(), microphone=(), geolocation=(self), payment=(self), usb=(), screen-wake-lock=(self)` | Restricts browser device hardware APIs. Disables camera and microphone globally; restricts geolocation and payment to the application origin. |
| **`Cross-Origin-Opener-Policy`** | `same-origin` | Isolates the browsing context, preventing Spectre-style cross-origin process attacks and cross-window manipulation. |
| **`Cross-Origin-Resource-Policy`** | `same-origin` | Restricts resources (images, scripts, bundles) from being read by unauthorized third-party origins. |
| **`X-Permitted-Cross-Domain-Policies`** | `none` | Prevents Adobe Flash and PDF cross-domain document loads. |

---

## 3. Server & Hosting Configuration Snippets

### A. Vercel Deployment (`vercel.json`)
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://routes.googleapis.com https://*.selcom.net https://*.clickpesa.com; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self';"
        },
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=63072000; includeSubDomains; preload"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "Permissions-Policy",
          "value": "camera=(), microphone=(), geolocation=(self), payment=(self)"
        },
        {
          "key": "Cross-Origin-Opener-Policy",
          "value": "same-origin"
        },
        {
          "key": "Cross-Origin-Resource-Policy",
          "value": "same-origin"
        }
      ]
    }
  ]
}
```

### B. Nginx Reverse Proxy (`/etc/nginx/conf.d/mlohub.conf`)
```nginx
server {
    listen 443 ssl http2;
    server_name mlohub.co.tz admin.mlohub.co.tz;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security Headers
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://routes.googleapis.com https://*.selcom.net https://*.clickpesa.com; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self';" always;
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=(self), payment=(self)" always;
    add_header Cross-Origin-Opener-Policy "same-origin" always;
    add_header Cross-Origin-Resource-Policy "same-origin" always;

    location / {
        root /var/www/mlohub/dist;
        try_files $uri $uri/ /index.html;
    }
}
```

### C. Cloudflare Pages (`_headers`)
```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://routes.googleapis.com https://*.selcom.net https://*.clickpesa.com; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self';
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(self), payment=(self)
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-origin
```

---

## 4. Native Mobile Considerations (React Native / Expo)
1. **No Browser Header Vulnerabilities**: Native Android and iOS binary execution does not expose traditional browser DOM vulnerabilities like MIME-sniffing or cross-origin frame embedding.
2. **Encrypted Storage**: Web sessions leverage browser `localStorage` or memory fallback, while native builds securely isolate session keys via AES-256 encrypted Android KeyStore / iOS Keychain (`expo-secure-store`).
3. **Restricted CORS**: Mobile network requests from native apps transmit no web `Origin` header. Supabase Edge Functions permit direct mobile API access while strictly enforcing origin whitelisting when web browsers connect.
