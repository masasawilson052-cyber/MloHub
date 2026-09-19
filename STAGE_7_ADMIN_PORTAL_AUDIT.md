# MloHub Stage 7: Admin Portal Architecture & Governance Audit

## 1. Executive Summary & Context
Prior to Stage 7, `app/admin/index.tsx` was a monolithic prototype file of 3,327 lines of code. While containing initial onboarding wizards and application review flows, it lacked modular decomposition, role-gated platform governance, a unified Attention Center, data report dispute resolution, payment transparency, and security audit inspection.

This audit evaluates the platform operations across 11 core domains and establishes the modular component architecture required for a production-grade operations center.

---

## 2. Monolith Decomposition Audit (3,327 LOC Analysis)

| Monolith Section | Line Range | Current Behavior & Deficiencies | Target Modular Component | Priority |
| :--- | :--- | :--- | :--- | :--- |
| **Top Navigation & Identity** | 86–128 | Basic text header; no Super Admin distinction or Realtime pulse | `AdminHeader.tsx`, `AdminSidebar.tsx`, `AdminMobileNav.tsx` | **P0** |
| **Overview & Action Center** | Embedded in tab 1 | Scattered counters without severity grouping or attention queues | `AdminOverview.tsx` (Attention Center + KPIs) | **P0** |
| **Vendor Applications** | 130–168, 600–900 | Basic approve/reject inline modal; lacking document inspection | `ApplicationsQueue.tsx`, `ApplicationDetail.tsx` | **P0** |
| **Restaurant Directory** | 200–350, 1100–1600 | Mixed list and inline modal; lacks multi-branch drilldown | `RestaurantsManager.tsx`, `RestaurantDetailAdmin.tsx` | **P1** |
| **Verification & Freshness** | Missing | No visibility into freshness state (`FRESH`, `AGING`, `STALE`) | `VerificationCenter.tsx` | **P0** |
| **Customer Data Reports** | Missing | No interface to resolve wrong prices or unavailable dishes | `CustomerReportsAdmin.tsx` | **P0** |
| **Orders Operations** | 196–204, 1800–2100 | Basic list; missing dispatch/support override protocols | `OrdersMonitor.tsx` | **P1** |
| **Payments Supervision** | Missing | No read-only payment monitoring or gateway status checks | `PaymentsMonitor.tsx` | **P0** |
| **User Directory** | Missing | Unable to inspect user accounts, roles, or suspend bad actors | `UsersManager.tsx` | **P1** |
| **Admin Provisioning** | Missing | No role elevation or Super Admin privilege gating | `AdminUsersManager.tsx` (Super Admin Only) | **P0** |
| **Platform Announcements** | 169–195 | Functional broadcast service; needs rich audience targeting | `NotificationsCenter.tsx` | **P2** |
| **Immutable Audit Logs** | Missing | Security events stored in DB but invisible to platform operators | `AuditLogViewer.tsx` | **P0** |
| **Platform Analytics** | Missing | No insights into top searches, zero-result queries, or dish demand | `PlatformAnalytics.tsx` | **P1** |
| **System & Adapter Health** | Missing | Operators unable to see SMS/payment adapter or DB sync state | `SystemHealth.tsx` | **P1** |
| **Governance Settings** | Missing | Hardcoded neighborhood lists and threshold configs | `AdminSettings.tsx` | **P2** |

---

## 3. Priority Matrix (P0 / P1 / P2)

### Priority P0 (Critical Governance & Access Control)
- **Role-Gated Navigation & Header**: Immediate enforcement of `ADMIN` and `SUPER_ADMIN` with visible role badges and Realtime connection indicator.
- **Platform Attention Center**: Unified triage dashboard categorizing urgent issues into Critical (fraud, suspended vendors), High (pending applications, stale menus), and Medium (customer reports).
- **Application Review & Approval Workflow**: Document inspection (TIN, Business License), approval with auto-provisioning of credentials, and structured rejection/changes request.
- **Customer Data Reports Resolution**: Direct side-by-side comparison of customer-reported prices vs verified catalog prices with one-click resolution.
- **Read-Only Payments Monitor**: Tamper-proof visibility into transaction statuses (`PAID`, `PENDING`, `FAILED`) with zero client-side mutation capability.
- **Immutable Audit Trail Viewer**: Full chronological log of administrative actions with metadata inspection.

### Priority P1 (Operational Health & Management)
- **Restaurants Management**: Search, filter by verification status, suspend with mandatory reason, and reactivate.
- **Verification Center**: Catalog freshness breakdown (`FRESH` < 7 days, `RECENT` 7–14 days, `AGING` 14–30 days, `STALE` > 30 days).
- **Orders Operational Monitor**: Search and filter live custom meal requests and orders.
- **Users Management**: View profiles, roles, and status.
- **System Health Monitor**: Live display of adapter modes (SMS: SIMULATED, Payments: SIMULATED, Supabase: CONFIGURED/LOCAL).
- **Platform Analytics**: Search demand, conversion rates, and food synonym trends.

### Priority P2 (Operational Enhancements)
- **Scoped Announcements**: Send broadcast notifications filtered by audience (All, Customers, Restaurant Owners, Pilot Region).
- **Admin Settings**: Pilot neighborhood coverage toggles, freshness thresholds, and commission display.

---

## 4. Architectural Decomposition Strategy
Rather than editing the 3,327-line monolith in-place, the portal is decomposed into clean, modular components inside `components/admin/`:
```
components/admin/
├── AdminHeader.tsx
├── AdminSidebar.tsx
├── AdminMobileNav.tsx
├── AdminOverview.tsx
├── ApplicationsQueue.tsx
├── ApplicationDetail.tsx
├── RestaurantsManager.tsx
├── RestaurantDetailAdmin.tsx
├── VerificationCenter.tsx
├── CustomerReportsAdmin.tsx
├── OrdersMonitor.tsx
├── PaymentsMonitor.tsx
├── UsersManager.tsx
├── AdminUsersManager.tsx
├── NotificationsCenter.tsx
├── AuditLogViewer.tsx
├── PlatformAnalytics.tsx
├── SystemHealth.tsx
├── AdminSettings.tsx
└── index.ts
```
`app/admin/index.tsx` becomes a slim orchestrator screen (~200 lines) that handles authentication guard checks, active tab routing, and shared state refreshing.
