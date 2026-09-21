// Deterministic offline export. Never reads .env files or hosted credentials.
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const env = {...process.env, EXPO_PUBLIC_APP_ENV:'demo', EXPO_PUBLIC_SUPABASE_URL:'', EXPO_PUBLIC_SUPABASE_ANON_KEY:'', EXPO_NO_DOTENV:'1', EXPO_NO_TELEMETRY:'1', CI:'1', NODE_ENV:'production'};
const result = spawnSync(process.execPath,[path.join(root,'node_modules/expo/bin/cli'),'export','--platform','web','--clear','--output-dir','dist-offline'],{cwd:root,env,stdio:'inherit'});
if(result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
