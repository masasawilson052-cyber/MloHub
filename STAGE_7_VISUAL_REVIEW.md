# MloHub Stage 7: Admin Portal UI/UX & Visual Review

## 1. Executive Summary
The Stage 7 visual upgrade transforms the MloHub Platform Operations and Governance Control Center (`/admin`) from an overgrown 3,327-line single-file prototype into an enterprise-grade, responsive platform operations hub. Built upon MloHub Design System V2 tokens (`Colors`, `Typography`, `Spacing`, `Radii`, `Shadows`), the portal provides visual clarity and operational ergonomics for both desktop monitors (>840px) and mobile operator devices.

---

## 2. Layout & Responsive Viewport System

### Desktop / Large Screen Viewport (>840px)
- **Top Header (`AdminHeader.tsx`)**: Fixed height, white elevation with subtle bottom border (`#f1f5f9`). Left branding with primary orange shield icon, platform title, and live Realtime pulse badge (`REALTIME LIVE` in emerald green or `LOCAL BUS` in amber). Right user pill displays role tag (`SUPER ADMIN` in pink/purple, `ADMIN` in blue), full name, refresh button, customer view switcher, and logout button.
- **Left Navigation Sidebar (`AdminSidebar.tsx`)**: 260px fixed width, vertical scroll container. Grouped with high-contrast active tab state (`#fff7ed` warm orange background, bold text, primary orange icon). Displays real-time numeric badges for urgent items (e.g. pending applications, open data reports, stale menus).
- **Right Content Panel**: Clean slate-50 canvas (`#f8fafc`) with dynamic rendering of the selected operational view, maximizing screen real estate for data tables, card grids, and action panels.

### Mobile & Small Screen Viewport (<=840px)
- **Header**: Responsive flex-wrap keeping operator identity, Realtime status, and refresh button immediately reachable without horizontal clipping.
- **Horizontal Navigation Carousel (`AdminMobileNav.tsx`)**: Horizontally scrollable pill bar below header allowing quick thumb access to all 14 operational views with active state highlighting and count badges.
- **Single-Column Stacking**: All KPI cards, application cards, and data discrepancy lists stack into readable vertical streams with 44px minimum tap targets.

---

## 3. Operational View Visual Specifications

### 1. Platform Attention Center & Operational Health (`AdminOverview.tsx`)
- **Severity-Coded Cards**: 
  - `CRITICAL` (Suspended vendors, payment issues): Crimson red border (`#fecaca`), soft amber-tinted background (`#fffaf0`), prominent count indicator.
  - `HIGH` (Pending applications, stale menus): Warm orange badges (`#ffedd5`, `#c2410c`).
  - `MEDIUM` (Customer reports): Golden amber badges (`#fef3c7`, `#b45309`).
  - `All Clear State`: Centered card with emerald green double checkmark (`#10b981`) and "All Systems Optimal".
- **KPI Metrics Grid**: 6 rounded cards (`#ffffff`, `Radii.lg`, `Shadows.sm`) featuring custom icon wrapper badges, bold 20pt numbers, and contextual sub-labels.

### 2. Applications Queue & Detail (`ApplicationsQueue.tsx`, `ApplicationDetail.tsx`)
- **Queue Cards**: Status-tagged cards displaying applicant name, phone, cuisine, neighborhood, and official document status (`TIN / Official License On File` in emerald vs `Informal Vendor`).
- **Modal Dialog**: Centered overlay modal (`rgba(15, 23, 42, 0.6)`) with structured sections for business information, owner details, applicant notes, and clear primary CTA (`Approve & Activate` in emerald green) vs secondary destructive (`Reject` in red).
- **Credentials Provisioning Modal**: Secure pop-up displaying the newly generated business credentials, owner login phone, and 20pt bold temporary security PIN in `[ 1234 ]` format.

