const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(process.argv[2] || path.join(__dirname, '..', 'dist'));
const port = Number(process.env.PORT || 5500);
if (!fs.existsSync(path.join(root, 'index.html'))) throw new Error('Build the web app before starting the preview.');
const mime = {'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ttf':'font/ttf','.woff':'font/woff','.woff2':'font/woff2','.ico':'image/x-icon'};
http.createServer((req,res)=>{
  if (!['GET','HEAD'].includes(req.method)) {res.writeHead(405);return res.end();}
  let name;try {name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);return res.end();}
  const wanted=path.resolve(root,'.'+name);
  if (wanted!==root&&!wanted.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  const candidates=[wanted,wanted+'.html',path.join(wanted,'index.html')];
  let file=candidates.find(p=>fs.existsSync(p)&&fs.statSync(p).isFile());
  if (!file&&!path.extname(name)) file=path.join(root,'index.html');
  if (!file){res.writeHead(404);return res.end('Not found');}
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Cache-Control':'no-store'});
  if(req.method==='HEAD')return res.end();fs.createReadStream(file).pipe(res);
}).listen(port,'127.0.0.1',()=>console.log(`MloHub preview: http://127.0.0.1:${port}\nPress Ctrl+C to stop.`));
