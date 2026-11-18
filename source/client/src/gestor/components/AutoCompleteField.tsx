import { useEffect, useId, useRef, useState } from "react";

export type AutoCompleteOption = {
  id: string;
  label: string;
  detail?: string;
};

const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();

const matches = (option: AutoCompleteOption, query: string) => {
  const terms = fold(query).split(/\s+/).filter(Boolean);
  const text = fold(`${option.label} ${option.detail ?? ""}`);
  return terms.every(term => text.includes(term));
};

/**
 * Free-text field with suggestions. Typing filters existing records; choosing a
 * suggestion (or typing an exact match) selects it. When the text matches nothing
 * the parent is asked what to do (`onUnmatched`), e.g. offer to create the record.
 */
export function AutoCompleteField({
  value,
  selectedId,
  options,
  placeholder,
  disabled,
  required,
  onTextChange,
  onSelect,
  onUnmatched,
}: {
  value: string;
  selectedId: string;
  options: AutoCompleteOption[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  onTextChange: (text: string) => void;
  onSelect: (option: AutoCompleteOption) => void;
  onUnmatched: (text: string) => void;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const skipBlur = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const query = value.trim();
  const list = (query ? options.filter(o => matches(o, query)) : options).slice(
    0,
    8
  );
  const prefix = query
    ? list.find(o => fold(o.label).startsWith(fold(query)))
    : undefined;
  const selected = options.find(o => o.id === selectedId);
  const settled = Boolean(selected && fold(selected.label) === fold(value));

  function choose(option: AutoCompleteOption) {
    skipBlur.current = false;
    onSelect(option);
    setOpen(false);
  }

  function commit() {
    if (!query || settled) return;
    const exact = options.filter(o => fold(o.label) === fold(query));
    if (exact.length === 1) return choose(exact[0]);
    if (list.length === 1 && fold(list[0].label).startsWith(fold(query)))
      return choose(list[0]);
    setOpen(false);
    onUnmatched(query);
  }

  return (
    <div className="combo">
      <input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        required={required}
        disabled={disabled}
        value={value}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={event => {
          onTextChange(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onBlur={() => {
          timer.current = window.setTimeout(() => {
            if (skipBlur.current) {
              skipBlur.current = false;
              return;
            }
            setOpen(false);
            commit();
          }, 120);
        }}
        onKeyDown={event => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setActive(index => Math.min(index + 1, list.length - 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive(index => Math.max(index - 1, 0));
          } else if (event.key === "Enter" || event.key === "Tab") {
            if (open && list.length && query && !settled) {
              if (event.key === "Enter") event.preventDefault();
              choose(list[Math.min(active, list.length - 1)]);
            } else if (event.key === "Enter" && query && !settled) {
              event.preventDefault();
              commit();
            }
          } else if (event.key === "Escape" && open) {
            event.stopPropagation();
            setOpen(false);
          }
        }}
      />
      {open && !settled && list.length > 0 && (
        <ul className="combo-list" id={listId} role="listbox">
          {list.map((option, index) => (
            <li key={option.id} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={index === active}
                onMouseDown={event => {
                  event.preventDefault();
                  skipBlur.current = true;
                }}
                onClick={() => choose(option)}
              >
                <span>{option.label}</span>
                {option.detail && <small>{option.detail}</small>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && !settled && prefix && query.length > 0 && (
        <span className="combo-ghost">
          Sugestão: {prefix.label} · toque ou Enter para aceitar
        </span>
      )}
    </div>
  );
}
