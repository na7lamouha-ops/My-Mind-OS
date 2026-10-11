const {resetJs,fill}=require('./common.js');
const WATCH={'sm-buy':1500,'sm-sell':3900,'sm-lead-usd':3,'sm-conf':55,'sm-del':55,'sm-other':250,'sm-retour':100,'sm-surplus':0};
module.exports={name:'r2_saa_lead',label:'مثال محسوب — ماشي وعد',setup:new Function(fill(WATCH)),blocks:[
 {say:'منتج رابح… حتى طلع الليد.',screen:'Cold open: -362 فخ المارج',do:[{a:'jump',sel:'#sm-hero',off:200},{a:'glow',sel:'#sm-hero',sec:1}]},
 {say:'شوف واش صرا… من الأول.',screen:'رجوع للبداية',do:[{a:'eval',js:resetJs(false)}]},
 {say:'ساعة: نشريها بـ 1,500… ونبيعها بـ 3,900.',screen:'الشراء والبيع',do:[{a:'scroll',sel:'#sm-buy',off:260},{a:'type',sel:'#sm-buy',text:'1500'},{a:'type',sel:'#sm-sell',text:'3900'}],pause:0.3},
 {say:'الليد بدولار ونص.',screen:'الليد',do:[{a:'scroll',sel:'#sm-lead-usd',off:300},{a:'type',sel:'#sm-lead-usd',text:'1.5'}]},
 {say:'التأكيد 55%، ويوصلو 55%.',screen:'السلايدرز',do:[{a:'scroll',sel:'#sm-conf',off:260},{a:'slide',sel:'#sm-conf',from:70,to:55,sec:0.8},{a:'slide',sel:'#sm-del',from:70,to:55,sec:0.8}]},
 {say:'التوصيل والتغليف 250، والروتور 100.',screen:'التوصيل والروتور',do:[{a:'scroll',sel:'#sm-other',off:200},{a:'type',sel:'#sm-other',text:'250'},{a:'type',sel:'#sm-retour',text:'100'}],pause:0.3},
 {say:'رابح: 852 صافي في الطلبية.',screen:'النتيجة خضرا',do:[{a:'fingAway'},{a:'scroll',sel:'#sm-hero',off:200},{a:'glow',sel:'#sm-hero',sec:1.2}],read:{hero:'#sm-hero-value'}},
 {say:'بصح شوف: أقصى ليد… 626.',screen:'أقصى ليد تضوي',do:[{a:'scroll',sel:'#sm-breakeven',off:330},{a:'glow',sel:'.simple-result-box:has(#sm-breakeven)',sec:1.4}],read:{be:'#sm-breakeven'}},
 {say:'وإذا الليد طلع لـ 3 دولار… يعني 735 دينار.',screen:'نبدّلو الليد',do:[{a:'scroll',sel:'#sm-lead-usd',off:300},{a:'type',sel:'#sm-lead-usd',text:'3'}],read:{lead:'#sm-lead-dzd'}},
 {say:'ولّى خاسر: ناقص 362 في كل طلبية.',screen:'النتيجة حمرا',do:[{a:'fingAway'},{a:'scroll',sel:'#sm-hero',off:200},{a:'glow',sel:'#sm-hero',sec:1.4}],read:{hero:'#sm-hero-value',label:'#sm-hero-label'}},
 {say:'نفس المنتج… غير الليد تبدّل. هذا علاش تحسب قبل ما تشري.',screen:'نبقاو على النتيجة',do:[{a:'wait',sec:0.3}]},
 {say:'جرّب منتجك مجاناً. اكتب «بوصلة» في الكومنتار ونبعثلك الرابط.',screen:'رجوع للفوق',do:[{a:'scroll',sel:'#sm-buy',off:330,sec:1}],pause:0.8},
]};
