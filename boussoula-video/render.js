const { chromium } = require('/opt/node-tools/node_modules/playwright'); const fs=require('fs');
(async()=>{ const [f,dir,fpsS]=process.argv.slice(2); const fps=+fpsS||30; fs.mkdirSync(dir,{recursive:true});
 const b=await chromium.launch(); const pg=await (await b.newContext({viewport:{width:1080,height:1920}})).newPage();
 await pg.goto('file://'+f); await pg.waitForFunction(()=>window.READY); const dur=await pg.evaluate(()=>DUR);
 const N=Math.round(dur*fps); const t0=Date.now();
 for(let i=0;i<N;i++){ await pg.evaluate(t=>render(t), i/fps); await pg.screenshot({path:`${dir}/f${String(i).padStart(5,'0')}.jpg`,type:'jpeg',quality:92}); }
 console.log('frames',N,'secs',Math.round((Date.now()-t0)/1000)); await b.close(); })();
