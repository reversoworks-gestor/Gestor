import { useMemo, useState } from "react";
import { Copy, MessageCircle } from "lucide-react";
import type { Client } from "../../lib/models";
import { useGestor } from "../store";
import type { Vehicle } from "../types";
import { Button, Field, PageHeading } from "../components/ui";
import {
  fillTemplate,
  messageTemplates,
  whatsappLink,
} from "../messageTemplates";

const firstName = (client?: Client) =>
  (client?.firstName ?? client?.name?.split(" ")[0] ?? "").trim();

export default function Messages() {
  const ctx = useGestor();
  const clients = ctx.data.clients as Client[];
  const vehicles = ctx.data.vehicles as Vehicle[];
  const [templateId, setTemplateId] = useState(messageTemplates[0].id);
  const [clientId, setClientId] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [edited, setEdited] = useState<string | null>(null);

  const template =
    messageTemplates.find(t => t.id === templateId) ?? messageTemplates[0];
  const client = clients.find(c => c.id === clientId);
  const clientVehicles = useMemo(
    () => vehicles.filter(v => v.clientId === clientId),
    [vehicles, clientId]
  );
  const merged = {
    name: firstName(client),
    ...values,
  };
  const generated = fillTemplate(template.body, merged);
  const text = edited ?? generated;
  const setValue = (key: string, value: string) => {
    setEdited(null);
    setValues(current => ({ ...current, [key]: value }));
  };
  const link = client?.phone ? whatsappLink(client.phone, text) : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      ctx.notify("Mensagem copiada.", "success");
    } catch {
      ctx.notify("Não foi possível copiar. Selecione o texto e copie.", "error");
    }
  }

  const input = (key: string, label: string, placeholder = "") => (
    <Field label={label}>
      <input
        value={values[key] ?? (key === "name" ? firstName(client) : "")}
        placeholder={placeholder}
        onChange={event => setValue(key, event.target.value)}
      />
    </Field>
  );

  return (
    <div className="stack">
      <PageHeading
        eyebrow="Atendimento"
        title="Mensagens"
        description="Modelos em inglês para os clientes. Campos entre [colchetes] ficam à vista até você preencher."
      />
      <section className="card" aria-label="Montar mensagem">
        <div className="card-body stack">
        <div className="form-grid">
          <Field label="Modelo">
            <select
              value={templateId}
              onChange={event => {
                setTemplateId(event.target.value);
                setEdited(null);
              }}
            >
              {messageTemplates.map(t => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Cliente">
            <select
              value={clientId}
              onChange={event => {
                setClientId(event.target.value);
                setValues(current => ({ ...current, name: "", vehicle: "" }));
                setEdited(null);
              }}
            >
              <option value="">Selecionar cliente</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          {input("name", "Nome (como chamar)", "Primeiro nome")}
          <Field label="Veículo">
            <input
              list="message-vehicles"
              value={values.vehicle ?? ""}
              placeholder="Ex.: 2021 Toyota 4Runner"
              onChange={event => setValue("vehicle", event.target.value)}
            />
            <datalist id="message-vehicles">
              {clientVehicles.map(v => (
                <option
                  key={v.id}
                  value={`${v.year} ${v.make} ${v.model}`.trim()}
                />
              ))}
            </datalist>
          </Field>
          {input("service", "Serviço", "Ex.: Paintless Dent Removal")}
          {input("day", "Dia", "Ex.: tomorrow, Friday")}
          {input("time", "Hora", "Ex.: 10 AM")}
          {input("min", "Faixa de preço: mínimo")}
          {input("max", "Faixa de preço: máximo")}
          {input("reviewLink", "Link de avaliação do Google", "https://...")}
          {input("care", "Cuidados / observação")}
        </div>
      </div>
      </section>
      <section className="card" aria-label="Mensagem pronta">
        <div className="card-body stack">
        <Field label="Mensagem pronta (você pode editar antes de copiar)">
          <textarea
            rows={9}
            value={text}
            onChange={event => setEdited(event.target.value)}
          />
        </Field>
        <div className="page-heading-action">
          <Button variant="primary" onClick={copy}>
            <Copy size={16} aria-hidden="true" /> Copiar
          </Button>
          {link ? (
            <a className="btn btn-secondary" href={link} target="_blank" rel="noopener noreferrer">
              <MessageCircle size={16} aria-hidden="true" /> WhatsApp
            </a>
          ) : (
            <span className="muted">
              Escolha um cliente com telefone para abrir o WhatsApp.
            </span>
          )}
        </div>
      </div>
      </section>
    </div>
  );
}
