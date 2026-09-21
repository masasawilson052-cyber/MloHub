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
    audit_logs: 'id,action'
  };

  for (const [table, columns] of Object.entries(tables)) {
    try {
      const res = await fetch(`${config.url}/rest/v1/${table}?select=${columns}&limit=0`, {
        headers,
        signal: AbortSignal.timeout(12000)
      });
      const body = await res.json().catch(() => ({}));
      checks.push({
        check: table,
        ok: res.ok,
        status: res.status,
        detail: res.ok ? 'schema accessible' : (body.message || 'unavailable')
      });
    } catch (e) {
      checks.push({ check: table, ok: false, detail: e.message });
    }
  }

  const status = {
    checkedAt: new Date().toISOString(),
    project: config.url,
    ready: checks.every(c => c.ok),
    scope: 'Read-only schema reachability; not payment, authentication or RLS certification',
    checks
  };

  console.log(JSON.stringify(status, null, 2));
  if (!status.ready) process.exitCode = 2;
}

main().catch(e => {
  console.error(e.message);
  process.exitCode = 1;
});
