const {reset}=require('./common.js');
module.exports={name:'r3_fast_entry',label:'مثال محسوب — ماشي وعد',setup:reset(true),blocks:[
 {do:[{a:'type',sel:'#sm-target',text:'1000000',fast:true},{a:'scroll',sel:'#sm-buy',off:260,sec:0.5},{a:'type',sel:'#sm-buy',text:'3000',fast:true},{a:'type',sel:'#sm-sell',text:'8900',fast:true},
  {a:'scroll',sel:'#sm-lead-usd',off:300,sec:0.5},{a:'type',sel:'#sm-lead-usd',text:'1.8',fast:true},{a:'scroll',sel:'#sm-conf',off:260,sec:0.5},{a:'slide',sel:'#sm-conf',from:70,to:55,sec:0.5},{a:'slide',sel:'#sm-del',from:70,to:50,sec:0.5},
  {a:'scroll',sel:'#sm-other',off:200,sec:0.5},{a:'type',sel:'#sm-other',text:'250',fast:true},{a:'type',sel:'#sm-retour',text:'100',fast:true},{a:'slide',sel:'#sm-surplus',from:0,to:20,sec:0.6},{a:'fingAway'}],screen:'تدخيل كامل بالخف'},
 {say:'دقيقة. والروتور والفائض داخلين.',screen:'النتيجة',do:[{a:'scroll',sel:'#sm-hero',off:200,sec:0.6},{a:'glow',sel:'#sm-hero',sec:1.2}],read:{hero:'#sm-hero-value'},pause:0.6},
]};
