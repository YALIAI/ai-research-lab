(async()=>{
 const checks=[], measurements=[];
 const wait=()=>new Promise(resolve=>setTimeout(resolve,100));
 const assert=(condition,label)=>{if(!condition)throw Error(label);checks.push(label)};
 function inspect(label){
   layoutPI();refreshBeam();
   const pi=document.querySelector('.agent.pi'),talk=pi.querySelector('.talk');
   const arena=document.querySelector('.arena').getBoundingClientRect();
   const question=document.querySelector('.center').getBoundingClientRect();
   const bubble=talk.getBoundingClientRect(),agent=pi.getBoundingClientRect();
   const gaps=[];
   for(const time of [0,400,800,1200,1600]){
     pi.querySelector('.portrait').getAnimations().forEach(a=>{a.pause();a.currentTime=time});
     gaps.push(pi.querySelector('.portrait').getBoundingClientRect().top-bubble.bottom);
   }
   measurements.push({label,viewport:innerWidth,arenaHeight:arena.height,topGap:bubble.top-arena.top,questionGap:question.top-agent.bottom,bubbleAvatarGap:Math.min(...gaps)});
   assert(bubble.top-arena.top>=24,label+': bubble clears arena top');
   assert(bubble.left>=arena.left&&bubble.right<=arena.right,label+': bubble inside arena horizontally');
   assert(Math.min(...gaps)>=16,label+': floating avatar clears bubble');
   assert(question.top-agent.bottom>=23.98,label+': PI labels clear question by 24px');
   assert(beam.classList.contains('show'),label+': animated beam visible');
   const svg=beam.ownerSVGElement.getBoundingClientRect();
   assert(Math.abs(Number(beam.getAttribute('y2'))/700*svg.height+svg.top-(agent.top+agent.height/2))<1,label+': beam follows PI');
   for(const [name,x,y] of [['researcher',innerWidth<=600?15:19,innerWidth<=600?39:38],['writer',innerWidth<=600?85:81,innerWidth<=600?39:38],['analyst',innerWidth<=600?21:24,innerWidth<=600?76:78],['critic',innerWidth<=600?79:76,innerWidth<=600?76:78]]){
     const style=getComputedStyle(document.querySelector('.agent.'+name));
     assert(Math.abs(parseFloat(style.left)/(arena.width-2)*100-x)<.2,label+': '+name+' horizontal orbit unchanged');
     assert(Math.abs(parseFloat(style.top)/(arena.height-2)*100-y)<.2,label+': '+name+' vertical orbit unchanged');
   }
 }
 try{
   clearTimeout(timer);await wait();inspect('Demo on load');
   switchMode('live');$('research-topic').value='Evidence and scientific uncertainty '.repeat(14).slice(0,500);syncResearchQuestion();
   renderLiveEvent({id:'pi-long',agent:'PI',message:'LongLiveMessage'.repeat(80)});
   await wait();inspect('Long live message');
   const bubble=document.querySelector('.agent.pi .talk');
   assert(bubble.scrollHeight>bubble.clientHeight&&getComputedStyle(bubble).overflowY==='auto','long live text scrolls within bubble');
   selectPanel('overview');selectPanel('debate');await wait();inspect('Live after tab return');
   switchMode('demo');clearTimeout(timer);await wait();inspect('Demo restored');
   if(!sessionStorage.getItem('pi-layout-refreshed')){sessionStorage.setItem('pi-layout-refreshed','yes');location.reload();return}
   document.body.innerHTML='<pre id="test-result">'+JSON.stringify({passed:true,afterRefresh:true,checks,measurements},null,2)+'</pre>';
 }catch(error){document.body.innerHTML='<pre id="test-result">'+JSON.stringify({passed:false,error:error.stack,checks,measurements},null,2)+'</pre>'}
})();
