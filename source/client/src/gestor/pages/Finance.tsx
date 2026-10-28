import { DateInput } from "../components/ui";
import { useMemo, useState } from "react";
import {
  Download,
  Pencil,
  Plus,
  ReceiptText,
  RotateCcw,
  WalletCards,
} from "lucide-react";
import type { StudioExpense as Expense } from "../types";
import {
  calculateOrderTotals,
  centsToAmount,
  toCents,
} from "../../lib/finance";
import { useGestor } from "../store";
import {
  Badge,
  Button,
  ConfirmButton,
  EmptyState,
  Field,
  FormModal,
  PageHeading,
} from "../components/ui";
import { dateLabel, makeId, money, today, type StudioOrder } from "../types";

const ALL_CATEGORIES = "__all_categories__";
const UNCATEGORIZED = "__uncategorized__";

type InvoiceFinancials = {
  order: StudioOrder;
  date: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  paidCents: number;
  outstandingCents: number;
};

type PaymentEntry = {
  invoice: StudioOrder;
  date: string;
  method: string;
  amountCents: number;
};

function storedCents(cents: unknown, amount: unknown, fallback = 0) {
  if (typeof cents === "number" && Number.isSafeInteger(cents) && cents >= 0)
    return cents;
  if (typeof amount !== "string" && typeof amount !== "number") return fallback;
  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount < 0) return fallback;
  const converted = toCents(amount);
  return Number.isSafeInteger(converted) && converted >= 0
    ? converted
    : fallback;
}

function dayValue(value?: string) {
  const match = value?.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return "";
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? `${match[1]}-${match[2]}-${match[3]}`
    : "";
}

function dateIsInRange(value: string, from: string, to: string) {
  if (!from && !to) return true;
  if (!value) return false;
  return (!from || value >= from) && (!to || value <= to);
}

function normalizeText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase();
}

function matchesSearch(query: string, values: Array<string | undefined>) {
  if (!query) return true;
  return normalizeText(values.filter(Boolean).join(" ")).includes(query);
}

function invoiceDate(order: StudioOrder) {
  return (
    dayValue(order.startDate) ||
    dayValue(order.createdAt) ||
    dayValue(order.dueDate)
  );
}

function invoiceFinancials(order: StudioOrder): InvoiceFinancials {
  const calculated = calculateOrderTotals(
    order.lines ?? [],
    order.taxRate ?? 0
  );
  const subtotalCents = storedCents(
    order.subtotalCents,
    order.subtotal,
    calculated.subtotalCents
  );
  const taxCents = storedCents(order.taxCents, order.tax, calculated.taxCents);
  const totalCents = storedCents(
    order.totalCents,
    order.total,
    calculated.totalCents
  );
  const paidCents = (order.payments ?? []).reduce(
    (sum, payment) => sum + storedCents(payment.amountCents, payment.amount),
    0
  );

  return {
    order,
    date: invoiceDate(order),
    subtotalCents,
    taxCents,
    totalCents,
    paidCents,
    outstandingCents: Math.max(0, totalCents - paidCents),
  };
}

function expenseCents(expense: Expense) {
  return storedCents(expense.amountCents, expense.amount);
}

function categoryName(category: string) {
  return category.trim() || "Sem categoria";
}

function amountText(cents: number) {
  return centsToAmount(cents).toFixed(2);
}

function expenseTemplate(): Expense {
  const timestamp = new Date().toISOString();
  return {
    id: makeId("expense"),
    title: "",
    category: "",
    vendor: "",
    amount: 0,
    amountCents: 0,
    date: today(),
    notes: "",
    createdAt: timestamp,
  };
}

function csvCell(value: string | number) {
  const text = String(value ?? "");
  // Quoting alone does not stop spreadsheet formula evaluation. Prefix any formula-like cell.
  const neutralized = /^\s*[=+\-@]/u.test(text) ? `'${text}` : text;
  return `"${neutralized.replace(/"/g, '""')}"`;
}

function isInvoice(order: StudioOrder) {
  return order.documentType === "Invoice";
}

function metric(title: string, value: string, detail: string) {
  return (
    <article className="stat">
      <span className="stat-label">{title}</span>
      <strong className="stat-value">{value}</strong>
      <small className="muted">{detail}</small>
    </article>
  );
}

