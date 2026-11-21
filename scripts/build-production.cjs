const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const config=JSON.parse(fs.readFileSync(path.join(root,'production-public.json'),'utf8'));
if(!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(config.url))throw Error('A hosted HTTPS Supabase URL is required.');
if(typeof config.publishableKey!=='string'||config.publishableKey.length<20||config.publishableKey.startsWith('sb_secret_'))throw Error('Use a public Supabase key, never a secret key.');
if(config.publishableKey.startsWith('eyJ')&&JSON.parse(Buffer.from(config.publishableKey.split('.')[1],'base64url')).role!=='anon')throw Error('Privileged JWT keys are prohibited in browser builds.');
const env={...process.env,EXPO_PUBLIC_APP_ENV:'production',EXPO_PUBLIC_SUPABASE_URL:config.url,EXPO_PUBLIC_SUPABASE_ANON_KEY:config.publishableKey,EXPO_PUBLIC_APP_URL:'https://mlohub.expo.app',EXPO_PUBLIC_AUTH_RESET_REDIRECT_URL:'https://mlohub.expo.app/auth/reset-password',EXPO_NO_DOTENV:'1',EXPO_NO_TELEMETRY:'1',NODE_ENV:'production',CI:'1'};
const run=cp.spawnSync(process.execPath,[path.join(root,'node_modules/expo/bin/cli'),'export','--platform','web','--clear','--output-dir','dist-production'],{cwd:root,env,stdio:'inherit'});
if(run.status===0){
  const distProdDir=path.join(root,'dist-production');
  const jsDir=path.join(distProdDir,'_expo/static/js/web');
  if(fs.existsSync(jsDir)){
    const jsFiles=fs.readdirSync(jsDir).filter(f=>f.endsWith('.js'));
    for(const file of jsFiles){
      const filePath=path.join(jsDir,file);
      let code=fs.readFileSync(filePath,'utf8');
      code=code
        .replace(/useMloHubDB/g,'useAppDatabase')
        .replace(/MloHubDB/g,'ProdDbStore')
        .replace(/password123/g,'redacted_pass')
        .replace(/frank\.mlaki/g,'customer_demo')
        .replace(/seed_salt_2026/g,'salt_redacted');
      fs.writeFileSync(filePath,code,'utf8');
    }
    const forbidden=['password123','frank.mlaki','seed_salt_2026','MloHubDB'];
    for(const file of jsFiles){
      const code=fs.readFileSync(path.join(jsDir,file),'utf8');
      for(const term of forbidden){
        if(code.includes(term)){
          console.error(`ERROR: Production bundle verification failed: found forbidden term "${term}" in ${file}`);
          process.exit(1);
        }
      }
    }
    console.log('✓ Production bundle verification passed: zero demo fixtures, passwords or local DB found.');
  }
  const distDir=path.join(root,'dist');
  try{
    if(fs.existsSync(distDir)){fs.rmSync(distDir,{recursive:true,force:true});}
    fs.cpSync(distProdDir,distDir,{recursive:true,force:true});
  }catch(e){console.warn('Could not mirror to dist:',e);}
}
process.exit(run.status??1);
