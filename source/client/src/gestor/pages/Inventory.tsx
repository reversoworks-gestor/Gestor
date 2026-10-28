import { DateInput } from "../components/ui";
import { useMemo, useState } from "react";
import type { Material } from "../../lib/models";
import { useGestor } from "../store";
import { allocations } from "../domain";
import { makeId, type StudioOrder } from "../types";
import {
  Badge,
  Button,
  ConfirmButton,
  EmptyState,
  Field,
  FormModal,
  PageHeading,
} from "../components/ui";

type MovementKind = "replenish" | "consume";
type MovementRequest = { material: Material; kind: MovementKind };

type OptionalNumberField =
  | "density"
  | "tensileStrengthXY"
  | "tensileStrengthZ"
  | "youngModulus"
  | "flexuralStrength"
  | "impactStrengthXY"
  | "impactStrengthZ"
  | "elongationAtBreak"
  | "creepResistance"
  | "fatigueResistance"
  | "glassTransition"
  | "hdt045"
  | "hdt18"
  | "vicat"
  | "continuousServiceTemp"
  | "peakServiceTemp"
  | "uvResistance"
  | "waterResistance"
  | "moistureSensitivity"
  | "oilResistance"
  | "gasolineResistance"
  | "dieselResistance"
  | "coolantResistance"
  | "brakeFluidResistance"
  | "ipaResistance"
  | "acidResistance"
  | "alkaliResistance"
  | "nozzleMinTemp"
  | "nozzleMaxTemp"
  | "bedMinTemp"
  | "bedMaxTemp"
  | "dryingTemperature"
  | "dryingTimeHours";

const optionalNumberFields: OptionalNumberField[] = [
  "density",
  "tensileStrengthXY",
  "tensileStrengthZ",
  "youngModulus",
  "flexuralStrength",
  "impactStrengthXY",
  "impactStrengthZ",
  "elongationAtBreak",
  "creepResistance",
  "fatigueResistance",
  "glassTransition",
  "hdt045",
  "hdt18",
  "vicat",
  "continuousServiceTemp",
  "peakServiceTemp",
  "uvResistance",
  "waterResistance",
  "moistureSensitivity",
  "oilResistance",
  "gasolineResistance",
  "dieselResistance",
  "coolantResistance",
  "brakeFluidResistance",
  "ipaResistance",
  "acidResistance",
  "alkaliResistance",
  "nozzleMinTemp",
  "nozzleMaxTemp",
  "bedMinTemp",
  "bedMaxTemp",
  "dryingTemperature",
  "dryingTimeHours",
];

function materialTemplate(): Material {
  return {
    id: makeId("material"),
    name: "",
    color: "",
    type: "",
    availableGrams: 0,
    reorderAtGrams: 0,
    pricePerGram: 0,
    nozzleTemp: "",
    bedTemp: "",
    printNotes: "",
  };
}

