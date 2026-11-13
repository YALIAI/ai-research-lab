// Injected by the local artifact runner; calls only client-side demo/live renderers.
(async()=>{
 const config=window.bubbleTestConfig||{},rows=[],failures=[];
 const wait=()=>new Promise(r=>setTimeout(r,80));
 const overlaps=(a,b)=>a.left<b.right-.5&&a.right>b.left+.5&&a.top<b.bottom-.5&&a.bottom>b.top+.5;
 const check=(value,message,row)=>{if(!value){failures.push({viewport:innerWidth,mode:row.mode,agent:row.agent,text:row.text,constraint:message});row.failed.push(message)}};
 async function measure(mode,agent,text,kind){
   if(mode==='demo'){
     if(currentMode!=='demo')switchMode('demo');
     restart();clearTimeout(timer);if(agent==='Researcher')showTurn();
     document.querySelector(`[data-agent="${agent}"] .talk`).textContent=text;
   }else{
     if(currentMode!=='live')switchMode('live');
     renderLiveEvent({id:mode+agent+kind,agent,message:text});
   }
   await wait();
   // Inspect the worst (highest) point of the existing avatar float animation.
   const el=document.querySelector(`[data-agent="${agent}"]`),bubble=el.querySelector('.talk');
   el.querySelector('.portrait').getAnimations().forEach(a=>{a.pause();a.currentTime=800});
   const b=bubble.getBoundingClientRect(),arena=document.querySelector('.arena').getBoundingClientRect(),portrait=el.querySelector('.portrait').getBoundingClientRect(),style=getComputedStyle(bubble);
   const range=document.createRange();range.selectNodeContents(bubble);
   const lines=[...range.getClientRects()].filter(r=>r.width>0),lineCount=new Set(lines.map(r=>r.top.toFixed(2))).size;
   const natural=lineCount*parseFloat(style.lineHeight)+parseFloat(style.paddingTop)+parseFloat(style.paddingBottom)+parseFloat(style.borderTopWidth)+parseFloat(style.borderBottomWidth);
   const row={viewport:innerWidth,mode,agent,text:kind,bubbleHeight:+b.height.toFixed(2),naturalHeight:+natural.toFixed(2),topClearance:+(b.top-arena.top).toFixed(2),leftClearance:+(b.left-arena.left).toFixed(2),avatarGap:+(portrait.top-b.bottom).toFixed(2),paddingTop:style.paddingTop,paddingBottom:style.paddingBottom,scrollHeight:bubble.scrollHeight,clientHeight:bubble.clientHeight,tail:getComputedStyle(bubble,'::after').display,failed:[]};
   rows.push(row);
   check(row.tail==='none','triangle hidden',row);
   check(row.paddingTop===row.paddingBottom,'symmetric vertical padding',row);
   check(b.top>=arena.top+23.5&&b.bottom<=arena.bottom-23.5&&b.left>=arena.left+.5&&b.right<=arena.right-.5,'bubble contained in arena',row);
   check(row.avatarGap>=12,'bubble clears floating avatar',row);
   check(Math.abs(b.height-Math.min(natural,parseFloat(style.maxHeight)))<1.1,'height follows text or scroll limit',row);
   if(kind==='short')check(bubble.scrollHeight<=bubble.clientHeight+1,'short text has no redundant scrolling',row);
   if(bubble.scrollHeight>bubble.clientHeight+1){
     bubble.scrollTop=bubble.scrollHeight;
     check(bubble.scrollTop>0&&getComputedStyle(bubble).overflowY==='auto','long text scrolls to end',row);
     const last=[...range.getClientRects()].filter(r=>r.width>0).at(-1);
     check(last.bottom<=b.bottom-parseFloat(style.borderBottomWidth)+1,'last line visible after scrolling',row);
     bubble.scrollTop=0;
   }
   for(const other of document.querySelectorAll('.agent,.center')){
     if(other===el)continue;
     check(!overlaps(b,other.getBoundingClientRect()),'bubble clears '+(other.dataset.agent||'question'),row);
   }
   check(!overlaps(b,el.querySelector('.name').getBoundingClientRect())&&!overlaps(b,el.querySelector('.role').getBoundingClientRect()),'own labels unobstructed',row);
   const svg=beam.ownerSVGElement.getBoundingClientRect(),group=el.getBoundingClientRect(),center=document.querySelector('.center').getBoundingClientRect();
   check(beam.classList.contains('show')&&Math.abs(Number(beam.getAttribute('x2'))/1000*svg.width+svg.left-(group.left+group.width/2))<1&&Math.abs(Number(beam.getAttribute('y1'))/700*svg.height+svg.top-(center.top+center.height/2))<1,'beam remains aligned',row);
   return row;
 }
 try{
   selectPanel('debate');clearTimeout(timer);await wait();
   const texts={short:'Planning research.',multiline:'We compare the evidence and its limitations.\nEach claim needs a source.\nThe next step is careful review.\nUncertainty remains explicit.',unbroken:'Evidence'.repeat(27)};
   if(config.capture){
     await measure(config.mode||'demo',config.agent||'PI',texts[config.text||'multiline'],config.text||'multiline');
     document.getAnimations().forEach(a=>{a.pause();a.currentTime=800});
     const arenaTop=window.scrollY+document.querySelector('.arena').getBoundingClientRect().top;
     const navHeight=document.querySelector('.demo-nav').getBoundingClientRect().height;
     window.scrollTo({top:Math.max(0,arenaTop-navHeight-16),behavior:'instant'});
     return;
   }
   for(const mode of ['demo','live'])for(const agent of ['PI','Researcher'])for(const [kind,text] of Object.entries(texts))await measure(mode,agent,text,kind);
   for(const name of ['analyst','critic','writer']){
     const talk=document.querySelector('.agent.'+name+' .talk');
     if(getComputedStyle(talk,'::after').display==='none')failures.push({constraint:name+' arrow must be unchanged'});
   }
   selectPanel('overview');selectPanel('debate');await wait();
   if(!sessionStorage.getItem('bubble-reloaded')){sessionStorage.setItem('bubble-reloaded','yes');location.reload();return;}
   if(document.documentElement.scrollWidth>document.documentElement.clientWidth)failures.push({constraint:'horizontal page overflow'});
   const result={passed:!failures.length,afterRefresh:true,rows,failures};
   document.body.innerHTML='<pre id="test-result">'+JSON.stringify(result,null,2)+'</pre>';
 }catch(e){document.body.innerHTML='<pre id="test-result">'+JSON.stringify({passed:false,error:e.stack,rows,failures})+'</pre>'}
})();
