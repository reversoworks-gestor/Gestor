import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Boxes,
  CalendarDays,
  CarFront,
  ChevronDown,
  ClipboardList,
  Component,
  FileText,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  MoreHorizontal,
  Printer,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  UsersRound,
  WalletCards,
  Workflow,
  X,
} from "lucide-react";
import { useGestor } from "../store";
import type { StudioView } from "../types";
import { Button, Field, Modal, EmptyState } from "./ui";
const navigation = [
  {
    label: "Operação",
    items: [
      { view: "overview", label: "Visão geral", icon: LayoutDashboard },
      { view: "clients", label: "Clientes", icon: UsersRound },
      { view: "vehicles", label: "Veículos", icon: CarFront },
      { view: "triage", label: "Avaliações", icon: ClipboardList },
      { view: "calendar", label: "Agenda", icon: CalendarDays },
    ],
  },
  {
    label: "Comercial",
    items: [
      { view: "estimates", label: "Estimativas", icon: FileText },
      { view: "invoices", label: "Invoices", icon: ReceiptText },
      { view: "orders", label: "Pedidos", icon: ClipboardList },
      { view: "production", label: "Produção", icon: Workflow },
    ],
  },
  {
    label: "Oficina",
    items: [
      { view: "inventory", label: "Estoque", icon: Boxes },
      { view: "printers", label: "Impressoras", icon: Printer },
      { view: "parts", label: "Peças e revisões", icon: Component },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { view: "finance", label: "Financeiro", icon: Landmark },
      { view: "expenses", label: "Despesas", icon: WalletCards },
    ],
  },
  {
    label: "Sistema",
    items: [
      { view: "more", label: "Mais recursos", icon: MoreHorizontal },
      { view: "settings", label: "Ajustes", icon: Settings },
    ],
  },
];
const nameFor = (view: string) =>
  navigation.flatMap(g => g.items).find(i => i.view === view)?.label ??
  "Gestor";
