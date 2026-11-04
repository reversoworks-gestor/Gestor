import { useState } from "react";
import { Badge } from "./ui";
import {
  buildChecklist,
  validateTaskCompletion,
  type JobWorkflow,
} from "../jobWorkflow";
import { serviceCategories } from "../serviceCatalog";
import "../processStyles.css";

export default function JobChecklist({
  workflow,
  onChange,
  readOnly = false,
}: {
  workflow: JobWorkflow;
  onChange: (workflow: JobWorkflow) => void;
  readOnly?: boolean;
}) {
  const [issues, setIssues] = useState<string[]>([]);
  const tasks = buildChecklist(workflow);
  const completed = tasks.filter(task => workflow.tasks[task.id]?.done).length;

  function toggle(id: string, done: boolean) {
    if (readOnly) return;
    const blockers = done ? validateTaskCompletion(workflow, id) : [];
    if (blockers.length) {
      setIssues(blockers);
      return;
    }
    const next = { ...workflow, tasks: { ...workflow.tasks } };
    next.tasks[id] = done
      ? { done: true, completedAt: new Date().toISOString() }
      : { done: false };
    if (!done) {
      // Reopening an earlier step invalidates every later execution, including packages.
      const index = tasks.findIndex(task => task.id === id);
      for (const task of tasks.slice(index + 1))
        next.tasks[task.id] = { done: false };
      if (tasks[index]?.category === "P3D" && tasks[index].step <= 6) {
        // Reopening is not a rejection: clear approval, rather than recording false
        // without the mandatory new CAD revision. Explicit rejection lives in JobDetails.
        next.details = { ...next.details };
        for (const field of Object.keys(next.details))
          if (
            /^P3D\./.test(field) &&
            /fit|approvedcad|cadapproved/i.test(field)
          )
            delete next.details[field];
      }
      setIssues([
        "Etapa reaberta. As tarefas posteriores foram desmarcadas; revise-as antes de avançar.",
      ]);
    } else setIssues([]);
    onChange(next);
  }

  return (
    <section
      className="process-checklist stack"
      aria-labelledby="job-checklist-heading"
    >
      <div className="split wrap">
        <div>
          <h3 id="job-checklist-heading">Checklist automático</h3>
          <p className="helper">
            Na ordem oficial. Portões e sequência dos pacotes não podem ser
            ignorados.
          </p>
        </div>
        <Badge
          tone={
            completed === tasks.length && tasks.length ? "success" : "neutral"
          }
        >
          {completed}/{tasks.length} concluídas
        </Badge>
      </div>
      {issues.length > 0 && (
        <div className="process-feedback" role="status">
          <ul>
            {issues.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
        </div>
      )}
      {tasks.length ? (
        <ol className="process-task-list">
          {tasks.map((task, index) => {
            const done = Boolean(workflow.tasks[task.id]?.done);
            const blockers = done
              ? []
              : validateTaskCompletion(workflow, task.id);
            return (
              <li
                key={task.id}
                className={`process-task${done ? " is-complete" : ""}`}
              >
                {(index === 0 ||
                  tasks[index - 1].category !== task.category) && (
                  <p className="eyebrow process-task-category">
                    {task.category} · {serviceCategories[task.category]}
                  </p>
                )}
                <label className="process-task-control">
                  <input
                    type="checkbox"
                    checked={done}
                    disabled={readOnly}
                    onChange={event => toggle(task.id, event.target.checked)}
                    aria-describedby={
                      blockers.length ? `task-blockers-${task.id}` : undefined
                    }
                  />
                  <span>
                    <span className="process-task-title">
                      <span className="mono">{task.step}.</span> {task.title}
                    </span>
                    <span className="process-task-meta">
                      {task.required
                        ? "Obrigatória · bloqueante"
                        : "Etapa do processo"}
                      {task.photo
                        ? ` · Imagem ${task.photo === "before" ? "antes" : "depois"} obrigatória`
                        : ""}
                      {task.serviceCode ? ` · ${task.serviceCode}` : ""}
                    </span>
                  </span>
                </label>
                {blockers.length > 0 && (
                  <details
                    id={`task-blockers-${task.id}`}
                    className="process-disclosure process-task-blockers"
                  >
                    <summary className="helper">
                      Ver {blockers.length} bloqueio(s) desta tarefa
                    </summary>
                    <ul className="helper">
                      {blockers.map((issue, index) => (
                        <li key={index}>{issue}</li>
                      ))}
                    </ul>
                  </details>
                )}
                {done && workflow.tasks[task.id]?.completedAt && (
                  <p className="helper process-task-blockers">
                    Registrada em{" "}
                    {new Date(
                      workflow.tasks[task.id].completedAt!
                    ).toLocaleString("pt-BR")}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="muted">
          Selecione serviços oficiais para gerar o processo.
        </p>
      )}
    </section>
  );
}
