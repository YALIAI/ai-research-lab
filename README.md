# AI Research Lab

**A local multi-agent research and debate experiment.** Five specialized roles plan research, retrieve literature, analyze evidence, challenge arguments, and produce a cited Markdown report.

Personal project · 2026–present · Python · LangGraph · LangChain · FastAPI · SQLite · React · llama.cpp

The first research question: **Will end-to-end AI replace traditional modular ADAS architectures by 2030?** The question is configurable; this is a research workflow, not an autonomous-driving system. Any conclusions are exploratory and require human review.

![Five AI research roles debating end-to-end versus modular ADAS architectures](docs/ai-debate-autonomous-driving.webp)

*Concept illustration of the multi-agent debate and an exploratory conclusion. The implemented workflow is shown below.*

## Architecture

```mermaid
flowchart TD
    UI[V4.1 Executive UI · interactive debate and live logs] -->|POST /api/runs| API[FastAPI · background task]
    API --> PI[PI · plan and generate search queries]
    PI --> R[Researcher · retrieve and deduplicate literature]
    R <-->|titles, abstracts, DOI links| OA[OpenAlex API]
    R --> A[Analyst · evidence-based arguments]
    A --> C{Critic · review claims and source IDs}
    C -->|REVISE · within review budget| A
    C -->|MORE_EVIDENCE · retrieval budget remains| Q[Refine search queries]
    Q --> R
    C -->|APPROVE or review budget exhausted| W[Writer · Markdown report and source list]
    W --> DB[(SQLite · run status, report, event log)]
    API --> DB
    DB -->|SSE events and final report API| UI
    L[Local LLM · llama.cpp compatible API] -.-> PI
    L -.-> A
    L -.-> C
    L -.-> Q
    L -.-> W
```

All roles share the configured model with distinct prompts. SQLite records execution history; it does not checkpoint LangGraph state. See [architecture details](docs/architecture.md).

## What is implemented

- Conditional LangGraph routing with reviewer-driven follow-up searches and bounded revision loops.
- Dynamic literature queries, OpenAlex retrieval, URL deduplication, and structured source IDs.
- Asynchronous FastAPI runs, live server-sent events (SSE), and persistent execution logs.
- Source-ID validation, unresolved-review notices, and downloadable Markdown reports.
- Local model inference through a configurable OpenAI-compatible endpoint; no OpenAI-hosted model is required.
- V4.1 Executive homepage with four sections, an animated five-agent Debate Arena, offline Demo Mode, Live Research, and run reconnection.

## Run locally

Requirements: Python 3.11+, Node.js 20+, a running llama.cpp server exposing `/v1/chat/completions`, and network access to OpenAlex. Model weights and the inference server are supplied separately; choose a model your hardware supports.

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Set LLM_BASE_URL and LLM_MODEL for your local inference server.
# Set OPENALEX_API_KEY if needed for your OpenAlex access.
uvicorn main:app --host 127.0.0.1 --port 8091 --reload
```

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:5174>. The UI expects the backend at `http://127.0.0.1:8091`. API documentation: <http://127.0.0.1:8091/docs>.

The V4.1 homepage opens the five-agent Debate Room. See [frontend instructions](frontend/README.md) for production serving and browser checks. Reuse existing backend and model services when already running.

## Project layout

```text
backend/main.py          Agent graph, retrieval, API, SQLite and SSE
backend/requirements.txt Backend dependencies
backend/.env.example     Configuration template without secrets
frontend/index.html      V4.1 Executive Interface, demo, live events and reports
frontend/vite.config.ts  Homepage build and same-origin API proxy
docs/architecture.md     Execution flow, API and design limits
```

## Current limits and next steps

This is an early prototype. Run one backend worker: tasks execute in-process and do not survive a restart. Retrieval uses paper metadata and available abstracts, not full texts. Citation checks validate identifiers, not whether a paper supports a claim. Reaching the review limit can produce a report with unresolved concerns explicitly flagged.

Next: reliable task recovery, retrieval and citation evaluation, automated workflow tests, and a searchable run-history UI. Local secrets, execution databases, virtual environments, and migration snapshots are excluded from version control.
