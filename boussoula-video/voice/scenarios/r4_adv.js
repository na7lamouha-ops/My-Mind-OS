// المتقدم: نفس الهدف (100 مليون)، 3 خطط — لينا، إلياس، عبد الرحمان. النهار بالضبط مغبّش.
const C1='#prodCards > div:nth-child(1)';
module.exports={name:'r4_adv_3plans',label:'مثال محسوب — شخصيات تمثيلية — ماشي وعد',blurDays:true,
 setup:new Function(`grantAccess('X'); try{localStorage.setItem('bt_welcome','1')}catch(e){}; switchMode('advanced'); switchTab(0); window.scrollTo(0,0);`),
 blocks:[
 {say:'نفس الهدف… 3 خطط. شوف واش يحسبلك المتقدم.',screen:'الوجهة: الهدف والمدة',do:[{a:'scroll',sel:'#sec-target',off:120,sec:0.6},{a:'glow',sel:'#sec-target',sec:1}]},
 {say:'لينا: 100 مليون في 40 يوم.',screen:'40 يوم تضوي',do:[{a:'glow',sel:'#periodBtns',sec:1.2}]},
 {say:'دخّلت 3 منتجات: فستان، عباية، وطقم.',screen:'الخطة: بطاقات المنتجات',do:[{a:'eval',js:"switchTab(1)"},{a:'jump',sel:'#prodCards',off:120},{a:'scroll',sel:'#prodCards > div:nth-child(3)',off:200,sec:1.6}]},
 {say:'والكوتش اختار الفستان والطقم… وخرّج العباية.',screen:'اختيار الكوتش',do:[{a:'scroll',sel:'#scenarioChoices',off:160,sec:1},{a:'glow',sel:'#scenarioChoices',sec:1.4}]},
 {say:'رأس المال اللازم: 61.5 مليون. و36 ليد في النهار.',screen:'دمج منتجين: رأس المال والليدات',do:[{a:'scroll',sel:'#execContainer',off:120,sec:1},{a:'glow',sel:'#execContainer',sec:1.5}]},
 {say:'يكفيها مؤكّد واحد ومتتبّع واحد… ويبقالها حوالي 158 قطعة.',screen:'الفريق + السلعة اللي تبقى',do:[{a:'tag',text:'واش يبقى عندك',id:'r_left'},{a:'scroll',sel:'#r_left',off:420,sec:1.1},{a:'glow',sel:'#r_left',sec:1}]},
 {say:'إلياس: نفس المنتجين… بصح حب يوصل في 30 يوم.',screen:'نبدّلو المدة لـ 30 يوم',do:[{a:'scroll',sel:'#periodBtns',off:220,sec:1.1},{a:'tap',sel:'#periodBtns .pbtn[data-val="30"]',click:true}]},
 {say:'رأس المال طلع لـ 98.8 مليون… و52 ليد في النهار.',screen:'الأرقام الجديدة',do:[{a:'fingAway'},{a:'scroll',sel:'#execContainer',off:120,sec:1.2},{a:'glow',sel:'#execContainer',sec:1.5}],read:{exec:'#execContainer'}},
 {say:'يعني حوالي 37 مليون زايدين… باش يربح 10 أيام.',screen:'نبقاو على الأرقام',do:[{a:'wait',sec:0.4}]},
 {say:'عبد الرحمان: منتج واحد يمشي بزاف. يكلّف 2,000… ويتباع بـ 4,500.',screen:'40 يوم + منتج واحد',do:[{a:'scroll',sel:'#periodBtns',off:220,sec:1},{a:'tap',sel:'#periodBtns .pbtn[data-val="40"]',click:true},{a:'scroll',sel:'#prodCards',off:120,sec:1},
   {a:'tap',sel:'#prodCards > div:nth-child(3) .prod-x',click:true},{a:'tap',sel:'#prodCards > div:nth-child(2) .prod-x',click:true},
   {a:'type',sel:C1+' .pname',text:'منتج يمشي بزاف'},{a:'type',sel:C1+' input[oninput*="buy"]',text:'2000'},{a:'type',sel:C1+' input[oninput*="sell"]',text:'4500'}]},
 {say:'والليد بدولار و20.',screen:'الليد',do:[{a:'type',sel:'#pc-lead-in-0',text:'1.2'}]},
 {say:'رأس المال: 421 مليون. 234 ليد في النهار… و6 عمال.',screen:'الأرقام الثقيلة',do:[{a:'fingAway'},{a:'scroll',sel:'#execContainer',off:120,sec:1.2},{a:'glow',sel:'#execContainer',sec:1.6}],read:{exec:'#execContainer'}},
 {say:'والبوصلة تنبّهو: الأرقام ثقيلة بزاف… وتقولو علاش.',screen:'تنبيه البوصلة',do:[{a:'wait',sec:0.6}]},
 {say:'نفس الهدف، 3 خطط… وكل خطة عندها ثمنها.',screen:'نبقاو',do:[{a:'wait',sec:0.3}]},
 {say:'شوف خطتك أنت قبل ما تبدا. البسيط مجاني، والمتقدم بـ 3,900 دينار مرة وحدة. الرابط في البيو.',screen:'رجوع للفوق',do:[{a:'scroll',sel:'#sec-target',off:120,sec:1.2}],pause:0.8},
]};
