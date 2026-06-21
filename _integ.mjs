import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
const errs = [];
p.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
p.on('pageerror', e => errs.push('PAGEERR: '+e.message));
await p.goto('http://localhost:8000/?sim', { waitUntil: 'load' });
await p.waitForTimeout(1500);
// Onboarding ueberspringen + starten
await p.click('#start-btn').catch(()=>{});
await p.waitForTimeout(500);
await p.keyboard.press('Escape'); // skip onboarding
await p.waitForTimeout(800);
const log = [];
async function step(name, fn){ try { const r = await p.evaluate(fn); log.push(name+'='+r); } catch(e){ log.push(name+'=EX:'+e.message); } }

await step('state', ()=>{ const g=window.__game; g.paused=false; return g.state; });
// Ressourcen geben
await step('giveRes', ()=>{ const g=window.__game; g.mats.scrap=200; g.mats.chips=30; g.meta.data=600; return 'ok'; });
// Jede Station oeffnen+schliessen
await step('forge', ()=>{ const g=window.__game; g.openForge(); g.craftMod('power'); g.closeForge(); return g.meta.craftedMods.power||0; });
await step('chips', ()=>{ const g=window.__game; g.openChips(); g._chipSel='cpu'; g.placeOrRemoveChip(0); g.closeChips(); return g.meta.chipGrid[0]; });
await step('fab', ()=>{ const g=window.__game; g.openFab(); g.startPrint('heal'); g._updatePrint(11); g.useConsumable(1); g.closeFab(); return 'ok'; });
await step('research', ()=>{ const g=window.__game; g.openResearch(); g.doResearch('boot'); g.closeResearch(); document.getElementById('lore-pop')?.classList.add('hidden'); return !!g.meta.research.boot; });
// Draft + Sektor
await step('draft', ()=>{ const g=window.__game; g._draftPending=true; g._offerDraft(); g._pickDraft(0); return g.weaponId; });
await step('sector', ()=>{ const g=window.__game; g._lastSectorModId=null; g._applySectorMod(2); return g.sectorMod?.id; });
// Welle starten + simulieren
await step('deploy', ()=>{ const g=window.__game; if(!g.defenseLoop) g.startDefense(); return g.defenseLoop; });
await p.waitForTimeout(2500); // Gegner spawnen + kaempfen lassen
await step('enemies', ()=>window.__game.enemies.aliveCount());
// Overclock simulieren
await step('overclock', ()=>{ const g=window.__game; const o=g.input.isDown.bind(g.input); g.input.isDown=(k)=>k==='KeyC'?true:o(k); for(let i=0;i<20;i++)g._updateHeat(0.1,false); g.input.isDown=o; return Math.round(g.heat); });
await p.waitForTimeout(1500);
await step('stillPlaying', ()=>window.__game.state);
await step('fps', ()=>Math.round(window.__game._fps||0));

console.log(log.join('\n'));
console.log('--- ERRORS:', errs.length ? errs.join(' || ') : 'NONE');
await b.close();