export default function FinancePage() {
  const {
    data,
    settings,
    loading,
    error,
    retry,
    view,
    navigate,
    search,
    save,
    remove,
    notify,
  } = useGestor();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [categoryFilter, setCategoryFilter] = useState(ALL_CATEGORIES);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const currentView = view === "expenses" ? "expenses" : "finance";
  const query = normalizeText(search.trim());
  const [currency, setCurrency] = useState<"USD" | "BRL">(settings.currency);
  const formatCents = (cents: number) => money(centsToAmount(cents), currency);
  const formatSignedCents = (cents: number) =>
    money(centsToAmount(cents), currency);

  const categories = useMemo(() => {
    const values = new Set(
      data.expenses.map(expense => expense.category.trim() || UNCATEGORIZED)
    );
    return [...values].sort((a, b) =>
      categoryName(a).localeCompare(categoryName(b), "pt-BR")
    );
  }, [data.expenses]);

  const filteredInvoices = useMemo(() => {
    return data.orders
      .filter(
        order => isInvoice(order) && (order.currency ?? "USD") === currency
      )
      .map(invoiceFinancials)
      .filter(invoice => dateIsInRange(invoice.date, dateFrom, dateTo))
      .filter(invoice =>
        matchesSearch(query, [
          invoice.order.id,
          invoice.order.title,
          invoice.order.clientName,
          invoice.order.documentType,
        ])
      )
      .sort((a, b) =>
        `${b.date}-${b.order.id}`.localeCompare(`${a.date}-${a.order.id}`)
      );
  }, [data.orders, dateFrom, dateTo, query, currency]);

  const filteredExpenses = useMemo(() => {
    return data.expenses
      .filter(expense => (expense.currency ?? "USD") === currency)
      .filter(expense =>
        dateIsInRange(dayValue(expense.date), dateFrom, dateTo)
      )
      .filter(expense => {
        if (categoryFilter === ALL_CATEGORIES) return true;
        if (categoryFilter === UNCATEGORIZED) return !expense.category.trim();
        return expense.category.trim() === categoryFilter;
      })
      .filter(expense =>
        matchesSearch(query, [
          expense.id,
          expense.title,
          expense.category,
          expense.vendor,
          expense.notes,
        ])
      )
      .sort((a, b) =>
        `${dayValue(b.date)}-${b.id}`.localeCompare(
          `${dayValue(a.date)}-${a.id}`
        )
      );
  }, [categoryFilter, data.expenses, dateFrom, dateTo, query, currency]);

  const paymentsInPeriod = useMemo(() => {
    const entries: PaymentEntry[] = [];
    data.orders
      .filter(
        order => isInvoice(order) && (order.currency ?? "USD") === currency
      )
      .forEach(invoice => {
        if (
          !matchesSearch(query, [
            invoice.id,
            invoice.title,
            invoice.clientName,
            invoice.documentType,
          ])
        )
          return;
        (invoice.payments ?? []).forEach(payment => {
          const date = dayValue(payment.date);
          if (!dateIsInRange(date, dateFrom, dateTo)) return;
          entries.push({
            invoice,
            date,
            method: payment.method,
            amountCents: storedCents(payment.amountCents, payment.amount),
          });
        });
      });
    return entries;
  }, [data.orders, dateFrom, dateTo, query, currency]);

  const invoiceTotals = useMemo(
    () =>
      filteredInvoices.reduce(
        (totals, invoice) => ({
          subtotalCents: totals.subtotalCents + invoice.subtotalCents,
          taxCents: totals.taxCents + invoice.taxCents,
          totalCents: totals.totalCents + invoice.totalCents,
          outstandingCents: totals.outstandingCents + invoice.outstandingCents,
        }),
        { subtotalCents: 0, taxCents: 0, totalCents: 0, outstandingCents: 0 }
      ),
    [filteredInvoices]
  );

  const periodPaidCents = useMemo(
    () =>
      paymentsInPeriod.reduce((sum, payment) => sum + payment.amountCents, 0),
    [paymentsInPeriod]
  );
  const expenseTotalCents = useMemo(
    () =>
      filteredExpenses.reduce((sum, expense) => sum + expenseCents(expense), 0),
    [filteredExpenses]
  );
  const cashBalanceCents = periodPaidCents - expenseTotalCents;
  const categoryTotals = useMemo(() => {
    const totals = new Map<string, number>();
    filteredExpenses.forEach(expense => {
      const category = categoryName(expense.category);
      totals.set(category, (totals.get(category) ?? 0) + expenseCents(expense));
    });
    return [...totals.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR")
    );
  }, [filteredExpenses]);

  const hasActiveFilters = Boolean(
    dateFrom || dateTo || categoryFilter !== ALL_CATEGORIES || query
  );
  const hasVisibleRecords =
    filteredInvoices.length > 0 ||
    filteredExpenses.length > 0 ||
    paymentsInPeriod.length > 0;

  function clearFilters() {
    setDateFrom("");
    setDateTo("");
    setCategoryFilter(ALL_CATEGORIES);
  }

  async function saveExpense(expense: Expense) {
    const exists = data.expenses.some(item => item.id === expense.id);
    await save("expenses", expense);
    notify(exists ? "Despesa atualizada." : "Despesa registrada.", "success");
  }

  async function deleteExpense(expense: Expense) {
    await remove("expenses", expense.id);
    notify("Despesa removida.", "success");
  }

  function exportCsv() {
    const header = [
      "Tipo",
      "Data",
      "Descrição",
      "Cliente / fornecedor",
      "Categoria",
      "Subtotal",
      "Imposto",
      `Total (${currency})`,
      `Recebido (${currency})`,
      `Em aberto (${currency})`,
      "Notas",
    ];
    const rows: Array<Array<string | number>> = [header];

    filteredInvoices.forEach(invoice => {
      rows.push([
        "Invoice",
        invoice.date,
        invoice.order.title || invoice.order.id,
        invoice.order.clientName,
        "",
        amountText(invoice.subtotalCents),
        amountText(invoice.taxCents),
        amountText(invoice.totalCents),
        amountText(invoice.paidCents),
        amountText(invoice.outstandingCents),
        invoice.order.notes || "",
      ]);
    });
    paymentsInPeriod.forEach(payment => {
      rows.push([
        "Pagamento",
        payment.date,
        payment.invoice.title || payment.invoice.id,
        payment.invoice.clientName,
        payment.method || "Não informado",
        "",
        "",
        amountText(payment.amountCents),
        amountText(payment.amountCents),
        "",
        `Pagamento de invoice ${payment.invoice.id}`,
      ]);
    });
    filteredExpenses.forEach(expense => {
      rows.push([
        "Despesa",
        dayValue(expense.date),
        expense.title,
        expense.vendor,
        categoryName(expense.category),
        "",
        "",
        amountText(expenseCents(expense)),
        "",
        "",
        expense.notes,
      ]);
    });

    if (rows.length === 1) {
      notify("Não há lançamentos visíveis para exportar.", "info");
      return;
    }

    const csv = `\uFEFF${rows.map(row => row.map(csvCell).join(";")).join("\r\n")}\r\n`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const period = `${dateFrom || "inicio"}-${dateTo || "atual"}`;
    anchor.href = url;
    anchor.download = `financeiro-${period}.csv`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    notify("CSV financeiro exportado.", "success");
  }

  const actions = (
    <div className="row wrap">
      <Button
        variant="secondary"
        onClick={exportCsv}
        disabled={!hasVisibleRecords}
      >
        <Download size={16} /> Exportar CSV
      </Button>
      <Button
        variant="primary"
        onClick={() =>
          setEditingExpense({
            ...expenseTemplate(),
            currency: settings.currency,
          })
        }
      >
        <Plus size={16} /> Nova despesa
      </Button>
    </div>
  );

  if (loading) {
    return (
      <section className="stack" aria-busy="true">
        <PageHeading
          eyebrow="Financeiro"
          title={currentView === "expenses" ? "Despesas" : "Financeiro"}
          description="Carregando lançamentos financeiros…"
        />
        <div className="card">
          <p className="muted">Carregando dados financeiros.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="stack" aria-busy="false">
      <PageHeading
        eyebrow="Financeiro"
        title={
          currentView === "expenses"
            ? "Despesas operacionais"
            : "Visão financeira"
        }
        description={
          currentView === "expenses"
            ? "Registre e acompanhe custos do estúdio com valores exatos em centavos."
            : "Invoices, impostos, recebimentos e despesas sem conversão de moeda."
        }
        action={actions}
      />

      <nav className="tabs" aria-label="Seções financeiras" role="tablist">
        <Button
          variant="ghost"
          role="tab"
          className={currentView === "finance" ? "active" : ""}
          aria-selected={currentView === "finance"}
          onClick={() => navigate("finance")}
        >
          <WalletCards size={16} /> Financeiro
        </Button>
        <Button
          variant="ghost"
          role="tab"
          className={currentView === "expenses" ? "active" : ""}
          aria-selected={currentView === "expenses"}
          onClick={() => navigate("expenses")}
        >
          <ReceiptText size={16} /> Despesas
        </Button>
      </nav>

      {error && (
        <div className="error-message" role="alert">
          <span>{error}</span>
          <Button variant="secondary" onClick={retry}>
            Tentar novamente
          </Button>
        </div>
      )}

      <section className="card" aria-label="Filtros financeiros">
        <div className="card-head">
          <div>
            <h2>Período e categoria</h2>
            <p className="muted">
              Invoices são filtradas pela data do documento; recebimentos, pela
              data do pagamento; despesas, pela data do lançamento.
            </p>
          </div>
        </div>
        <div className="card-body toolbar wrap">
          <Field label="Moeda do relatório">
            <select
              value={currency}
              onChange={event =>
                setCurrency(event.target.value as "USD" | "BRL")
              }
            >
              <option value="USD">USD · sem conversão</option>
              <option value="BRL">BRL · sem conversão</option>
            </select>
          </Field>
          <Field label="A partir de">
            <DateInput
              aria-label="Data inicial"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={event => setDateFrom(event.target.value)}
            />
          </Field>
          <Field label="Até">
            <DateInput
              aria-label="Data final"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={event => setDateTo(event.target.value)}
            />
          </Field>
          <Field label="Categoria de despesa">
            <select
              aria-label="Categoria de despesa"
              value={categoryFilter}
              onChange={event => setCategoryFilter(event.target.value)}
            >
              <option value={ALL_CATEGORIES}>Todas as categorias</option>
              {categories.map(category => (
                <option value={category} key={category}>
                  {categoryName(category)}
                </option>
              ))}
            </select>
          </Field>
          <Button
            variant="ghost"
            onClick={clearFilters}
            disabled={!hasActiveFilters}
          >
            <RotateCcw size={16} /> Limpar filtros
          </Button>
        </div>
        <div className="card-footer">
          <p className="helper">
            Todos os valores estão em {currency}; esta tela não faz conversão
            nem combina moedas.
          </p>
          {query && (
            <p className="helper">
              A busca global também está aplicada aos lançamentos visíveis.
            </p>
          )}
        </div>
      </section>

      {currentView === "finance" ? (
        <>
          <div className="metric-grid" aria-label="Métricas financeiras">
            {metric(
              "Invoices",
              formatCents(invoiceTotals.totalCents),
              `${filteredInvoices.length} documento${filteredInvoices.length === 1 ? "" : "s"} no período`
            )}
            {metric(
              "Subtotal",
              formatCents(invoiceTotals.subtotalCents),
              "Antes dos impostos"
            )}
            {metric(
              "Impostos",
              formatCents(invoiceTotals.taxCents),
              "Conforme cada invoice"
            )}
            {metric(
              "Recebido",
              formatCents(periodPaidCents),
              `${paymentsInPeriod.length} pagamento${paymentsInPeriod.length === 1 ? "" : "s"} no período`
            )}
            {metric(
              "A receber",
              formatCents(invoiceTotals.outstandingCents),
              "Saldo das invoices selecionadas"
            )}
            {metric(
              "Despesas",
              formatCents(expenseTotalCents),
              `${filteredExpenses.length} lançamento${filteredExpenses.length === 1 ? "" : "s"} no período`
            )}
            {metric(
              "Saldo de caixa",
              formatSignedCents(cashBalanceCents),
              "Recebimentos do período menos despesas filtradas"
            )}
          </div>

          {!hasVisibleRecords ? (
            <EmptyState
              title="Nenhum lançamento financeiro neste recorte"
              description="Altere os filtros ou registre uma despesa para começar a acompanhar o fluxo financeiro."
              action={
                hasActiveFilters ? (
                  <Button variant="secondary" onClick={clearFilters}>
                    Limpar filtros
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    onClick={() =>
                      setEditingExpense({
                        ...expenseTemplate(),
                        currency: settings.currency,
                      })
                    }
                  >
                    Registrar despesa
                  </Button>
                )
              }
            />
          ) : (
            <div className="grid grid-2">
              <section className="card" aria-labelledby="invoices-heading">
                <div className="card-head">
                  <div>
                    <p className="eyebrow">Comercial</p>
                    <h2 id="invoices-heading">Invoices selecionadas</h2>
                  </div>
                  <Button variant="ghost" onClick={() => navigate("invoices")}>
                    Abrir invoices
                  </Button>
                </div>
                {filteredInvoices.length ? (
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th scope="col">Invoice</th>
                          <th scope="col">Data</th>
                          <th scope="col">Total</th>
                          <th scope="col">Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredInvoices.map(invoice => {
                          const tone =
                            invoice.outstandingCents === 0
                              ? "success"
                              : invoice.paidCents > 0
                                ? "warning"
                                : "neutral";
                          const status =
                            invoice.outstandingCents === 0
                              ? "Quitada"
                              : invoice.paidCents > 0
                                ? "Parcial"
                                : "Pendente";
                          return (
                            <tr key={invoice.order.id}>
                              <td>
                                <strong>
                                  {invoice.order.title || "Invoice sem título"}
                                </strong>
                                <small className="muted">
                                  {invoice.order.clientName ||
                                    "Cliente não informado"}
                                </small>
                              </td>
                              <td>
                                {invoice.date
                                  ? dateLabel(invoice.date)
                                  : "Não informada"}
                              </td>
                              <td>
                                {formatCents(invoice.totalCents)}
                                <small className="muted">
                                  Pago: {formatCents(invoice.paidCents)}
                                </small>
                              </td>
                              <td>
                                <Badge tone={tone}>
                                  {status} ·{" "}
                                  {formatCents(invoice.outstandingCents)}
                                </Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="card-body muted">
                    Nenhuma invoice corresponde ao período, à busca atual ou aos
                    filtros selecionados.
                  </p>
                )}
              </section>

              <section
                className="card"
                aria-labelledby="expense-summary-heading"
              >
                <div className="card-head">
                  <div>
                    <p className="eyebrow">Custos</p>
                    <h2 id="expense-summary-heading">Despesas por categoria</h2>
                  </div>
                  <Button variant="ghost" onClick={() => navigate("expenses")}>
                    Gerenciar despesas
                  </Button>
                </div>
                {categoryTotals.length ? (
                  <ul className="list">
                    {categoryTotals.map(([category, cents]) => (
                      <li className="list-row" key={category}>
                        <span>{category}</span>
                        <strong>{formatCents(cents)}</strong>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="card-body muted">
                    Nenhuma despesa corresponde aos filtros atuais.
                  </p>
                )}
              </section>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="metric-grid" aria-label="Resumo de despesas">
            {metric(
              "Despesas",
              formatCents(expenseTotalCents),
              `${filteredExpenses.length} lançamento${filteredExpenses.length === 1 ? "" : "s"} no período`
            )}
            {metric(
              "Recebido",
              formatCents(periodPaidCents),
              "Recebimentos na mesma faixa de datas"
            )}
            {metric(
              "Saldo de caixa",
              formatSignedCents(cashBalanceCents),
              "Recebido menos despesas filtradas"
            )}
          </div>

          {filteredExpenses.length ? (
            <section className="card" aria-labelledby="expense-list-heading">
              <div className="card-head">
                <div>
                  <p className="eyebrow">Registros persistidos</p>
                  <h2 id="expense-list-heading">Lançamentos de despesas</h2>
                </div>
                <span className="muted">{formatCents(expenseTotalCents)}</span>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Data</th>
                      <th scope="col">Despesa</th>
                      <th scope="col">Categoria</th>
                      <th scope="col">Fornecedor</th>
                      <th scope="col">Valor</th>
                      <th scope="col">
                        <span className="sr-only">Ações</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExpenses.map(expense => (
                      <tr key={expense.id}>
                        <td>
                          {dayValue(expense.date)
                            ? dateLabel(dayValue(expense.date))
                            : "Não informada"}
                        </td>
                        <td>
                          <strong>
                            {expense.title || "Despesa sem título"}
                          </strong>
                          {expense.notes && (
                            <small className="muted">{expense.notes}</small>
                          )}
                        </td>
                        <td>
                          <Badge tone="neutral">
                            {categoryName(expense.category)}
                          </Badge>
                        </td>
                        <td>{expense.vendor || "Não informado"}</td>
                        <td>
                          <strong>{formatCents(expenseCents(expense))}</strong>
                        </td>
                        <td>
                          <div className="row wrap">
                            <Button
                              variant="ghost"
                              aria-label={`Editar ${expense.title || "despesa"}`}
                              onClick={() =>
                                setEditingExpense({
                                  ...expense,
                                  amountCents: expenseCents(expense),
                                  amount: centsToAmount(expenseCents(expense)),
                                })
                              }
                            >
                              <Pencil size={16} />
                            </Button>
                            <ConfirmButton
                              label="Remover"
                              confirmation={`Remover a despesa “${expense.title || "sem título"}”? Esta ação não pode ser desfeita.`}
                              onConfirm={() => deleteExpense(expense)}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : (
            <EmptyState
              title={
                hasActiveFilters
                  ? "Nenhuma despesa corresponde aos filtros"
                  : "Nenhuma despesa registrada"
              }
              description={
                hasActiveFilters
                  ? "Limpe ou ajuste os filtros para ver outros lançamentos."
                  : "Registre custos de materiais, fornecedores e operação para acompanhar o caixa."
              }
              action={
                hasActiveFilters ? (
                  <Button variant="secondary" onClick={clearFilters}>
                    Limpar filtros
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    onClick={() =>
                      setEditingExpense({
                        ...expenseTemplate(),
                        currency: settings.currency,
                      })
                    }
                  >
                    <Plus size={16} /> Nova despesa
                  </Button>
                )
              }
            />
          )}
        </>
      )}

      {editingExpense && (
        <ExpenseDialog
          expense={editingExpense}
          onClose={() => setEditingExpense(null)}
          onSave={saveExpense}
        />
      )}
    </section>
  );
}

function ExpenseDialog({
  expense,
  onClose,
  onSave,
}: {
  expense: Expense;
  onClose: () => void;
  onSave: (expense: Expense) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Expense>({
    ...expense,
    amountCents: expenseCents(expense),
    amount: centsToAmount(expenseCents(expense)),
    date: dayValue(expense.date) || today(),
  });
  const [amount, setAmount] = useState(amountText(expenseCents(expense)));

  async function submit() {
    const rawAmount = amount.trim();
    const parsedAmount = Number(rawAmount);
    if (!rawAmount || !Number.isFinite(parsedAmount) || parsedAmount < 0) {
      throw new Error("Informe um valor não negativo para a despesa.");
    }
    const amountCents = toCents(rawAmount);
    if (!Number.isSafeInteger(amountCents) || amountCents < 0) {
      throw new Error(
        "O valor da despesa é inválido ou excede o limite permitido."
      );
    }
    const title = draft.title.trim();
    const category = draft.category.trim();
    const date = dayValue(draft.date);
    if (!title) throw new Error("Informe o título da despesa.");
    if (!category) throw new Error("Informe a categoria da despesa.");
    if (!date) throw new Error("Informe uma data válida para a despesa.");

    const timestamp = new Date().toISOString();
    await onSave({
      ...draft,
      title,
      category,
      vendor: draft.vendor.trim(),
      notes: draft.notes.trim(),
      date,
      amountCents,
      amount: centsToAmount(amountCents),
      createdAt: draft.createdAt || timestamp,
      updatedAt: timestamp,
    });
  }

  return (
    <FormModal
      title={expense.title ? "Editar despesa" : "Nova despesa"}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={expense.title ? "Salvar alterações" : "Registrar despesa"}
    >
      <div className="form-grid">
        <Field label="Título" className="field-full">
          <input
            required
            value={draft.title}
            onChange={event =>
              setDraft({ ...draft, title: event.target.value })
            }
            placeholder="Ex.: Insumo para restauração"
          />
        </Field>
        <Field label="Categoria">
          <input
            required
            value={draft.category}
            onChange={event =>
              setDraft({ ...draft, category: event.target.value })
            }
            placeholder="Ex.: Materiais"
          />
        </Field>
        <Field label="Fornecedor">
          <input
            value={draft.vendor}
            onChange={event =>
              setDraft({ ...draft, vendor: event.target.value })
            }
            placeholder="Opcional"
          />
        </Field>
        <Field
          label="Valor"
          help="Armazenado como centavos; valores negativos não são aceitos."
        >
          <input
            required
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={amount}
            onChange={event => setAmount(event.target.value)}
          />
        </Field>
        <Field label="Data">
          <DateInput
            required
            value={draft.date}
            onChange={event => setDraft({ ...draft, date: event.target.value })}
          />
        </Field>
        <Field label="Notas" className="field-full">
          <textarea
            value={draft.notes}
            onChange={event =>
              setDraft({ ...draft, notes: event.target.value })
            }
            placeholder="Contexto interno, número do comprovante ou observações."
          />
        </Field>
      </div>
    </FormModal>
  );
}
