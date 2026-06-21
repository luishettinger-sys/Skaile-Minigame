// Live-Reload Dev-Server (No-Cache) + headed Vorschau-Fenster.
// Bei jeder Datei-Änderung: Browser lädt automatisch neu.
import http from 'http';
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const PORT = 8000;
const clients = new Set();
const MIME = { '.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.glb':'model/gltf-binary','.svg':'image/svg+xml','.ico':'image/x-icon','.wav':'audio/wav','.mp3':'audio/mpeg','.ogg':'audio/ogg','.webp':'image/webp' };
const SNIPPET = `<script>(function(){try{var es=new EventSource('/__livereload');es.onmessage=function(e){if(e.data==='reload')location.reload();};}catch(_){}})();</script>`;

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/__livereload') {
    res.writeHead(200, { 'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive' });
    res.write(': connected\n\n'); clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  let file = path.join(ROOT, decodeURIComponent(url));
  if (url === '/' || url.endsWith('/')) file = path.join(file, 'index.html');
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('404'); return; }
    const ext = path.extname(file).toLowerCase();
    const headers = { 'Content-Type': MIME[ext]||'application/octet-stream','Cache-Control':'no-store, no-cache, must-revalidate, max-age=0','Pragma':'no-cache' };
    if (ext === '.html') { res.writeHead(200, headers); res.end(data.toString().replace('</body>', SNIPPET+'</body>')); }
    else { res.writeHead(200, headers); res.end(data); }
  });
});
server.listen(PORT, '127.0.0.1', () => console.log('DEV-SERVER  http://localhost:'+PORT));

let win = null;
let timer = null;
function reloadAll(reason) {
  if (timer) return;
  timer = setTimeout(async () => {
    timer = null;
    for (const c of clients) c.write('data: reload\n\n');
    if (win) { try { await win.reload(); } catch(_){} }
    console.log('RELOAD ('+reason+')  Clients:'+clients.size);
  }, 200);
}
function watchable(f){ return f && /\.(js|mjs|css|html|json|png|jpg|jpeg|glb|webp)$/i.test(f); }
for (const dir of ['src', '.']) {
  try { fs.watch(path.join(ROOT, dir), (ev, f) => { if (watchable(f)) reloadAll(f); }); } catch(_){}
}

// Vorschau-Fenster (garantiert lauffaehig). Schliesst sich nicht.
const browser = await chromium.launch({ headless: false });
win = await browser.newPage({ viewport: { width: 1180, height: 760 } });
await win.goto('http://localhost:'+PORT+'/?sim');
console.log('VORSCHAU-FENSTER offen.');