export default function Shell({
  children,
  onSignOut,
}: {
  children: ReactNode;
  onSignOut?: () => void | Promise<void>;
}) {
  const {
    data,
    mode,
    navigate,
    owner,
    search,
    setSearch,
    userName,
    view,
    notify,
  } = useGestor();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false),
    [profileOpen, setProfileOpen] = useState(false),
    [searchOpen, setSearchOpen] = useState(false);
  const [desktop, setDesktop] = useState(
    () => matchMedia("(min-width:900px) and (min-height:600px)").matches
  );
  const sidebar = useRef<HTMLElement>(null),
    frame = useRef<HTMLDivElement>(null),
    menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const query = matchMedia("(min-width:900px) and (min-height:600px)");
    const change = () => {
      setDesktop(query.matches);
      if (query.matches) setMobileMenuOpen(false);
    };
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    if (!mobileMenuOpen || desktop) return;
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (frame.current) frame.current.inert = true;
    sidebar.current?.querySelector<HTMLElement>("button")?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileMenuOpen(false);
      }
      if (event.key === "Tab") {
        const controls = Array.from(
          sidebar.current?.querySelectorAll<HTMLElement>(
            "button:not([disabled]),a[href]"
          ) ?? []
        );
        const first = controls[0],
          last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("keydown", key, true);
      document.body.style.overflow = previousOverflow;
      if (frame.current) frame.current.inert = false;
      previous?.focus();
    };
  }, [mobileMenuOpen, desktop]);
  useEffect(() => {
    if (!profileOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    menu.current?.querySelector<HTMLElement>("button")?.focus();
    const close = (event: MouseEvent) => {
      if (!menu.current?.contains(event.target as Node)) setProfileOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProfileOpen(false);
        previous?.focus();
      }
      if (["ArrowDown", "ArrowUp"].includes(event.key)) {
        event.preventDefault();
        const items = Array.from(
          menu.current?.querySelectorAll<HTMLElement>("button") ?? []
        );
        const index = items.indexOf(document.activeElement as HTMLElement);
        items[
          (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) %
            items.length
        ]?.focus();
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", key);
    };
  }, [profileOpen]);
  function goTo(next: StudioView) {
    navigate(next);
    setMobileMenuOpen(false);
    setProfileOpen(false);
    setSearchOpen(false);
  }
  const query = search.trim().toLocaleLowerCase();
  const results =
    query.length < 2
      ? []
      : [
          ...data.clients
            .filter(c =>
              `${c.name} ${c.email} ${c.phone}`
                .toLocaleLowerCase()
                .includes(query)
            )
            .map(c => ({
              id: c.id,
              title: c.name,
              detail: "Cliente",
              view: "clients" as StudioView,
            })),
          ...data.vehicles
            .filter(v =>
              `${v.make} ${v.model} ${v.plate}`
                .toLocaleLowerCase()
                .includes(query)
            )
            .map(v => ({
              id: v.id,
              title: `${v.make} ${v.model}`,
              detail: `Veículo · ${v.year} · ${v.plate}`,
              view: "vehicles" as StudioView,
            })),
          ...data.orders
            .filter(o =>
              `${o.title} ${o.clientName} ${o.id}`
                .toLocaleLowerCase()
                .includes(query)
            )
            .map(o => ({
              id: o.id,
              title: o.title,
              detail: `${o.documentType} · ${o.clientName}`,
              view:
                o.documentType === "Invoice"
                  ? "invoices"
                  : ("estimates" as StudioView),
            })),
        ].slice(0, 20);
  const initials = userName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(n => n[0])
    .join("")
    .toUpperCase();
  return (
    <div className="gestor-shell">
      <a className="skip-link" href="#gestor-workspace">
        Pular para o conteúdo
      </a>
      <aside
        className={`gestor-sidebar ${mobileMenuOpen ? "is-open" : ""}`}
        ref={sidebar}
        inert={!desktop && !mobileMenuOpen}
        aria-label="Navegação do Gestor"
      >
        <div className="sidebar-brand">
          <img
            src={`${import.meta.env.BASE_URL}reverso-logo-branca.png`}
            alt="Reverso Works"
          />
          <button
            type="button"
            className="icon-button sidebar-close"
            aria-label="Fechar menu"
            onClick={() => setMobileMenuOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        <p className="sidebar-caption">Gestor · Automotive Studio</p>
        <nav className="sidebar-navigation" aria-label="Navegação principal">
          {navigation.map(group => (
            <section
              className="nav-group"
              key={group.label}
              aria-label={group.label}
            >
              <p className="nav-group-label">{group.label}</p>
              <div className="nav-list">
                {group.items.map(({ view: itemView, label, icon: Icon }) => (
                  <button
                    className={`nav-item ${view === itemView ? "active" : ""}`}
                    key={itemView}
                    type="button"
                    data-view={itemView}
                    aria-current={view === itemView ? "page" : undefined}
                    onClick={() => goTo(itemView as StudioView)}
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </nav>
        <div className="sidebar-status">
          <span className="status status-neutral">
            <ShieldCheck size={12} />
            {mode === "demo"
              ? "Demonstração local"
              : mode === "emulator"
                ? "QA · emulador"
                : "Workspace autenticado"}
          </span>
        </div>
      </aside>
      {mobileMenuOpen && (
        <button
          type="button"
          className="sidebar-scrim"
          tabIndex={-1}
          aria-label="Fechar menu de navegação"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      <div className="gestor-frame" ref={frame}>
        <header className="gestor-topbar">
          <div className="topbar-context">
            <button
              type="button"
              className="icon-button mobile-menu-toggle"
              aria-label="Abrir menu"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu size={21} />
            </button>
            <div className="breadcrumbs">
              <button type="button" onClick={() => goTo("overview")}>
                Reverso Works
              </button>
              <span>/ Gestor</span>
            </div>
            <p className="workspace-title">{nameFor(view)}</p>
          </div>
          <div className="topbar-actions">
            <form
              className="global-search"
              role="search"
              onSubmit={event => {
                event.preventDefault();
                setSearchOpen(true);
              }}
            >
              <label className="sr-only" htmlFor="gestor-global-search">
                Buscar em clientes, veículos e documentos
              </label>
              <input
                id="gestor-global-search"
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar no Gestor"
              />
              <button
                type="submit"
                className="global-search-submit"
                aria-label="Pesquisar no Gestor"
              >
                <Search size={18} aria-hidden="true" />
              </button>
            </form>
            <button
              type="button"
              className="icon-button compact-search-toggle"
              aria-label="Abrir busca global"
              onClick={() => setSearchOpen(true)}
            >
              <Search size={18} />
            </button>
            <div className="profile-wrap">
              <button
                type="button"
                className="profile-trigger"
                aria-label="Abrir perfil"
                aria-expanded={profileOpen}
                aria-haspopup="menu"
                onClick={() => setProfileOpen(v => !v)}
              >
                <span className="avatar" aria-hidden="true">
                  {initials}
                </span>
                <span className="profile-trigger-name">{userName}</span>
                <ChevronDown size={16} />
              </button>
              {profileOpen && (
                <div
                  className="profile-menu"
                  role="menu"
                  aria-label="Menu do perfil"
                  ref={menu}
                >
                  <div className="profile-summary">
                    <div>
                      <strong>{userName}</strong>
                      <span>
                        {owner
                          ? "Responsável pelo espaço"
                          : "Equipe autorizada"}
                      </span>
                    </div>
                  </div>
                  <div className="profile-environment">
                    <ShieldCheck size={16} />
                    <span>
                      {mode === "demo"
                        ? "Dados fictícios neste navegador"
                        : mode === "emulator"
                          ? "QA isolado, sem produção"
                          : "Acesso privado · Firebase"}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="profile-menu-action"
                    role="menuitem"
                    onClick={() => goTo("settings")}
                  >
                    <Settings size={17} />
                    Ajustes
                  </button>
                  {onSignOut && (
                    <button
                      type="button"
                      className="profile-menu-action danger"
                      role="menuitem"
                      onClick={() => {
                        setProfileOpen(false);
                        void Promise.resolve(onSignOut()).catch(() =>
                          notify(
                            "Não foi possível encerrar a sessão. Tente novamente.",
                            "error"
                          )
                        );
                      }}
                    >
                      <LogOut size={17} />
                      {mode === "demo" ? "Voltar ao login" : "Encerrar sessão"}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>
        {mode === "demo" && (
          <div className="environment-strip">
            DEMONSTRAÇÃO · Registros sintéticos, salvos somente neste navegador.
            Nenhum dado de produção é acessado.
          </div>
        )}
        {mode === "emulator" && (
          <div className="environment-strip">
            QA ISOLADO · Firebase Auth, Firestore e Storage em emuladores
            locais.
          </div>
        )}
        <main id="gestor-workspace" className="gestor-workspace" tabIndex={-1}>
          {mode !== "demo" && !owner && (
            <p className="demo-banner">
              Acesso consultivo · somente o responsável pelo workspace altera
              registros e arquivos.
            </p>
          )}
          {children}
        </main>
      </div>
      {searchOpen && (
        <Modal title="Buscar no Gestor" onClose={() => setSearchOpen(false)}>
          <div className="stack">
            <Field label="Buscar em clientes, veículos e documentos">
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Digite ao menos 2 caracteres"
              />
            </Field>
            {results.length ? (
              results.map(result => (
                <Button
                  className="list-row list-row-action"
                  key={`${result.view}-${result.id}`}
                  onClick={() => goTo(result.view)}
                >
                  <span className="list-row-main">
                    <strong>{result.title}</strong>
                    <span>{result.detail}</span>
                  </span>
                </Button>
              ))
            ) : (
              <EmptyState
                title={
                  query.length < 2
                    ? "Digite para pesquisar"
                    : "Nenhum registro encontrado"
                }
                description="Busque por cliente, modelo, placa, título ou identificador."
              />
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
