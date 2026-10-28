import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { auth, prepareWorkspace, USING_EMULATORS } from "./lib/firebase";
import { GestorProvider, useGestor } from "./gestor/store";
import Shell from "./gestor/components/Shell";
import { Button, EmptyState } from "./gestor/components/ui";
import "./gestor/styles.css";

const Dashboard = lazy(() => import("./gestor/pages/Dashboard"));
const Customers = lazy(() => import("./gestor/pages/Customers"));
const Commercial = lazy(() => import("./gestor/pages/Commercial"));
const Production = lazy(() => import("./gestor/pages/Production"));
const Triage = lazy(() => import("./gestor/pages/Triage"));
const Inventory = lazy(() => import("./gestor/pages/Inventory"));
const Printers = lazy(() => import("./gestor/pages/Printers"));
const Parts = lazy(() => import("./gestor/pages/Parts"));
const Calendar = lazy(() => import("./gestor/pages/Calendar"));
const Finance = lazy(() => import("./gestor/pages/Finance"));
const Settings = lazy(() => import("./gestor/pages/Settings"));
function Opening() {
  return (
    <div className="opening-state" role="status">
      <ShieldCheck size={30} />
      <h2>Conectando a operação</h2>
      <p>Validando acesso e sincronizando os registros do estúdio.</p>
    </div>
  );
}
function Pages() {
  const { view, loading, error, retry, navigate } = useGestor();
  if (loading) return <Opening />;
  if (error)
    return (
      <EmptyState
        title="Não foi possível sincronizar"
        description={error}
        action={
          <Button variant="primary" onClick={retry}>
            Tentar novamente
          </Button>
        }
      />
    );
  let page;
  switch (view) {
    case "clients":
    case "vehicles":
      page = <Customers />;
      break;
    case "orders":
    case "estimates":
    case "invoices":
      page = <Commercial />;
      break;
    case "production":
      page = <Production />;
      break;
    case "triage":
      page = <Triage />;
      break;
    case "inventory":
      page = <Inventory />;
      break;
    case "printers":
      page = <Printers />;
      break;
    case "parts":
      page = <Parts />;
      break;
    case "calendar":
      page = <Calendar />;
      break;
    case "finance":
    case "expenses":
      page = <Finance />;
      break;
    case "settings":
      page = <Settings />;
      break;
    case "more":
      page = (
        <>
          <header className="page-heading">
            <div>
              <p className="eyebrow">Operação completa</p>
              <h1>Áreas do estúdio</h1>
              <p className="muted">
                Dados conectados. Cada decisão permanece rastreável.
              </p>
            </div>
          </header>
          <div className="grid grid-3">
            {[
              ["clients", "Clientes"],
              ["vehicles", "Veículos"],
              ["calendar", "Calendário"],
              ["inventory", "Estoque"],
              ["printers", "Impressoras e manutenção"],
              ["parts", "Peças e revisões"],
              ["finance", "Financeiro"],
              ["expenses", "Despesas"],
              ["settings", "Ajustes"],
            ].map(([id, label]) => (
              <Button
                className="area-link"
                key={id}
                onClick={() => navigate(id as any)}
              >
                {label}
                <ArrowRight size={18} />
              </Button>
            ))}
          </div>
        </>
      );
      break;
    default:
      page = <Dashboard />;
  }
  return <Suspense fallback={<Opening />}>{page}</Suspense>;
}
function Login({ onDemo }: { onDemo: () => void }) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function login(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (e) {
      const code = (e as { code?: string }).code;
      setError(
        code?.includes("network")
          ? "Falha de conexão. Confira sua rede e tente novamente."
          : "Não foi possível entrar. Confira e-mail, senha e autorização de acesso."
      );
    } finally {
      setBusy(false);
    }
  }
  async function reset() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Preencha um e-mail válido antes de solicitar recuperação.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setMessage("Se a conta existir, o e-mail de recuperação será enviado.");
    } catch {
      setError("Não foi possível solicitar recuperação. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <section className="login-brand">
        <div className="logo-plate">
          <img
            src={`${import.meta.env.BASE_URL}reverso-logo-branca.png`}
            alt="Reverso Works"
          />
        </div>
        <p className="eyebrow">Automotive Restoration & Engineering Studio</p>
        <h1>
          Restore.
          <br />
          Refine.
          <br />
          <span>Recreate.</span>
        </h1>
        <p>O método vem antes da intervenção.</p>
        <p className="muted">
          Faróis. PDR. Peças e engenharia. Customização técnica.
        </p>
        <div className="login-signature">GESTOR / AUTOMOTIVE EDITION</div>
      </section>
      <section className="login-panel-wrap">
        <form className="login-panel stack" onSubmit={login} aria-busy={busy}>
          <div>
            <p className="eyebrow">
              <LockKeyhole size={14} /> Acesso privado
            </p>
            <h2>Entrar no estúdio</h2>
            <p className="muted">
              Use sua conta autorizada para acessar os registros da operação.
            </p>
          </div>
          {USING_EMULATORS && (
            <div className="demo-banner">
              Ambiente QA · emuladores Firebase · sem dados de produção
            </div>
          )}
          {error && (
            <div className="error-message" role="alert">
              {error}
            </div>
          )}
          {message && <p role="status">{message}</p>}
          <label className="field">
            <span>E-mail</span>
            <input
              type="email"
              name="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="username"
              required
              placeholder="seu@email.com"
            />
          </label>
          <label className="field">
            <span>Senha</span>
            <input
              type="password"
              name="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Conectando…" : "Entrar no Gestor"}
            <ArrowRight size={18} />
          </Button>
          <Button variant="ghost" onClick={() => void reset()} disabled={busy}>
            Recuperar senha
          </Button>
          <div className="divider" />
          <Button onClick={onDemo} disabled={busy}>
            Explorar demonstração
          </Button>
          <small className="muted">
            A demonstração usa dados fictícios e armazenamento neste navegador.
            Não acessa o workspace real.
          </small>
        </form>
      </section>
    </main>
  );
}
export default function App() {
  const [user, setUser] = useState<User | null>(null),
    [opening, setOpening] = useState(true),
    [accessError, setAccessError] = useState("");
  const [demo, setDemo] = useState(
    () => new URLSearchParams(location.search).get("preview") === "1"
  );
  const sequence = useRef(0);
  useEffect(() => {
    if (demo) {
      setOpening(false);
      return;
    }
    return onAuthStateChanged(auth, async next => {
      const id = ++sequence.current;
      setUser(next);
      setAccessError("");
      if (!next) {
        setOpening(false);
        return;
      }
      setOpening(true);
      try {
        await prepareWorkspace(next);
      } catch (e) {
        if (id === sequence.current)
          setAccessError(
            e instanceof Error
              ? e.message
              : "Confira as permissões do workspace."
          );
      } finally {
        if (id === sequence.current) setOpening(false);
      }
    });
  }, [demo]);
  function startDemo() {
    const url = new URL(location.href);
    url.searchParams.set("preview", "1");
    history.replaceState(null, "", url);
    setDemo(true);
  }
  async function exit() {
    if (!demo) await signOut(auth);
    const url = new URL(location.href);
    url.searchParams.delete("preview");
    url.searchParams.delete("view");
    history.replaceState(null, "", url);
    setDemo(false);
    setUser(null);
  }
  if (!demo && opening)
    return (
      <main className="opening-page">
        <Opening />
      </main>
    );
  if (!demo && accessError)
    return (
      <main className="opening-page">
        <h1>Acesso não autorizado</h1>
        <p role="alert">{accessError}</p>
        <Button onClick={() => void exit()}>Voltar ao login</Button>
      </main>
    );
  if (!demo && !user) return <Login onDemo={startDemo} />;
  return (
    <GestorProvider key={demo ? "demo" : user?.uid} user={user} demo={demo}>
      <Shell
        onSignOut={() => {
          void exit().catch(() =>
            setAccessError(
              "Não foi possível encerrar a sessão. Tente novamente."
            )
          );
        }}
      >
        <Pages />
      </Shell>
    </GestorProvider>
  );
}
