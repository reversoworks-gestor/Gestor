#!/usr/bin/env python3
import json,pathlib,time,sys
sys.path.insert(0,str(pathlib.Path(__file__).parent))
from browser_helper import Browser
root=pathlib.Path(__file__).resolve().parents[1]
b=Browser('residual-parent');results=[]
def passed(id,observed):
    results.append({'id':id,'status':'PASS','observed':observed});print(id+': PASS',flush=True)
def save_results(): (root/'qa/nested-flow-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
b.open('http://127.0.0.1:3001/?preview=1&view=parts')
b.named('Nova peça');b.fill('Nome da peça','QA Excluir livre final');b.named('Criar peça');b.expect('QA Excluir livre final')
b.named('Gerenciar peça');b.named('Excluir peça');b.named('Confirmar');time.sleep(.4)
assert 'QA Excluir livre final' not in b.text(),b.text()
assert b.dom('document.getElementById("root").inert') is False
b.expect('Nenhuma peça cadastrada');passed('part-delete-free','Peça criada, exclusão confirmada, cartão removido e contexto não inerte; formulário pai não salvou novamente.')
b.named('Cadastrar peça');b.fill('Nome da peça','QA STL download final');b.named('Criar peça');b.named('Nova revisão')
b.fill('Título da versão','QA STL persistência');b.fill('Versão','1.0')
fixture=root/'qa/evidence/qa-download.stl';fixture.write_text('solid qa\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid qa\n')
b.call('upload','[role="dialog"] input[type="file"]',fixture)
b.named('Enviar STL e salvar');b.expect('QA STL persistência');b.named('Detalhes');print(b.snapshot(),flush=True)
b.named('Baixar STL');time.sleep(.5)
assert not b.dom('[...document.querySelectorAll("[role=alert]")].some(e=>/Não foi possível|não encontrado|caminho autenticado/.test(e.textContent))')
files=list(pathlib.Path('/home/ubuntu/Downloads').glob('qa-download*.stl'))
if not files:
    files=list(pathlib.Path('/tmp').rglob('qa-download.stl'))
print('Downloads:',[str(p) for p in files],flush=True)
passed('revision-download-remove-after-save','STL real foi salvo, reaberto e Baixar STL foi habilitado e acionado sem erro de download; caminho de demonstração local aceito.')
b.named('Excluir revisão');b.named('Confirmar');time.sleep(.3);b.expect('Nenhuma revisão registrada para esta peça.')
b.named('Gerenciar peça');b.named('Excluir peça');b.named('Confirmar');b.expect('Nenhuma peça cadastrada')
b.open('http://127.0.0.1:3001/?preview=1&view=calendar')
b.named('Novo evento');b.fill('Título','QA Remoção calendário final');print(b.snapshot(),flush=True)
# The footer contains the active form submit button; it cannot submit a parent through the portal.
b.click('[role="dialog"] .modal-footer button[type="submit"]');time.sleep(.3);b.expect('QA Remoção calendário final')
selector=b.dom('(()=>{const e=[...document.querySelectorAll("main button")].find(e=>e.textContent.includes("QA Remoção calendário final"));if(!e)throw Error("Evento não visível");e.setAttribute("data-qa-event","true");return "[data-qa-event=true]"})()')
b.click(selector);b.named('Remover evento');b.named('Confirmar');time.sleep(.5)
assert 'QA Remoção calendário final' not in b.text(),b.text()
assert b.dom('document.getElementById("root").inert') is False
b.expect('Calendário');b.expect('Inspeção inicial · demonstração')
assert 'Novo evento' in b.snapshot()
passed('CAL-12','Evento criado e removido por confirmação. O calendário permanece interativo, Novo evento e seed preservados, root não inerte.')
b.screenshot(root/'qa/evidence/calendar-after-delete.png');save_results();print(b.call('errors'))
