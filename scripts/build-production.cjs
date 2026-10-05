const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const config=JSON.parse(fs.readFileSync(path.join(root,'production-public.json'),'utf8'));
if(!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(config.url))throw Error('A hosted HTTPS Supabase URL is required.');
if(typeof config.publishableKey!=='string'||config.publishableKey.length<20||config.publishableKey.startsWith('sb_secret_'))throw Error('Use a public Supabase key, never a secret key.');
if(config.publishableKey.startsWith('eyJ')&&JSON.parse(Buffer.from(config.publishableKey.split('.')[1],'base64url')).role!=='anon')throw Error('Privileged JWT keys are prohibited in browser builds.');
const env={...process.env,EXPO_PUBLIC_APP_ENV:'production',EXPO_PUBLIC_SUPABASE_URL:config.url,EXPO_PUBLIC_SUPABASE_ANON_KEY:config.publishableKey,EXPO_PUBLIC_APP_URL:'https://mlohub.expo.app',EXPO_PUBLIC_AUTH_RESET_REDIRECT_URL:'https://mlohub.expo.app/auth/reset-password',EXPO_NO_DOTENV:'1',EXPO_NO_TELEMETRY:'1',NODE_ENV:'production',CI:'1'};
const run=cp.spawnSync(process.execPath,[path.join(root,'node_modules/expo/bin/cli'),'export','--platform','web','--clear','--output-dir','dist-production'],{cwd:root,env,stdio:'inherit'});
if(run.status===0){
  const distDir=path.join(root,'dist');
  const distProdDir=path.join(root,'dist-production');
  try{fs.cpSync(distProdDir,distDir,{recursive:true,force:true});}catch(e){console.warn('Could not mirror to dist:',e);}
}
process.exit(run.status??1);
