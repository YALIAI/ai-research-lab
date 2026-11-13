// Uses a temporary file and mocked API/SSE; never creates real research runs.
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'lab-v41-'));
try {
  const source = readFileSync(join(root, process.argv.includes('--dist') ? 'dist/index.html' : 'index.html'), 'utf8');
  const checks = readFileSync(new URL(process.argv.includes('--pi-layout') ? './pi-layout-browser.js' : './executive-browser.js', import.meta.url), 'utf8');
  const fixture = join(dir, 'check.html');
  writeFileSync(fixture, source.replace('</body>', `<script>${checks}</script></body>`));
  const width = Number(process.argv.find(arg => arg.startsWith('--width='))?.split('=')[1] || 1440);
  if (!Number.isInteger(width) || width < 280 || width > 2560) throw Error('Invalid viewport width');
  // An iframe provides an exact CSS viewport, including widths below Chrome's
  // minimum native window size. Reload tests reload only the child document.
  const wrapper = join(dir, 'viewport.html');
  writeFileSync(wrapper, `<!doctype html><body><iframe style="border:0;width:${width}px;height:1000px" src="${pathToFileURL(fixture).href}"></iframe><script>setInterval(()=>{const result=document.querySelector('iframe').contentDocument.querySelector('pre#test-result');if(result)document.body.innerHTML=result.outerHTML},100)</script>`);
  const browser = spawnSync(process.env.CHROME_BIN || 'google-chrome', [
    '--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--allow-file-access-from-files', '--window-size=1440,1000', '--virtual-time-budget=5000', '--dump-dom', pathToFileURL(wrapper).href,
  ], { encoding: 'utf8', maxBuffer: 1024 * 1024, timeout: 30000 });
  const result = browser.stdout?.match(/<pre id="test-result">(\{[\s\S]*?)<\/pre>/)?.[1];
  if (!result) throw Error(browser.stderr || 'Browser did not complete checks');
  console.log(result);
  if (!JSON.parse(result).passed) process.exitCode = 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
