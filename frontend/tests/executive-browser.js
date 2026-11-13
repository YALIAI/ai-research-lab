(async()=>{
 const checks=[];function ok(value,name){if(!value)throw Error(name);checks.push(name)}
 function frame(){return new Promise(r=>setTimeout(r,50))}
 try{
 ok(document.querySelector('.demo-panel.visible').id==='panel-debate','homepage opens Debate Room');
 for(const name of panels){document.querySelector(`[data-tab="${name}"]`).click();ok(document.querySelector('.demo-panel.visible').id==='panel-'+name,'tab '+name)}
 selectPanel('debate');restart();clearTimeout(timer);await frame();
 const agents=new Set();for(let n=0;n<8;n++){if(n)showTurn();await frame();const active=document.querySelector('.agent.active');agents.add(active.dataset.agent);updateResearchBeam(active);ok(beam.classList.contains('show')&&[...['x1','x2','y1','y2']].every(k=>Number.isFinite(Number(beam.getAttribute(k)))),'beam turn '+n);const svg=beam.ownerSVGElement.getBoundingClientRect(),center=document.querySelector('.center').getBoundingClientRect();ok(Math.abs(Number(beam.getAttribute('x1'))/1000*svg.width+svg.left-(center.left+center.width/2))<1,'beam starts at research question '+n);if(n===0){const a=document.querySelector('.arena').getBoundingClientRect(),b=active.querySelector('.talk').getBoundingClientRect(),portrait=active.querySelector('.portrait').getBoundingClientRect();ok(b.top>=a.top&&b.bottom<=portrait.top,'PI bubble inside arena above avatar')}}
 ok(agents.size===5,'demo animates all five agents');
 selectPanel('overview');selectPanel('debate');await frame();ok(Number(beam.getAttribute('x1'))>0,'beam restored after tab changes');
 switchMode('live');$('research-topic').value='How do retrieval systems improve scientific evidence quality?';$('research-topic').dispatchEvent(new Event('input'));ok($('arena-research-question').textContent===$('research-topic').value,'custom live question');ok(!$('reconnect-tools').open&&$('run-id').getClientRects().length===0,'UUID hidden by default');$('reconnect-tools').querySelector('summary').click();ok($('run-id').getClientRects().length>0,'Advanced reveals reconnect input');
 const run='12345678-1234-1234-1234-123456789abc';let posts=0,downloads=0;
 window.fetch=async(url,options)=>{if(options?.method==='POST'){posts++;ok(JSON.parse(options.body).topic.includes('retrieval'),'start sends custom topic');return{ok:true,json:async()=>({id:run})}}return{ok:true,json:async()=>({id:run,topic:'Saved research topic from a completed run',status:'completed',report:'# Completed report'})}};
 window.EventSource=class{constructor(url){this.url=url;queueMicrotask(()=>{for(const agent of Object.keys(colors))this.onmessage?.({data:JSON.stringify({id:agent,agent,message:'Saved research event from '+agent})});this.done?.()})}addEventListener(name,fn){if(name==='done')this.done=fn}close(){}};
 $('start-live').click();await new Promise(r=>setTimeout(r,50));
 ok(posts===1,'mock start creates exactly one run');ok($('arena-research-question').textContent==='Saved research topic from a completed run','saved run topic loaded');ok(liveCount===5,'completed SSE history replayed');ok(!$('download-report').disabled&&$('report-content').textContent==='# Completed report','completed report available');
 URL.createObjectURL=()=>{downloads++;return 'blob:test'};HTMLAnchorElement.prototype.click=function(){};$('download-report').click();ok(downloads===1,'Markdown download');
 $('run-id').value=run;$('reconnect-live').click();await new Promise(r=>setTimeout(r,50));ok(liveCount===5&&posts===1,'reconnect replays without starting run');
 selectPanel('results');ok(!$('live-report').hidden,'report visible in Results');switchMode('demo');clearTimeout(timer);ok($('arena-research-question').textContent===demoQuestion,'Demo restores showcase question');
 restart();clearTimeout(timer);await frame();ok(!Number.isNaN(Number(beam.getAttribute('x2'))),'beam valid after restart');
 document.body.innerHTML='<pre id="test-result">'+JSON.stringify({passed:true,checks},null,2)+'</pre>';
 }catch(e){document.body.innerHTML='<pre id="test-result">'+JSON.stringify({passed:false,error:e.stack,checks},null,2)+'</pre>'}
})();
