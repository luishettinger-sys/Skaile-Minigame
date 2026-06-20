import { chromium } from 'playwright';
const url = 'http://localhost:8123/';
const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('console', m => { if (m.type()==='error') errs.push('C:'+m.text()); });
page.on('pageerror', e => errs.push('P:'+e.message));
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(5000);
await page.evaluate(() => { const b=document.getElementById('start-btn'); if(b) b.click(); });
await page.waitForTimeout(2200);
await page.mouse.move(900, 360); await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/play2.png' });
const diag = await page.evaluate(() => {
  const g = window.__game; if(!g) return {err:'no __game'};
  const p = g.player;
  const out = { weaponId:g.weaponId, hasAnchor:!!p.weaponAnchor, hasModel:!!p.weaponModel,
                playerPos:[+p.pos.x.toFixed(2),+p.pos.y.toFixed(2),+p.pos.z.toFixed(2)],
                rootScale:p.root.scale.toArray().map(n=>+n.toFixed(2)),
                facing:+p.facing.toFixed(2) };
  if(p.weaponAnchor){ out.anchorChildren=p.weaponAnchor.children.length; out.anchorPos=p.weaponAnchor.position.toArray().map(n=>+n.toFixed(2)); }
  if(p.weaponModel){
    out.modelScale=p.weaponModel.scale.toArray().map(n=>+n.toFixed(2));
    out.modelVisible=p.weaponModel.visible;
    let mc=0,vis=true; p.weaponModel.traverse(o=>{ if(o.isMesh){mc++; if(!o.visible)vis=false;} });
    out.meshCount=mc; out.allMeshVisible=vis;
    const w=p.weaponModel.getWorldPosition(new p.weaponModel.position.constructor());
    out.modelWorld=[+w.x.toFixed(2),+w.y.toFixed(2),+w.z.toFixed(2)];
  }
  // camera pos
  const cam = g.world?.camera; if(cam) out.cam=[+cam.position.x.toFixed(1),+cam.position.y.toFixed(1),+cam.position.z.toFixed(1)];
  return out;
});
console.log('DIAG', JSON.stringify(diag));
console.log('ERRORS', errs.length ? errs.slice(0,8).join(' || ') : 'none');
await browser.close();
