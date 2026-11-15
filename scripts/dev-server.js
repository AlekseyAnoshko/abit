// Dependency-free local static server; accepts preview host/port arguments.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const args=process.argv.slice(2);
const option=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
const port=Number(option('--port',process.env.PORT||'8000'));
const host=option('--host','127.0.0.1');
const root=process.cwd();
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg','.webp':'image/webp'};
http.createServer(async(req,res)=>{
 try {
  const url=new URL(req.url,'http://localhost');
  const requested=decodeURIComponent(url.pathname);
  const file=path.resolve(root,'.'+requested+(requested.endsWith('/')?'index.html':''));
  if(!file.startsWith(root+path.sep)||path.relative(root,file).split(path.sep).some(part=>part.startsWith('.'))) {res.writeHead(403).end();return;}
  const body=await fs.readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(body);
 }catch {res.writeHead(404).end('Not found');}
}).listen(port,host,()=>console.log(`Local: http://${host}:${port}`));
