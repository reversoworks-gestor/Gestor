"""QA de leitura: somente fixtures sintéticas na demonstração do navegador."""
import argparse, json, pathlib
from browser_helper import Browser
p = argparse.ArgumentParser()
p.add_argument('--url', default='http://127.0.0.1:3000/?preview=1')
p.add_argument('--output', default='qa/legacy-commercial-browser.json')
a = p.parse_args()
assert 'preview=1' in a.url
b = Browser('legacy-commercial-final')
b.open(a.url)
b.call('wait', 'h1')
b.call('set', 'viewport', 440, 956)
fixture = pathlib.Path('qa/legacy-commercial-fixture.json').read_text()
b.dom('(() => { if(new URLSearchParams(location.search).get("preview")!=="1") throw new Error("QA exige demonstração"); localStorage.setItem("reverso-automotive-demo-v1", ' + json.dumps(fixture) + '); return true; })()')
separator = '&' if '?' in a.url else '?'
b.open(a.url + separator + 'view=estimates')
b.call('wait', '#commercial-search')
titles = b.dom('[...document.querySelectorAll("article.card strong")].filter(e=>!e.hasAttribute("aria-label")).map(e=>e.textContent)')
assert titles == ['QA Documento ISO', 'QA Documento Firestore', 'QA Documento época', 'QA Documento sem data'], titles
b.expect('Serviço: Serviço a definir')
b.screenshot('qa/evidence/legacy-estimates-mobile.png')
b.click('article.card:last-child button.btn-secondary')
b.call('wait', '[role=dialog]')
b.expect('Editar documento')
b.call('press', 'Escape')
assert not b.dom('!!document.querySelector("[role=dialog]")')
assert not b.dom('document.documentElement.scrollWidth>innerWidth')
assert not b.call('errors')
pathlib.Path(a.output).write_text(json.dumps({'estimatesRead':True,'chronologicalOrder':True,'missingDateVisible':True,'unknownServiceEdit':True,'mobileNoOverflow':True,'jsErrors':False,'dataMode':'synthetic-browser-demo-only'},indent=2)+'\n')
print('PASS: estimativas ISO/época/Firestore/sem data, ordenação, serviço legado, editor e layout móvel')
