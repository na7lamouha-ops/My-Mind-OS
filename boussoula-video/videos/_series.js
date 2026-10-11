// سلسلة «النزيف الصامت» — كل حلقة: تاجر واحد، غلطة وحدة، مثال كامل بالأرقام، درس واحد، والحلقة الجاية (open loop)
// البنية: هوك (لحظة الوجع) ← شكون ودار واش ← الغلطة ← الكشف بالرقم ← الحقيقة ← CTA + الحلقة الجاية
window.AV=(name,emoji,g,sub,o)=>Object.assign({type:'avatar',x:540,y:330,g,emoji,name,sub},o||{});
window.Q=(t,y,o)=>Object.assign({type:'text',size:'mid',t:`<span class="q">${t}</span>`,y},o||{});
window.END=(next,btn)=>({d:4,items:[{type:'cta',brand:'البوصلة من Na7la',tag:next?`الحلقة الجاية: ${next}`:'الحكايات كاملة في كتاب «النزيف الصامت» 📖',btn:btn||'🧭 احسب رقمك أنت — مجاناً'}]});
window.SERIES={
 // E0 — الحماس ضد البداية الصحيحة
 e0:{yoff:70,badge:'🧭 قبل ما تبدا',disc:DISC_N,scenes:[
  {d:3.4,items:[AV('أنيس','🤩','gray','قرا «ملخص النجاح» في ليلة'),{type:'text',size:'big',slam:true,t:'«غدوة نبدا!» 🔥',y:720,at:0.6}]},
  {d:5,items:[{type:'text',size:'mid',t:'كتاب كتبو تاجر إلكتروني…<br>حكى طريقو، وعطاك الدافع.',y:520},{type:'text',size:'mid',color:'gold',t:'والدافع مهم. بلا بيه ما تبداش.',y:780,at:2}]},
  {d:5,tint:'red',items:[{type:'text',size:'mid',t:'في الصباح: شرى السلعة،<br>فتح صفحة، وطلق إعلان…',y:520},{type:'text',size:'big',color:'red',slam:true,t:'بلا ما يعرف وين رايح.',y:800,at:2.4}]},
  {d:8.2,tint:'gold',items:[{type:'text',size:'mid',t:'قبل الدينار الأول، كان لازم يعرف:',y:380},{type:'list',y:580,at:0.5,step:1.1,rows:[{t:'الهدف',s:'شحال، وفي قداش من وقت'},{t:'رأس المال اللي يلزم',s:'ماشي ثمن السلعة برك'},{t:'وقتاش يرجع الكاش',s:'ماشي «من بعد نشوف»'},{t:'المعيار',s:'الكاش اللي يرجع، ماشي عدد الطلبيات'}]}]},
  {d:5,items:[{type:'text',size:'big',slam:true,t:'الحماس يطلقك…',y:540},{type:'text',size:'big',color:'gold',slam:true,t:'والبداية الصحيحة<br>توصلك.',y:720,at:1.3}]},
  {d:6,items:[{type:'list',y:440,at:0.2,step:1.2,rows:[{n:'📕',t:'«ملخص النجاح»',s:'يحمّسك تبدا'},{n:'🧭',t:'البوصلة',s:'تعطيك البداية الصحيحة لأي مشروع'},{n:'📖',t:'«النزيف الصامت»',s:'الغلطات اللي ما يحكيهاش حتى واحد'}]}]},
  END('إلياس ولينا: نفس الهدف… و37 مليون فرق')]},

 // E1 — النزيف 0: إلياس ولينا
 e1:{yoff:70,badge:'🩸 النزيف الصامت · 0',disc:DISC_B,scenes:[
  {d:3.6,items:[AV('إلياس','🏃','red','«ازدم وسكايلي»',{x:760}),AV('لينا','🧭','green','«الخريطة قبل»',{x:320,at:0.3}),{type:'text',size:'big',slam:true,t:'نفس الهدف:<br>100 مليون.',y:660,at:0.7},{type:'text',size:'mid',color:'gold',t:'واحد فيهم خلّص 37 مليون زايدين.',y:920,at:1.7}]},
  {d:5,items:[AV('إلياس','🏃','red','صانع محتوى'),{type:'text',size:'mid',t:'يعاود لجمهورو كل نهار:<br>«ما تخممش بزاف. ازدم وسكايلي.»',y:680,at:0.4},{type:'text',size:'mid',color:'red',t:'حط هدف: 100 مليون في شهر.',y:920,at:2.4}]},
  {d:5,tint:'red',items:[{type:'text',size:'mid',t:'بعد أسبوع: الستوك خلاص،<br>والكاش مازال في الطريق…',y:520},{type:'text',size:'mid',color:'red',slam:true,t:'وهو يسلّف باش ما يحبسش الإعلان.',y:800,at:2.3}]},
  {d:7,disc:{},items:[{type:'text',size:'sm',t:'نفس المنتجين، نفس الفريق:',y:330},{type:'split',y:420,at:0.3,step:1,cols:[{k:'bad',h:'إلياس',s:'30 يوم',rows:[['ليد/نهار','52'],['رأس المال','99 م'],['سلعة تبقى','212']]},{k:'good',h:'لينا',s:'40 يوم',rows:[['ليد/نهار','36'],['رأس المال','61.5 م'],['سلعة تبقى','158']]}]}]},
  {d:4.6,disc:{},items:[{type:'counter',y:480,at:0.1,from:0,to:37,dur:1.2,size:220,color:'red',suf:'<span style="font-size:70px"> مليون</span>',label:'زايدين من جيب إلياس…<br>باش يربح 10 أيام برك.'}]},
  {d:4.6,items:[{type:'text',size:'big',slam:true,t:'السرعة في الاتجاه الغالط…',y:540},{type:'text',size:'mid',color:'gold',t:'ما توصلكش أسرع. تبعدك أسرع.',y:780,at:1.4}]},
  END('أمين و«المارج اللي يكذب عليك»')]},

 // E2 — النزيف 1: أمين والفستان
 e2:{yoff:70,badge:'🩸 النزيف الصامت · 1',disc:DISC_B,scenes:[
  {d:3.8,items:[AV('أمين','👗','blue','ماشي مبتدئ'),{type:'text',size:'big',slam:true,t:'3,946 دج صافي<br>في كل فستان.',y:680,at:0.5},{type:'text',size:'mid',color:'gold',t:'وحساب مازال ما كملش.',y:960,at:1.8}]},
  {d:5.4,items:[{type:'text',size:'mid',t:'يبيع الفستان بـ <span class="gold">8,900</span>،<br>يشريه بـ <span class="gold">3,000</span>.',y:460},{type:'text',size:'sm',t:'حسب التغليف، التوصيل، الروتور والأدس.',y:700,at:1.6},{type:'text',size:'mid',t:'وقال: «عرفت تجارتي.»',y:840,at:3}]},
  {d:6,tint:'red',disc:{},items:[{type:'text',size:'mid',t:'نسى سؤال: المقاسات والألوان<br>اللي ما مشاوش… شكون يخلّصها؟',y:380},{type:'counter',y:640,at:1.6,from:3946,to:3646,dur:1.2,size:190,color:'red',suf:'<span style="font-size:60px"> دج</span>',label:'بعد السلعة اللي تبقى (~300 دج في كل طلبية)'}]},
  {d:6.8,disc:{},items:[{type:'text',size:'mid',t:'وناقصتو حدود ملعبو:',y:360},{type:'list',y:480,at:0.5,step:1.1,rows:[{n:'📣',t:'أغلى ليد يقدر يخلّصو: 1,444 دج'},{n:'🏷️',t:'أقل سعر يبيع بيه: 5,254 دج'}]},{type:'text',size:'mid',color:'red',t:'برّا هاذ الحدود، الربح يولّي خسارة.',y:820,at:3}]},
  {d:4.4,items:[{type:'text',size:'big',slam:true,t:'المارج رقم واحد…',y:540},{type:'text',size:'mid',color:'gold',t:'ماشي آخر الحساب.',y:760,at:1.2}]},
  END('رياض و«100 ليد في النهار»')]},

 // E3 — النزيف 2: رياض والليد
 e3:{yoff:70,badge:'🩸 النزيف الصامت · 2',disc:DISC_B,scenes:[
  {d:3.2,items:[AV('رياض','📸','orange','يتبع صناع المحتوى'),{type:'text',size:'big',slam:true,t:'«100 ليد في النهار!» 🎉',y:700,at:0.5}]},
  {d:6.6,items:[{type:'chat',y:360,list:[{side:'r',who:'رياض · الغروب',t:'شوفو الكوسط كيفاش هابط! 441 دج للليد 🔥',at:0.3},{side:'l',who:'صاحبو',t:'ماشاء الله خويا 🔥🔥',at:1.8},{side:'l',who:'واحد آخر',t:'علّمنا كيفاش 😍',at:2.8}]},{type:'text',size:'sm',t:'التسيير؟ ما عطاهش أهمية… حتى نهار قعد يحسب.',y:1060,at:3.8}]},
  {d:7,tint:'red',disc:{t:'مثال: تأكيد 55% · توصيل 50% — محسوب بالبوصلة، ماشي وعد بالربح.'},items:[{type:'flow',y:360,at:0.2,step:0.7,nodes:[{i:'📥',b:'100',s:'ليد'},{i:'📞',b:'55',s:'يأكّدو'},{i:'💵',b:'~27',s:'يخلّصو'}]},{type:'counter',y:660,at:2.4,from:441,to:1604,dur:1.4,size:200,color:'red',suf:'<span style="font-size:64px"> دج</span>',label:'الإعلان الحقيقي على كل طلبية موصّلة (×3.6)'}]},
  {d:4.8,items:[{type:'text',size:'mid',t:'والـ100 ليد اللي فرحان بيهم؟',y:500},{type:'text',size:'big',color:'gold',slam:true,t:'~27 طلبية برك<br>تدخّل الدراهم.',y:680,at:1.4}]},
  {d:4.4,items:[{type:'text',size:'mid',t:'الإعلان يتحسب على اللي خلّص…',y:540},{type:'text',size:'mid',color:'gold',slam:true,t:'ماشي على اللي طلب.',y:720,at:1.3}]},
  END('سارة… واليوم 8')]},

 // E4 — النزيف 3: سارة ورأس المال
 e4:{yoff:70,badge:'🩸 النزيف الصامت · 3',disc:DISC_B,scenes:[
  {d:3.6,items:[AV('سارة','🧕','gold','جمعت 39 مليون في عامين'),{type:'text',size:'big',slam:true,t:'وفي اليوم 8…',y:700,at:0.6},{type:'text',size:'big',color:'red',slam:true,t:'الكاش خلاص.',y:860,at:1.6}]},
  {d:5,items:[{type:'text',size:'mid',t:'كل دينار بتعبو. حسبت:',y:500},{type:'text',size:'mid',t:'<span class="q">«الستوك بـ 39 مليون، ونبدا.»</span>',y:680,at:1.2}]},
  {d:6.8,tint:'red',items:[{type:'text',size:'mid',t:'اليوم 8: الإعلان وقف،<br>والسلعة في الكراطن.',y:440},{type:'text',size:'sm',t:'كل ليلة تعاود تحسب في التيليفون… ونفس الرقم يطلعلها: ناقص.',y:700,at:2},{type:'text',size:'mid',color:'red',t:'وما قدرتش تقولها لحتى واحد.',y:900,at:3.8}]},
  {d:6.4,disc:{},items:[{type:'text',size:'sm',t:'لو كانت تخدم خطة لينا:',y:340},{type:'split',y:440,at:0.3,step:0.9,cols:[{k:'bad',h:'الستوك',rows:[['اللي حسبت','39 م']]},{k:'good',h:'رأس المال',rows:[['اللي يلزم','61.5 م']]}]},{type:'text',size:'mid',color:'red',t:'الفرق هو اللي وقّفها في النص.',y:820,at:2.6}]},
  {d:4.8,items:[{type:'text',size:'mid',t:'رأس المال = ستوك + أدس + احتياط',y:520},{type:'text',size:'big',color:'gold',slam:true,t:'حتى يرجع أول كاش.',y:700,at:1.4}]},
  END('ياسين… وسؤال كل ليلة 🌙')]},

 // E5 — النزيف 4: ياسين ورجوع الدراهم
 e5:{yoff:70,badge:'🩸 النزيف الصامت · 4',disc:DISC_B,scenes:[
  {d:3.6,items:[AV('ياسين','🌙','blue','شرى فورماسيون'),{type:'text',size:'mid',t:'كل ليلة نفس السؤال:',y:660,at:0.4},{type:'text',size:'big',color:'gold',slam:true,t:'«وقتاش نرجّع فلوسي؟»',y:780,at:1.1}]},
  {d:6,items:[{type:'text',size:'mid',t:'خبّى <span class="gold">70 مليون</span> باش يبدا،<br>وشرى 200 قطعة.',y:460},{type:'text',size:'sm',t:'الفورماسيون علّمتو كيفاش يطلق إعلان…',y:720,at:1.8},{type:'text',size:'mid',color:'red',t:'ما علّمتوش وقتاش يرجعلو الدينار.',y:850,at:3}]},
  {d:4.2,items:[{type:'text',size:'mid',t:'«نبيع النص، نرجّع فلوسي.»',y:560,strike:1.6},{type:'text',size:'sm',t:'(تخمين)',y:700,at:1.8}]},
  {d:6,tint:'green',disc:{},items:[{type:'counter',y:400,at:0.2,from:0,to:44,dur:1.2,size:220,color:'grn',suf:'<span style="font-size:70px"> / 100</span>',label:'قطعة تكفي باش ترجّع الدفعة (فستان أمين)'},{type:'text',size:'mid',color:'gold',t:'والباقي ربح.',y:860,at:2.6}]},
  {d:6,disc:{},items:[{type:'text',size:'sm',t:'ورأس المال؟ في خطة لينا:',y:340},{type:'timeline',y:620,at:0.2,days:40,mark:23,dur:2.4,ticks:[1,30,40],pinLabel:'🔒',ok:'✅ يرجع قبل اليوم 30'},{type:'text',size:'sm',t:'النهار بالضبط؟ في المتقدم 🔒',y:1000,at:3.8}]},
  END('الدراهم اللي خلّصتها… وخلّيتها 💬')]},

 // E6 — النزيف 5: الربح المهمل
 e6:{yoff:70,badge:'🩸 النزيف الصامت · 5',disc:DISC_B,scenes:[
  {d:3.4,items:[AV('أمين','🤷','blue','عندو رسائل ما تجاوبتش'),{type:'text',size:'big',slam:true,t:'«ماشي مهم…<br>يجيو غيرهم.»',y:690,at:0.5}]},
  {d:5.4,items:[{type:'phone',y:330,head:'💬 ما تجاوبتش',badge:{from:0,to:6,at:0.3,dur:3.2},notifs:[['🛒','طلبية ما تكمّلتش','المتجر'],['💬','«شحال؟»','صفحة الفيسبوك'],['📩','«كاين التوصيل لتيارت؟»','إنستغرام'],['🛒','حط الرقم وخرج','المتجر'],['💬','«مازال كاين؟»','ماسنجر'],['📩','«نحب نطلب 2»','إنستغرام']].map((n,i)=>({i:n[0],t:n[1],s:n[2],at:0.4+i*0.55}))}]},
  {d:4.6,tint:'red',items:[{type:'text',size:'mid',t:'ويزيد في ميزانية الأدس…',y:500},{type:'text',size:'mid',color:'red',slam:true,t:'باش يجيب ناس كانو عندو ديجا.',y:680,at:1.3}]},
  {d:5.6,tint:'gold',disc:{},items:[{type:'counter',y:380,at:0.2,from:0,to:12,dur:1.2,size:220,color:'gold',pre:'+',suf:'<span style="font-size:70px"> مليون</span>',label:'في 40 يوم (خطة لينا)… لو يرجّع ربعهم برك'},{type:'text',size:'mid',t:'أكثر من 3,000 دج كل نهار.',y:840,at:2.4}]},
  {d:5.4,items:[{type:'text',size:'mid',t:'كيفاش يرجّعهم؟ 👇',y:340},{type:'list',y:460,at:0.4,step:0.7,rows:[{n:'🔥',t:'الساخن الأول',s:'اللي كتب اليوم قبل اللي كتب البارح'},{n:'2',t:'روتين 7 خطوات',lock:true},{n:'3',t:'العرض اللي ما يتفوّتش',lock:true},{n:'4',t:'رسائل جاهزة للفريق',lock:true}]}]},
  {d:4,items:[{type:'text',size:'mid',t:'أرخص ربح…',y:540},{type:'text',size:'mid',color:'gold',slam:true,t:'هو اللي خلّصت ثمنو، وخلّيتو.',y:700,at:1}]},
  END('نادية… و158 قطعة في المخزن 📦')]},

 // E7 — النزيف 6: نادية والسلعة اللي تبقى
 e7:{yoff:70,badge:'🩸 النزيف الصامت · 6',disc:DISC_B,scenes:[
  {d:3.4,items:[AV('نادية','📦','green','وصلت الهدف'),{type:'text',size:'big',slam:true,t:'ووقفت.',y:700,at:0.5},{type:'text',size:'mid',color:'gold',t:'ولقات 158 قطعة في المخزن.',y:880,at:1.5}]},
  {d:4.6,tint:'red',items:[{type:'text',size:'mid',t:'فلوس راقدة… حسبتها خسارة.',y:500},{type:'text',size:'mid',t:'«الباقي = خسارة»',y:680,at:1.2,strike:2.4},{type:'text',size:'mid',t:'ولا العكس: «الباقي = ربح»',y:820,at:2.8,strike:3.8}]},
  {d:5.6,tint:'gold',disc:{},items:[{type:'counter',y:420,at:0.2,from:0,to:27,dur:1.2,size:220,color:'gold',pre:'~',suf:'<span style="font-size:70px"> مليون</span>',label:'الفرق بين «توقف» و«تكمل»<br>على نفس الـ158 قطعة'}]},
  {d:5.8,items:[{type:'text',size:'mid',t:'السلعة الباقية ماشي خسارة ولا ربح…',y:480},{type:'text',size:'big',color:'gold',slam:true,t:'حسب واش تدير بيها.',y:660,at:1.4},{type:'text',size:'sm',t:'أي قرار يربّحك أكثر؟ بالأرقام: في المتقدم 🔒',y:900,at:3}]},
  END('دحمان… وأحسن أسبوع 📈')]},

 // E8 — النزيف 7: دحمان وأحسن أسبوع
 e8:{yoff:70,badge:'🩸 النزيف الصامت · 7',disc:DISC_B,scenes:[
  {d:3.4,items:[AV('دحمان','📈','orange','يلقى المنتجات قبل الناس'),{type:'text',size:'big',slam:true,t:'عائد 963% 🤯',y:700,at:0.5},{type:'text',size:'mid',color:'gold',t:'فرح… وكبّر الميزانية.',y:880,at:1.6}]},
  {d:5.4,items:[{type:'text',size:'mid',t:'تاجر قوي: يراقب السوق كل نهار.',y:440},{type:'text',size:'mid',color:'red',t:'بصح يسعّر بالعين،<br>ويبني خطتو على أحسن أسبوع.',y:640,at:1.8}]},
  {d:7,tint:'red',disc:{},items:[{type:'text',size:'sm',t:'منتج بـ 2,500، يكلّف 500:',y:330},{type:'split',y:420,at:0.3,step:1.1,cols:[{k:'good',h:'أحسن أسبوع',rows:[['توصيل','65%'],['ليد','0.3$'],['العائد','963%']]},{k:'bad',h:'أسبوع عادي',rows:[['توصيل','45%'],['ليد','1$'],['العائد','46%']]}]}]},
  {d:4.8,items:[{type:'text',size:'mid',t:'المنتج الصح نص الخدمة برك.',y:520},{type:'text',size:'big',color:'gold',slam:true,t:'الخطة تتحسب<br>على أسوأ أسبوع.',y:680,at:1.4}]},
  END(null,'📖 اقرا الحكايات كاملة — مجاناً')]},
};
