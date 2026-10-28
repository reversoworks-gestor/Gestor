#!/usr/bin/env python3
"""Finite, demo-only layout checks through the preferred agent-browser CLI."""
import json, pathlib, subprocess, time, os
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'qa'/'evidence'
OUT.mkdir(parents=True, exist_ok=True)
SESSION='automotive-layout'
VIEWS=['overview','clients','vehicles','estimates','invoices','orders','production','triage','calendar','inventory','printers','parts','finance','expenses','more','settings']
def call(*args):
    completed=subprocess.run(['agent-browser','--session',SESSION,*args],check=True,capture_output=True,text=True,timeout=40)
    return completed.stdout.strip()
def result(text):
    data=json.loads(text)
    return json.loads(data) if isinstance(data,str) else data
previous=json.loads((ROOT/'qa'/'layout-results.json').read_text()) if (ROOT/'qa'/'layout-results.json').exists() else []
records=[]
for width in [320,375,768,1024,1280,1440]:
    call('set','viewport',str(width),'900')
    for view in VIEWS:
        old=next((r for r in previous if r['width']==width and r['view']==view and r['pass']),None)
        if old:
            records.append(old)
            continue
        call('open',f"{os.environ.get('QA_BASE_URL','http://127.0.0.1:3001')}/?preview=1&view={view}")
        time.sleep(.35)
        metrics=result(call('eval','JSON.stringify({width:innerWidth,client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,heading:document.querySelector("main h1")?.textContent,visible:!!document.querySelector("main"),cut:[...document.querySelectorAll("main button,main input,main select,main textarea")].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.left<0||r.right>innerWidth+1)&&!e.closest(".table-wrap")}).map(e=>({tag:e.tagName,label:e.getAttribute("aria-label")||e.textContent.slice(0,40)}))})'))
        entry={'view':view,'width':width,**metrics,'pass':bool(metrics.get('heading')) and metrics['scroll']<=width+1 and len(metrics['cut'])==0}
        records.append(entry)
        if not entry['pass'] or (width in [375,1440] and view in ['overview','triage','production','clients']):
            call('screenshot',str(OUT/f'{view}-{width}.png'))
        print(json.dumps(entry,ensure_ascii=False),flush=True)
(ROOT/'qa'/'layout-results.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n')
call('close')
failed=[r for r in records if not r['pass']]
print(f'Layout records: {len(records)}; failing: {len(failed)}',flush=True)
raise SystemExit(1 if failed else 0)
