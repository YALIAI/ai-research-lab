# Architecture and execution

The [README architecture diagram](../README.md#architecture) shows the implemented workflow. Agent roles are LangGraph nodes using distinct prompts over the same configurable local model; they are not five independent model servers.

## Agent responsibilities

| Role | Responsibility |
| --- | --- |
| PI | Produce a research plan and up to three deduplicated search queries. |
| Researcher | Search OpenAlex and accumulate titles, years, URLs, and available abstracts with stable source IDs. |
| Analyst | Develop a balanced analysis using the retrieved source IDs and prior reviewer feedback. |
| Critic | Request revision, request more evidence, or approve; check analysis source IDs. |
| Writer | Produce Markdown, flag unresolved review concerns, and append the retrieved source list. |

A helper node generates follow-up queries from the critique. The Critic permits at most two retrieval rounds. After three reviews, the normal revision route proceeds to writing; a second retrieval may still be requested at that boundary, allowing a fourth review before writing. The graph also has a recursion limit of 20 steps.

## API and storage

| Endpoint | Behavior |
| --- | --- |
| `POST /api/runs` | Validate a 10–500 character question, insert a running record, schedule an asynchronous task, and return its ID. |
| `GET /api/runs/{id}` | Return stored status, report, error, and creation timestamp. |
| `GET /api/runs/{id}/events` | Stream stored events, poll once per second, and emit `done` when the run completes or fails. |

SQLite uses WAL mode and stores `runs` and `events`. Intermediate graph state is not persisted. SSE connections replay stored events from the beginning; the current UI has no automatic reconnect or history browser.

## Evidence boundaries

OpenAlex results supply metadata and abstracts when available. Retrieval failures are logged; a run fails if no sources can be retrieved. The Critic checks citation IDs in the analysis. The Writer replaces unknown report IDs with an unverified-citation marker and includes all retrieved sources, which may include uncited papers. These checks do not establish semantic support, research completeness, or factual correctness.

## Deployment boundary

Designed for local experimentation with one worker. There is no authentication, task queue, cancellation, or restart recovery. A production deployment would require these capabilities and an evaluation suite before exposing the API publicly.
