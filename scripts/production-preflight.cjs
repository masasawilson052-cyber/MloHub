const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'production-public.json'), 'utf8'));

async function main() {
  const headers = {
    apikey: config.publishableKey,
    Authorization: 'Bearer ' + config.publishableKey
  };
  const checks = [];
  const tables = {
    profiles: 'id,role',
    restaurants: 'id,is_active,is_published',
    restaurant_applications: 'id,applicant_user_id',
    restaurant_members: 'id',
    restaurant_branches: 'id',
    menu_items: 'id,price_tzs,category_id,name_en,name_sw,is_archived',
    orders: 'id,status',
    payments: 'id,status',
    notifications: 'id,order_id,action_type,data',
    reservations: 'id,party_size,reservation_time,deposit_amount_tzs',
    custom_meal_requests: 'id,delivery_location,preferred_time,accepted_quote_id',
    restaurant_quotes: 'id,quoted_price_tzs,status',
    reservation_holds: 'id,party_size',
    refunds: 'id,status',
    audit_logs: 'id,action',
    delivery_quotes: 'id,branch_id,delivery_fee_tzs,distance_meters',
    branch_delivery_pricing: 'branch_id,base_fee_tzs,pricing_mode,configuration_confirmed',
    api_rate_limits: 'id,rate_key,action',
    security_events: 'id,event_type,severity',
    payment_events: 'id,provider,event_id'
  };

  const pendingMigrationTables = [
    'delivery_quotes',
    'branch_delivery_pricing',
    'api_rate_limits',
    'security_events'
  ];

  for (const [table, columns] of Object.entries(tables)) {
    try {
      const res = await fetch(`${config.url}/rest/v1/${table}?select=${columns}&limit=0`, {
        headers,
        signal: AbortSignal.timeout(12000)
      });
      const body = await res.json().catch(() => ({}));
      const isPendingMigration = pendingMigrationTables.includes(table);
      checks.push({
        check: table,
        ok: res.ok,
        status: res.status,
        phase: isPendingMigration ? 'NEW_MIGRATION_20260927' : 'CORE_DEPLOYED',
        detail: res.ok ? 'schema accessible' : (isPendingMigration ? 'Pending remote migration deploy (20260927000100/20260927000200)' : (body.message || 'unavailable'))
      });
    } catch (e) {
      checks.push({ check: table, ok: false, detail: e.message });
    }
  }

  const coreChecks = checks.filter(c => c.phase === 'CORE_DEPLOYED');
  const coreReady = coreChecks.every(c => c.ok);
  const fullReady = checks.every(c => c.ok);

  const status = {
    checkedAt: new Date().toISOString(),
    project: config.url,
    coreSchemaReady: coreReady,
    allMigrationsApplied: fullReady,
    pendingMigrations: checks.filter(c => !c.ok).map(c => c.check),
    scope: 'Read-only schema reachability; not payment, authentication or RLS certification',
    checks
  };

  console.log(JSON.stringify(status, null, 2));
  if (!fullReady) process.exitCode = 2;
}

main().catch(e => {
  console.error(e.message);
  process.exitCode = 1;
});
