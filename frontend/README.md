# AI Research Lab V4.1

`index.html` is the canonical Executive Interface. The homepage opens the animated
five-agent Debate Room; Overview, Architecture, and Results & Roadmap remain tabs.
The old `/executive-v4.1.html` bookmark leads to `/`.

```sh
cd frontend
npm install
npm run dev
# http://localhost:5174/
npm run build
npm run preview
# http://localhost:5174/ (stop the dev server first)
```

Both Vite servers proxy `/api` to the existing FastAPI service at
`http://127.0.0.1:8091`. Demo Mode works without that service. Live Research starts
runs with a custom topic, reconnects using an existing UUID, replays persisted SSE
events, polls status, and exposes the completed report in Results & Roadmap with a
Markdown download. Reconnecting loads the saved topic into the central question.

For another production static server, serve `dist/` and configure a same-origin
`/api` reverse proxy to FastAPI (including unbuffered SSE). A static file server
alone supports the complete offline demo but cannot proxy live requests.

Legacy React entries (`src/debate.tsx`, `src/main.tsx`, `dashboard.html`) and archived
presentations in `public/` remain for reference. They are not production build
entries. `publicDir: false` prevents archived homepages and local backups from
being published. The compatibility alias is emitted explicitly by Vite.

The frontend does not modify the backend, SQLite data, llama.cpp, or other services.

## Browser regression checks

With Chrome installed, run `node tests/check-executive.mjs` and
`node tests/check-executive.mjs --dist` after building. These exercise the tabs,
five-agent animation, beam geometry, PI bubble bounds, mode/topic switching,
custom-topic submission, completed SSE replay, reconnect, and report download.
Live API/SSE responses are mocked; this does not replace a real backend check.

PI layout checks (exact iframe viewport sizes, long live messages, and reload):

```sh
node tests/check-executive.mjs --pi-layout --width=1440
node tests/check-executive.mjs --pi-layout --width=390
node tests/check-executive.mjs --pi-layout --width=320 --dist
```

The Arena reserves the measured PI and question heights plus bubble headroom and
animation clearance. PI labels stay 24px above the question; other agents retain
their original percentage positions. Long PI commentary scrolls inside its bubble.
