"""Ações do cabeçalho em demonstração pelo navegador, sem acesso ao Firebase."""
import argparse, json, pathlib, time
from browser_helper import Browser
p = argparse.ArgumentParser()
p.add_argument('--url', default='http://127.0.0.1:3000/?preview=1')
p.add_argument('--output', default='qa/header-actions.json')
a = p.parse_args()
b = Browser('header-actions-final')
b.open(a.url)
b.call('wait', 'h1')
b.call('set', 'viewport', 440, 956)
b.named('Abrir busca global')
b.call('wait', '[role=dialog]')
b.call('fill', '[role=dialog] input[type=search]', 'Cliente')
b.call('wait', '[role=dialog] .list-row-action')
assert b.dom('document.querySelector("[role=dialog] input").value') == 'Cliente'
b.call('press', 'Escape')
assert not b.dom('!!document.querySelector("[role=dialog]")')
assert b.dom('document.activeElement.getAttribute("aria-label")') == 'Abrir busca global'
b.named('Abrir perfil')
b.call('wait', '[role=menu]')
b.call('press', 'Escape')
assert not b.dom('!!document.querySelector("[role=menu]")')
b.named('Abrir menu')
assert b.dom('document.querySelector(".gestor-sidebar").classList.contains("is-open")')
b.named('Peças e revisões')
b.call('wait', 'h1')
assert b.dom('document.querySelector(".workspace-title").textContent') == 'Peças e revisões'
b.call('set', 'viewport', 320, 956)
assert not b.dom('document.querySelector(".workspace-title").scrollWidth > document.querySelector(".workspace-title").clientWidth + 1')
b.open(a.url)
b.call('wait', 'h1')
b.call('set', 'viewport', 440, 956)
b.screenshot('qa/evidence/header-440-after.png')
b.call('set', 'viewport', 1280, 956)
b.call('fill', '#gestor-global-search', 'Cliente')
b.call('press', 'Enter')
b.call('wait', '[role=dialog] .list-row-action')
b.call('press', 'Escape')
assert not b.call('errors')
result = {'compactSearch': True, 'inlineSearch': True, 'searchResults': True,
          'escapeRestoreFocus': True, 'menuNavigation': True, 'profile': True,
          'longTitle320': True, 'jsErrors': False}
pathlib.Path(a.output).write_text(json.dumps(result, indent=2) + '\n')
print('PASS: busca compacta e inline, resultados, Escape, retorno de foco, menu, navegação e perfil')
