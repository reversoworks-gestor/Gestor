import { AlertTriangle, RotateCcw, House } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Falha de interface do Gestor", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <main className="app-error-page">
        <section
          className="card card-body app-error-panel"
          aria-labelledby="app-error-heading"
        >
          <AlertTriangle
            size={32}
            aria-hidden="true"
            className="app-error-icon"
          />
          <p className="eyebrow">Reverso Gestor</p>
          <h1 id="app-error-heading">Não foi possível abrir esta página.</h1>
          <p className="muted" role="alert">
            Ocorreu uma falha na interface. Tente recarregar ou volte à visão
            geral.
          </p>
          <p className="helper">
            Recarregar descarta alterações ainda não salvas, mas não apaga seus
            registros salvos.
          </p>
          <div className="stack">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => window.location.reload()}
            >
              <RotateCcw size={18} aria-hidden="true" /> Recarregar página
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                const url = new URL(window.location.href);
                url.searchParams.delete("view");
                window.location.assign(url.href);
              }}
            >
              <House size={18} aria-hidden="true" /> Voltar à visão geral
            </button>
          </div>
        </section>
      </main>
    );
  }
}
export default ErrorBoundary;
