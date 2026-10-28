import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { CatalogItem } from "../../lib/models";
import { addWorkspaceEmail } from "../../lib/firebase";
import {
  Badge,
  Button,
  ConfirmButton,
  EmptyState,
  Field,
  FormModal,
  PageHeading,
} from "../components/ui";
import { useGestor } from "../store";
import { makeId, money, type Settings } from "../types";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function blankCatalogItem(currency: Settings["currency"] = "USD"): CatalogItem {
  return {
    id: makeId("catalog"),
    name: "",
    description: "",
    unitPrice: 0,
    currency,
    taxable: false,
    kind: "service",
  };
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function validEmail(value: string) {
  return emailPattern.test(value);
}

export default function SettingsPage() {
  const ctx = useGestor();
  const { data, mode, owner, settings } = ctx;
  const [settingsDraft, setSettingsDraft] = useState<Settings>(settings);
  const [settingsError, setSettingsError] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [catalogDraft, setCatalogDraft] = useState<CatalogItem | null>(null);
  const [teamEmail, setTeamEmail] = useState("");
  const [teamError, setTeamError] = useState("");
  const [authorizingTeam, setAuthorizingTeam] = useState(false);

  useEffect(() => {
    setSettingsDraft(settings);
  }, [settings]);

  const catalogItems = useMemo(
    () =>
      [...data.catalogItems].sort((first, second) =>
        first.name.localeCompare(second.name, "pt-BR")
      ),
    [data.catalogItems]
  );
  const canAuthorizeTeam =
    owner && (mode === "firebase" || mode === "emulator");

  function updateSettings(patch: Partial<Settings>) {
    setSettingsDraft(current => ({ ...current, ...patch }));
  }

  function updateCatalog(patch: Partial<CatalogItem>) {
    setCatalogDraft(current => (current ? { ...current, ...patch } : current));
  }

  async function saveStudioSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSettingsError("");

    const studioName = settingsDraft.studioName.trim();
    const taxRate = Number(settingsDraft.taxRate);
    const email = normalizeEmail(settingsDraft.email);

    if (!studioName) {
      setSettingsError("Informe o nome do estúdio.");
      return;
    }
    if (!Number.isFinite(taxRate) || taxRate < 0) {
      setSettingsError("A taxa deve ser um número decimal não negativo.");
      return;
    }
    if (email && !validEmail(email)) {
      setSettingsError(
        "Informe um e-mail de contato válido ou deixe o campo em branco."
      );
      return;
    }

    const saved: Settings = {
      ...settingsDraft,
      studioName,
      taxRate,
      address: settingsDraft.address.trim(),
      phone: settingsDraft.phone.trim(),
      email,
      publicFooter: settingsDraft.publicFooter.trim(),
    };

    setSavingSettings(true);
    try {
      await ctx.save("settings", saved);
      ctx.notify("Configurações do estúdio salvas.", "success");
    } catch (error) {
      const message = errorMessage(
        error,
        "Não foi possível salvar as configurações do estúdio."
      );
      setSettingsError(message);
      ctx.notify(message, "error");
    } finally {
      setSavingSettings(false);
    }
  }

  async function saveCatalogItem() {
    if (!catalogDraft) return;

    const name = catalogDraft.name.trim();
    const description = catalogDraft.description.trim();
    const unitPrice = Number(catalogDraft.unitPrice);

    if (!name) throw new Error("Informe o nome do item do catálogo.");
    if (!description)
      throw new Error("Informe a descrição do item do catálogo.");
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new Error("O preço unitário deve ser um número não negativo.");
    }

    const saved: CatalogItem = {
      ...catalogDraft,
      name,
      description,
      unitPrice,
    };

    try {
      await ctx.save("catalogItems", saved);
      setCatalogDraft(null);
      ctx.notify("Item do catálogo salvo.", "success");
    } catch (error) {
      const message = errorMessage(
        error,
        "Não foi possível salvar o item do catálogo."
      );
      ctx.notify(message, "error");
      throw error;
    }
  }

  async function removeCatalogItem(item: CatalogItem) {
    try {
      await ctx.remove("catalogItems", item.id);
      if (catalogDraft?.id === item.id) setCatalogDraft(null);
      ctx.notify("Item removido do catálogo.", "success");
    } catch (error) {
      const message = errorMessage(
        error,
        "Não foi possível remover o item do catálogo."
      );
      ctx.notify(message, "error");
      throw new Error(message);
    }
  }

  async function authorizeTeamMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTeamError("");

    if (mode !== "firebase" && mode !== "emulator") {
      setTeamError(
        "A autorização de equipe só está disponível em um workspace Firebase ou no emulador."
      );
      return;
    }
    if (!owner) {
      setTeamError(
        "Somente o proprietário do workspace pode autorizar acessos."
      );
      return;
    }

    const email = normalizeEmail(teamEmail);
    if (!validEmail(email)) {
      setTeamError(
        "Informe um endereço de e-mail válido antes de autorizar o acesso."
      );
      return;
    }

    setAuthorizingTeam(true);
    try {
      await addWorkspaceEmail(email);
      setTeamEmail("");
      ctx.notify("Acesso autorizado para o e-mail informado.", "success");
    } catch (error) {
      const message = errorMessage(
        error,
        "Não foi possível autorizar este e-mail."
      );
      setTeamError(message);
      ctx.notify(message, "error");
    } finally {
      setAuthorizingTeam(false);
    }
  }

  return (
    <div className="stack" data-testid="settings-page">
      <PageHeading
        eyebrow="Ajustes"
        title="Configurações do estúdio"
        description="Defina a identidade do workspace, mantenha o catálogo operacional e controle o acesso da equipe."
      />

      <section className="card" aria-labelledby="studio-settings-heading">
        <div className="card-head split">
          <div>
            <p className="eyebrow">Estúdio</p>
            <h2 id="studio-settings-heading">Dados comerciais e documentos</h2>
          </div>
          <Badge tone="neutral">{settingsDraft.currency}</Badge>
        </div>
        <div className="card-body">
          <form className="stack" onSubmit={saveStudioSettings} noValidate>
            <div className="form-grid">
              <Field
                label="Nome do estúdio"
                error={
                  settingsError && !settingsDraft.studioName.trim()
                    ? settingsError
                    : undefined
                }
              >
                <input
                  id="studio-name"
                  data-testid="studio-name"
                  name="studioName"
                  value={settingsDraft.studioName}
                  onChange={event =>
                    updateSettings({ studioName: event.target.value })
                  }
                  required
                  autoComplete="organization"
                />
              </Field>

              <Field
                label="Moeda"
                help="A moeda define apenas a apresentação dos valores. O Gestor não converte valores automaticamente."
              >
                <select
                  id="studio-currency"
                  data-testid="studio-currency"
                  name="currency"
                  value={settingsDraft.currency}
                  onChange={event =>
                    updateSettings({
                      currency: event.target.value as Settings["currency"],
                    })
                  }
                >
                  <option value="USD">USD — dólar americano</option>
                  <option value="BRL">BRL — real brasileiro</option>
                </select>
              </Field>

              <Field
                label="Taxa padrão (decimal)"
                help="A taxa é armazenada como fração decimal: 0,1 representa 10%. Ela será aplicada somente onde o item estiver marcado como tributável."
                error={
                  settingsError &&
                  (!Number.isFinite(Number(settingsDraft.taxRate)) ||
                    Number(settingsDraft.taxRate) < 0)
                    ? settingsError
                    : undefined
                }
              >
                <input
                  id="studio-tax-rate"
                  data-testid="studio-tax-rate"
                  name="taxRate"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.001"
                  value={
                    Number.isFinite(Number(settingsDraft.taxRate))
                      ? String(settingsDraft.taxRate)
                      : ""
                  }
                  onChange={event =>
                    updateSettings({
                      taxRate:
                        event.target.value === ""
                          ? Number.NaN
                          : Number(event.target.value),
                    })
                  }
                  required
                />
              </Field>

              <Field
                label="Telefone"
                help="Opcional; usado como contato público nos documentos."
              >
                <input
                  id="studio-phone"
                  data-testid="studio-phone"
                  name="phone"
                  type="tel"
                  value={settingsDraft.phone}
                  onChange={event =>
                    updateSettings({ phone: event.target.value })
                  }
                  autoComplete="tel"
                />
              </Field>

              <Field
                label="E-mail público"
                help="Opcional; aparece como contato nos documentos quando preenchido."
                error={
                  settingsError &&
                  settingsDraft.email &&
                  !validEmail(normalizeEmail(settingsDraft.email))
                    ? settingsError
                    : undefined
                }
              >
                <input
                  id="studio-email"
                  data-testid="studio-email"
                  name="email"
                  type="email"
                  value={settingsDraft.email}
                  onChange={event =>
                    updateSettings({ email: event.target.value })
                  }
                  autoComplete="email"
                />
              </Field>

              <Field label="Endereço" className="field-full">
                <textarea
                  id="studio-address"
                  data-testid="studio-address"
                  name="address"
                  rows={3}
                  value={settingsDraft.address}
                  onChange={event =>
                    updateSettings({ address: event.target.value })
                  }
                  autoComplete="street-address"
                />
              </Field>

              <Field
                label="Rodapé público"
                className="field-full"
                help="Texto exibido em estimativas, invoices e outros documentos públicos."
              >
                <textarea
                  id="studio-public-footer"
                  data-testid="studio-public-footer"
                  name="publicFooter"
                  rows={3}
                  value={settingsDraft.publicFooter}
                  onChange={event =>
                    updateSettings({ publicFooter: event.target.value })
                  }
                />
              </Field>
            </div>

            {settingsError && (
              <p className="error-message" role="alert">
                {settingsError}
              </p>
            )}

            <div className="row wrap">
              <Button
                type="submit"
                variant="primary"
                disabled={savingSettings || ctx.loading}
              >
                {savingSettings ? "Salvando…" : "Salvar configurações"}
              </Button>
            </div>
          </form>
        </div>
      </section>

      <section className="card" aria-labelledby="catalog-heading">
        <div className="card-head split">
          <div>
            <p className="eyebrow">Catálogo</p>
            <h2 id="catalog-heading">Itens e serviços</h2>
            <p className="muted">
              Itens do catálogo podem ser editados ou removidos. Um item
              removido não é recriado nesta tela.
            </p>
          </div>
          <Button
            type="button"
            variant="primary"
            onClick={() =>
              setCatalogDraft(blankCatalogItem(ctx.settings.currency))
            }
          >
            Novo item
          </Button>
        </div>
        <div className="card-body">
          {catalogItems.length === 0 ? (
            <EmptyState
              title="Nenhum item no catálogo"
              description="Cadastre serviços e itens para reutilizá-los em estimativas e invoices."
              action={
                <Button
                  type="button"
                  variant="primary"
                  onClick={() =>
                    setCatalogDraft(blankCatalogItem(ctx.settings.currency))
                  }
                >
                  Cadastrar item
                </Button>
              }
            />
          ) : (
            <div className="table-wrap">
              <table className="data-table" data-testid="catalog-items-table">
                <thead>
                  <tr>
                    <th scope="col">Item</th>
                    <th scope="col">Tipo</th>
                    <th scope="col">Preço unitário</th>
                    <th scope="col">Tributação</th>
                    <th scope="col">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {catalogItems.map(item => (
                    <tr key={item.id} data-testid={`catalog-item-${item.id}`}>
                      <td>
                        <strong>{item.name}</strong>
                        <p className="muted">{item.description}</p>
                      </td>
                      <td>
                        <Badge tone="neutral">
                          {item.kind === "service" ? "Serviço" : "Item"}
                        </Badge>
                      </td>
                      <td>{money(item.unitPrice, item.currency ?? "USD")}</td>
                      <td>
                        {item.taxable ? (
                          <Badge tone="warning">Tributável</Badge>
                        ) : (
                          <span className="muted">Não tributável</span>
                        )}
                      </td>
                      <td>
                        <div className="row wrap">
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setCatalogDraft({ ...item })}
                          >
                            Editar
                          </Button>
                          <ConfirmButton
                            label="Remover"
                            variant="danger"
                            confirmation={`Remover “${item.name}” do catálogo? Esta ação não pode ser desfeita.`}
                            onConfirm={() => removeCatalogItem(item)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="card" aria-labelledby="team-heading">
        <div className="card-head">
          <p className="eyebrow">Equipe</p>
          <h2 id="team-heading">Autorizar acesso ao workspace</h2>
        </div>
        <div className="card-body stack">
          {mode === "demo" ? (
            <p className="muted">
              O modo de demonstração não simula autorização de acesso. Para
              autorizar uma conta, use um workspace Firebase ou o emulador
              autenticado.
            </p>
          ) : !owner ? (
            <p className="muted">
              Sua conta é membro deste workspace. Somente o proprietário pode
              autorizar novos endereços de e-mail.
            </p>
          ) : canAuthorizeTeam ? (
            <form className="stack" onSubmit={authorizeTeamMember} noValidate>
              <Field
                label="E-mail da pessoa a autorizar"
                help="O endereço será normalizado para minúsculas antes de ser autorizado no workspace."
                error={teamError || undefined}
              >
                <input
                  id="team-email"
                  data-testid="team-email"
                  name="teamEmail"
                  type="email"
                  value={teamEmail}
                  onChange={event => setTeamEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </Field>
              {teamError && (
                <p className="error-message" role="alert">
                  {teamError}
                </p>
              )}
              <div className="row wrap">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={authorizingTeam}
                >
                  {authorizingTeam ? "Autorizando…" : "Autorizar e-mail"}
                </Button>
              </div>
            </form>
          ) : (
            <p className="muted">
              A autorização de equipe não está disponível neste ambiente.
            </p>
          )}
        </div>
      </section>

      {catalogDraft && (
        <FormModal
          title={
            data.catalogItems.some(item => item.id === catalogDraft.id)
              ? "Editar item do catálogo"
              : "Novo item do catálogo"
          }
          onClose={() => setCatalogDraft(null)}
          onSubmit={saveCatalogItem}
          submitLabel="Salvar item"
        >
          <div className="form-grid">
            <Field label="Nome" className="field-full">
              <input
                id="catalog-name"
                data-testid="catalog-name"
                name="catalogName"
                value={catalogDraft.name}
                onChange={event => updateCatalog({ name: event.target.value })}
                required
                autoFocus
              />
            </Field>

            <Field label="Descrição" className="field-full">
              <textarea
                id="catalog-description"
                data-testid="catalog-description"
                name="catalogDescription"
                rows={3}
                value={catalogDraft.description}
                onChange={event =>
                  updateCatalog({ description: event.target.value })
                }
                required
              />
            </Field>

            <Field label="Tipo">
              <select
                id="catalog-kind"
                data-testid="catalog-kind"
                name="catalogKind"
                value={catalogDraft.kind}
                onChange={event =>
                  updateCatalog({
                    kind: event.target.value as CatalogItem["kind"],
                  })
                }
              >
                <option value="service">Serviço</option>
                <option value="item">Item</option>
              </select>
            </Field>

            <Field
              label="Preço unitário"
              help={`Moeda deste item: ${catalogDraft.currency ?? "USD"}. A troca da moeda do estúdio não converte o valor deste item.`}
            >
              <input
                id="catalog-unit-price"
                data-testid="catalog-unit-price"
                name="catalogUnitPrice"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={
                  Number.isFinite(Number(catalogDraft.unitPrice))
                    ? String(catalogDraft.unitPrice)
                    : ""
                }
                onChange={event =>
                  updateCatalog({
                    unitPrice:
                      event.target.value === ""
                        ? Number.NaN
                        : Number(event.target.value),
                  })
                }
                required
              />
            </Field>

            <Field
              label="Tributação"
              className="field-full"
              help="Marque quando este item deve receber a taxa padrão nos documentos."
            >
              <span className="row">
                <input
                  id="catalog-taxable"
                  data-testid="catalog-taxable"
                  name="catalogTaxable"
                  type="checkbox"
                  checked={catalogDraft.taxable}
                  onChange={event =>
                    updateCatalog({ taxable: event.target.checked })
                  }
                />
                Item tributável
              </span>
            </Field>
          </div>
        </FormModal>
      )}
    </div>
  );
}