function grams(value: number | undefined): string {
  if (!Number.isFinite(value)) return "—";
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(value ?? 0)} g`;
}

function validNonNegative(value: number | undefined): value is number {
  return Number.isFinite(value) && value !== undefined && value >= 0;
}

function optionalNumber(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  return Number(value);
}

function searchText(material: Material): string {
  return Object.values(material)
    .filter((value): value is string | number | boolean =>
      ["string", "number", "boolean"].includes(typeof value)
    )
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

function reservationFor(materialId: string, orders: StudioOrder[]) {
  const invoicesWithAllocation = orders.filter(order => {
    const gramsAllocated = allocations(order)[materialId] ?? 0;
    return gramsAllocated > 0;
  });

  return {
    grams: invoicesWithAllocation.reduce(
      (total, order) => total + (allocations(order)[materialId] ?? 0),
      0
    ),
    count: invoicesWithAllocation.length,
  };
}

function stockTone(material: Material): "success" | "warning" | "danger" {
  if (
    !validNonNegative(material.availableGrams) ||
    !validNonNegative(material.reorderAtGrams)
  )
    return "danger";
  return material.availableGrams <= material.reorderAtGrams
    ? "warning"
    : "success";
}

function stockLabel(material: Material): string {
  if (
    !validNonNegative(material.availableGrams) ||
    !validNonNegative(material.reorderAtGrams)
  )
    return "Saldo a revisar";
  return material.availableGrams <= material.reorderAtGrams
    ? "Reposição a avaliar"
    : "Acima do ponto de reposição";
}

function NumericField({
  label,
  value,
  onChange,
  step = "0.01",
  help,
  className,
  required = false,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: string) => void;
  step?: string;
  help?: string;
  className?: string;
  required?: boolean;
}) {
  return (
    <Field label={label} help={help} className={className}>
      <input
        type="number"
        min="0"
        step={step}
        required={required}
        value={value ?? ""}
        onChange={event => onChange(event.currentTarget.value)}
      />
    </Field>
  );
}

function MaterialForm({
  material,
  onChange,
}: {
  material: Material;
  onChange: (material: Material) => void;
}) {
  const setText = <K extends keyof Material>(field: K, value: Material[K]) => {
    onChange({ ...material, [field]: value });
  };

  const setOptionalNumber = (field: OptionalNumberField, value: string) => {
    onChange({ ...material, [field]: optionalNumber(value) });
  };

  const setRequiredNumber = (
    field: "reorderAtGrams" | "pricePerGram",
    value: string
  ) => {
    onChange({ ...material, [field]: value.trim() === "" ? 0 : Number(value) });
  };

  return (
    <>
      <section
        className="card"
        aria-labelledby="material-identification-heading"
      >
        <div className="card-head">
          <div>
            <p className="eyebrow">Identificação e estoque</p>
            <h3 id="material-identification-heading">Material cadastrado</h3>
          </div>
        </div>
        <div className="card-body form-grid">
          <Field label="Nome do material *" className="field-full">
            <input
              required
              value={material.name}
              onChange={event => setText("name", event.currentTarget.value)}
              placeholder="Ex.: PA6-CF — fabricante / variante"
            />
          </Field>
          <Field label="Família">
            <input
              value={material.family ?? ""}
              onChange={event => setText("family", event.currentTarget.value)}
              placeholder="Nylon, ASA, PETG…"
            />
          </Field>
          <Field label="Tipo legado">
            <input
              value={material.type}
              onChange={event => setText("type", event.currentTarget.value)}
              placeholder="Classificação original"
            />
          </Field>
          <Field label="Fabricante">
            <input
              value={material.manufacturer ?? ""}
              onChange={event =>
                setText("manufacturer", event.currentTarget.value)
              }
            />
          </Field>
          <Field label="Variante / grau">
            <input
              value={material.variant ?? ""}
              onChange={event => setText("variant", event.currentTarget.value)}
            />
          </Field>
          <Field label="Reforço">
            <input
              value={material.reinforcement ?? ""}
              onChange={event =>
                setText("reinforcement", event.currentTarget.value)
              }
              placeholder="CF, GF ou nenhum"
            />
          </Field>
          <Field label="Cor">
            <input
              value={material.color}
              onChange={event => setText("color", event.currentTarget.value)}
              placeholder="Natural, preto…"
            />
          </Field>
          <NumericField
            label="Ponto de reposição (g)"
            value={material.reorderAtGrams}
            step="0.001"
            onChange={value => setRequiredNumber("reorderAtGrams", value)}
            help="É um ponto de atenção, não confirma compra ou prazo de entrega."
          />
          <NumericField
            label="Valor por grama"
            value={material.pricePerGram}
            step="0.0001"
            onChange={value => setRequiredNumber("pricePerGram", value)}
          />
          <div className="field field-full">
            <span className="field-label">Saldo registrado</span>
            <div className="key-value">
              <strong>{grams(material.availableGrams)}</strong>
              <span className="muted">
                O saldo não é editável neste formulário. Use Repor ou Consumir
                para registrar uma movimentação validada.
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="card" aria-labelledby="material-mechanical-heading">
        <div className="card-head">
          <div>
            <p className="eyebrow">Propriedades técnicas</p>
            <h3 id="material-mechanical-heading">Mecânicas</h3>
          </div>
        </div>
        <div className="card-body form-grid">
          <NumericField
            label="Densidade (g/cm³)"
            value={material.density}
            step="0.001"
            onChange={value => setOptionalNumber("density", value)}
          />
          <NumericField
            label="Módulo de Young (MPa)"
            value={material.youngModulus}
            onChange={value => setOptionalNumber("youngModulus", value)}
          />
          <NumericField
            label="Tensão à tração XY (MPa)"
            value={material.tensileStrengthXY}
            onChange={value => setOptionalNumber("tensileStrengthXY", value)}
          />
          <NumericField
            label="Tensão à tração Z (MPa)"
            value={material.tensileStrengthZ}
            onChange={value => setOptionalNumber("tensileStrengthZ", value)}
          />
          <NumericField
            label="Resistência à flexão (MPa)"
            value={material.flexuralStrength}
            onChange={value => setOptionalNumber("flexuralStrength", value)}
          />
          <NumericField
            label="Impacto XY"
            value={material.impactStrengthXY}
            onChange={value => setOptionalNumber("impactStrengthXY", value)}
          />
          <NumericField
            label="Impacto Z"
            value={material.impactStrengthZ}
            onChange={value => setOptionalNumber("impactStrengthZ", value)}
          />
          <NumericField
            label="Alongamento na ruptura (%)"
            value={material.elongationAtBreak}
            onChange={value => setOptionalNumber("elongationAtBreak", value)}
          />
          <NumericField
            label="Resistência à fluência"
            value={material.creepResistance}
            onChange={value => setOptionalNumber("creepResistance", value)}
          />
          <NumericField
            label="Resistência à fadiga"
            value={material.fatigueResistance}
            onChange={value => setOptionalNumber("fatigueResistance", value)}
          />
        </div>
      </section>

      <section className="card" aria-labelledby="material-thermal-heading">
        <div className="card-head">
          <div>
            <p className="eyebrow">Propriedades técnicas</p>
            <h3 id="material-thermal-heading">Térmicas</h3>
          </div>
        </div>
        <div className="card-body form-grid">
          <NumericField
            label="Transição vítrea (°C)"
            value={material.glassTransition}
            onChange={value => setOptionalNumber("glassTransition", value)}
          />
          <NumericField
            label="HDT @ 0,45 MPa (°C)"
            value={material.hdt045}
            onChange={value => setOptionalNumber("hdt045", value)}
          />
          <NumericField
            label="HDT @ 1,8 MPa (°C)"
            value={material.hdt18}
            onChange={value => setOptionalNumber("hdt18", value)}
          />
          <NumericField
            label="Vicat (°C)"
            value={material.vicat}
            onChange={value => setOptionalNumber("vicat", value)}
          />
          <NumericField
            label="Serviço contínuo (°C)"
            value={material.continuousServiceTemp}
            onChange={value =>
              setOptionalNumber("continuousServiceTemp", value)
            }
          />
          <NumericField
            label="Temperatura de pico (°C)"
            value={material.peakServiceTemp}
            onChange={value => setOptionalNumber("peakServiceTemp", value)}
          />
        </div>
      </section>

      <section className="card" aria-labelledby="material-chemical-heading">
        <div className="card-head">
          <div>
            <p className="eyebrow">Compatibilidade</p>
            <h3 id="material-chemical-heading">Químicas e ambientais</h3>
          </div>
        </div>
        <div className="card-body form-grid">
          <p className="helper field-full">
            Registre a escala e as condições na fonte ou nas notas. Zero é
            mantido como valor informado; campo vazio significa não informado.
          </p>
          <NumericField
            label="Resistência UV"
            value={material.uvResistance}
            onChange={value => setOptionalNumber("uvResistance", value)}
          />
          <NumericField
            label="Resistência à água"
            value={material.waterResistance}
            onChange={value => setOptionalNumber("waterResistance", value)}
          />
          <NumericField
            label="Sensibilidade à umidade"
            value={material.moistureSensitivity}
            onChange={value => setOptionalNumber("moistureSensitivity", value)}
          />
          <NumericField
            label="Resistência a óleo"
            value={material.oilResistance}
            onChange={value => setOptionalNumber("oilResistance", value)}
          />
          <NumericField
            label="Resistência à gasolina"
            value={material.gasolineResistance}
            onChange={value => setOptionalNumber("gasolineResistance", value)}
          />
          <NumericField
            label="Resistência a diesel"
            value={material.dieselResistance}
            onChange={value => setOptionalNumber("dieselResistance", value)}
          />
          <NumericField
            label="Resistência a fluido de arrefecimento"
            value={material.coolantResistance}
            onChange={value => setOptionalNumber("coolantResistance", value)}
          />
          <NumericField
            label="Resistência a fluido de freio"
            value={material.brakeFluidResistance}
            onChange={value => setOptionalNumber("brakeFluidResistance", value)}
          />
          <NumericField
            label="Resistência a IPA"
            value={material.ipaResistance}
            onChange={value => setOptionalNumber("ipaResistance", value)}
          />
          <NumericField
            label="Resistência a ácidos"
            value={material.acidResistance}
            onChange={value => setOptionalNumber("acidResistance", value)}
          />
          <NumericField
            label="Resistência a álcalis"
            value={material.alkaliResistance}
            onChange={value => setOptionalNumber("alkaliResistance", value)}
          />
        </div>
      </section>

      <section className="card" aria-labelledby="material-process-heading">
        <div className="card-head">
          <div>
            <p className="eyebrow">Fabricação aditiva</p>
            <h3 id="material-process-heading">Processo de impressão</h3>
          </div>
        </div>
        <div className="card-body form-grid">
          <Field label="Temperatura de nozzle — texto legado">
            <input
              value={material.nozzleTemp}
              onChange={event =>
                setText("nozzleTemp", event.currentTarget.value)
              }
              placeholder="Ex.: 240–270 °C"
            />
          </Field>
          <Field label="Temperatura de mesa — texto legado">
            <input
              value={material.bedTemp}
              onChange={event => setText("bedTemp", event.currentTarget.value)}
              placeholder="Ex.: 80–100 °C"
            />
          </Field>
          <NumericField
            label="Nozzle mínimo (°C)"
            value={material.nozzleMinTemp}
            onChange={value => setOptionalNumber("nozzleMinTemp", value)}
          />
          <NumericField
            label="Nozzle máximo (°C)"
            value={material.nozzleMaxTemp}
            onChange={value => setOptionalNumber("nozzleMaxTemp", value)}
          />
          <NumericField
            label="Mesa mínima (°C)"
            value={material.bedMinTemp}
            onChange={value => setOptionalNumber("bedMinTemp", value)}
          />
          <NumericField
            label="Mesa máxima (°C)"
            value={material.bedMaxTemp}
            onChange={value => setOptionalNumber("bedMaxTemp", value)}
          />
          <Field label="Requisito de câmara">
            <select
              value={material.chamberRequirement ?? ""}
              onChange={event =>
                setText(
                  "chamberRequirement",
                  (event.currentTarget.value ||
                    undefined) as Material["chamberRequirement"]
                )
              }
            >
              <option value="">Não informado</option>
              <option value="Aberta">Aberta</option>
              <option value="Fechada">Fechada</option>
              <option value="Alta temperatura">Alta temperatura</option>
            </select>
          </Field>
          <Field label="Risco de empenamento">
            <select
              value={material.warpingRisk ?? ""}
              onChange={event =>
                setText(
                  "warpingRisk",
                  (event.currentTarget.value ||
                    undefined) as Material["warpingRisk"]
                )
              }
            >
              <option value="">Não informado</option>
              <option value="Baixo">Baixo</option>
              <option value="Médio">Médio</option>
              <option value="Alto">Alto</option>
            </select>
          </Field>
          <NumericField
            label="Secagem — temperatura (°C)"
            value={material.dryingTemperature}
            onChange={value => setOptionalNumber("dryingTemperature", value)}
          />
          <NumericField
            label="Secagem — duração (h)"
            value={material.dryingTimeHours}
            onChange={value => setOptionalNumber("dryingTimeHours", value)}
          />
          <label className="row">
            <input
              type="checkbox"
              checked={Boolean(material.abrasive)}
              onChange={event =>
                setText("abrasive", event.currentTarget.checked)
              }
            />
            <span>Material abrasivo</span>
          </label>
          <label className="row">
            <input
              type="checkbox"
              checked={Boolean(material.hardenedNozzleRequired)}
              onChange={event =>
                setText("hardenedNozzleRequired", event.currentTarget.checked)
              }
            />
            <span>Requer nozzle endurecido</span>
          </label>
        </div>
      </section>

      <section className="card" aria-labelledby="material-evidence-heading">
        <div className="card-head">
          <div>
            <p className="eyebrow">Rastreabilidade</p>
            <h3 id="material-evidence-heading">Fonte, confiança e notas</h3>
          </div>
        </div>
        <div className="card-body form-grid">
          <Field label="Fonte dos dados" className="field-full">
            <input
              value={material.dataSource ?? ""}
              onChange={event =>
                setText("dataSource", event.currentTarget.value)
              }
              placeholder="Fabricante, ensaio interno, catálogo…"
            />
          </Field>
          <Field label="Datasheet / URL" className="field-full">
            <input
              type="url"
              value={material.datasheetUrl ?? ""}
              onChange={event =>
                setText("datasheetUrl", event.currentTarget.value)
              }
              placeholder="https://…"
            />
          </Field>
          <Field label="Norma de ensaio">
            <input
              value={material.testStandard ?? ""}
              onChange={event =>
                setText("testStandard", event.currentTarget.value)
              }
              placeholder="ASTM D648, ISO…"
            />
          </Field>
          <Field label="Nível de confiança">
            <select
              value={material.confidenceLevel ?? ""}
              onChange={event =>
                setText(
                  "confidenceLevel",
                  (event.currentTarget.value ||
                    undefined) as Material["confidenceLevel"]
                )
              }
            >
              <option value="">Não informado</option>
              <option value="Baixa">Baixa</option>
              <option value="Média">Média</option>
              <option value="Alta">Alta</option>
            </select>
          </Field>
          <Field label="Última atualização da fonte">
            <DateInput
              value={material.lastUpdated ?? ""}
              onChange={event =>
                setText("lastUpdated", event.currentTarget.value || undefined)
              }
            />
          </Field>
          <Field label="Notas técnicas" className="field-full">
            <textarea
              value={material.technicalNotes ?? ""}
              onChange={event =>
                setText("technicalNotes", event.currentTarget.value)
              }
              placeholder="Condições de ensaio, limitações, orientação e observações técnicas…"
            />
          </Field>
          <Field label="Notas de impressão legadas" className="field-full">
            <textarea
              value={material.printNotes}
              onChange={event =>
                setText("printNotes", event.currentTarget.value)
              }
              placeholder="Preparação, secagem, adesão, acabamento e observações de processo…"
            />
          </Field>
        </div>
      </section>
    </>
  );
}

function MovementModal({
  request,
  onClose,
}: {
  request: MovementRequest;
  onClose: () => void;
}) {
  const ctx = useGestor();
  const [quantity, setQuantity] = useState("");
  const isReplenishment = request.kind === "replenish";

  async function submitMovement() {
    const amount = Number(quantity);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Informe uma quantidade positiva e válida em gramas.");
    }
    if (!isReplenishment && amount > request.material.availableGrams) {
      throw new Error(
        `Saldo insuficiente para o consumo solicitado. Saldo registrado: ${grams(request.material.availableGrams)}.`
      );
    }

    await ctx.moveMaterial(request.material, amount, request.kind);
    ctx.notify(
      `${isReplenishment ? "Reposição" : "Consumo"} de ${grams(amount)} registrado para ${request.material.name}.`,
      "success"
    );
  }

  return (
    <FormModal
      title={`${isReplenishment ? "Repor" : "Consumir"} material`}
      onClose={onClose}
      onSubmit={submitMovement}
      submitLabel={
        isReplenishment ? "Registrar reposição" : "Registrar consumo"
      }
    >
      <p>
        <strong>{request.material.name}</strong>
      </p>
      <p className="muted">
        Saldo registrado antes da operação:{" "}
        {grams(request.material.availableGrams)}. A operação é validada
        novamente ao ser salva.
      </p>
      <Field label="Quantidade (g)">
        <input
          autoFocus
          type="number"
          min="0.001"
          step="0.001"
          inputMode="decimal"
          required
          value={quantity}
          onChange={event => setQuantity(event.currentTarget.value)}
          aria-describedby="movement-help"
        />
      </Field>
      <p id="movement-help" className="helper">
        {isReplenishment
          ? "Registre somente material efetivamente recebido. Esta tela não confirma compra, fornecedor ou prazo."
          : "A saída não pode superar o saldo registrado; reservas e concorrência são verificadas pelo serviço."}
      </p>
    </FormModal>
  );
}

export default function InventoryPage() {
  const ctx = useGestor();
  const [editor, setEditor] = useState<Material | null>(null);
  const [movement, setMovement] = useState<MovementRequest | null>(null);

  const materials = useMemo(() => {
    const query = ctx.search
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLocaleLowerCase("pt-BR");

    return [...ctx.data.materials]
      .filter(material => !query || searchText(material).includes(query))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [ctx.data.materials, ctx.search]);

  const summary = useMemo(() => {
    const totalRecorded = ctx.data.materials.reduce(
      (total, material) =>
        validNonNegative(material.availableGrams)
          ? total + material.availableGrams
          : total,
      0
    );
    const atReorderPoint = ctx.data.materials.filter(
      material =>
        validNonNegative(material.availableGrams) &&
        validNonNegative(material.reorderAtGrams) &&
        material.availableGrams <= material.reorderAtGrams
    ).length;
    return { totalRecorded, atReorderPoint };
  }, [ctx.data.materials]);

  async function saveMaterial() {
    if (!editor) return;
    const name = editor.name.trim();
    if (!name) throw new Error("Informe o nome do material.");

    const requiredNumbers: [string, number][] = [
      ["ponto de reposição", editor.reorderAtGrams],
      ["valor por grama", editor.pricePerGram],
    ];
    const invalidRequired = requiredNumbers.find(
      ([, value]) => !validNonNegative(value)
    );
    if (invalidRequired)
      throw new Error(
        `${invalidRequired[0]} deve ser um número válido e não negativo.`
      );

    const invalidOptional = optionalNumberFields.find(field => {
      const value = editor[field];
      return value !== undefined && !validNonNegative(value);
    });
    if (invalidOptional)
      throw new Error(
        `O campo ${invalidOptional} deve ser um número válido e não negativo.`
      );

    // Saldo só é alterado por moveMaterial. Ao editar, recuperamos o valor atual do store
    // para não regravar um saldo que tenha mudado depois da abertura do formulário.
    const current = ctx.data.materials.find(
      material => material.id === editor.id
    );
    const materialToSave: Material = {
      ...editor,
      name,
      availableGrams: current ? current.availableGrams : 0,
    };

    await ctx.save("materials", materialToSave);
    ctx.notify(
      `Material ${current ? "atualizado" : "criado"}: ${name}.`,
      "success"
    );
  }

  return (
    <main className="stack" data-testid="inventory-page">
      <PageHeading
        eyebrow="Estoque técnico"
        title="Materiais"
        description="Especificações, rastreabilidade e movimentos de estoque. O saldo é confirmado pelo serviço no momento da operação."
        action={
          <Button
            variant="primary"
            onClick={() => setEditor(materialTemplate())}
            data-testid="new-material"
          >
            Novo material
          </Button>
        }
      />

      {ctx.error && (
        <div className="error-message" role="alert">
          <span>{ctx.error}</span>
          <Button variant="secondary" onClick={ctx.retry}>
            Tentar novamente
          </Button>
        </div>
      )}

      <section className="metric-grid" aria-label="Resumo do estoque">
        <article className="stat">
          <span className="stat-label">Materiais cadastrados</span>
          <strong className="stat-value">{ctx.data.materials.length}</strong>
        </article>
        <article className="stat">
          <span className="stat-label">Saldo registrado</span>
          <strong className="stat-value">{grams(summary.totalRecorded)}</strong>
        </article>
        <article className="stat">
          <span className="stat-label">No ponto de reposição</span>
          <strong className="stat-value">{summary.atReorderPoint}</strong>
        </article>
      </section>

      <section className="card" aria-labelledby="inventory-list-heading">
        <div className="card-head split">
          <div>
            <p className="eyebrow">Consulta operacional</p>
            <h2 id="inventory-list-heading">Lista de materiais</h2>
          </div>
          <label className="field" htmlFor="inventory-search">
            <span className="field-label">Buscar materiais</span>
            <input
              id="inventory-search"
              data-testid="inventory-search"
              type="search"
              value={ctx.search}
              onChange={event => ctx.setSearch(event.currentTarget.value)}
              placeholder="Nome, família, fabricante, fonte…"
            />
          </label>
        </div>
        <div className="card-body">
          {ctx.loading ? (
            <p className="muted" role="status">
              Carregando materiais…
            </p>
          ) : materials.length ? (
            <div className="list" aria-live="polite">
              {materials.map(material => {
                const reservation = reservationFor(
                  material.id,
                  ctx.data.orders
                );
                const tone = stockTone(material);
                return (
                  <article
                    className="list-row"
                    key={material.id}
                    data-testid={`material-${material.id}`}
                  >
                    <div className="split wrap">
                      <div>
                        <h3>{material.name}</h3>
                        <p className="muted">
                          {[
                            material.family || material.type,
                            material.manufacturer,
                            material.variant,
                            material.color,
                          ]
                            .filter(Boolean)
                            .join(" · ") ||
                            "Classificação técnica não informada"}
                        </p>
                      </div>
                      <Badge tone={tone}>{stockLabel(material)}</Badge>
                    </div>

                    <dl className="details-grid">
                      <div>
                        <dt>Disponível (registro)</dt>
                        <dd>{grams(material.availableGrams)}</dd>
                      </div>
                      <div>
                        <dt>Reservado por invoices</dt>
                        <dd>
                          {reservation.count
                            ? `${grams(reservation.grams)} · ${reservation.count} invoice(s)`
                            : "Nenhuma alocação"}
                        </dd>
                      </div>
                      <div>
                        <dt>Ponto de reposição</dt>
                        <dd>{grams(material.reorderAtGrams)}</dd>
                      </div>
                      <div>
                        <dt>Confiança</dt>
                        <dd>{material.confidenceLevel || "Não informada"}</dd>
                      </div>
                    </dl>

                    <p className="helper">
                      “Disponível” é o saldo registrado. “Reservado” reflete as
                      alocações atuais das invoices e não deve ser somado ao
                      saldo; a disponibilidade final é validada no serviço.
                    </p>
                    {material.availableGrams <= material.reorderAtGrams && (
                      <p className="helper">
                        O saldo atingiu o ponto de reposição. Isso sinaliza
                        acompanhamento, não confirma compra, fornecedor ou prazo
                        de entrega.
                      </p>
                    )}

                    <div className="row wrap">
                      <Button
                        variant="secondary"
                        onClick={() => setEditor({ ...material })}
                        aria-label={`Editar ${material.name}`}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() =>
                          setMovement({ material, kind: "replenish" })
                        }
                        aria-label={`Repor ${material.name}`}
                      >
                        Repor
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() =>
                          setMovement({ material, kind: "consume" })
                        }
                        aria-label={`Consumir ${material.name}`}
                      >
                        Consumir
                      </Button>
                      <ConfirmButton
                        label="Excluir"
                        confirmation={`Excluir “${material.name}”? A exclusão será bloqueada se houver registros vinculados.`}
                        onConfirm={async () => {
                          await ctx.remove("materials", material.id);
                          ctx.notify(
                            `Material removido: ${material.name}.`,
                            "success"
                          );
                        }}
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title={
                ctx.search
                  ? "Nenhum material encontrado"
                  : "Nenhum material cadastrado"
              }
              description={
                ctx.search
                  ? "Altere ou limpe a busca para consultar outros registros."
                  : "Cadastre a ficha técnica e use Repor quando o material estiver fisicamente disponível."
              }
              action={
                ctx.search ? (
                  <Button variant="secondary" onClick={() => ctx.setSearch("")}>
                    Limpar busca
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    onClick={() => setEditor(materialTemplate())}
                  >
                    Cadastrar material
                  </Button>
                )
              }
            />
          )}
        </div>
      </section>

      {editor && (
        <FormModal
          key={editor.id}
          title={
            ctx.data.materials.some(material => material.id === editor.id)
              ? "Editar material técnico"
              : "Novo material técnico"
          }
          onClose={() => setEditor(null)}
          onSubmit={saveMaterial}
          submitLabel="Salvar material"
        >
          <MaterialForm material={editor} onChange={setEditor} />
        </FormModal>
      )}

      {movement && (
        <MovementModal request={movement} onClose={() => setMovement(null)} />
      )}
    </main>
  );
}
