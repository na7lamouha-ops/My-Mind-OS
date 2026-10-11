const {resetJs,fill}=require('./common.js');
const DRESS={'sm-target':1000000,'sm-buy':3000,'sm-sell':8900,'sm-lead-usd':1.8,'sm-conf':55,'sm-del':50,'sm-other':250,'sm-retour':100,'sm-surplus':0};
module.exports={name:'r1_demo_fostan',label:'مثال محسوب — ماشي وعد',setup:new Function(fill(DRESS)),blocks:[
 // cold open: النتيجة تهبط قدّام العين، ومن بعد نرجعو للبداية
 {say:'هاذ الفستان يربّح 3,946؟ لا.',screen:'Cold open: النتيجة 3,946',do:[{a:'jump',sel:'#sm-surplus',off:150},{a:'glow',sel:'#sm-hero',sec:0.9,keep:true}]},
 {say:'شوف علاش… من الأول.',screen:'الفائض يطلع ← 3,646، ومن بعد رجوع للفوق',do:[{a:'slide',sel:'#sm-surplus',from:0,to:20,sec:1.1},{a:'fingAway'},{a:'unglow',sel:'#sm-hero'},{a:'eval',js:resetJs(true)}]},
 {say:'نبداو من الهدف: 100 مليون.',screen:'تكتب الهدف',do:[{a:'type',sel:'#sm-target',text:'1000000'}]},
 {say:'فستان: نشريه بـ 3,000… ونبيعو بـ 8,900.',screen:'الشراء والبيع',do:[{a:'scroll',sel:'#sm-buy',off:260},{a:'type',sel:'#sm-buy',text:'3000'},{a:'type',sel:'#sm-sell',text:'8900'}]},
 {say:'الليد بدولار و80… 441 دينار.',screen:'الليد',do:[{a:'scroll',sel:'#sm-lead-usd',off:300},{a:'type',sel:'#sm-lead-usd',text:'1.8'}],read:{lead:'#sm-lead-dzd'}},
 {say:'التأكيد 55%… ويوصلو 50%.',screen:'السلايدرز',do:[{a:'scroll',sel:'#sm-conf',off:260},{a:'slide',sel:'#sm-conf',from:70,to:55,sec:0.9},{a:'slide',sel:'#sm-del',from:70,to:50,sec:0.9}]},
 {say:'التوصيل والتغليف 250… والروتور 100.',screen:'التوصيل والروتور',do:[{a:'scroll',sel:'#sm-other',off:200},{a:'type',sel:'#sm-other',text:'250'},{a:'type',sel:'#sm-retour',text:'100'}]},
 {say:'شوف: 3,946 صافي في الطلبية الموصلة.',screen:'النتيجة تضوي',do:[{a:'fingAway'},{a:'scroll',sel:'#sm-surplus',off:150},{a:'glow',sel:'#sm-hero',sec:1.3}],read:{hero:'#sm-hero-value'}},
 {say:'بصح نسينا المقاسات والألوان اللي ما يتباعوش.',screen:'الفائض من 0 لـ 20%',do:[{a:'slide',sel:'#sm-surplus',from:0,to:20,sec:1.8},{a:'fingAway'}],read:{hero:'#sm-hero-value'}},
 {say:'3,646… 300 دينار طارو في المقاسات.',screen:'النتيجة الجديدة',do:[{a:'glow',sel:'#sm-hero',sec:1.5}]},
 {say:'وأغلى ليد تقدر تخلّصو: 1,444 دينار.',screen:'أقصى ليد',do:[{a:'scroll',sel:'#sm-breakeven',off:330},{a:'glow',sel:'.simple-result-box:has(#sm-breakeven)',sec:1.4}],read:{be:'#sm-breakeven'}},
 {say:'وتقريباً 44 من كل 100 قطعة… يرجعولك ثمن السلعة كاملة.',screen:'استرجاع الدفعة',do:[{a:'scroll',sel:'#mp-be',off:330},{a:'glow',sel:'.smap-r:has(#mp-be)',sec:1.4}],read:{rec:'#mp-be'}},
 {say:'ورأس المال والليدات؟ بين رقمين. الرقم بالضبط، ونهار يرجعلك رأس مالك… في المتقدم.',screen:'«بين رقمين» + القفل',do:[{a:'scroll',sel:'#mp-cap',off:330},{a:'glow',sel:'.smap-r:has(#mp-cap)',sec:1.4},{a:'scroll',sel:'.smap-lock',off:260,sec:0.9},{a:'glow',sel:'.smap-lock',sec:1.2}],read:{cap:'#mp-cap',leads:'#mp-leads'}},
 {say:'جرّب بمنتجك أنت. مجاناً، دقيقة. الرابط في البيو.',screen:'رجوع للفوق',do:[{a:'scroll',sel:'#sm-target',off:330,sec:1.1}],pause:0.8},
]};
