# MloHub Payment Provider Assets & Mobile-Money System

## 1. Directory Structure

Official mobile-money operator brand assets are located in:
```
assets/payments/
├── mpesa.png           # Vodacom M-Pesa official logo
├── airtel-money.png    # Airtel Money official logo
├── mixx-by-yas.png     # Mixx by Yas (Tigo Pesa) official logo
└── halopesa.png        # Halotel HaloPesa official logo
```

### Current Status Audit

```
FOUND:
(none)

MISSING:
- assets/payments/mpesa.png
- assets/payments/airtel-money.png
- assets/payments/mixx-by-yas.png
- assets/payments/halopesa.png
```

> [!IMPORTANT]
> Logos are an **external asset dependency**. Payment branding is classified as **PARTIAL** until the four official carrier PNG files are provided by the client/design team. Under no circumstances should placeholder, fake, or scraped logos be bundled. The clean neutral vector fallback is used in the interim.

---

## 2. Operator Specifications

MloHub strictly supports the **4 canonical mobile-money providers in Tanzania**:

| Provider Code | Display Name | Carrier | Brand Color | USSD Code | Official Asset |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `MPESA` | **M-Pesa** | Vodacom Tanzania | `#E60000` (Red) | `*150*00#` | `assets/payments/mpesa.png` |
| `AIRTEL_MONEY` | **Airtel Money** | Airtel Tanzania | `#ED1B24` (Airtel Red) | `*150*60#` | `assets/payments/airtel-money.png` |
| `MIXX_BY_YAS` | **Mixx by Yas** | Tigo / Yas | `#007A87` (Teal) | `*150*01#` | `assets/payments/mixx-by-yas.png` |
| `HALOPESA` | **HaloPesa** | Halotel Tanzania | `#FF6600` (Orange) | `*150*88#` | `assets/payments/halopesa.png` |

> [!NOTE]
> Non-canonical payment methods (`CARD`, `CASH_ON_DELIVERY`, `EZYPESA`) are strictly excluded from the customer checkout flow to prevent payment failure and chargeback risks.

---

## 3. Recommended Asset Specifications

When replacing or updating operator logos in `assets/payments/`:
- **Format**: PNG with alpha transparency (`image/png`).
- **Dimensions**: $128 \times 128 \text{ px}$ (or $256 \times 256 \text{ px}$ for @2x / @3x high-DPI displays).
- **Aspect Ratio**: $1:1$ (square) or rectangular centered in a square canvas.
- **Background**: Transparent.
- **Maximum File Size**: $< 50 \text{ KB}$ per asset.

---

## 4. Neutral Fallback System (`PaymentProviderLogo.tsx`)

To ensure flawless offline and pre-asset rendering without visual broken-image states or emoji cliches:

1. **Zero Emoji Branding**: MloHub strictly forbids using emojis (`🔴`, `🔵`, `🟠`, etc.) as telecom provider representations.
2. **Dynamic Fallback**: If an image asset is absent or fails to load, `PaymentProviderLogo.tsx` automatically renders:
   - A styled rounded container tinted with the operator's brand accent color.
   - An accessible vector wallet icon (`Ionicons name="wallet-outline"`).
   - A distinct carrier letter badge (e.g., **"M"** for M-Pesa, **"A"** for Airtel, **"Y"** for Mixx by Yas, **"H"** for HaloPesa).
3. **Accessibility**: Every logo component includes `accessibilityRole="image"` and an accessible `accessibilityLabel`.

---

## 5. Security & Customer PIN Protection

> [!CAUTION]
> **Strict PIN Rule**: MloHub **NEVER** asks for, accepts, or stores customer mobile-money PINs.

- Customer mobile numbers are normalized to E.164 (`+255XXXXXXXXX`).
- USSD push requests are dispatched via ClickPesa or direct telco gateway.
- Customers enter their personal PIN **exclusively** within the secure telco prompt on their mobile device.
- All checkout interfaces display bilingual security notices:
  - *EN*: `"Security Notice: MloHub will never ask for or store your mobile-money PIN. Enter your PIN exclusively on your telecom pop-up or official USSD prompt."*
  - *SW*: *"Usalama wa Mteja: MloHub haitawahi kukuomba au kuhifadhi PIN yako ya simu. Weka PIN yako pekee kwenye ujumbe rasmi wa mtandao wako wa simu."*
