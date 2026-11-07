#!/usr/bin/env node
// Demo-only checks. CDP is used only for native safe-area emulation;
// all page navigation, inspection and interaction use agent-browser.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const base = process.env.QA_BASE_URL || "http://127.0.0.1:3000/";
const session = "iphone-header-safe-area";
const browser = (...args) => execFileSync("agent-browser", ["--session", session, ...args], {
  encoding: "utf8", timeout: 45000,
}).trim();
const evaluate = expression => {
  let value = JSON.parse(browser("eval", `JSON.stringify(${expression})`));
  return typeof value === "string" ? JSON.parse(value) : value;
};
const url = view => `${base}${base.includes("?") ? "&" : "?"}preview=1&view=${view}`;
browser("open", url("overview"));
const socket = new WebSocket(browser("get", "cdp-url"));
let nextId = 0;
const pending = new Map();
socket.onmessage = event => {
  const message = JSON.parse(event.data), request = pending.get(message.id);
  if (!request) return;
  pending.delete(message.id);
  message.error ? request.reject(new Error(JSON.stringify(message.error))) : request.resolve(message.result);
};
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
  const id = ++nextId;
  pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
});
const { targetInfos } = await send("Target.getTargets");
const target = targetInfos.find(item => item.type === "page" && item.url.startsWith(base.split("?")[0]));
if (!target) throw new Error("Demo browser target not found.");
const { sessionId } = await send("Target.attachToTarget", { targetId: target.targetId, flatten: true });
const metricsExpression = `(() => {
  const header = document.querySelector('.gestor-topbar'), frame = document.querySelector('.gestor-frame');
  const box = header.getBoundingClientRect(), css = getComputedStyle(header);
  const controls = [...header.querySelectorAll('button')].map(el => {
    const r = el.getBoundingClientRect();
    return { label: el.getAttribute('aria-label') || el.textContent, top:r.top, left:r.left, right:r.right, width:r.width, height:r.height };
  }).filter(item => item.width > 0 && item.height > 0);
  return { viewport:innerWidth, width:document.documentElement.clientWidth, scrollWidth:document.documentElement.scrollWidth,
    scrollY, position:css.position, headerTop:box.top, headerHeight:box.height, safePadding:parseFloat(css.paddingTop),
    framePadding:parseFloat(getComputedStyle(frame).paddingTop), controls, heading:document.querySelector('main h1')?.textContent };
})()`;
const interactionsOnly = process.env.QA_INTERACTIONS_ONLY === "1";
const checks = interactionsOnly ? JSON.parse(readFileSync(resolve(root, "qa/iphone-header-results.json"), "utf8")).checks.filter(item => item.scenario) : [];
const scenarios = [
  { width:320, height:844, insets:{top:0,bottom:0,left:0,right:0} },
  { width:390, height:844, insets:{top:59,bottom:34,left:0,right:0} },
  { width:440, height:956, insets:{top:62,bottom:34,left:0,right:0} },
  { width:956, height:440, insets:{top:0,bottom:21,left:62,right:62} },
  { width:768, height:1024, insets:{top:24,bottom:20,left:0,right:0} },
  { width:1440, height:900, insets:{top:0,bottom:0,left:0,right:0} },
];
try {
  for (const scenario of interactionsOnly ? [] : scenarios) {
    browser("set", "viewport", String(scenario.width), String(scenario.height));
    for (const view of ["overview", "estimates", "production", "settings"]) {
      browser("open", url(view));
      browser("wait", "--fn", "!!document.querySelector('.gestor-topbar') && !!document.querySelector('main h1')");
      await send("Emulation.setSafeAreaInsetsOverride", { insets:scenario.insets }, sessionId);
      // Wait for layout, then allow ResizeObserver's reserved height to settle.
      browser("wait", "--fn", `parseFloat(getComputedStyle(document.querySelector('.gestor-topbar')).paddingTop)>=${scenario.insets.top + 10} && Math.abs(parseFloat(document.documentElement.style.getPropertyValue('--rw-topbar-height'))-document.querySelector('.gestor-topbar').getBoundingClientRect().height)<1`);
      const initial = evaluate(metricsExpression);
      browser("scroll", "down", "600");
      const scrolled = evaluate(metricsExpression);
      const mobile = scenario.width < 900 || scenario.height < 600;
      const pass = initial.scrollWidth <= initial.width + 1 && scrolled.headerTop >= -1 &&
        initial.safePadding >= scenario.insets.top + 10 &&
        (!mobile || Math.abs(initial.framePadding - initial.headerHeight) < 1) &&
        initial.controls.every(c => c.width >= 44 && c.height >= 44 && c.top >= scenario.insets.top && c.left >= scenario.insets.left && c.right <= initial.width - scenario.insets.right + 1);
      const result = { scenario, view, mobile, initial, scrolled, pass };
      checks.push(result);
      console.log(`${scenario.width}x${scenario.height} ${view}: ${pass ? "PASS" : "FAIL"}, safe=${scenario.insets.top}, header=${initial.headerHeight}, scrollTop=${scrolled.headerTop}`);
      if (!pass) throw new Error(`Header layout failed: ${JSON.stringify(result)}`);
    }
  }
  browser("set", "viewport", "440", "956");
  browser("open", url("overview"));
  browser("wait", "--text", "Visão geral");
  await send("Emulation.setSafeAreaInsetsOverride", { insets:{top:62,bottom:34,left:0,right:0} }, sessionId);
  browser("wait", "--fn", "parseFloat(getComputedStyle(document.querySelector('.gestor-frame')).paddingTop)>=document.querySelector('.gestor-topbar').getBoundingClientRect().height");
  browser("find", "role", "button", "click", "--name", "Abrir menu", "--exact");
  browser("wait", "--fn", "document.querySelector('.gestor-sidebar').classList.contains('is-open')");
  browser("scrollintoview", "button[data-view=settings]");
  browser("click", "button[data-view=settings]");
  browser("wait", "--text", "Configurações do estúdio");
  browser("find", "role", "button", "click", "--name", "Abrir busca global", "--exact");
  browser("wait", "--fn", "!!document.querySelector('[role=dialog]')");
  browser("press", "Escape");
  browser("wait", "--fn", "!document.querySelector('[role=dialog]')");
  browser("find", "role", "button", "click", "--name", "Abrir perfil", "--exact");
  browser("wait", "--fn", "document.querySelector('[aria-label=\"Abrir perfil\"]').getAttribute('aria-expanded')==='true'");
  browser("press", "Escape");
  browser("wait", "--fn", "document.querySelector('.skip-link').getBoundingClientRect().bottom<=0");
  checks.push({ interactions:"menu → Ajustes, busca → Escape, perfil → Escape", pass:true });
  mkdirSync(resolve(root, "qa/evidence"), { recursive:true });
  browser("screenshot", resolve(root, "qa/evidence/iphone-header-safe-area-440.png"));
} finally {
  writeFileSync(resolve(root, "qa/iphone-header-results.json"), JSON.stringify({ base, physicalIPhoneTest:false, nativeSafeAreasEmulated:true, checks }, null, 2) + "\n");
  socket.close();
  browser("close");
}
console.log(`Validated ${checks.length} demo-only header checks; no Firebase data writes.`);
