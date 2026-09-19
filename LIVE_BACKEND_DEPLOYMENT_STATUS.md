# MloHub Live Backend Deployment Status

## 1. Status Taxonomy
To prevent ambiguity across investors, engineers, and operational staff, every backend capability is classified into one of four verified lifecycle states:

1. **CODE READY**: Application TypeScript logic, domain models, services, and guard functions are fully implemented and verified with zero compiler or lint errors.
2. **MIGRATION READY**: SQL schemas, indexes, triggers, constraints, RLS policies, and RPC stored procedures are written and formatted in `supabase/migrations/` ready for automated migration runner deployment.
3. **LIVE DEPLOYED**: Successfully executed against an active Supabase PostgreSQL cluster in the cloud.
4. **LIVE TESTED**: End-to-end integration verified against the running cloud database using authenticated JWT sessions.

---

## 2. Platform Capability Readiness Matrix

| Capability / Resource | Current State | Evidence & References |
| :--- | :--- | :--- |
| **Authentication & Sessions** | **CODE READY / MIGRATION READY** | `db/auth/guards.ts`, `db/auth/service.ts`, `20260916000001_initial_schema.sql` |
| **User Profiles & Granular Roles** | **CODE READY / MIGRATION READY** | `public.profiles`, `public.platform_role` enum, `AuthGuards.requireRole` |
| **Restaurant Tenancy & Memberships** | **CODE READY / MIGRATION READY** | `public.restaurant_memberships`, `AuthGuards.requireRestaurantMembership` |
| **Multi-Branch & Menus** | **CODE READY / MIGRATION READY** | `public.restaurants`, `public.restaurant_branches`, `public.menu_items` |
| **Food Discovery Engine** | **CODE READY / MIGRATION READY** | `services/DiscoveryService.ts`, `config/discoveryRanking.ts`, Full-Text Search |
| **Order Pipeline & State Machine** | **CODE READY / MIGRATION READY** | `services/OrderPipelineService.ts`, `public.orders`, `public.order_items` |
| **Row Level Security (RLS)** | **MIGRATION READY** | 22/22 Tables RLS Enabled, 48 Dynamic Smoke Tests passing |
| **Customer Data Reports** | **CODE READY / MIGRATION READY** | `public.data_reports`, `repositories/dataReports.repository.ts` |
| **Platform Audit Logs** | **CODE READY / MIGRATION READY** | `public.audit_logs`, `repositories/auditLogs.repository.ts` |
| **Realtime Engine** | **CODE READY** | Hybrid: Cloud WebSockets + Web BroadcastChannel + In-Memory Bus |
| **SMS Notifications** | **SIMULATED** | Local mock provider with Tanzanian carrier recognition |
| **Payment Gateway** | **SIMULATED** | Read-only tracking, simulated provider reference, no client status mutation |

---

## 3. Environment Variable Configuration
When deploying to live Supabase, configure:
```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
EXPO_PUBLIC_USE_MOCK_DATA=false
```
When these variables are absent, MloHub runs gracefully in deterministic local mock mode for development, demonstration, and automated test pipelines.
