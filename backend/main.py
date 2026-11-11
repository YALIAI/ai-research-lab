import asyncio, json, os, re, sqlite3, uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import TypedDict
from urllib.parse import urlparse
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, START, END

load_dotenv()
ROOT = Path(__file__).resolve().parent
DB = ROOT / 'runs.sqlite3'
DEFAULT_TOPIC = 'Will end-to-end AI replace traditional modular ADAS architectures by 2030?'
app = FastAPI(title='AI Research Lab')
app.add_middleware(CORSMiddleware, allow_origins=['http://localhost:5173','http://127.0.0.1:5173'], allow_methods=['*'], allow_headers=['*'])

def connect():
    c = sqlite3.connect(DB, timeout=30)
    c.row_factory = sqlite3.Row
    c.execute('PRAGMA journal_mode=WAL')
    return c

def init_db():
    with connect() as c:
        c.execute('CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, topic TEXT, status TEXT, report TEXT, error TEXT, created TEXT)')
        c.execute('CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT, ts TEXT, agent TEXT, message TEXT)')
init_db()

def event(run_id, agent, message):
    with connect() as c:
        c.execute('INSERT INTO events(run_id,ts,agent,message) VALUES (?,?,?,?)', (run_id,datetime.now(timezone.utc).isoformat(),agent,message[:10000]))

def llm():
    return ChatOpenAI(model=os.getenv('LLM_MODEL','local-model'), base_url=os.getenv('LLM_BASE_URL','http://127.0.0.1:8080/v1'), api_key=os.getenv('LLM_API_KEY','not-needed'), temperature=0.2, timeout=180, max_retries=1)

async def ask(role, prompt):
    response = await llm().ainvoke([('system',role),('human',prompt)])
    return str(response.content)

class State(TypedDict):
    run_id: str
    topic: str
    plan: str
    evidence: list[dict]
    analysis: str
    critique: str
    approved: bool
    round: int
    report: str
    search_queries: list[str]
    research_round: int
    next_action: str


async def pi(s: State):
    event(s['run_id'], 'PI', 'Planning research')

    plan = await ask(
        'You are a rigorous research principal investigator. '
        'Develop testable research subquestions appropriate to the topic. '
        'Do not invent citations.',
        s['topic']
    )

    event(s['run_id'], 'PI', plan)

    queries = await generate_queries(s['topic'], plan)

    event(
        s['run_id'], 'PI',
        'Search queries: ' + '; '.join(queries)
    )

    return {'plan': plan, 'search_queries': queries}


def parse_queries(text, fallback):
    import json

    try:
        match = re.search(r'\[[\s\S]*?\]', text)
        values = json.loads(match.group(0)) if match else []
    except (ValueError, AttributeError):
        values = []

    if not isinstance(values, list):
        values = []

    queries = []
    for value in values:
        if isinstance(value, str):
            value = ' '.join(value.split())[:160]
            if value and value.casefold() not in {
                q.casefold() for q in queries
            }:
                queries.append(value)

    return queries[:3] or [fallback[:160]]


async def generate_queries(topic, context):
    response = await ask(
        'You generate academic literature search queries. '
        'Return ONLY a JSON array containing exactly three '
        'short English search strings. No Markdown.',
        f'TOPIC: {topic}\nCONTEXT: {context[:1200]}'
    )

    return parse_queries(response, topic)


async def fetch_evidence(queries, existing=None):
    items = list(existing or [])
    seen = {e['url'] for e in items}

    async with httpx.AsyncClient(
        timeout=25,
        headers={
            'User-Agent': 'AIResearchLab/0.2 (local educational research)'
        }
    ) as client:
        for q in queries:
            params = {'search': q, 'per-page': 5}

            if os.getenv('OPENALEX_API_KEY'):
                params['api_key'] = os.environ['OPENALEX_API_KEY']

            try:
                resp = await client.get(
                    'https://api.openalex.org/works',
                    params=params
                )
                resp.raise_for_status()

                for work in resp.json().get('results', []):
                    title = work.get('display_name') or ''
                    url = work.get('doi') or work.get('id')

                    if not title or not url or url in seen:
                        continue

                    seen.add(url)

                    inv = work.get('abstract_inverted_index') or {}
                    words = {
                        i: w
                        for w, positions in inv.items()
                        for i in positions
                    }
                    abstract = ' '.join(
                        words[i] for i in sorted(words)
                    )[:1600]

                    items.append({
                        'id': f'S{len(items) + 1}',
                        'title': title,
                        'url': url,
                        'year': work.get('publication_year'),
                        'abstract': abstract,
                        'source': 'OpenAlex'
                    })

            except Exception as exc:
                print(
                    f'OpenAlex search failed for {q}: '
                    f'{type(exc).__name__}: {exc}',
                    flush=True
                )

    return items


