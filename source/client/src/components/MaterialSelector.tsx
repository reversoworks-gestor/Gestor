import { useMemo, useState } from "react";
import { Check, ChevronDown, FileText, Printer, Save, ShieldAlert } from "lucide-react";
import type { Material, Printer as PrinterModel } from "@/lib/models";
import { applyPreset, calculateSelector, defaultSelectorForm, materialDatabase, selectorPresets, type SelectorForm, type SelectorResult } from "@/lib/materialSelector";

type Props = {
  stock: Material[];
  printers: PrinterModel[];
  onSave: (payload: Record<string, unknown>) => Promise<void>;
  onNotice: (message: string) => void;
};

const options = {
  environment: ["Interior", "Automotivo / motor", "Exterior / intempéries"],
  humidity: ["Normal / controlada", "Alta / condensação", "Água / exposição direta"],
  uv: ["Nenhuma", "Moderada", "Alta / contínua"],
  chemical: ["Nenhuma relevante", "Óleo / graxa / fluidos comuns", "Combustível / químico relevante", "Solvente / agente severo"],
  rigidity: ["Normal", "Alta", "Muito alta"],
  flexibility: ["Peça rígida", "Precisa ser flexível"],
  impact: ["Baixa / não determinante", "Alta / relevante"],
  dimensional: ["Normal", "Alta / tolerância crítica"],
  loadModel: ["Sem cálculo mecânico", "Tração / compressão axial", "Flexão — cantilever"],
  orientation: ["XY", "Z"],
  loadPath: ["Predominantemente no plano", "Atravessa interfaces de camada"],
  duration: ["Curta / eventual", "Sustentada", "Longa duração"],
  chamber: ["não informado", "Aberta", "Fechada", "Alta temperatura"],
  drying: ["não confirmado", "sim / controlado", "não"],
};

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <label className="field-stack"><span>{label}</span>{children}{hint && <small className="field-hint">{hint}</small>}</label>;
}
function SelectField({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return <Field label={label}><select value={value} onChange={(event) => onChange(event.target.value)}>{values.map((item) => <option key={item}>{item}</option>)}</select></Field>;
}
function Metric({ label, value }: { label: string; value: string }) {
  return <div className="selector-metric"><span>{label}</span><b>{value}</b></div>;
}
function CandidateCard({ title, candidate }: { title: string; candidate: SelectorResult["primary"] }) {
  if (!candidate) return <div className="selector-empty"><span>{title}</span><b>Nenhum material seguro</b></div>;
  return <article className="selector-candidate"><div className="selector-candidate-head"><div><p className="eyebrow">{title}</p><h4>{candidate.name}</h4></div><span className={`selector-status selector-${candidate.status.toLowerCase()}`}>{candidate.status}</span></div><div className="selector-candidate-grid"><Metric label="Score" value={`${candidate.score}/100`} /><Metric label="HDT" value={`${candidate.hdt} °C`} /><Metric label="Estoque" value={candidate.stockGrams ? `${(candidate.stockGrams / 1000).toFixed(2)} kg` : "Não localizado"} /><Metric label="Custo peça" value={`$ ${candidate.cost.toFixed(2)}`} /></div><p>{candidate.tradeoff}</p></article>;
}

export default function MaterialSelector({ stock, printers, onSave, onNotice }: Props) {
  const [form, setForm] = useState<SelectorForm>(defaultSelectorForm);
  const [advanced, setAdvanced] = useState(false);
  const result = useMemo(() => calculateSelector(form, stock, printers), [form, stock, printers]);
  const update = <K extends keyof SelectorForm>(key: K, value: SelectorForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  const setNumber = (key: keyof SelectorForm, value: string) => update(key, Number(value) || 0);
  const handlePreset = (preset: string) => setForm((current) => applyPreset(current, preset));
  const save = async () => {
    await onSave({ id: `selector-${crypto.randomUUID()}`, project: form.project || "Projeto sem nome", inputs: form, preset: form.preset, recommendation: result.primary?.name || "NO SAFE RECOMMENDATION", score: result.primary?.score || 0, confidence: result.confidence, ranking: result, algorithmVersion: result.algorithmVersion, createdAt: new Date().toISOString() });
    onNotice("Análise salva no histórico do Gestor.");
  };
  const report = () => {
    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) return;
    printWindow.document.write(`<html><head><title>Relatório Material Selector — ${form.project || "Projeto"}</title><style>body{font-family:Arial;color:#101318;padding:32px}h1{font-size:24px}h2{margin-top:26px;border-bottom:1px solid #ddd;padding-bottom:6px}.row{display:flex;gap:24px;flex-wrap:wrap}.box{padding:12px;border:1px solid #ddd;border-radius:8px;min-width:150px}small{color:#666}</style></head><body><h1>Reverso Material Selector v3</h1><p><b>Projeto:</b> ${form.project || "Não informado"} · <b>Preset:</b> ${form.preset}</p><h2>Recomendação principal</h2><div class="box"><b>${result.primary?.name || "NO SAFE RECOMMENDATION"}</b><br/>Score: ${result.primary?.score || "—"}/100<br/>Confidence: ${result.confidence}%</div><h2>Alternativas</h2><div class="row">${result.alternatives.map((item) => `<div class="box"><b>${item.name}</b><br/>${item.status} · ${item.score}/100<br/>${item.tradeoff}</div>`).join("") || "Nenhuma alternativa segura."}</div><h2>Não recomendados</h2><div class="row">${result.rejected.map((item) => `<div class="box"><b>${item.name}</b><br/>${item.reasons.join(" ")}</div>`).join("") || "Nenhum material rejeitado."}</div><h2>Limitações</h2><p>Esta ferramenta realiza triagem de engenharia baseada nos dados disponíveis. Valide geometria, orientação, processo e peça física antes de aplicações críticas.</p><script>window.print()</script></body></html>`);
    printWindow.document.close();
  };
  return <div className="material-selector">
    <div className="selector-flow" aria-label="Fluxo de seleção"><span>01 Aplicação</span><i>→</i><span>02 Engenharia</span><i>→</i><span>03 Produção</span><i>→</i><span>04 Recomendação</span></div>
    <div className="selector-layout">
      <section className="panel-card selector-inputs"><div className="panel-title"><div><p className="eyebrow">Reverso Material Selector v3</p><h3>Requisitos da aplicação</h3></div><span className="score-pill">Recalcula automaticamente</span></div>
        <div className="form-grid"><Field label="Nome da peça / projeto"><input value={form.project} onChange={(event) => update("project", event.target.value)} placeholder="Ex.: suporte da tela — console central" /></Field><Field label="Função principal"><input value={form.function} onChange={(event) => update("function", event.target.value)} placeholder="suporte, clip, carcaça, jig…" /></Field></div>
        <SelectField label="Preset de aplicação" value={form.preset} values={Object.keys(selectorPresets)} onChange={handlePreset} />
        <div className="selector-section"><p className="eyebrow">Ambiente e térmica</p><div className="form-grid"><SelectField label="Ambiente" value={form.environment} values={options.environment} onChange={(v) => update("environment", v)} /><SelectField label="Umidade" value={form.humidity} values={options.humidity} onChange={(v) => update("humidity", v)} /><Field label="Temperatura contínua (°C)"><input type="number" min="0" value={form.continuousTemp || ""} onChange={(e) => setNumber("continuousTemp", e.target.value)} /></Field><Field label="Temperatura de pico (°C)"><input type="number" min="0" value={form.peakTemp || ""} onChange={(e) => setNumber("peakTemp", e.target.value)} /></Field><SelectField label="Exposição UV" value={form.uv} values={options.uv} onChange={(v) => update("uv", v)} /><SelectField label="Exposição química" value={form.chemical} values={options.chemical} onChange={(v) => update("chemical", v)} /></div></div>
        <div className="selector-section"><p className="eyebrow">Requisitos mecânicos</p><div className="form-grid"><SelectField label="Rigidez exigida" value={form.rigidity} values={options.rigidity} onChange={(v) => update("rigidity", v)} /><SelectField label="Flexibilidade" value={form.flexibility} values={options.flexibility} onChange={(v) => update("flexibility", v)} /><SelectField label="Impacto / vibração" value={form.impact} values={options.impact} onChange={(v) => update("impact", v)} /><SelectField label="Estabilidade dimensional" value={form.dimensional} values={options.dimensional} onChange={(v) => update("dimensional", v)} /><Field label="Vida de serviço (anos)"><input type="number" min="0" value={form.serviceLife || ""} onChange={(e) => setNumber("serviceLife", e.target.value)} /></Field><Field label="Safety Factor alvo"><input type="number" min="1" step="0.1" value={form.safetyFactor} onChange={(e) => setNumber("safetyFactor", e.target.value)} /></Field></div></div>
        <button type="button" className="selector-advanced-toggle" onClick={() => setAdvanced((value) => !value)}><ChevronDown size={16} /> Carga, geometria e produção avançadas</button>
        {advanced && <div className="selector-section selector-advanced"><div className="form-grid"><SelectField label="Modelo de carga" value={form.loadModel} values={options.loadModel} onChange={(v) => update("loadModel", v)} /><SelectField label="Orientação principal" value={form.orientation} values={options.orientation} onChange={(v) => update("orientation", v as "XY" | "Z")} /><Field label="Força máxima (N)"><input type="number" min="0" value={form.force || ""} onChange={(e) => setNumber("force", e.target.value)} /></Field><Field label="Área resistente (mm²)"><input type="number" min="0" value={form.area || ""} onChange={(e) => setNumber("area", e.target.value)} /></Field><Field label="Comprimento L (mm)"><input type="number" min="0" value={form.length || ""} onChange={(e) => setNumber("length", e.target.value)} /></Field><Field label="Número de ciclos"><input type="number" min="0" value={form.cycles || ""} onChange={(e) => setNumber("cycles", e.target.value)} /></Field><SelectField label="Caminho da carga" value={form.loadPath} values={options.loadPath} onChange={(v) => update("loadPath", v)} /><SelectField label="Duração da carga" value={form.duration} values={options.duration} onChange={(v) => update("duration", v)} /><Field label="Massa estimada (g)"><input type="number" min="0" value={form.partMass || ""} onChange={(e) => setNumber("partMass", e.target.value)} /></Field><Field label="Limite de custo ($/kg)"><input type="number" min="0" value={form.costLimit || ""} onChange={(e) => setNumber("costLimit", e.target.value)} /></Field><Field label="Paredes / infill"><input value={`${form.walls} / ${form.infill}%`} onChange={(e) => { const [walls, infill] = e.target.value.split("/").map(Number); setForm((current) => ({ ...current, walls: walls || current.walls, infill: infill || current.infill })); }} /></Field><SelectField label="Câmara" value={form.chamber} values={options.chamber} onChange={(v) => update("chamber", v)} /><SelectField label="Secagem" value={form.drying} values={options.drying} onChange={(v) => update("drying", v)} /><Field label="Nozzle máximo da impressora (°C)"><input type="number" value={form.printerNozzleMax} onChange={(e) => setNumber("printerNozzleMax", e.target.value)} /></Field><Field label="Câmara máxima (°C)"><input type="number" value={form.printerChamberMax} onChange={(e) => setNumber("printerChamberMax", e.target.value)} /></Field></div><label className="selector-check"><input type="checkbox" checked={form.hardenedNozzle} onChange={(e) => update("hardenedNozzle", e.target.checked)} /> Bico endurecido disponível</label><label className="selector-check"><input type="checkbox" checked={form.preferStock} onChange={(e) => update("preferStock", e.target.checked)} /> Preferir material em estoque</label><label className="selector-check"><input type="checkbox" checked={form.requireStock} onChange={(e) => update("requireStock", e.target.checked)} /> Exigir material em estoque</label></div>}
      </section>
      <section className="selector-results"><div className="panel-card selector-primary"><div className="panel-title"><div><p className="eyebrow">Recomendação principal</p><h3>{result.primary?.name || "NO SAFE RECOMMENDATION"}</h3></div>{result.primary && <span className="selector-status selector-pass">{result.primary.score}/100</span>}</div>{result.primary ? <><p>{result.primary.notes}</p><div className="selector-metrics"><Metric label="Confidence" value={`${result.confidence}%`} /><Metric label="HDT / contínua" value={`${result.primary.hdt} / ${result.primary.continuous} °C`} /><Metric label="Resistência relevante" value={`${form.orientation === "Z" ? result.primary.tensileZ : result.primary.tensileXY} MPa`} /><Metric label="FS triagem" value={result.primary.safetyFactor ? result.primary.safetyFactor.toFixed(1) : "Dados insuficientes"} /></div><div className="selector-why"><p className="eyebrow">Por que este material</p><p>{result.primary.reasons[0]} Margem térmica, processo e propriedades foram ponderados para evitar overengineering.</p></div><div className="selector-process"><p className="eyebrow">Processo recomendado</p><p><b>Secagem:</b> {result.primary.drying} · <b>Bico:</b> {result.primary.processNozzleMin}–{result.primary.processNozzleMax} °C · <b>Mesa:</b> {result.primary.bed} · <b>Câmara:</b> {result.primary.chamber} · <b>Hardened:</b> {result.primary.hardenedRequired ? "obrigatório" : "não obrigatório"}</p></div></> : <p className="selector-warning"><ShieldAlert size={17} /> Nenhum material atende aos requisitos críticos informados. Revise temperatura, química, processo ou estoque.</p>}<div className="selector-actions"><button type="button" className="button button-primary" onClick={() => void save()}><Save size={16} /> Salvar análise</button><button type="button" className="button button-secondary" onClick={report}><Printer size={16} /> Relatório técnico</button></div></div><div className="selector-group"><p className="eyebrow">2 alternativas recomendadas</p>{result.alternatives.map((item) => <CandidateCard key={item.name} title="Alternativa" candidate={item} />)}</div><div className="selector-group"><p className="eyebrow">2 opções não recomendadas</p>{result.rejected.map((item) => <CandidateCard key={item.name} title="Não recomendado" candidate={item} />)}</div><div className="selector-confidence"><FileText size={16} /><span><b>Confiança {result.confidence}%.</b> {result.missing.length ? `Para aumentar a confiança, informe: ${result.missing.join(", ")}.` : "Dados principais preenchidos; valide a peça física antes da aplicação."}</span></div><p className="selector-disclaimer">Esta ferramenta realiza triagem de engenharia baseada nos dados disponíveis e nas condições informadas. Valide a geometria final, orientação, processo de impressão e peça física antes de aplicações críticas.</p></section>
    </div>
  </div>;
}
