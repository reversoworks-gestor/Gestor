"""Somente viewport Chromium e demonstração; nenhum dado Firebase é modificado."""
import json, pathlib, time
from browser_helper import Browser
b = Browser('services-layout')
results = []
for view in ['overview','estimates','production','selector','settings','finance']:
    b.open('http://127.0.0.1:3000/?preview=1&view='+view)
    b.call('wait','h1'); time.sleep(.4)
    for width,height in [(320,900),(440,956),(956,440),(1280,900)]:
        b.call('set','viewport',width,height)
        state = b.dom('({viewport:[innerWidth,innerHeight],overflow:document.documentElement.scrollWidth>innerWidth+1,heading:document.querySelector("h1")?.textContent,error:!!document.querySelector(".error-fallback")})')
        assert not state['overflow'] and not state['error'], (view,state)
        results.append({'view':view,**state,'pass':True})
    if view in ['production','settings']:
        b.call('set','viewport',440,956);b.screenshot('qa/evidence/services-'+view+'-mobile.png')
pathlib.Path('qa/service-layout-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
print('PASS',len(results),'combinações de página e viewport')
