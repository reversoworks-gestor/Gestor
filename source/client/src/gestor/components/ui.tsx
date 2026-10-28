import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
  type InputHTMLAttributes,
  type ChangeEvent,
} from "react";
import { createPortal } from "react-dom";
import { X, AlertCircle, Loader2, CalendarDays } from "lucide-react";
import { useGestor, useOptionalGestor } from "../store";
import { isRealDate } from "../domain";

export function Button({
  variant = "secondary",
  className = "",
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const context = useOptionalGestor();
  const plain = (node: ReactNode): string =>
    Children.toArray(node)
      .map(child =>
        typeof child === "string"
          ? child
          : isValidElement<{ children?: ReactNode }>(child)
            ? plain(child.props.children)
            : ""
      )
      .join(" ");
  const restricted =
    context &&
    context.mode !== "demo" &&
    !context.owner &&
    /^(Novo|Nova|Criar|Cadastrar|Salvar|Registrar|Enviar|Autorizar|Excluir|Remover|Confirmar|Converter|Marcar|Repor|Consumir|Adicionar|Iniciar avaliação|Aprovar)/i.test(
      plain(children).trim()
    );
  return (
    <button
      type="button"
      {...props}
      disabled={disabled || Boolean(restricted)}
      className={`btn btn-${variant} ${className}`}
    >
      {children}
    </button>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "gold" | "success" | "warning" | "danger" | "neutral";
}) {
  return <span className={`status status-${tone}`}>{children}</span>;
}
export function Field({
  label,
  children,
  help,
  error,
  className = "",
}: {
  label: string;
  children: ReactNode;
  help?: string;
  error?: string;
  className?: string;
}) {
  const id = useId(),
    helpId = `${id}-help`,
    errorId = `${id}-error`;
  const items = Children.toArray(children);
  const direct =
    items.length === 1 &&
    isValidElement(items[0]) &&
    (["input", "select", "textarea"].includes(String(items[0].type)) ||
      items[0].type === DateInput);
  if (direct) {
    const child = items[0] as React.ReactElement<any>;
    const controlId = child.props.id || id;
    return (
      <div className={`field ${className}`}>
        <label className="field-label" htmlFor={controlId}>
          {label}
        </label>
        {cloneElement(child, {
          id: controlId,
          "aria-label":
            child.props["aria-label"] ||
            (child.type === DateInput ? label : undefined),
          "aria-describedby":
            [
              child.props["aria-describedby"],
              help ? helpId : "",
              error ? errorId : "",
            ]
              .filter(Boolean)
              .join(" ") || undefined,
          "aria-invalid": error ? true : child.props["aria-invalid"],
        })}
        {help && (
          <small id={helpId} className="helper">
            {help}
          </small>
        )}
        {error && (
          <span id={errorId} role="alert" className="error-message">
            {error}
          </span>
        )}
      </div>
    );
  }
  return (
    <div className={`field ${className}`} role="group" aria-labelledby={id}>
      <span id={id} className="field-label">
        {label}
      </span>
      {children}
      {help && <small className="helper">{help}</small>}
      {error && (
        <span role="alert" className="error-message">
          {error}
        </span>
      )}
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {action && <div className="page-heading-action">{action}</div>}
    </header>
  );
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      {description && <p className="muted">{description}</p>}
      {action}
    </div>
  );
}
let modalLocks = 0;
let unlockedOverflow = "";
let unlockedInert = false;
let lockedRoot: HTMLElement | null = null;
const focusable =
  'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
