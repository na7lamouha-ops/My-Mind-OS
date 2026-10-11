const SET="const set=(id,v)=>{const e=document.getElementById(id);e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));};";
exports.SET=SET;
exports.reset=(clearTarget)=>new Function(SET+` ${clearTarget?"set('sm-target','');":""} ['sm-buy','sm-sell','sm-lead-usd','sm-other','sm-retour'].forEach(id=>set(id,'')); set('sm-conf',70); set('sm-del',70); set('sm-surplus',0); window.scrollTo(0,0);`);
exports.resetJs=(clearTarget)=>SET+` ${clearTarget?"set('sm-target','');":""} ['sm-buy','sm-sell','sm-lead-usd','sm-other','sm-retour'].forEach(id=>set(id,'')); set('sm-conf',70); set('sm-del',70); set('sm-surplus',0); window.scrollTo(0,0); document.querySelectorAll('.rec-glow').forEach(e=>e.classList.remove('rec-glow'));`;
exports.fill=(o)=>SET+Object.entries(o).map(([k,v])=>`set('${k}','${v}');`).join('');
