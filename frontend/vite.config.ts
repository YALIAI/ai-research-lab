import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

const executiveAlias = readFileSync(new URL('./public/executive-v4.1.html', import.meta.url), 'utf8');
const proxy = { '/api': { target: 'http://127.0.0.1:8091', changeOrigin: true } };

// Both profiles build the same canonical document. The static profile excludes
// local controls and adapter code rather than shipping a second, divergent UI.
function publicShowcase(html: string) {
  return html
    .replace('<html lang="en">', '<html lang="en" class="public-showcase">')
    .replace(/<!-- local-live-console:start -->[\s\S]*?<!-- local-live-console:end -->/, `<div class="live-console showcase-notice">
      <div class="mode-row"><button id="mode-demo" class="mode-choice active" type="button">▶ Demo Mode · Scripted</button><button id="mode-live" class="mode-choice" type="button" disabled title="Available only when running the full system locally">Live Research · local only</button></div>
      <p>This is a scripted browser demonstration. No live LLM inference or backend connection.</p>
    </div>`)
    .replace(/<!-- local-live-report:start -->[\s\S]*?<!-- local-live-report:end -->/, '')
    .replace(/\/\/ @local-live:start[\s\S]*?\/\/ @local-live:end/, `const currentMode='demo';
      document.getElementById('mode-demo').addEventListener('click',restart);`)
    .replace(/<script id="v41-(?:topic|status)-sync">[\s\S]*?<\/script>/g, '')
    .replace('◉ Live Debate Transcript', '◉ Scripted Debate Transcript')
    .replace('EXECUTIVE V4.1 · DEMO READY', 'V4.1 · SCRIPTED DEMO')
    .replace('The debate room supports both a scripted presentation and live research from the backend.', 'This public showcase uses scripted dialogue. The full research workflow runs locally.')
    .replace('Choose Demo Mode for a scripted presentation or Live Research to connect to your research backend.', 'The public demo is scripted. Live Research is available only in a local installation.')
    .replace('Use Demo Mode for the original animated presentation, or Live Research to display actual LangGraph agent events.', 'This public presentation is scripted; the locally hosted system can display real research events.')
    .replace('The V3 frontend visualizes events through server-sent events (SSE).', 'The local frontend visualizes research events through server-sent events (SSE); this public showcase uses scripted dialogue.')
    .replace('Local OpenAI-compatible API with Holo-3.1-35B-A3B for the existing prototype.', 'A locally served LLM powers the full research workflow.')
    .replace('Architecture describes the developed V2 prototype; Live Research connects to its API through the same-origin /api proxy.', 'Architecture describes the locally hosted research workflow. This public demonstration runs scripted dialogue entirely in your browser.')
    .replace('Demo: scripted dialogue · Live: actual backend events', 'Scripted demonstration · No live inference')
    .replace('V4.1 · Offline demo · Live backend research', 'V4.1 · Scripted browser demonstration · No live inference');
}

export default defineConfig(({ mode }) => {
  const pages = mode === 'pages';
  return {
    base: './',
    publicDir: false,
    plugins: [react(), {
      name: 'executive-entry-profiles',
      transformIndexHtml: {
        order: 'pre',
        handler(html) { return pages ? publicShowcase(html) : html; },
      },
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.split('?')[0] !== '/executive-v4.1.html') return next();
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(executiveAlias);
        });
      },
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'executive-v4.1.html', source: executiveAlias });
        this.emitFile({ type: 'asset', fileName: 'social/ai-research-lab-og.png', source: readFileSync(new URL('./public/social/ai-research-lab-og.png', import.meta.url)) });
      },
    }],
    server: { host: '127.0.0.1', port: pages ? 5175 : 5174, strictPort: true, ...(pages ? {} : { proxy }) },
    preview: { host: '127.0.0.1', port: pages ? 5175 : 5174, strictPort: true, ...(pages ? {} : { proxy }) },
  };
});