export function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    if (modalLocks === 0) {
      unlockedOverflow = document.body.style.overflow;
      lockedRoot = document.getElementById("root");
      unlockedInert = lockedRoot?.inert ?? false;
    }
    modalLocks += 1;
    document.body.style.overflow = "hidden";
    if (lockedRoot) lockedRoot.inert = true;
    const isTop = () =>
      Array.from(document.querySelectorAll('[role="dialog"]')).at(-1) ===
      panel.current;
    const timer = requestAnimationFrame(() => {
      if (isTop())
        (
          panel.current?.querySelector<HTMLElement>(focusable) || panel.current
        )?.focus();
    });
    const key = (event: KeyboardEvent) => {
      if (!isTop()) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const elements = Array.from(
        panel.current?.querySelectorAll<HTMLElement>(focusable) || []
      ).filter(e => e.getClientRects().length > 0 && e.tabIndex >= 0);
      if (!elements.length) {
        event.preventDefault();
        panel.current?.focus();
        return;
      }
      const first = elements[0],
        last = elements[elements.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !panel.current?.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !panel.current?.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    const contain = (event: FocusEvent) => {
      if (
        isTop() &&
        panel.current &&
        !panel.current.contains(event.target as Node)
      ) {
        (
          panel.current.querySelector<HTMLElement>(focusable) || panel.current
        ).focus();
      }
    };
    document.addEventListener("keydown", key, true);
    document.addEventListener("focusin", contain);
    return () => {
      cancelAnimationFrame(timer);
      document.removeEventListener("keydown", key, true);
      document.removeEventListener("focusin", contain);
      modalLocks = Math.max(0, modalLocks - 1);
      if (modalLocks === 0) {
        document.body.style.overflow = unlockedOverflow;
        if (lockedRoot) lockedRoot.inert = unlockedInert;
        lockedRoot = null;
      }
      const remaining = Array.from(
        document.querySelectorAll("[role=dialog]")
      ).at(-1);
      if (previous?.isConnected && (!remaining || remaining.contains(previous)))
        previous.focus();
    };
  }, []);
  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={panel}
        tabIndex={-1}
      >
        <header className="modal-header">
          <div>
            <p className="eyebrow">Reverso Gestor</p>
            <h2 id={titleId}>{title}</h2>
          </div>
          <Button variant="ghost" aria-label="Fechar" onClick={onClose}>
            <X size={20} />
          </Button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </div>,
    document.body
  );
}
/** ISO text is keyboard/paste accessible; selection uses stable DOM instead of an opaque native popup. */
export function DateInput({
  type: ignoredType,
  value,
  onChange,
  disabled,
  min,
  max,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(2026),
    [month, setMonth] = useState(1),
    [day, setDay] = useState(1);
  const inputRef = useRef<HTMLInputElement>(null);
  const current = String(value ?? "");
  const invalid = Boolean(
    current &&
      (!isRealDate(current) ||
        (min && current < String(min)) ||
        (max && current > String(max)))
  );
  useEffect(() => {
    inputRef.current?.setCustomValidity(
      invalid
        ? "Informe uma data real entre 1900 e 2100, dentro do período permitido."
        : ""
    );
  }, [current, invalid]);
  const totalDays = new Date(year, month, 0).getDate();
  const chosen = `${year}-${String(month).padStart(2, "0")}-${String(Math.min(day, totalDays)).padStart(2, "0")}`;
  const outside =
    (min && chosen < String(min)) || (max && chosen > String(max));
  const emit = (next: string) =>
    onChange?.({
      target: { value: next },
      currentTarget: { value: next },
    } as ChangeEvent<HTMLInputElement>);
  function show() {
    const date = isRealDate(current)
      ? new Date(`${current}T12:00:00`)
      : new Date();
    setYear(date.getFullYear());
    setMonth(date.getMonth() + 1);
    setDay(date.getDate());
    setOpen(true);
  }
  return (
    <>
      <div className="date-input">
        <input
          {...props}
          ref={inputRef}
          aria-invalid={invalid || props["aria-invalid"]}
          type="text"
          inputMode="numeric"
          placeholder="AAAA-MM-DD"
          pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}"
          value={current}
          disabled={disabled}
          onChange={event => onChange?.(event)}
        />
        <Button
          variant="secondary"
          disabled={disabled}
          aria-label={`Escolher data${props["aria-label"] ? ` · ${props["aria-label"]}` : ""}`}
          onClick={show}
        >
          <CalendarDays size={17} />
        </Button>
      </div>
      {invalid && (
        <span className="error-message" role="alert">
          Informe uma data real entre 1900 e 2100, dentro do período permitido.
        </span>
      )}
      {open && (
        <Modal
          title="Escolher data"
          onClose={() => setOpen(false)}
          footer={
            <>
              <Button onClick={() => setOpen(false)}>Cancelar</Button>
              <Button
                variant="primary"
                disabled={Boolean(outside)}
                onClick={() => {
                  emit(chosen);
                  setOpen(false);
                }}
              >
                Aplicar data
              </Button>
            </>
          }
        >
          <div className="stack">
            <p className="helper">
              Selecione uma data real ou digite AAAA-MM-DD no campo. O período
              permitido é de 1900 a 2100.
            </p>
            <div className="form-grid">
              <Field label="Ano">
                <select
                  value={year}
                  onChange={event => setYear(Number(event.target.value))}
                >
                  {Array.from({ length: 201 }, (_, i) => 1900 + i).map(y => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Mês">
                <select
                  value={month}
                  onChange={event => setMonth(Number(event.target.value))}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>
                      {new Intl.DateTimeFormat("pt-BR", {
                        month: "long",
                      }).format(new Date(2026, m - 1, 1))}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Dia">
                <select
                  value={Math.min(day, totalDays)}
                  onChange={event => setDay(Number(event.target.value))}
                >
                  {Array.from({ length: totalDays }, (_, i) => i + 1).map(d => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <p className="mono">{chosen}</p>
            {outside && (
              <p className="error-message" role="alert">
                Escolha uma data entre {String(min ?? "1900-01-01")} e{" "}
                {String(max ?? "2100-12-31")}.
              </p>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
export function FormModal({
  title,
  onClose,
  onSubmit,
  children,
  submitLabel = "Salvar",
}: {
  title: string;
  onClose: () => void;
  onSubmit: () => Promise<void>;
  children: ReactNode;
  submitLabel?: string;
}) {
  const context = useOptionalGestor();
  const readOnly = Boolean(
    context && context.mode !== "demo" && !context.owner
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const formId = useId();
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (event.target !== event.currentTarget || busy) return;
    setError("");
    setBusy(true);
    try {
      await onSubmit();
      onClose();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível salvar. Tente novamente."
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={title}
      onClose={() => {
        if (!busy) onClose();
      }}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} variant="primary" disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="spin" size={16} /> Salvando…
              </>
            ) : (
              submitLabel
            )}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="stack" aria-busy={busy}>
        {error && (
          <div className="error-message" role="alert">
            <AlertCircle size={18} />
            {error}
          </div>
        )}
        {readOnly && (
          <p className="helper">
            Acesso consultivo. Alterações são reservadas ao responsável pelo
            workspace.
          </p>
        )}
        <fieldset
          disabled={readOnly}
          className="stack"
          style={{ border: 0, padding: 0, margin: 0 }}
        >
          {children}
        </fieldset>
      </form>
    </Modal>
  );
}
export function useAction() {
  const { notify } = useGestor();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return {
    busy,
    error,
    run: async (operation: () => Promise<unknown>, success?: string) => {
      if (busy) return;
      setBusy(true);
      setError("");
      try {
        await operation();
        if (success) notify(success, "success");
      } catch (e) {
        const text =
          e instanceof Error
            ? e.message
            : "Não foi possível concluir. Tente novamente.";
        setError(text);
        notify(text, "error");
      } finally {
        setBusy(false);
      }
    },
  };
}
export function ConfirmButton({
  label,
  confirmation,
  onConfirm,
  variant = "danger",
}: {
  label: string;
  confirmation: string;
  onConfirm: () => Promise<void>;
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        {label}
      </Button>
      {open && (
        <FormModal
          title="Confirmar ação"
          onClose={() => setOpen(false)}
          onSubmit={onConfirm}
          submitLabel="Confirmar"
        >
          <p>{confirmation}</p>
        </FormModal>
      )}
    </>
  );
}
