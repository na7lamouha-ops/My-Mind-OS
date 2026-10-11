const {reset}=require('./common.js');
module.exports={name:'r1_demo_fostan',setup:reset(true),blocks:[
 {say:'عطيني منتجك… ونقولك شحال يبقالك فيه بصح.',screen:'الأداة من الفوق',do:[{a:'wait',sec:0.4}]},
 {say:'نبداو من الهدف: 100 مليون.',screen:'تكتب الهدف',do:[{a:'type',sel:'#sm-target',text:'1000000'}]},
 {say:'المنتج: فستان. نشريه بـ 3,000… ونبيعو بـ 8,900.',screen:'تكتب الشراء والبيع',do:[{a:'scroll',sel:'#sm-buy',off:260},{a:'type',sel:'#sm-buy',text:'3000'},{a:'type',sel:'#sm-sell',text:'8900'}]},
 {say:'الليد بـ 1.8 دولار… يعني 441 دينار.',screen:'تكتب الليد',do:[{a:'scroll',sel:'#sm-lead-usd',off:300},{a:'type',sel:'#sm-lead-usd',text:'1.8'}],read:{lead:'#sm-lead-dzd'}},
 {say:'التأكيد 55%… والتوصيل 50%.',screen:'تحرّك السلايدرز',do:[{a:'scroll',sel:'#sm-conf',off:260},{a:'slide',sel:'#sm-conf',from:70,to:55,sec:0.9},{a:'slide',sel:'#sm-del',from:70,to:50,sec:0.9}]},
 {say:'التوصيل والتغليف 250… والروتور 100.',screen:'تكتب التوصيل والروتور',do:[{a:'scroll',sel:'#sm-other',off:200},{a:'type',sel:'#sm-other',text:'250'},{a:'type',sel:'#sm-retour',text:'100'}]},
 {say:'شوف: 3,946 دينار صافي في كل طلبية موصلة.',screen:'النتيجة تضوي',do:[{a:'fingAway'},{a:'scroll',sel:'#sm-surplus',off:150},{a:'glow',sel:'#sm-hero',sec:1.4}],read:{hero:'#sm-hero-value'}},
 {say:'بصح نسينا حاجة: المقاسات والألوان اللي ما يتباعوش.',screen:'سلايدر الفائض من 0 لـ 20%',do:[{a:'slide',sel:'#sm-surplus',from:0,to:20,sec:1.8}],read:{hero:'#sm-hero-value'}},
 {say:'3,646. ماشي 3,946… 300 دينار تمشي في الفائض.',screen:'النتيجة الجديدة تضوي',do:[{a:'fingAway'},{a:'glow',sel:'#sm-hero',sec:1.6}]},
 {say:'وأغلى ليد تقدر تخلّصو قبل ما تخسر: 1,444 دينار.',screen:'أقصى ليد',do:[{a:'scroll',sel:'#sm-breakeven',off:330},{a:'glow',sel:'.simple-result-box:has(#sm-breakeven)',sec:1.4}],read:{be:'#sm-breakeven'}},
 {say:'واسترجاع الدفعة: 44 قطعة من كل 100 ترجّعلك ثمنها.',screen:'استرجاع الدفعة',do:[{a:'scroll',sel:'#mp-be',off:330},{a:'glow',sel:'.smap-r:has(#mp-be)',sec:1.4}],read:{rec:'#mp-be'}},
 {say:'ورأس المال والليدات؟ يبانولك بين رقمين. الرقم بالضبط، ونهار يرجعلك رأس مالك… في المتقدم.',screen:'الخانات «بين رقمين» + القفل',do:[{a:'scroll',sel:'#mp-cap',off:330},{a:'glow',sel:'.smap-r:has(#mp-cap)',sec:1.4},{a:'scroll',sel:'.smap-lock',off:260,sec:0.9},{a:'glow',sel:'.smap-lock',sec:1.2}],read:{cap:'#mp-cap',leads:'#mp-leads'}},
 {say:'جرّب بمنتجك أنت. مجاناً، دقيقة. الرابط في البيو.',screen:'رجوع للفوق',do:[{a:'scroll',sel:'#sm-target',off:330,sec:1.1}],pause:0.8},
]};