async def researcher(s: State):
    event(
        s['run_id'], 'Researcher',
        f'Searching OpenAlex (research round {s["research_round"] + 1})'
    )

    previous = s['evidence']
    evidence = await fetch_evidence(
        s['search_queries'],
        existing=previous
    )

    added = len(evidence) - len(previous)

    event(
        s['run_id'], 'Researcher',
        f'Total sources: {len(evidence)}; newly retrieved: {added}'
    )

    if not evidence:
        raise RuntimeError(
            'No sources retrieved; refusing unsupported report'
        )

    return {
        'evidence': evidence,
        'research_round': s['research_round'] + 1
    }


def evidence_text(evidence):
    return '\n'.join(f"[{e['id']}] {e['title']} ({e['year']}) {e['url']}\nAbstract: {e['abstract'] or '[not available; metadata only]'}" for e in evidence)

async def analyst(s: State):
    event(s['run_id'],'Analyst',f'Analyzing evidence (round {s["round"]+1})')
    prompt=f"QUESTION: {s['topic']}\nPLAN: {s['plan']}\nSOURCES:\n{evidence_text(s['evidence'])}\nPREVIOUS CRITIQUE: {s['critique']}\nWrite a balanced analysis. Cite source IDs [S1], [S2] etc. Never claim a paper proves something beyond the supplied abstract. Mark missing evidence explicitly."
    analysis=await ask('You are a cautious technical analyst. Only source IDs supplied in the prompt may be cited. Distinguish evidence from hypotheses.',prompt)
    event(s['run_id'],'Analyst',analysis)
    return {'analysis':analysis}


async def critic(s: State):
    event(
        s['run_id'], 'Critic',
        f'Checking analysis (round {s["round"] + 1})'
    )

    prompt = (
        f"QUESTION: {s['topic']}\n"
        f"SOURCES:\n{evidence_text(s['evidence'])}\n"
        f"ANALYSIS:\n{s['analysis']}\n"
        "Review evidence quality, unsupported claims, citations, "
        "and missing counterarguments.\n"
        "First line must be exactly one of:\n"
        "APPROVE\n"
        "MORE_EVIDENCE\n"
        "REVISE\n"
        "Use MORE_EVIDENCE when additional literature is needed. "
        "Then provide specific feedback."
    )

    critique = await ask(
        'You are a skeptical academic peer reviewer.',
        prompt
    )

    allowed = {e['id'] for e in s['evidence']}
    used = set(re.findall(r'\[S\d+\]', s['analysis']))
    invalid = [
        x for x in used if x[1:-1] not in allowed
    ]

    decision = critique.strip().splitlines()[0].strip().upper()
    if decision not in {'APPROVE', 'MORE_EVIDENCE', 'REVISE'}:
        decision = 'REVISE'

    approved = (
        decision == 'APPROVE'
        and not invalid
        and bool(used)
    )

    if invalid:
        critique += '\nINVALID SOURCE IDS: ' + ', '.join(invalid)

    if approved:
        action = 'writer'
    elif decision == 'MORE_EVIDENCE' and s['research_round'] < 2:
        action = 'researcher'
    elif s['round'] + 1 >= 3:
        action = 'writer'
    else:
        action = 'analyst'

    event(
        s['run_id'], 'Critic',
        f'Decision: {decision}; next: {action}\n{critique}'
    )

    return {
        'critique': critique,
        'approved': approved,
        'round': s['round'] + 1,
        'next_action': action
    }


async def refine_search(s: State):
    queries = await generate_queries(
        s['topic'],
        s['critique']
    )

    event(
        s['run_id'], 'Researcher',
        'Additional search queries: ' + '; '.join(queries)
    )

    return {'search_queries': queries}


