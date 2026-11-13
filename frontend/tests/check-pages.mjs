import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';

const root=fileURLToPath(new URL('../',import.meta.url));
const dist=join(root,'dist-pages'),artifacts=resolve(root,'../test-artifacts/pages');
mkdirSync(artifacts,{recursive:true});
const entry=readFileSync(join(dist,'index.html'),'utf8');
const alias=readFileSync(join(dist,'executive-v4.1.html'),'utf8');
if(!entry.includes('class="public-showcase"')||!entry.includes('id="panel-debate"'))throw Error('Wrong homepage');
if(/\bfetch\s*\(|\bEventSource\b|localhost|127\.0\.0\.1|\/api\b|Holo-|\/home\//i.test(entry))throw Error('Local adapter/configuration leaked into public HTML');
if(/id="(?:live-controls|run-id|live-report)"/.test(entry))throw Error('Live controls leaked');
if(!alias.includes('url=./'))throw Error('Compatibility entry must stay within repository subpath');
if(readdirSync(dist).sort().join(',')!=='executive-v4.1.html,index.html')throw Error('Unexpected published files');
const checks=readFileSync(new URL('./pages-browser.js',import.meta.url),'utf8');
const instrumentation=`<script>
window.__pagesErrors=[];window.__pagesNetwork=[];
addEventListener('error',e=>window.__pagesErrors.push(e.message||('Resource error: '+e.target?.src)),true);
addEventListener('unhandledrejection',e=>window.__pagesErrors.push(String(e.reason)));
window.fetch=(url)=>{window.__pagesNetwork.push('fetch '+url);return Promise.reject(Error('Unexpected public network request'))};
window.EventSource=class{constructor(url){window.__pagesNetwork.push('SSE '+url);throw Error('Unexpected SSE')}};
window.WebSocket=class{constructor(url){window.__pagesNetwork.push('WebSocket '+url);throw Error('Unexpected WebSocket')}};
XMLHttpRequest.prototype.open=function(method,url){window.__pagesNetwork.push('XHR '+url);throw Error('Unexpected XHR')};
navigator.sendBeacon=(url)=>{window.__pagesNetwork.push('beacon '+url);return false};
</script>`;
const instrumented=entry.replace('<head>','<head>'+instrumentation).replace('</body>',`<script>${checks}</script></body>`);
const sizes=[[1440,900],[768,1024],[390,844]];
function wrapper(url,width,height,poll=true){return `<!doctype html><style>body{margin:0;background:#070b17}iframe{border:0;display:block}</style><iframe style="width:${width}px;height:${height}px" src="${url}"></iframe>${poll?'<script>setInterval(()=>{const r=document.querySelector("iframe").contentDocument.querySelector("#test-result");if(r)document.body.innerHTML=r.outerHTML},100)</script>':''}`}
const files=[];
for(const [width,height] of sizes){
  // The extra directory exercises a repository subpath, rather than a root URL.
  const base=join(artifacts,String(width),'ai-research-lab');mkdirSync(base,{recursive:true});
  const child=join(base,'index.html');writeFileSync(child,instrumented);
  const page=join(artifacts,`${width}.html`);writeFileSync(page,wrapper(pathToFileURL(child).href,width,height));
  const capture=join(base,'capture.html');writeFileSync(capture,instrumented.replace('<head>','<head><script>window.pagesCapture=true;</script>'));
  writeFileSync(join(artifacts,`${width}-capture.html`),wrapper(pathToFileURL(capture).href,width,height,false));
  files.push({width,height,url:pathToFileURL(page).href});
}
if(process.argv.includes('--prepare-only')){
  console.log(JSON.stringify({staticChecks:'passed',files,artifacts},null,2));
}else{
  let server,origin,requests=[];
  if(!process.argv.includes('--file')){
    server=createServer((req,res)=>{
      const url=new URL(req.url,'http://test.invalid');requests.push(url.pathname);
      res.setHeader('Content-Type','text/html; charset=utf-8');
      if(url.pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}
      if(url.pathname==='/ai-research-lab/'||url.pathname==='/ai-research-lab/index.html'){
        res.end(url.searchParams.has('verify')?instrumented:entry);return;
      }
      if(url.pathname==='/ai-research-lab/executive-v4.1.html'){res.end(alias);return;}
      if(url.pathname==='/verify'){
        res.end(wrapper(`${origin}/ai-research-lab/?verify=1`,Number(url.searchParams.get('width')),Number(url.searchParams.get('height'))));return;
      }
      res.writeHead(404);res.end('Not found');
    });
    await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok)});
    origin=`http://127.0.0.1:${server.address().port}`;
  }
  const results=[];
  try{
    if(origin){
      const response=await fetch(origin+'/ai-research-lab/');
      if(!response.ok||await response.text()!==entry)throw Error('HTTP repository-subpath homepage mismatch');
      const old=await fetch(origin+'/ai-research-lab/executive-v4.1.html');
      if(!old.ok||!(await old.text()).includes('url=./'))throw Error('HTTP compatibility entry mismatch');
    }
    for(const {width,height,url} of files){
      const target=origin?`${origin}/verify?width=${width}&height=${height}`:url;
      const output=await new Promise((ok,fail)=>{
        const chrome=spawn(process.env.CHROME_BIN||'google-chrome',['--headless','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--allow-file-access-from-files','--window-size=1440,1000','--virtual-time-budget=40000','--dump-dom',target]);
        let stdout='',stderr='';const timeout=setTimeout(()=>{chrome.kill();fail(Error('Chrome timed out'))},30000);
        chrome.stdout.on('data',d=>stdout+=d);chrome.stderr.on('data',d=>stderr+=d);
        chrome.on('error',error=>{clearTimeout(timeout);fail(error)});
        chrome.on('close',code=>{clearTimeout(timeout);if(code)fail(Error(stderr));else ok(stdout)});
      });
      const raw=output.match(/<pre id="test-result">(\{[\s\S]*?)<\/pre>/)?.[1];
      if(!raw)throw Error('Browser did not finish Pages checks');
      const result=JSON.parse(raw.replaceAll('&gt;','>').replaceAll('&lt;','<').replaceAll('&amp;','&'));
      results.push({width,height,...result});
      writeFileSync(join(artifacts,`${width}-results.json`),JSON.stringify(result,null,2));
      if(!result.passed)throw Error(JSON.stringify(result));
    }
    if(requests.some(path=>!/^(?:\/ai-research-lab\/(?:index.html|executive-v4.1.html)?|\/verify|\/favicon.ico)$/.test(path)))throw Error('Unexpected HTTP request: '+JSON.stringify(requests));
    writeFileSync(join(artifacts,'results.json'),JSON.stringify({http:!!origin,results,requests},null,2));
    console.log(JSON.stringify({passed:true,http:!!origin,viewports:results.map(r=>({width:r.width,height:r.height,checks:r.checks.length})),artifacts},null,2));
  }finally{server?.close();}
}
