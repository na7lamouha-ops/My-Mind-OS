exports.reset=(clearTarget)=>new Function(`const set=(id,v)=>{const e=document.getElementById(id);e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));};
 ${clearTarget?"set('sm-target','');":""} ['sm-buy','sm-sell','sm-lead-usd','sm-other','sm-retour'].forEach(id=>set(id,'')); set('sm-conf',70); set('sm-del',70); set('sm-surplus',0); window.scrollTo(0,0);`);
