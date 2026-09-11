import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { Eye, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import Home from "./pages/Home";
import { auth, prepareWorkspace } from "./lib/firebase";

function Login({ onPreview }: { onPreview: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch {
      setError("E-mail ou senha não reconhecidos. Verifique os dados e tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-brand">
        <div className="login-mark">R</div>
        <p className="eyebrow">Reverse engineering system</p>
        <h1>Do objeto físico à peça possível.</h1>
        <p>Centro privado de engenharia, fabricação e operação da Reverso Works.</p>
        <div className="login-ambient"><span /><span /><span /></div>
      </section>
      <section className="login-panel-wrap">
        <form className="login-panel" onSubmit={handleLogin}>
          <div className="login-panel-heading"><div className="secure-icon"><ShieldCheck size={23} /></div><div><p className="eyebrow">Acesso restrito</p><h2>Entrar no espaço</h2></div></div>
          <p>Use sua conta Firebase autorizada para continuar.</p>
          {error && <div className="login-error">{error}</div>}
          <label className="field-stack"><span>E-mail</span><div className="input-icon"><Mail size={16} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="seu@email.com" autoComplete="email" required /></div></label>
          <label className="field-stack"><span>Senha</span><div className="input-icon"><LockKeyhole size={16} /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" autoComplete="current-password" required /></div></label>
          <button className="button button-primary login-submit" type="submit" disabled={busy}>{busy ? "Entrando…" : "Entrar no espaço"}</button>
          <button type="button" className="preview-link" onClick={onPreview}><Eye size={16} /> Ver prévia da interface</button>
        </form>
      </section>
    </main>
  );
}

function OpeningWorkspace() {
  return <main className="opening-page"><div className="opening-orb" /><p className="eyebrow">Reverso Works</p><h1>Abrindo seu espaço…</h1><p>Validando acesso e conectando a operação privada.</p></main>;
}

function AccessError({ message, onSignOut }: { message: string; onSignOut: () => void }) {
  return <main className="opening-page"><div className="secure-icon error-orb"><LockKeyhole size={25} /></div><p className="eyebrow">Acesso privado</p><h1>Não foi possível abrir o espaço</h1><p>{message}</p><button type="button" className="button button-primary" onClick={onSignOut}>Voltar ao login</button></main>;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [opening, setOpening] = useState(true);
  const [workspaceError, setWorkspaceError] = useState("");
  const [preview, setPreview] = useState(
    () => new URLSearchParams(window.location.search).get("preview") === "1",
  );

  useEffect(() => onAuthStateChanged(auth, async (nextUser) => {
    setUser(nextUser);
    setWorkspaceError("");
    if (!nextUser) {
      setOpening(false);
      return;
    }
    setOpening(true);
    try {
      await prepareWorkspace(nextUser);
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Confira a conexão e as regras do Firestore.");
    } finally {
      setOpening(false);
    }
  }), []);

  if (preview) return <Home user={null} preview onExit={() => setPreview(false)} />;
  if (opening) return <OpeningWorkspace />;
  if (workspaceError) return <AccessError message={workspaceError} onSignOut={() => void signOut(auth)} />;
  if (!user) return <Login onPreview={() => setPreview(true)} />;
  return <Home user={user} preview={false} onExit={() => undefined} />;
}