### 3. Restaurants & Vendors Directory (`RestaurantsManager.tsx`, `RestaurantDetailAdmin.tsx`)
- **Directory Grid**: Multi-card responsive grid highlighting seller tier badges (`VERIFIED` in emerald vs `BASIC` in blue) and live operating status dot (green for Open, grey for Closed).
- **Suspension Dialog**: Requires entering a mandatory reason, preventing accidental or unjustified vendor deactivations.
- **Reactivation Flow**: Restores vendor visibility to the customer discovery engine with an immediate confirmation alert.

### 4. Catalog Verification & Freshness Center (`VerificationCenter.tsx`)
- **Freshness Health KPIs**: Platform freshness score percentage, count of fresh spots (<7 days), aging spots (14–30 days), and stale spots (>30 days).
- **Spot Row**: Displays days since last catalog verification, verified dishes count, and a "Send Verification Reminder" action button.

### 5. Customer Data Reports Resolution (`CustomerReportsAdmin.tsx`)
- **Discrepancy Cards**: Color-coded badges for `Wrong Price` (red), `Unavailable` (orange), `Wrong Hours` (amber), and `Closed Spot` (dark red).
- **Side-by-Side Visual Comparison**: Strikethrough catalog price (`#64748b`) positioned adjacent to customer-reported price (`#dc2626` bold red) with directional arrow.
- **Triage Drawer**: In-place expansion drawer allowing operators to resolve and update catalog, investigate, or dismiss.

### 6. Orders Monitor (`OrdersMonitor.tsx`)
- **Order Pipeline Stream**: Real-time status badges (`Cooking`, `Ready`, `Completed`, `Cancelled`), dining option tag, delivery address row, and customer contact details.

### 7. Payments Supervision (`PaymentsMonitor.tsx`)
- **Read-Only Notice Banner**: Soft blue informational alert box (`#f0f9ff`, `#bae6fd`) with lock icon and `GATEWAY: SIMULATED` badge, communicating financial immutability.
- **Financial Cards**: Displays provider reference, gross transaction amount, 10% platform commission breakdown, payment method (M-Pesa, Tigo, Airtel, Card), and timestamp.

### 8. User Accounts & Super Admin Governance (`UsersManager.tsx`, `AdminUsersManager.tsx`)
- **User Directory**: Searchable list with avatar emojis, role badges, phone verification checkmarks, and account status toggles.
- **Super Admin Governance**: Strict access gating showing unauthorized shield if accessed by standard Admin. Features operator invite card, platform role selector (`ADMIN` vs `SUPER_ADMIN`), and revocation buttons with self-demotion guards.

### 9. Platform Announcements (`NotificationsCenter.tsx`)
- **Composer**: Target audience pills (`All Users`, `Customers Only`, `Restaurant Owners`), title input, multi-line message body, and dispatch button with loading indicator.

### 10. Immutable Audit Trail (`AuditLogViewer.tsx`)
- **Security Event Cards**: High-contrast action badges, actor attribution, timestamp, and collapsible JSON metadata box styled in dark terminal slate (`#0f172a`) with sensitive fields sanitized.

### 11. System Health & Platform Settings (`SystemHealth.tsx`, `AdminSettings.tsx`)
- **Subsystem Status Cards**: Live operational pills for Supabase PostgreSQL, Realtime WebSockets, SMS Adapter, Payment Gateway, RLS, and Storage.
- **Settings**: Locked financial authority parameters (`10% commission`, `1,500 TZS service fee`, `2,500 TZS delivery fee`) and toggleable pilot delivery neighborhoods.

---

## 4. Design System Compliance Checklist
- [x] Zero hardcoded inline color hexes in components; strictly conforms to `Colors` palette.
- [x] Typography uses standard hierarchy (Title 18pt bold, Section 15pt bold, Body 13pt regular, Caption 11pt).
- [x] Corner radius standardized across all cards (`Radii.lg` = 16px, `Radii.md` = 12px, `Radii.full` = 9999px).
- [x] Touch targets comply with accessibility standards (minimum 44x44px).
- [x] Responsive layout renders seamlessly from 320px mobile screens to 1440px+ 4K monitors.
