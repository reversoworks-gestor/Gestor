"""Viewport da captura, não teste físico de Safari. Apenas demonstração."""
import json, pathlib
from browser_helper import Browser
b = Browser('iphone-layout-check')
b.open('http://127.0.0.1:3000/?preview=1&view=parts')
b.call('wait', 'h1')
results = []
for width, height, name in [(440, 956, 'vertical'), (956, 440, 'horizontal')]:
    b.call('set', 'viewport', width, height, 3)
    state = b.dom('''(() => {
        const title = document.querySelector('.workspace-title');
        const menu = document.querySelector('.mobile-menu-toggle');
        return {width:innerWidth,height:innerHeight,scale:devicePixelRatio,
            titleClipped:title.scrollWidth>title.clientWidth+1,
            overflow:document.documentElement.scrollWidth>innerWidth,
            mobileMenuVisible:menu.getBoundingClientRect().width>=44};
    })()''')
    assert not state['titleClipped'] and not state['overflow'] and state['mobileMenuVisible']
    b.named('Abrir busca global')
    b.call('wait', '[role=dialog]')
    modal = b.dom('''(() => {const d=document.querySelector('[role=dialog]'), i=d.querySelector('input'), r=d.getBoundingClientRect();return {fontSize:parseFloat(getComputedStyle(i).fontSize),top:r.top,bottom:r.bottom};})()''')
    assert modal['fontSize'] >= 16 and modal['top'] >= 0 and modal['bottom'] <= height
    b.call('press', 'Escape')
    b.screenshot('qa/evidence/iphone-' + name + '.png')
    results.append({'orientation':name, **state, 'modal':modal, 'pass':True})
b.call('set', 'viewport', 440, 956)
b.dom('document.documentElement.style.fontSize="200%"')
assert not b.dom('document.documentElement.scrollWidth>innerWidth')
assert not b.dom('document.querySelector(".workspace-title").scrollWidth>document.querySelector(".workspace-title").clientWidth+1')
pathlib.Path('qa/iphone-priority-results.json').write_text(json.dumps({'method':'Chromium viewport/scale; sem teste físico de Safari ou emulação touch completa', 'orientations':results,'text200Percent':True},ensure_ascii=False,indent=2)+'\n')
print('PASS: vertical, horizontal, menu móvel, modal, campos >=16px e texto 200%')
