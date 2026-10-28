"""UI-only agent-browser actions; never reads application internals or calls its API."""
import json, subprocess, time, pathlib, re
class Browser:
    def __init__(self,session='qa-final'): self.session=session
    def call(self,*args):
        p=subprocess.run(['agent-browser','--session',self.session,*map(str,args)],capture_output=True,text=True,timeout=45)
        if p.returncode: raise RuntimeError(p.stdout+'\n'+p.stderr)
        return p.stdout.strip()
    def open(self,url):
        if 'preview=1' not in url: raise ValueError('QA requer explicitamente preview=1')
        self.call('open',url);time.sleep(.4)
    def click(self,selector):
        self.call('scrollintoview',selector);self.call('click',selector);time.sleep(.15)
    def named(self,name):
        rows=self.snapshot().splitlines()
        row=next((r for r in rows if re.search(r'button "'+re.escape(name)+r'"',r,re.I)),None)
        if not row: raise AssertionError('Botão não encontrado: '+name)
        reference='@'+re.search(r'ref=(e[0-9]+)',row).group(1)
        self.click(reference)
    def fill(self,label,value): self.call('find','label',label,'fill',str(value))
    def select(self,label,value):
        field=next((f for f in self.fields() if f['tag']=='SELECT' and (f.get('label') or '').casefold()==label.casefold()),None)
        if not field: raise AssertionError('Select não encontrado: '+label)
        self.call('select',f'[id="{field["id"]}"]',str(value))
    def snapshot(self): return self.call('snapshot','-i')
    def dom(self,expression):
        value=json.loads(self.call('eval','JSON.stringify('+expression+')'))
        return json.loads(value) if isinstance(value,str) else value
    def text(self): return self.dom('document.body.innerText')
    def expect(self,text):
        current=self.text()
        if text not in current: raise AssertionError(f'Não encontrado: {text}\n{current[-3500:]}')
    def screenshot(self,path): return self.call('screenshot',str(path))
    def fields(self): return self.dom('[...document.querySelectorAll("[role=dialog] input,[role=dialog] select,[role=dialog] textarea")].map(e=>({tag:e.tagName,type:e.type,id:e.id,label:e.getAttribute("aria-label")||document.querySelector(`label[for="${e.id}"]`)?.textContent?.trim()||e.closest("label")?.textContent?.trim(),value:e.value,required:e.required,disabled:e.disabled,options:e.tagName==="SELECT"?[...e.options].map(o=>({value:o.value,label:o.textContent})):undefined}))')
    def close(self): self.call('close')
