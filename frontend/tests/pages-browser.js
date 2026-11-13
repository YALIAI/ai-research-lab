// Runs against the actual compiled Pages entry, with no backend or test data API.
(async()=>{
 const checks=[],rows=[];
 const assert=(value,label)=>{if(!value)throw Error(label);checks.push(label)};
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 function geometry(label){
   const arena=document.querySelector('.arena'),a=arena.getBoundingClientRect(),card=document.querySelector('.center').getBoundingClientRect();
   assert(arena.dataset.layout==='ready',label+': feasible geometry');
   assert(card.left>=a.left+24&&card.right<=a.right-24&&card.top>=a.top+24&&card.bottom<=a.bottom-24,label+': question inside arena');
   const pi=document.querySelector('.agent.pi').getBoundingClientRect();
   assert(card.top-pi.bottom>=23.98,label+': PI labels clear question');
   for(const el of document.querySelectorAll('.agent')){
     const r=el.getBoundingClientRect(),portrait=el.querySelector('.portrait').getBoundingClientRect();
     assert(!(card.left<r.right&&card.right>r.left&&card.top<r.bottom&&card.bottom>r.top),label+': question clears '+el.dataset.agent);
     assert(!(card.left<portrait.right&&card.right>portrait.left&&card.top<portrait.bottom&&card.bottom>portrait.top),label+': question clears floating avatar');
     assert(r.left>=a.left&&r.right<=a.right&&r.top>=a.top&&r.bottom<=a.bottom,label+': '+el.dataset.agent+' inside arena');
   }
   const active=document.querySelector('.agent.active');
   if(active){
     const r=active.getBoundingClientRect(),bubble=active.querySelector('.talk').getBoundingClientRect(),svg=beam.ownerSVGElement.getBoundingClientRect();
     assert(bubble.top>=a.top+24&&bubble.left>=a.left&&bubble.right<=a.right&&bubble.bottom<=a.bottom,label+': focused speech bubble inside arena');
     const values=[['x1',card.left+card.width/2,svg.left,svg.width,1000],['y1',card.top+card.height/2,svg.top,svg.height,700],['x2',r.left+r.width/2,svg.left,svg.width,1000],['y2',r.top+r.height/2,svg.top,svg.height,700]];
     assert(beam.classList.contains('show')&&values.every(([attr,target,start,size,units])=>Math.abs(Number(beam.getAttribute(attr))/units*size+start-target)<1),label+': dashed beam aligned');
     assert(getComputedStyle(beam).animationName==='dash',label+': dash animation preserved');
     assert(getComputedStyle(active.querySelector('.portrait')).animationName==='float',label+': float animation preserved');
     assert(active.querySelector('.talk').textContent.length>0,label+': speech text present');
   }
   assert(document.documentElement.scrollWidth<=document.documentElement.clientWidth,label+': no horizontal overflow');
   rows.push({label,viewport:innerWidth,arenaHeight:a.height,piGap:card.top-pi.bottom});
 }
 function result(data){document.body.innerHTML='<pre id="test-result">'+JSON.stringify(data,null,2)+'</pre>'}
 try{
   await wait(150);
   assert(document.documentElement.classList.contains('public-showcase'),'Pages build profile');
   assert(document.querySelector('.demo-panel.visible').id==='panel-debate','Debate Arena is landing view');
   assert(document.querySelector('.agent.active')?.dataset.agent==='PI'&&feed.children.length===1,'automatic initial playback');
   assert(document.getElementById('mode-live').disabled,'Live Research disabled');
   assert(!document.getElementById('live-controls')&&!document.getElementById('live-report'),'local controls absent');
   assert(document.querySelector('.showcase-notice').textContent.includes('scripted'),'scripted demo clearly labeled');
   geometry('initial PI');
   if(window.pagesCapture){
     toggle.click();document.getAnimations().forEach(a=>{a.pause();a.currentTime=800});
     const arena=document.querySelector('.arena');const top=window.scrollY+arena.getBoundingClientRect().top-document.querySelector('.demo-nav').getBoundingClientRect().height-16;
     window.scrollTo({top:Math.max(0,top),behavior:'instant'});return;
   }
   toggle.click();const paused=index;await wait(3500);assert(index===paused&&researchState.runStatus!=='running','pause stops automatic progression');
   toggle.click();await wait(3400);assert(index===paused+1&&document.querySelector('.agent.active').dataset.agent==='Researcher','resume advances automatically');
   geometry('resumed Researcher');
   document.getElementById('restart').click();assert(index===1&&feed.children.length===1&&researchState.runStatus==='running','replay restarts automatically');
   for(let n=0;n<7;n++){await wait(3350);geometry('automatic turn '+(n+2));}
   const speakers=[...feed.querySelectorAll('.msg .who span')].map(el=>el.textContent);
   assert(speakers.length===turns.length&&new Set(speakers).size===5&&speakers.at(-1)==='Writer','all five agents spoke during real autoplay timer');
   assert(researchState.runStatus==='completed'&&$('hypothesis-label').textContent.includes('FINAL RESEARCH SYNTHESIS')&&$('current-hypothesis').textContent===DEMO_HYPOTHESIS,'final synthesis revealed after Writer');
   await wait(3400);assert(researchState.runStatus!=='running'&&status.textContent.includes('COMPLETED'),'automatic completion');
   toggle.click();assert(researchState.runStatus==='running'&&index===1,'play again after completion');toggle.click();
   for(const panel of ['overview','architecture','results','debate']){
     document.querySelector(`[data-tab="${panel}"]`).click();await wait(80);
     assert(document.querySelector('.demo-panel.visible').id==='panel-'+panel,'navigation '+panel);
   }
   geometry('after navigation');
   assert(window.__pagesErrors.length===0,'no JavaScript console errors or unhandled rejections');
   assert(window.__pagesNetwork.length===0,'no fetch, XHR, SSE, WebSocket or beacon requests');
   assert(performance.getEntriesByType('resource').every(r=>!/(?:localhost|127\.0\.0\.1).*(?:\/api|:8091|:8080)/.test(r.name)),'no localhost API resources');
   result({passed:true,checks,rows,errors:window.__pagesErrors,network:window.__pagesNetwork});
 }catch(error){result({passed:false,error:error.stack,checks,rows,errors:window.__pagesErrors,network:window.__pagesNetwork})}
})();
