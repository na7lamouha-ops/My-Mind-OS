const {reset}=require('./common.js');
module.exports={name:'r2_saa_lead',setup:reset(false),blocks:[
 {say:'راك حاب تبدا بمنتج؟ قبل ما تشريه… دخّلو هنا.',screen:'الأداة',do:[{a:'wait',sec:0.4}]},
 {say:'مثال: ساعة. نشريها بـ 1,500… ونبيعها بـ 3,900.',screen:'الشراء والبيع',do:[{a:'scroll',sel:'#sm-buy',off:260},{a:'type',sel:'#sm-buy',text:'1500'},{a:'type',sel:'#sm-sell',text:'3900'}]},
 {say:'الليد بـ 1.5 دولار.',screen:'الليد',do:[{a:'scroll',sel:'#sm-lead-usd',off:300},{a:'type',sel:'#sm-lead-usd',text:'1.5'}]},
 {say:'التأكيد 55%، والتوصيل 55%.',screen:'السلايدرز',do:[{a:'scroll',sel:'#sm-conf',off:260},{a:'slide',sel:'#sm-conf',from:70,to:55,sec:0.8},{a:'slide',sel:'#sm-del',from:70,to:55,sec:0.8}]},
 {say:'التوصيل والتغليف 250، والروتور 100.',screen:'التوصيل والروتور',do:[{a:'scroll',sel:'#sm-other',off:200},{a:'type',sel:'#sm-other',text:'250'},{a:'type',sel:'#sm-retour',text:'100'}]},
 {say:'منتج رابح: 852 دينار صافي في الطلبية.',screen:'النتيجة خضرا',do:[{a:'fingAway'},{a:'scroll',sel:'#sm-hero',off:200},{a:'glow',sel:'#sm-hero',sec:1.3}],read:{hero:'#sm-hero-value'}},
 {say:'بصح شوف هاذ الرقم: أقصى ليد… 626 دينار.',screen:'أقصى ليد',do:[{a:'scroll',sel:'#sm-breakeven',off:330},{a:'glow',sel:'.simple-result-box:has(#sm-breakeven)',sec:1.3}],read:{be:'#sm-breakeven'}},
 {say:'يعني لو الليد طلع لـ 3 دولار…',screen:'نبدّلو الليد',do:[{a:'scroll',sel:'#sm-lead-usd',off:300},{a:'type',sel:'#sm-lead-usd',text:'3'}]},
 {say:'المنتج ولّى خاسر: ناقص 362 دينار في كل طلبية.',screen:'النتيجة حمرا',do:[{a:'fingAway'},{a:'scroll',sel:'#sm-hero',off:200},{a:'glow',sel:'#sm-hero',sec:1.4}],read:{hero:'#sm-hero-value',label:'#sm-hero-label'}},
 {say:'نفس المنتج… غير الليد تبدّل. هذا علاش تحسب قبل ما تشري.',screen:'نبقاو على النتيجة',do:[{a:'wait',sec:0.3}]},
 {say:'جرّب منتجك مجاناً. اكتب «بوصلة» ونبعثلك الرابط.',screen:'رجوع للفوق',do:[{a:'scroll',sel:'#sm-buy',off:330,sec:1}],pause:0.8},
]};
