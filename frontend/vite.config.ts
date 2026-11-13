import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

const proxy = {
  '/api': { target: 'http://127.0.0.1:8091', changeOrigin: true },
};
const executiveAlias = readFileSync(new URL('./public/executive-v4.1.html', import.meta.url), 'utf8');

export default defineConfig({
  // Archived presentations and local backups stay on disk, outside the release.
  publicDir: false,
  plugins: [react(), {
    name: 'executive-compatibility-entry',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== '/executive-v4.1.html') return next();
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(executiveAlias);
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'executive-v4.1.html', source: executiveAlias });
    },
  }],
  server: { host: '127.0.0.1', port: 5174, strictPort: true, proxy },
  preview: { host: '127.0.0.1', port: 5174, strictPort: true, proxy },
});
