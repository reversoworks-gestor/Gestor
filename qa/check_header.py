"""Regressão do cabeçalho pelo DOM público; somente demonstração, sem Firebase real."""
import argparse, json, pathlib
from browser_helper import Browser

parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:3000/?preview=1')
parser.add_argument('--widths', default='440')
parser.add_argument('--output', default='qa/header-results.json')
args = parser.parse_args()
assert 'preview=1' in args.url
browser = Browser('header-regression')
browser.open(args.url)
browser.call('wait', 'h1')
results = []
for width in map(int, args.widths.split(',')):
    browser.call('set', 'viewport', width, 956)
    row = browser.dom('''(() => {
      const visible = e => !!e && e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height > 0;
      const title = document.querySelector('.workspace-title');
      const form = document.querySelector('.global-search');
      const toggles = [...document.querySelectorAll('.topbar-actions button')].filter(visible);
      const searchButtons = toggles.filter(e => /busca|pesquisar/i.test(e.getAttribute('aria-label') || ''));
      const context = document.querySelector('.topbar-context').getBoundingClientRect();
      const actions = document.querySelector('.topbar-actions').getBoundingClientRect();
      const targets = [...document.querySelectorAll('.gestor-topbar button')].filter(visible).map(e => ({
        label: e.getAttribute('aria-label') || e.innerText,
        width: e.getBoundingClientRect().width,
        height: e.getBoundingClientRect().height
      }));
      return {width: innerWidth, title: title.textContent,
        titleClipped: title.scrollWidth > title.clientWidth + 1 || title.scrollHeight > title.clientHeight + 1,
        formVisible: visible(form), searchButtons: searchButtons.length,
        headerOverlap: context.right > actions.left + 1,
        overflow: document.documentElement.scrollWidth > innerWidth,
        targets};
    })()''')
    row['pass'] = (not row['titleClipped'] and not row['headerOverlap'] and not row['overflow']
        and row['searchButtons'] == 1 and row['formVisible'] == (width >= 1280)
        and all(t['width'] >= 43.5 and t['height'] >= 43.5 for t in row['targets']))
    results.append(row)
pathlib.Path(args.output).write_text(json.dumps(results, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(results, ensure_ascii=False, indent=2))
assert all(row['pass'] for row in results), 'Cabeçalho com corte, duplicação, sobreposição ou alvo insuficiente'
