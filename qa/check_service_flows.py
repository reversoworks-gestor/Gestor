"""Cenários sintéticos de UI; não consulta nem grava Firebase real."""
import sys,json,pathlib,time
from browser_helper import Browser
b=Browser('services-flow-resumed')
results=[]
def note(case): results.append({'case':case,'status':'PASS'});print('PASS',case,flush=True)
def fill(label,value):
    f=next(f for f in b.fields() if (f.get('label') or '').casefold()==label.casefold())
    b.call('fill',f'[id="{f["id"]}"]',str(value))
def stage(value):
    b.select('Etapa desejada',value);b.named('Salvar e alterar etapa');time.sleep(.25)
    expected={'lead':'Lead','evaluation':'Avaliação','quote':'Orçamento enviado','approved':'Aprovado','scheduled':'Agendado','production':'Em produção','quality':'Controle de qualidade','delivered':'Entregue / Pago','aftercare':'Pós-venda'}[value]
    assert b.dom('document.querySelector(".process-context .status").textContent')==expected,(value,b.text()[-1000:])
    assert not b.dom('!!document.querySelector("[role=alert]")'),b.text()[-1200:]
    note('Pipeline · '+value)
base='http://127.0.0.1:3000/'
b.open(base+'?preview=1&view=estimates');b.call('wait','h1');time.sleep(.5)
b.call('set','viewport',440,956)
b.named('Novo documento');b.select('Cliente','demo-client');b.select('Veículo','demo-vehicle')
fill('Título','QA FAR oficial · retomada validada');fill('Escopo','Restauração externa das lentes, sujeita à inspeção.')
b.select('Catálogo oficial','FAR-01');b.named('Adicionar do catálogo')
price=b.dom('[...document.querySelectorAll("input")].find(e=>e.placeholder==="Por avaliação")?.id')
assert price
b.call('fill',f'[id="{price}"]','120');b.named('Salvar documento');b.expect('QA FAR oficial · retomada validada');note('Cadastro oficial com preço manual')
b.open(base+'?preview=1&view=production');b.call('wait','h1');time.sleep(.5)
b.named('Ver detalhes de QA FAR oficial · retomada validada')
# Try a prohibited jump before supplying gate evidence.
b.select('Etapa desejada','production');b.named('Salvar e alterar etapa');b.expect('não pule status');note('Salto bloqueado')
b.select('Etapa desejada','evaluation');b.named('Salvar e alterar etapa');note('Pipeline · evaluation')
fill('Descrição do problema','Amarelamento externo sem trinca ou dano interno')
fill('Prazo estimado do orçamento','2026-11-05');fill('Dano externo / interno / trinca','Externo')
fixture=pathlib.Path('qa/evidence/fixture-evidence.png')
before=b.dom('[...document.querySelectorAll("input[type=file]")].find(e=>e.accept==="image/png,image/jpeg")?.id')
b.call('upload',f'[id="{before}"]',str(fixture.resolve()))
b.named('Salvar job');time.sleep(.3)
# Complete the mandatory feasibility evaluation.
b.click('.process-task-list > li:nth-child(1) input[type=checkbox]')
stage('quote');stage('approved')
fill('Data de entrada','2026-11-04');fill('Entrega prometida','2026-11-05')
stage('scheduled');fill('Custo de material','0');fill('Horas trabalhadas','1');stage('production')
fill('Grãos usados (sequência progressiva, sem pular)','400, 800, 1200, 2000')
file_inputs=b.dom('[...document.querySelectorAll("input[type=file]")].map(e=>({id:e.id,label:document.querySelector(`label[for="${e.id}"]`)?.textContent}))')
after=next(x for x in file_inputs if 'depois' in (x['label'] or '').lower())
b.call('upload',f'[id="{after["id"]}"]',str(fixture.resolve()));b.named('Salvar job');time.sleep(.3)
count=b.dom('document.querySelectorAll(".process-task-list > li").length')
for i in range(2,count+1):
    selector=f'.process-task-list > li:nth-child({i}) input[type=checkbox]'
    b.click(selector)
    assert b.dom(f'document.querySelector({json.dumps(selector)}).checked'),b.text()[-1500:]
stage('quality')
fill('Valor final cobrado','120');fill('Forma de pagamento','Cartão');fill('Data do pagamento','2026-11-05');fill('Data da entrega','2026-11-05')
b.click('details.process-disclosure summary');fill('Valor deste recebimento','120');b.call('focus','details.process-disclosure .row button:first-child');b.call('press','Enter');b.call('wait','--fn','document.querySelectorAll(".process-payment-list li").length===1');b.expect('pago');b.named('Salvar job');time.sleep(.3);note('Quitação e saldo calculados sem duplicar recebimentos')
stage('delivered');b.select('Avaliação solicitada ao cliente','yes');stage('aftercare')
b.screenshot('qa/evidence/services-complete-job-mobile.png')
assert not b.dom('document.documentElement.scrollWidth>innerWidth+1')
note('Ficha móvel sem overflow')
assert not b.call('errors').strip(), b.call('errors')
pathlib.Path('qa/service-flow-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
print('PASS ciclo operacional completo sem produção Firebase',flush=True)
