(async()=>{
 const config=window.centerTestConfig||{},rows=[],failures=[],checks=[];
 const wait=()=>new Promise(r=>setTimeout(r,100));
 function check(ok,label){checks.push(label);if(!ok)failures.push(label)}
 const overlaps=(a,b)=>a.left<b.right-.5&&a.right>b.left+.5&&a.top<b.bottom-.5&&a.bottom>b.top+.5;
 function inspect(label){
   for(const portrait of document.querySelectorAll('.portrait'))portrait.getAnimations().forEach(animation=>{animation.pause();animation.currentTime=800});
   const arena=document.querySelector('.arena'),a=arena.getBoundingClientRect(),c=document.querySelector('.center').getBoundingClientRect();
   const pi=document.querySelector('.agent.pi'),p=pi.getBoundingClientRect(),role=pi.querySelector('.role').getBoundingClientRect();
   const analyst=document.querySelector('.agent.analyst'),critic=document.querySelector('.agent.critic');
   const lower=[analyst,critic].map(el=>el.getBoundingClientRect());
   const r={label,viewport:innerWidth,arenaHeight:a.height,cardHeight:c.height,centerY:c.top+c.height/2-a.top,piRoleGap:c.top-role.bottom,analystGap:Math.min(lower[0].top,analyst.querySelector('.portrait').getBoundingClientRect().top)-c.bottom,criticGap:Math.min(lower[1].top,critic.querySelector('.portrait').getBoundingClientRect().top)-c.bottom,analystGroupBoxGap:lower[0].top-c.bottom,criticGroupBoxGap:lower[1].top-c.bottom,analystLabelGap:analyst.querySelector('.name').getBoundingClientRect().top-c.bottom,criticLabelGap:critic.querySelector('.name').getBoundingClientRect().top-c.bottom,horizontalError:Math.abs(c.left+c.width/2-(a.left+a.width/2))};
   rows.push(r);
   check(arena.dataset.layout==='ready',label+': layout feasible');
   check(r.piRoleGap>=23.98,label+': PI role clearance >=24px');
   check(r.analystGap>=23.98&&r.criticGap>=23.98,label+': lower group clearance >=24px');
   check(r.horizontalError<1,label+': card horizontally centered');
   check(c.left>=a.left+24&&c.right<=a.right-24&&c.top>=a.top+24&&c.bottom<=a.bottom-24,label+': card inside arena');
   let floor=p.bottom+24;
   for(const el of document.querySelectorAll('.agent.researcher,.agent.writer')){
     const box=el.getBoundingClientRect();
     if(c.left<box.right+24&&c.right>box.left-24)floor=Math.max(floor,box.bottom+24);
   }
   const ceiling=Math.min(...lower.map(box=>box.top-24))-24;
   r.balanceError=Math.abs((c.top-floor)-(ceiling-c.bottom));
   check(r.balanceError<1,label+': card centers within feasible interval');
   for(const el of document.querySelectorAll('.agent')){
     const box=el.getBoundingClientRect();
     el.querySelector('.portrait').getAnimations().forEach(animation=>{animation.pause();animation.currentTime=800});
     const portrait=el.querySelector('.portrait').getBoundingClientRect();
     check(!overlaps(c,box)&&!overlaps(c,portrait),label+': card clears '+el.dataset.agent+' including float');
     check(box.left>=a.left&&box.right<=a.right&&box.top>=a.top&&box.bottom<=a.bottom,label+': '+el.dataset.agent+' fully inside arena');
   }
   const active=document.querySelector('.agent.active');
   if(active){
     const b=active.querySelector('.talk').getBoundingClientRect(),group=active.getBoundingClientRect(),svg=beam.ownerSVGElement.getBoundingClientRect();
     if(active===pi)check(b.top>=a.top+24&&b.bottom<pi.querySelector('.portrait').getBoundingClientRect().top,label+': PI bubble clear');
     const coords=[['x1',c.left+c.width/2,svg.left,svg.width,1000],['y1',c.top+c.height/2,svg.top,svg.height,700],['x2',group.left+group.width/2,svg.left,svg.width,1000],['y2',group.top+group.height/2,svg.top,svg.height,700]];
     check(beam.classList.contains('show')&&coords.every(([attr,target,origin,size,units])=>Math.abs(Number(beam.getAttribute(attr))/units*size+origin-target)<1),label+': SVG endpoints align');
   }
   check(document.documentElement.scrollWidth<=document.documentElement.clientWidth,label+': no horizontal overflow');
   return r;
 }
 try{
   selectPanel('debate');clearTimeout(timer);await wait();inspect('Demo initial');
   if(config.capture){
     switchMode('live');$('run-id').value='47606574-3c1e-4b81-9a00-8c59617b880a';$('run-state').textContent='running';
     renderLiveEvent({id:'capture-pi',agent:'PI',message:'We will compare the evidence, check uncertainties, and define the research scope.'});
     await wait();document.getAnimations().forEach(a=>{a.pause();a.currentTime=800});
     const target=document.querySelector(config.capture==='controls'?'.live-console':'.arena');
     const y=window.scrollY+target.getBoundingClientRect().top-document.querySelector('.demo-nav').getBoundingClientRect().height-16;
     window.scrollTo({top:Math.max(0,y),behavior:'instant'});return;
   }
   for(let n=0;n<7;n++){showTurn();await wait();inspect('Demo turn '+(n+2))}
   switchMode('live');renderLiveEvent({id:'test-pi',agent:'PI',message:'Planning research with explicit evidence limits.'});await wait();inspect('Live standard topic');
   $('research-topic').value='Evidence and uncertainty in scientific research. '.repeat(12).slice(0,500);syncResearchQuestion();await wait();inspect('Live long topic');
   selectPanel('overview');selectPanel('debate');await wait();inspect('After tab return');
   const details=$('reconnect-tools'),input=$('run-id'),id='47606574-3c1e-4b81-9a00-8c59617b880a';
   check(!!details&&!details.open,'Advanced closed by default');check(input.getClientRects().length===0,'UUID input hidden by default');
   const sourceRequests=[],postRequests=[];let fakeStatus='running';
   window.fetch=async(url,options)=>{if(options?.method==='POST'){postRequests.push(url);return{ok:true,json:async()=>({id})}}return{ok:true,json:async()=>({id,topic:'A saved research topic for reconnect testing',status:fakeStatus,report:'# Saved report',error:fakeStatus==='failed'?'Fixture failure':''})}};
   window.EventSource=class{constructor(url){sourceRequests.push(url)}addEventListener(){}close(){}};
   details.querySelector('summary').click();input.value=id;check(input.getClientRects().length>0,'Advanced reveals original UUID input');
   $('reconnect-live').click();await wait();
   check(liveRunId===id&&input.value===id&&sourceRequests[0].includes(id),'Reconnect preserves UUID and SSE endpoint');
   check(postRequests.length===0,'Reconnect never starts a run');
   details.querySelector('summary').click();check(input.value===id&&input.getClientRects().length===0,'Collapsing retains UUID');
   check($('run-state').textContent.includes('Research Running')&&!$('run-state').textContent.includes(id),'Compact running status without UUID');
   fakeStatus='completed';await refreshRun();await wait();check($('run-state').textContent.includes('Research Completed')&&!$('download-report').disabled,'Completed status/report retained');
   fakeStatus='failed';await refreshRun();await wait();check($('run-state').textContent.includes('Research Failed'),'Failed status retained');
   fakeStatus='running';$('start-live').click();await wait();check(postRequests.length===1&&input.value===id&&!details.open,'Starting run retains UUID in collapsed Advanced');
   closeLive();
   switchMode('demo');clearTimeout(timer);await wait();inspect('Demo restored');
   let writes=0;const observer=new MutationObserver(records=>writes+=records.length);observer.observe(document.querySelector('.arena'),{attributes:true,attributeFilter:['style']});await wait();await wait();observer.disconnect();check(writes===0,'Geometry remains stable without observer feedback writes');
   if(!sessionStorage.getItem('center-reconnect-reloaded')){sessionStorage.setItem('center-reconnect-reloaded','yes');location.reload();return}
   document.body.innerHTML='<pre id="test-result">'+JSON.stringify({passed:!failures.length,afterRefresh:true,rows,checks:checks.length,failures},null,2)+'</pre>';
 }catch(error){document.body.innerHTML='<pre id="test-result">'+JSON.stringify({passed:false,error:error.stack,rows,checks:checks.length,failures},null,2)+'</pre>'}
})();
