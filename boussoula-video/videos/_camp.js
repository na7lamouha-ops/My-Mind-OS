// حملة «الخريطة قبل الصرف» — 8 كرياتيفات سريعة + هوكات بديلة للتيست
window.H=(a,b,c)=>({d:2.2,items:[{type:'text',size:'big',slam:true,static:false,t:a,y:b||640,color:c}]});
window.HOOK2=(a,b,y)=>({d:2.6,items:[{type:'text',size:'big',slam:true,t:a,y:y||560},{type:'text',size:'big',color:'gold',slam:true,t:b,y:(y||560)+230,at:0.9}]});
window.HOOKS={
 f3a:()=>H('الليد بـ 441؟<br>لا… <bdi>1,604</bdi>',560), f3b:()=>H('441 دج للليد؟ عاود احسب.',600),
 f6a:()=>HOOK2('طلبيات متروكة…','دراهم خلّصتها ديجا.',540), f6b:()=>H('الربح اللي راقد في الميساجات.',600),
 f4a:()=>HOOK2('9 أرقام.','شحال تعرف منهم؟',560), f4b:()=>H('تحدي: 9 أرقام في دقيقتين.',600)};
window.CAMP={
 // F1 — STOP قبل ما تشري (A1 · الحساب قبل الصرف)
 f1:(hook)=>({fast:true,yoff:110,disc:DISC_B,scenes:[
  hook||HOOK2('✋ حبس!','قبل ما تشري السلعة.',560),
  {d:4.4,tint:'gold',items:[{type:'text',size:'mid',t:'جاوب في راسك 👇',y:300},{type:'list',y:450,at:0.4,step:0.75,rows:[{t:'شحال يلزمك رأس مال؟'},{t:'وقتاش يرجعلك الكاش؟'},{t:'شحال من سلعة تبقالك؟'}]}]},
  {d:2.6,items:[{type:'text',size:'big',slam:true,t:'ما عرفتش؟',y:560},{type:'text',size:'sm',t:'عادي… أغلب التجار يخمّنو.',y:800,at:0.8}]},
  {d:4.2,tint:'green',disc:{},items:[{type:'text',size:'sm',t:'مثال لينا — هدف مبيعات 100 مليون في 40 يوم:',y:280},{type:'counter',y:420,from:0,to:61.5,dec:1,dur:1.4,size:160,color:'gold',suf:'<span style="font-size:60px"> مليون</span>',label:'رأس المال اللي يلزم'},{type:'text',size:'mid',color:'grn',t:'✅ يرجع قبل اليوم 30',y:820,at:2.2,slam:true}]},
  {d:2.2,items:[{type:'text',size:'big',color:'gold',slam:true,t:'البوصلة تحسبهالك<br>في دقيقة.',y:600}]},
  CTA_AD('🧭 احسب منتجك — مجاناً','قبل ما تزدم… شوف وين رايح.<br>+ كتاب «النزيف الصامت» هدية 🎁')]}),
 // F2 — الطلبيات تجي… والكاش؟ (A2 · رقم أعمال ولا فايدة)
 f2:(hook)=>({fast:true,yoff:110,disc:DISC_N,scenes:[
  hook||{d:5.4,disc:{},items:[{type:'text',size:'mid',slam:true,t:'234 ليد في النهار 🔥',y:200},{type:'phone',y:300,at:0,head:'🛒 ليدات اليوم',badge:{from:0,to:234,at:0.2,dur:4.6},notifs:[0.4,0.9,1.3,1.7,2.0,2.3,2.6,2.85,3.1,3.35,3.6,3.85].map((a,i)=>({i:'🛒',t:'ليد جديد',s:['وهران · 2 قطع','الجزائر · قطعة','سطيف · 3 قطع','عنابة · قطعة','البليدة · 2 قطع','قسنطينة · قطعة'][i%6],at:a}))}]},
  {d:3.4,tint:'red',disc:{},items:[{type:'text',size:'big',slam:true,t:'والكاش؟',y:420},{type:'meter',y:720,at:0.5,nopc:true,label:'💸 الكاش اللي يبقى في اليد (مثال)',from:100,to:20,dur:2.2,color:'#ff4d6a'}]},
  {d:4.2,items:[{type:'text',size:'big',slam:true,t:'الطلبية ماشي ربح.',y:520},{type:'text',size:'sm',t:'الربح هو اللي يبقى بعد الإعلان، الروتور، والسلعة اللي تبقى.',y:760,at:1}]},
  {d:3.4,tint:'gold',items:[{type:'text',size:'mid',color:'gold',slam:true,t:'البوصلة تحسبلك الصافي الحقيقي…',y:540},{type:'text',size:'mid',slam:true,t:'قبل ما تكبّر.',y:740,at:0.9}]},
  CTA_AD('🧭 شوف الصافي تاعك — مجاناً','شوف وين رايح… ومن بعد ازدم وسكايلي.')]}),
 // F3 — الليد بـ 441؟ لا. 1,604 (A1 · الليد الحقيقي)
 f3:(hook)=>({fast:true,yoff:110,disc:DISC_B,scenes:[
  hook||{d:3.6,items:[{type:'text',size:'mid',slam:true,t:'شحال يكلفك الليد؟',y:330},{type:'counter',y:540,at:0.6,to:441,size:220,suf:'<span style="font-size:70px"> دج</span>'},{type:'text',size:'mid',color:'red',slam:true,t:'غلط.',y:900,at:2.2,rot:-4}]},
  {d:5.6,tint:'red',disc:{t:'مثال: تأكيد 55% · توصيل 50% — محسوب بالبوصلة، ماشي وعد بالربح.'},items:[{type:'text',size:'mid',t:'على كل طلبية <span class="gold">موصّلة</span>، زيد:',y:270},{type:'flow',y:420,at:0.3,step:0.55,nodes:[{i:'📞',b:'ماشي الكل',s:'يأكّد'},{i:'🚚',b:'ماشي الكل',s:'يستلم'},{i:'↩️',b:'الروتور',s:'خسارة'}]},{type:'counter',y:760,at:2,from:441,to:1604,dur:1.6,size:220,color:'red',suf:'<span style="font-size:70px"> دج</span>',label:'التكلفة الحقيقية على كل موصّلة (×3.6)'}]},
  {d:3.6,items:[{type:'text',size:'mid',slam:true,t:'الإعلان يتحسب على <span class="gold">الموصّلة</span>…',y:500},{type:'text',size:'mid',slam:true,t:'ماشي على الليد.',y:700,at:0.9}]},
  CTA_AD('🧭 احسب الليد الحقيقي — مجاناً','قبل ما تزدم… شوف وين رايح.<br>+ كتاب «النزيف الصامت» هدية 🎁')]}),
 // F4 — تحدي الـ9 أرقام (الكل · self-assessment)
 f4:(hook)=>({fast:true,yoff:110,disc:DISC_N,scenes:[
  hook||HOOK2('9 أرقام تقرّر تجارتك.','شحال تعرف منهم؟',540),
  {d:5.2,tint:'gold',items:[{type:'text',size:'mid',t:'بالرقم… ماشي «تقريباً» 👇',y:230},{type:'tiles',y:360,at:0.2,step:0.22,scan:2.6,list:['الليدات في النهار','الفريق','الصافي من كل ليد','أقل سعر','استرجاع الدفعة','يوم رجوع رأس المال','رأس المال','الربح المهمل','الستوك اللي يبقى']}]},
  {d:3.4,items:[{type:'text',size:'big',slam:true,t:'«تقريباً» ماشي رقم.',y:500},{type:'text',size:'mid',color:'red',t:'وكل رقم ناقص… نزيف صامت.',y:740,at:1.1}]},
  {d:3.4,tint:'gold',items:[{type:'text',size:'mid',t:'دير التحدي في دقيقتين،',y:480},{type:'text',size:'mid',color:'gold',slam:true,t:'وخذ كتاب «النزيف الصامت» مجاناً.',y:640,at:0.8}]},
  CTA_AD('🎯 دير التحدي — مجاناً','9 أرقام. وأنت شحال؟')]}),
 // F5 — 3 حوايج يقولوهالك وغالطين (A1/A5 · myth vs fact)
 f5:(hook)=>({fast:true,yoff:110,disc:DISC_B,scenes:[
  hook||HOOK2('3 حوايج تسمعهم كل نهار…','وغالطين.',540),
  {d:5,tint:'red',disc:{},items:[{type:'text',size:'mid',t:'«رأس المال = ثمن السلعة»',y:300,strike:1.1},{type:'text',size:'mid',color:'grn',t:'✅ سلعة + إعلان + احتياط<br>حتى يرجع أول كاش.',y:470,at:1.5},{type:'split',y:800,at:2.6,step:0.4,cols:[{k:'bad',h:'السلعة',rows:[['لينا','39 م']]},{k:'good',h:'رأس المال',rows:[['لينا','61.5 م']]}]}]},
  {d:4,tint:'red',items:[{type:'text',size:'mid',t:'«كثرة الطلبيات = فايدة»',y:400,strike:1},{type:'text',size:'mid',color:'grn',t:'✅ الفايدة هي اللي يبقى<br>بعد الإعلان والروتور.',y:580,at:1.4}]},
  {d:4,tint:'red',items:[{type:'text',size:'mid',t:'«نحسب على أحسن أسبوع»',y:400,strike:1},{type:'text',size:'mid',color:'grn',t:'✅ الخطة الصحيحة تتحسب<br>على أسوأ أسبوع.',y:580,at:1.4}]},
  CTA_AD('🧭 احسبها صحيحة — مجاناً')]}),
 // F6 — الربح المهمل (A1/A2 · loss aversion + fog)
 f6:(hook)=>({fast:true,yoff:110,disc:DISC_B,scenes:[
  hook||{d:5,items:[{type:'text',size:'mid',slam:true,t:'طلبيات متروكة… دراهم خلّصتها ديجا.',y:200},{type:'phone',y:300,head:'💬 رسائل ما تجاوبتش',badge:{from:0,to:38,at:0.2,dur:4},notifs:[['💬','«شحال السومة؟»','صفحة الفيسبوك'],['🛒','طلبية متروكة','ما كمّلش الفورم'],['📩','«كاين التوصيل لتيارت؟»','إنستغرام'],['💬','«مازال كاين؟»','صفحة الفيسبوك'],['🛒','طلبية متروكة','حط الرقم وخرج'],['📩','«نحب نطلب 2»','إنستغرام'],['💬','«وين نخلّص؟»','ماسنجر']].map((n,i)=>({i:n[0],t:n[1],s:n[2],at:0.4+i*0.5}))}]},
  {d:3,tint:'red',items:[{type:'text',size:'mid',t:'خلّصت عليهم الإعلان…',y:480},{type:'text',size:'big',color:'red',slam:true,t:'وخلّيتهم يبردو.',y:660,at:0.9}]},
  {d:3.8,tint:'gold',disc:{},items:[{type:'text',size:'sm',t:'في خطة لينا، الربح المهمل:',y:340},{type:'counter',y:470,at:0.3,from:0,to:12,dur:1.3,size:220,color:'gold',pre:'+',suf:'<span style="font-size:70px"> مليون</span>',pulse:true}]},
  {d:4.4,items:[{type:'text',size:'mid',t:'كيفاش ترجّعهم؟ 👇',y:280},{type:'list',y:420,at:0.4,step:0.6,rows:[{t:'🔥 الساخن الأول',s:'اللي كتب اليوم قبل اللي كتب البارح'},{t:'روتين الرد السريع',lock:true},{t:'العرض اللي يرجّعهم',lock:true}]}]},
  CTA_AD('🧭 احسب ربحك المهمل — مجاناً','قبل ما تزدم… شوف وين رايح.<br>+ كتاب «النزيف الصامت» هدية 🎁')]}),
 // F7 — ياسين خبّى 70 مليون (A4 · وقتاش يرجعو دراهمي)
 f7:(hook)=>({fast:true,yoff:110,disc:DISC_B,scenes:[
  hook||{d:3.4,items:[{type:'avatar',x:540,y:300,g:'blue',emoji:'😟',name:'ياسين',sub:'خبّى 70 مليون'},{type:'text',size:'big',slam:true,t:'خبّى 70 مليون… وبقى مقلق.',y:700,at:0.7}]},
  {d:3.4,items:[{type:'text',size:'mid',t:'السؤال ماشي «واش نربح؟»',y:460,strike:1.2},{type:'text',size:'mid',color:'gold',slam:true,t:'السؤال: وقتاش يرجعلي رأس مالي؟',y:640,at:1.6}]},
  {d:5.4,tint:'green',disc:{},items:[{type:'text',size:'sm',t:'مثال لينا — رأس مال 61.5 مليون، هدف 40 يوم:',y:300},{type:'timeline',y:620,at:0.2,days:40,mark:23,dur:2.6,ticks:[1,30,40],pinLabel:'🔒',ok:'✅ رأس المال رجع — قبل اليوم 30'}]},
  {d:3.8,items:[{type:'text',size:'mid',t:'ما نضمنولكش ربح…',y:480},{type:'text',size:'mid',color:'gold',slam:true,t:'نضمنولك الحساب الصحيح<br>قبل الدينار الأول.',y:640,at:1}]},
  CTA_AD('🧭 احسب رأس مالك — مجاناً','النهار بالضبط؟ في المتقدم 🔒')]}),
 // F8 — الشركات تبدا بالهدف (A3 · authority / comparison)
 f8:(hook)=>({fast:true,yoff:110,disc:DISC_N,scenes:[
  hook||HOOK2('أي شركة كبيرة تكتب هدف العام…','قبل الدينار الأول. وأنت؟',480),
  {d:5.4,items:[{type:'split',y:280,at:0.2,step:0.6,cols:[{k:'bad',h:'في راسك / Excel',rows:[['الأرقام','تقريباً'],['زوج منتجات','تتلف'],['الثمن تبدّل','عاود']]},{k:'good',h:'🧭 البوصلة',rows:[['الأرقام','بالضبط'],['المنتجات','حتى 10'],['العروض','تتقارن']]}]}]},
  {d:3.2,tint:'gold',items:[{type:'text',size:'big',slam:true,t:'هدف ← حساب ← خطة.',y:560},{type:'text',size:'sm',t:'الفريق، الستوك، ووقتاش تعاود تطلب… كلش محسوب.',y:780,at:1}]},
  CTA_AD('🧭 ابدا بالهدف — مجاناً','ابدا بالهدف مجاناً… والمقارنة في المتقدم.')]}),
};
