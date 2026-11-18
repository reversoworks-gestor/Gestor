import { useMemo, useState } from "react";
import { useGestor } from "../store";
import { makeId, today, type TaxEntry } from "../types";
import {
  Button,
  ConfirmButton,
  EmptyState,
  Field,
  PageHeading,
} from "../components/ui";
import {
  estimatedDueDates,
  homeOfficeDeductionCents,
  mileageTotals,
  paidEstimated,
} from "../taxMath";

const usd = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }).format(
    cents / 100
  );
const dateText = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(`${value}T12:00:00`)
  );
const PROFILE_ID = "tax-profile";

export default function Taxes() {
  const ctx = useGestor();
  const entries = ctx.data.taxEntries as TaxEntry[];
  const profile = entries.find(e => e.id === PROFILE_ID);
  const [year, setYear] = useState(new Date().getFullYear());
  const [estimated, setEstimated] = useState({
    date: today(),
    quarter: "1",
    agency: "Federal",
    amount: "",
  });
  const [trip, setTrip] = useState({ date: today(), miles: "", purpose: "" });
  const [rate, setRate] = useState<string | null>(null);
  const [sqft, setSqft] = useState<string | null>(null);

  const years = useMemo(() => {
    const set = new Set<number>([new Date().getFullYear()]);
    entries.forEach(e => e.date && set.add(Number(e.date.slice(0, 4))));
    return [...set].sort((a, b) => b - a);
  }, [entries]);
  const payments = entries
    .filter(e => e.kind === "estimated" && e.date.slice(0, 4) === String(year))
    .sort((a, b) => a.date.localeCompare(b.date));
  const trips = entries
    .filter(e => e.kind === "mileage" && e.date.slice(0, 4) === String(year))
    .sort((a, b) => b.date.localeCompare(a.date));
  const currentRate = profile?.mileageRate ?? 0;
  const totals = mileageTotals(entries, year, currentRate);
  const currentSqft = profile?.homeOfficeSqft ?? 0;

  async function addPayment() {
    const amount = Number(estimated.amount);
    if (!(amount > 0)) return ctx.notify("Informe o valor pago.", "error");
    try {
      await ctx.save("taxEntries", {
        id: makeId("tax"),
        kind: "estimated",
        date: estimated.date,
        quarter: Number(estimated.quarter) as 1 | 2 | 3 | 4,
        agency: estimated.agency as "Federal" | "Califórnia",
        amount,
      });
      setEstimated({ ...estimated, amount: "" });
    } catch (error) {
      ctx.notify(error instanceof Error ? error.message : "Erro ao salvar.", "error");
    }
  }
  async function addTrip() {
    const miles = Number(trip.miles);
    if (!(miles > 0)) return ctx.notify("Informe as milhas.", "error");
    try {
      await ctx.save("taxEntries", {
        id: makeId("tax"),
        kind: "mileage",
        date: trip.date,
        miles,
        purpose: trip.purpose.trim(),
      });
      setTrip({ ...trip, miles: "", purpose: "" });
    } catch (error) {
      ctx.notify(error instanceof Error ? error.message : "Erro ao salvar.", "error");
    }
  }
  async function saveProfile() {
    try {
      await ctx.save("taxEntries", {
        id: PROFILE_ID,
        kind: "profile",
        date: "2000-01-01",
        mileageRate: rate === null ? currentRate : Number(rate) || 0,
        homeOfficeSqft: sqft === null ? currentSqft : Number(sqft) || 0,
      });
      setRate(null);
      setSqft(null);
    } catch (error) {
      ctx.notify(error instanceof Error ? error.message : "Erro ao salvar.", "error");
    }
  }

  return (
    <div className="stack">
      <PageHeading
        eyebrow="Financeiro"
        title="Impostos e deduções"
        description="Organização simples. Não substitui o contador: confirme valores, datas e elegibilidade com ele."
        action={
          <select
            aria-label="Ano"
            value={year}
            onChange={event => setYear(Number(event.target.value))}
          >
            {years.map(y => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        }
      />

      <section className="card" aria-label="Impostos estimados">
        <div className="card-body stack">
        <h2>Impostos estimados pagos</h2>
        <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Trimestre</th>
              <th scope="col">Vencimento</th>
              <th scope="col">Federal</th>
              <th scope="col">Califórnia</th>
            </tr>
          </thead>
          <tbody>
            {estimatedDueDates(year).map(due => (
              <tr key={due.quarter}>
                <td>T{due.quarter}</td>
                <td>{dateText(due.date)}</td>
                <td>{usd(paidEstimated(entries, year, due.quarter, "Federal"))}</td>
                <td>{usd(paidEstimated(entries, year, due.quarter, "Califórnia"))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <p className="muted">
          As datas federais mudam quando caem em fim de semana ou feriado. A
          Califórnia usa um calendário de parcelas próprio: pergunte ao contador
          os valores e as datas.
        </p>
        <div className="form-grid">
          <Field label="Data do pagamento">
            <input type="date" value={estimated.date} onChange={e => setEstimated({ ...estimated, date: e.target.value })} />
          </Field>
          <Field label="Trimestre">
            <select value={estimated.quarter} onChange={e => setEstimated({ ...estimated, quarter: e.target.value })}>
              {[1, 2, 3, 4].map(q => (<option key={q} value={q}>T{q}</option>))}
            </select>
          </Field>
          <Field label="Órgão">
            <select value={estimated.agency} onChange={e => setEstimated({ ...estimated, agency: e.target.value })}>
              <option>Federal</option>
              <option>Califórnia</option>
            </select>
          </Field>
          <Field label="Valor pago (US$)">
            <input type="number" step="0.01" min="0" value={estimated.amount} onChange={e => setEstimated({ ...estimated, amount: e.target.value })} />
          </Field>
        </div>
        <Button variant="primary" onClick={addPayment}>Registrar pagamento</Button>
        {payments.length > 0 && (
          <ul className="plain-list">
            {payments.map(p => (
              <li key={p.id}>
                {dateText(p.date)} · {p.agency} · T{p.quarter} · {usd(p.amountCents ?? 0)}{" "}
                <ConfirmButton
                  label="Remover"
                  confirmation="Remover este pagamento do registro? O histórico fica arquivado."
                  onConfirm={() => ctx.remove("taxEntries", p.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
      </section>

      <section className="card" aria-label="Quilometragem">
        <div className="card-body stack">
        <h2>Quilometragem do negócio</h2>
        <div className="form-grid">
          <Field label="Data">
            <input type="date" value={trip.date} onChange={e => setTrip({ ...trip, date: e.target.value })} />
          </Field>
          <Field label="Milhas">
            <input type="number" step="0.1" min="0" value={trip.miles} onChange={e => setTrip({ ...trip, miles: e.target.value })} />
          </Field>
          <Field label="Motivo">
            <input value={trip.purpose} placeholder="Ex.: buscar produtos, visita a cliente" onChange={e => setTrip({ ...trip, purpose: e.target.value })} />
          </Field>
        </div>
        <Button variant="primary" onClick={addTrip}>Registrar viagem</Button>
        <p>
          <strong>{totals.miles.toFixed(1)} milhas</strong> em {year}.{" "}
          {currentRate > 0
            ? `Dedução estimada: ${usd(totals.deductionCents)} (taxa US$ ${currentRate}/milha).`
            : "Defina a taxa por milha abaixo para ver a dedução estimada."}
        </p>
        <p className="muted">
          A taxa por milha é definida pelo IRS e muda por ano: confirme o valor
          do ano e se esse método vale para você.
        </p>
        {trips.length === 0 ? (
          <EmptyState title="Nenhuma viagem registrada" description="Registre cada deslocamento do negócio com data, milhas e motivo." />
        ) : (
          <ul className="plain-list">
            {trips.map(t => (
              <li key={t.id}>
                {dateText(t.date)} · {(t.miles ?? 0).toFixed(1)} mi · {t.purpose || "sem motivo"}{" "}
                <ConfirmButton
                  label="Remover"
                  confirmation="Remover esta viagem do registro? O histórico fica arquivado."
                  onConfirm={() => ctx.remove("taxEntries", t.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
      </section>

      <section className="card" aria-label="Parâmetros e home office">
        <div className="card-body stack">
        <h2>Parâmetros e home office</h2>
        <div className="form-grid">
          <Field label="Taxa por milha (US$, do IRS no ano)">
            <input type="number" step="0.001" min="0" value={rate ?? (currentRate || "")} onChange={e => setRate(e.target.value)} />
          </Field>
          <Field label="Área usada só para o negócio (pés²)">
            <input type="number" step="1" min="0" value={sqft ?? (currentSqft || "")} onChange={e => setSqft(e.target.value)} />
          </Field>
        </div>
        <Button variant="primary" onClick={saveProfile}>Salvar parâmetros</Button>
        <p>
          Home office (método simplificado):{" "}
          <strong>{currentSqft > 0 ? usd(homeOfficeDeductionCents(currentSqft)) : "—"}</strong>
        </p>
        <p className="muted">
          Método simplificado: US$ 5 por pé² até 300 pés². Normalmente exige uso
          regular e exclusivo da área para o negócio. Confirme com o contador se a
          sua oficina em casa se encaixa.
        </p>
      </div>
      </section>
    </div>
  );
}
