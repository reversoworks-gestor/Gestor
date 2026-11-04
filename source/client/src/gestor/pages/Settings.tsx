import { useEffect, useMemo, useState, type FormEvent } from "react";
import { addWorkspaceEmail } from "../../lib/firebase";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  PageHeading,
} from "../components/ui";
import {
  findService,
  officialServices,
  serviceCategories,
  type OfficialService,
  type ServiceCategory,
} from "../serviceCatalog";
import { useGestor } from "../store";
import { type Settings } from "../types";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const categories = Object.keys(serviceCategories) as ServiceCategory[];
const serviceTypes: OfficialService["type"][] = [
  "Principal",
  "Add-on",
  "Principal B2B",
  "Pacote",
];

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function validEmail(value: string) {
  return emailPattern.test(value);
}

function serviceReference(code: string) {
  const service = findService(code);
  return service ? `${code} — ${service.name}` : code;
}

function serviceCategoryNames(service: OfficialService) {
  if (service.category) return serviceCategories[service.category];
  const codes = [...service.components, ...(service.alternatives ?? [])];
  const involved = categories.filter(category =>
    codes.some(code => findService(code)?.category === category)
  );
  return `Conforme composição: ${involved.map(category => serviceCategories[category]).join(" · ")}`;
}

export default function SettingsPage() {
  const ctx = useGestor();
  const { mode, owner, settings } = ctx;
  const [settingsDraft, setSettingsDraft] = useState<Settings>(settings);
  const [settingsError, setSettingsError] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<ServiceCategory | "">(
    ""
  );
  const [typeFilter, setTypeFilter] = useState<OfficialService["type"] | "">(
    ""
  );
  const [teamEmail, setTeamEmail] = useState("");
  const [teamError, setTeamError] = useState("");
  const [authorizingTeam, setAuthorizingTeam] = useState(false);

  useEffect(() => {
    setSettingsDraft(settings);
  }, [settings]);

  const catalogItems = useMemo(() => {
    const query = catalogSearch.trim().toLocaleLowerCase();
    return officialServices.filter(service => {
      const matchesCategory =
        !categoryFilter ||
        service.category === categoryFilter ||
        (service.type === "Pacote" &&
          [...service.components, ...(service.alternatives ?? [])].some(
            code => findService(code)?.category === categoryFilter
          ));
      const text = [
        service.code,
        service.name,
        service.description,
        serviceCategoryNames(service),
        service.type,
        ...service.prerequisites,
        ...service.components,
        ...(service.alternatives ?? []),
      ]
        .join(" ")
        .toLocaleLowerCase();
      return (
        matchesCategory &&
        (!typeFilter || service.type === typeFilter) &&
        (!query || text.includes(query))
      );
    });
  }, [catalogSearch, categoryFilter, typeFilter]);

  const canAuthorizeTeam =
    owner && (mode === "firebase" || mode === "emulator");

  function updateSettings(patch: Partial<Settings>) {
    setSettingsDraft(current => ({ ...current, ...patch }));
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
        description="Defina a identidade do workspace, consulte o catálogo oficial e controle o acesso da equipe."
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
            <p className="eyebrow">Catálogo oficial · 04/11/2026</p>
            <h2 id="catalog-heading">Serviços por avaliação</h2>
            <p className="muted">
              4 categorias · 18 serviços · 3 pacotes · 21 itens oficiais.
            </p>
          </div>
          <Badge tone="neutral">Somente leitura</Badge>
        </div>
        <div className="card-body stack">
          <p className="helper">
            Todos os preços permanecem nulos: “por avaliação” significa que o
            valor e o prazo são definidos manualmente no orçamento, após avaliar
            o veículo, o problema e o escopo. Não há tabela fixa, valor sugerido
            ou preço zero. Códigos, nomes e descrições são oficiais e não podem
            ser alterados nesta tela.
          </p>
          <div className="form-grid">
            <Field label="Pesquisar catálogo" className="field-full">
              <input
                id="catalog-search"
                data-testid="catalog-search"
                type="search"
                value={catalogSearch}
                onChange={event => setCatalogSearch(event.target.value)}
                placeholder="Código, nome, descrição ou composição"
              />
            </Field>
            <Field
              label="Categoria"
              help="Pacotes aparecem nas categorias dos serviços que compõem; não são uma quinta categoria."
            >
              <select
                id="catalog-category"
                data-testid="catalog-category"
                value={categoryFilter}
                onChange={event =>
                  setCategoryFilter(event.target.value as ServiceCategory | "")
                }
              >
                <option value="">Todas as 4 categorias</option>
                {categories.map(category => (
                  <option key={category} value={category}>
                    {category} — {serviceCategories[category]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tipo">
              <select
                id="catalog-type"
                data-testid="catalog-type"
                value={typeFilter}
                onChange={event =>
                  setTypeFilter(
                    event.target.value as OfficialService["type"] | ""
                  )
                }
              >
                <option value="">Todos os tipos</option>
                {serviceTypes.map(type => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <p className="muted" role="status" aria-live="polite">
            {catalogItems.length} de {officialServices.length} itens oficiais
          </p>
          {catalogItems.length ? (
            <div className="grid grid-2" data-testid="catalog-items">
              {catalogItems.map(service => (
                <article
                  key={service.code}
                  className="card card-body stack"
                  data-testid={`catalog-item-${service.code}`}
                  aria-labelledby={`service-${service.code}`}
                  style={{ minWidth: 0, overflowWrap: "anywhere" }}
                >
                  <div className="row wrap">
                    <span className="mono">{service.code}</span>
                    <Badge tone="neutral">{service.type}</Badge>
                    <Badge tone="success">
                      {service.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <h3 id={`service-${service.code}`}>{service.name}</h3>
                  <p className="muted">{service.description}</p>
                  <p className="helper">
                    <strong>Categoria:</strong> {serviceCategoryNames(service)}
                  </p>
                  <p>
                    <strong>Preço:</strong> Por avaliação{" "}
                    <span className="muted">— não definido</span>
                  </p>
                  {service.type !== "Pacote" && (
                    <p className="helper">
                      <strong>Pré-requisito:</strong>{" "}
                      {service.prerequisites.length
                        ? `${service.prerequisites.map(serviceReference).join(" OU ")}. Pelo menos um deve integrar o mesmo job antes deste add-on.`
                        : "Nenhum."}
                    </p>
                  )}
                  {service.type === "Pacote" && (
                    <div className="stack">
                      {Boolean(service.alternatives?.length) && (
                        <p className="helper">
                          <strong>Escolha obrigatória:</strong>{" "}
                          {service.alternatives
                            ?.map(serviceReference)
                            .join(" OU ")}{" "}
                          — escolher uma alternativa, não ambas.
                        </p>
                      )}
                      <p className="helper">
                        <strong>
                          Composição
                          {service.alternatives?.length ? " adicional" : ""}:
                        </strong>{" "}
                        {service.components.map(serviceReference).join(" + ")}
                      </p>
                      <p className="helper">
                        Nome comercial: o orçamento lança os códigos
                        individuais, não o pacote como serviço executável
                        separado.
                      </p>
                      <p className="helper">
                        <strong>Execução:</strong>{" "}
                        {service.code === "PCT-01"
                          ? "FAR → DET (correção e trim) → proteções FAR-02 e DET-04 por último."
                          : service.code === "PCT-02"
                            ? "PDR sempre primeiro; DET depois. Nunca inverter."
                            : "Processo P3D completo; fit test aprovado antes da impressão final."}
                      </p>
                    </div>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Nenhum serviço encontrado"
              description="Ajuste a pesquisa, categoria ou tipo. O catálogo oficial não permite criar itens livres."
              action={
                <Button
                  onClick={() => {
                    setCatalogSearch("");
                    setCategoryFilter("");
                    setTypeFilter("");
                  }}
                >
                  Limpar filtros
                </Button>
              }
            />
          )}
          <p className="helper">
            PPF, pintura completa, mecânica e eletrônica automotiva não integram
            o catálogo. Registros históricos são preservados; esta consulta não
            altera nem exclui dados antigos.
          </p>
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
    </div>
  );
}
