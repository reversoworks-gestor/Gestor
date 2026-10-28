#!/usr/bin/env python3
import sys,time,json,pathlib
sys.path.insert(0,str(pathlib.Path(__file__).parent))
from browser_helper import Browser
b=Browser('automotive-auth')
ROOT=pathlib.Path(__file__).resolve().parents[1]
TITLE='QA autenticada · nota privada e arquivo'
PRIVATE='SEGREDO_QA_LOCAL_NAO_EXPORTAR'
results=[]
b.call('open','http://127.0.0.1:3000/?view=invoices');time.sleep(1)
body=b.text()
if 'QA' not in body: raise RuntimeError('A aplicação não confirma o ambiente QA; nenhuma escrita será executada.')
b.named('Novo documento')
b.select('Cliente','demo-client');b.select('Veículo','demo-vehicle')
b.fill('Título',TITLE);b.fill('Escopo','Verificar persistência privada exclusivamente nos emuladores.');b.fill('Nota privada',PRIVATE)
b.named('Adicionar Restauração de faróis');b.fill('Preço unitário (USD)',120)
b.call('upload','input[type="file"]',str(ROOT/'docs/Marketing-Book-Automotivo.pdf'))
b.expect('120,00');print('Campos, nota privada e preço 120 preenchidos em QA.',flush=True)
b.click('[role="dialog"] .modal-footer button:last-child')
for i in range(30):
    time.sleep(.5)
    if not b.dom('!!document.querySelector("[role=dialog]")'): break
    if i%10==0:print('Aguardando confirmação de Storage/Firestore...',flush=True)
if b.dom('!!document.querySelector("[role=dialog]")'):
    raise AssertionError('Salvar não fechou o diálogo: '+b.text()[-3500:])
b.expect(TITLE);results.append({'id':'AUTH-PRIVATE-SAVE','status':'PASS','observed':'Invoice com nota privada, preço 120 e PDF salva via Auth/Firestore/Storage em emulador.'})
b.named('Editar')
fields=b.fields()
assert any(f.get('label','').casefold()=='título' and f['value']==TITLE for f in fields),fields
assert any(f.get('label','').casefold()=='nota privada' and f['value']==PRIVATE for f in fields),fields
b.expect('Marketing-Book-Automotivo.pdf')
results.append({'id':'AUTH-PRIVATE-REOPEN','status':'PASS','observed':'Título, nota privada e metadados do PDF permanecem no formulário reaberto por leitura Firebase.'})
buttons=b.dom('[...document.querySelectorAll("[role=dialog] button")].map(e=>({label:e.getAttribute("aria-label")||e.textContent.trim()}))')
print(json.dumps(buttons,ensure_ascii=False),flush=True)
b.screenshot(ROOT/'qa/evidence/authenticated-private-field.png')
b.named('Cancelar')
print('Persistência autenticada comprovada; sem alteração de produção.',flush=True)
(ROOT/'qa/auth-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