def route(s: State):
    return s['next_action']


async def writer(s: State):
    event(s['run_id'],'Writer','Drafting final report')
    report=await ask('You write transparent technical research reports. Cite only supplied IDs. Explicitly flag unresolved review concerns. Never invent references.',f"TOPIC: {s['topic']}\nANALYSIS:\n{s['analysis']}\nCRITIQUE:\n{s['critique']}\nAPPROVED: {s['approved']}\nWrite a concise Markdown report with executive summary, evidence, competing viewpoints, limitations and conclusion. Cite [S#] identifiers.")
    valid={e['id'] for e in s['evidence']}
    report=re.sub(r'\[S\d+\]',lambda m:m.group(0) if m.group(0)[1:-1] in valid else '[UNVERIFIED CITATION]',report)
    if not s['approved']: report='> **Review status:** Unresolved reviewer concerns remain.\n\n'+report
    report+='\n\n## Retrieved sources\n'+ '\n'.join(f"- [{e['id']}] {e['title']} ({e['year']}) — {e['url']}" for e in s['evidence'])
    event(s['run_id'],'Writer','Report completed')
    return {'report':report}

builder=StateGraph(State)
for name,fn in [('PI',pi),('Researcher',researcher),('Analyst',analyst),('Critic',critic),('Writer',writer)]: builder.add_node(name,fn)
builder.add_edge(START,'PI')
builder.add_edge('PI','Researcher')
builder.add_edge('Researcher','Analyst')
builder.add_edge('Analyst','Critic')
builder.add_node('RefineSearch', refine_search)
builder.add_conditional_edges(
    'Critic',
    route,
    {
        'analyst': 'Analyst',
        'researcher': 'RefineSearch',
        'writer': 'Writer'
    }
)
builder.add_edge('RefineSearch', 'Researcher')
builder.add_edge('Writer',END)
graph=builder.compile()

class CreateRun(BaseModel):
    topic: str = Field(default=DEFAULT_TOPIC,min_length=10,max_length=500)

async def execute(run_id,topic):
    try:
        state={'run_id':run_id,'topic':topic,'plan':'','evidence':[],'analysis':'','critique':'','approved':False,'round':0,'report':'',
               'search_queries':[],
               'research_round':0,
               'next_action':'analyst'}
        result=await graph.ainvoke(state,config={'recursion_limit':20})
        with connect() as c: c.execute('UPDATE runs SET status=?,report=? WHERE id=?',('completed',result['report'],run_id))
        event(run_id,'System','Research complete')
    except Exception as exc:
        with connect() as c: c.execute('UPDATE runs SET status=?,error=? WHERE id=?',('failed',str(exc),run_id))
        event(run_id,'System','FAILED: '+str(exc))

@app.post('/api/runs')
async def create_run(payload:CreateRun):
    run_id=str(uuid.uuid4())
    with connect() as c: c.execute('INSERT INTO runs VALUES (?,?,?,?,?,?)',(run_id,payload.topic,'running','','',datetime.now(timezone.utc).isoformat()))
    asyncio.create_task(execute(run_id,payload.topic))
    return {'id':run_id}

@app.get('/api/runs/{run_id}')
def get_run(run_id:str):
    with connect() as c:
        row=c.execute('SELECT * FROM runs WHERE id=?',(run_id,)).fetchone()
    if not row: raise HTTPException(404,'Run not found')
    return dict(row)

@app.get('/api/runs/{run_id}/events')
async def stream_events(run_id:str):
    get_run(run_id)
    async def gen():
        last=0
        while True:
            with connect() as c:
                rows=c.execute('SELECT * FROM events WHERE run_id=? AND id>? ORDER BY id',(run_id,last)).fetchall()
            for row in rows:
                last=row['id']
                yield 'data: '+json.dumps(dict(row),ensure_ascii=False)+'\n\n'
            status=get_run(run_id)['status']
            if status in ('completed','failed'):
                yield 'event: done\ndata: '+json.dumps({'status':status})+'\n\n'
                break
            yield ': heartbeat\n\n'
            await asyncio.sleep(1)
    return StreamingResponse(gen(),media_type='text/event-stream',headers={'Cache-Control':'no-cache','X-Accel-Buffering':'no'})
