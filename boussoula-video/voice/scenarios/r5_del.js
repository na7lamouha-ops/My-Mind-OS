const {fill}=require('./common.js');
const DRESS={'sm-target':1000000,'sm-buy':3000,'sm-sell':8900,'sm-lead-usd':1.8,'sm-conf':55,'sm-del':50,'sm-other':250,'sm-retour':100,'sm-surplus':20};
module.exports={name:'r5_tawsil',label:'مثال محسوب — ماشي وعد',setup:new Function(fill(DRESS)+"window.scrollTo(0,0);"),blocks:[
 {say:'حسبت منتجك على 50% توصيل؟',screen:'السلايدر على 50% + النتيجة',do:[{a:'jump',sel:'#sm-del',off:150},{a:'glow',sel:'#sm-hero',sec:1.1}],read:{hero:'#sm-hero-value',be:'#sm-breakeven'}},
 {say:'هنا: 3,646 صافي، وأقصى ليد 1,444.',screen:'النتيجة + أقصى ليد',do:[{a:'scroll',sel:'#sm-hero',off:110,sec:0.7},{a:'glow',sel:'.simple-result-box:has(#sm-breakeven)',sec:1}]},
 {say:'وإذا الأسبوع الجاي وصلو 40% برك؟',screen:'السلايدر ينزل لـ 40%',do:[{a:'scroll',sel:'#sm-del',off:150,sec:0.6},{a:'slide',sel:'#sm-del',from:50,to:40,sec:1.2},{a:'fingAway'}],read:{hero:'#sm-hero-value',be:'#sm-breakeven'}},
 {say:'الصافي يهبط لـ 3,195… وأقصى ليد لـ 1,144.',screen:'الأرقام الجديدة تضوي',do:[{a:'scroll',sel:'#sm-hero',off:110,sec:0.7},{a:'glow',sel:'#sm-hero',sec:0.8},{a:'glow',sel:'.simple-result-box:has(#sm-breakeven)',sec:0.8}]},
 {say:'و30%؟',screen:'السلايدر لـ 30%',do:[{a:'scroll',sel:'#sm-del',off:150,sec:0.6},{a:'slide',sel:'#sm-del',from:40,to:30,sec:1},{a:'fingAway'}],read:{hero:'#sm-hero-value',be:'#sm-breakeven'}},
 {say:'2,444… وأقصى ليد 844 برك.',screen:'النتيجة + أقصى ليد',do:[{a:'scroll',sel:'#sm-hero',off:110,sec:0.7},{a:'glow',sel:'#sm-hero',sec:0.8},{a:'glow',sel:'.simple-result-box:has(#sm-breakeven)',sec:0.8}]},
 {say:'نفس المنتج، نفس السعر. معلومة وحدة تبدّلت… والقرار تبدّل معاها.',screen:'نبقاو',do:[{a:'wait',sec:0.3}]},
 {say:'جرّب منتجك بأرقام أسبوع عادي، ماشي أحسن أسبوع. مجاناً، الرابط في البيو.',screen:'رجوع للفوق',do:[{a:'scroll',sel:'#sm-buy',off:300,sec:1}],pause:0.8},
]};
