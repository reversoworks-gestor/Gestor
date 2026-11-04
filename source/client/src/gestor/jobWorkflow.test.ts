import { describe, expect, it } from "vitest";
import type { Attachment, Payment } from "../lib/models";
import type { StudioData, StudioOrder } from "./types";
import {
  categoryFields,
  createWorkflow,
  buildChecklist,
  pipeline,
  transitionIssues,
  validateTaskCompletion,
  validateWorkflowSave,
  workflowForOrder,
  workflowPayment,
  type JobWorkflow,
} from "./jobWorkflow";
import { findService } from "./serviceCatalog";

const day = "2026-11-04";
const image: Attachment = {
  name: "before.jpg",
  contentType: "image/jpeg",
  storagePath: "test/jobs/photo.jpg",
};
const afterImage: Attachment = {
  ...image,
  name: "after.jpg",
  storagePath: "test/jobs/after.jpg",
};
function orderFor(
  workflow?: JobWorkflow
): StudioOrder & { workflow?: JobWorkflow } {
  return {
    id: "job",
    title: "Job sintético",
    documentType: "Orçamento",
    status: "Rascunho",
    clientId: "client",
    clientName: "Ana",
    vehicleId: "vehicle",
    startDate: day,
    dueDate: "",
    materialId: "",
    materialName: "",
    materialGrams: 0,
    notes: "",
    total: 0,
    createdAt: day,
    lines: (workflow?.serviceCodes.length ? workflow.serviceCodes : [""]).map(
      code => ({
        id: `line-${code}`,
        service: "custom",
        kind: "service",
        label: findService(code)?.name || "Legado",
        quantity: 1,
        unitPrice: 100,
        description: "",
        ...(code ? { serviceCode: code } : {}),
      })
    ),
    payments: [],
    ...(workflow ? { workflow } : {}),
  };
}
function dataFor(order: StudioOrder): StudioData {
  return {
    clients: [
      {
        id: "client",
        name: "Ana",
        email: "ana@example.test",
        phone: "",
        company: "",
        address: "",
        notes: "",
      },
    ],
    vehicles: [
      {
        id: "vehicle",
        clientId: "client",
        make: "Toyota",
        model: "Corolla",
        year: 2020,
        color: "Prata",
        plate: "",
        vin: "",
        notes: "",
      },
    ],
    orders: [order],
    materials: [],
    printers: [],
    parts: [],
    partRevisions: [],
    expenses: [],
    calendar: [],
    triages: [],
    catalogItems: [],
    settings: [],
  };
}

describe("interface pública do workflow oficial", () => {
  it("abre Lead com nove status, custos nulos e checklists automáticos", () => {
    const workflow = createWorkflow(["FAR-01"]);
    expect(pipeline.map(stage => stage.id)).toEqual([
      "lead",
      "evaluation",
      "quote",
      "approved",
      "scheduled",
      "production",
      "quality",
      "delivered",
      "aftercare",
    ]);
    expect(workflow.stage).toBe("lead");
    expect([
      workflow.quotedAmount,
      workflow.depositAmount,
      workflow.materialCost,
      workflow.hoursWorked,
      workflow.finalAmount,
    ]).toEqual([null, null, null, null, null]);
    expect(workflow.reviewRequested).toBeNull();
    expect(buildChecklist(workflow).map(task => task.step)).toEqual([
      1, 2, 3, 4, 5, 7, 8,
    ]);
    expect(buildChecklist(workflow)[0].required).toBe(true);
    expect(Object.keys(categoryFields)).toEqual(["DET", "PDR", "FAR", "P3D"]);
  });
  it("exporta os links do manifesto P3D para renderização automática dos campos", () => {
    for (const key of ["P3D.scanFileUrl", "P3D.cadFileUrl"]) {
      const field = categoryFields.P3D.find(field => field.key === key);
      expect(field?.type).toBe("text");
      expect(field?.label).toContain("HTTPS");
    }
  });
});

function readyWorkflow(codes: string[], packageCode?: string): JobWorkflow {
  const workflow = createWorkflow(codes, packageCode);
  return {
    ...workflow,
    problem: "Oxidação / dano avaliado",
    beforePhotos: [image],
    afterPhotos: [afterImage],
    quotedAmount: 100,
    estimatedDeadline: "2026-11-10",
    materialCost: 0,
    entryDate: day,
    promisedDate: "2026-11-10",
    deliveryDate: "2026-11-10",
    finalAmount: 100,
    paymentMethod: "Cash",
    paymentDate: "2026-11-10",
    hoursWorked: 2,
    cadVersions: ["v1"],
    reviewRequested: false,
    details: {
      "DET.preexistingDamage": "Nenhum além dos registrados nas fotos",
      "DET.upsellApproved": true,
      "DET.testSpotDone": true,
      "DET.compoundPad": "Composto e boina registrados",
      "DET.rotation": "Rotação definida em teste",
      "DET.protectionProduct": "Produto contratado",
      "DET.protectionDate": day,
      "DET.cureRespected": true,
      "DET.nextMaintenance": "Reavaliar conforme uso",
      "PDR.panel": "Porta",
      "PDR.sizeDepth": "2 cm / leve",
      "PDR.access": "Por trás do painel",
      "PDR.paintIntact": true,
      "PDR.feasibility": "Viável, escopo aprovado",
      "PDR.technique": "alavanca",
      "PDR.removedAccessItems": "Nenhum",
      "FAR.damageType": "externo",
      "FAR.expectationAligned": true,
      "FAR.grits": "800, 1000, 1500, 2000",
      "FAR.protectionProduct": "Proteção contratada",
      "FAR.protectionDate": day,
      "FAR.cureRespected": true,
      "P3D.functionLoads": "Suporte interno, vibração e calor",
      "P3D.feasibility": "Viável para a função não crítica",
      "P3D.quoteBreakdown":
        "Scan/CAD, impressão, acabamento, instalação separados no orçamento",
      "P3D.materialFinal": "Material avaliado pela função",
      "P3D.approvedCadVersion": "v1",
      "P3D.fitApproved": true,
      "P3D.fitDate": day,
      "P3D.fitApprovedBy": "Cliente / veículo",
      "P3D.projectFolder": "https://example.test/project",
      "P3D.scanFileUrl": "https://example.test/project/scan.ply",
      "P3D.cadFileUrl": "https://example.test/project/cad-v1.step",
      "P3D.printSettings": "Configurações validadas no projeto",
    },
  };
}
function complete(workflow: JobWorkflow): JobWorkflow {
  let result = structuredClone(workflow);
  for (const task of buildChecklist(result)) {
    expect(validateTaskCompletion(result, task.id), task.title).toEqual([]);
    result = {
      ...result,
      tasks: {
        ...result.tasks,
        [task.id]: { done: true, completedAt: `${day}T12:00:00Z` },
      },
    };
  }
  return result;
}
function paidOrder(workflow: JobWorkflow) {
  return {
    ...orderFor(workflow),
    payments: [{ id: "p", date: "2026-11-10", method: "Cash", amount: 100 }],
  };
}

describe("portões na etapa correta", () => {
  it("tolera workflow vazio transitório mas proíbe salvá-lo sem serviço", () => {
    const workflow = createWorkflow([]);
    expect(workflow.serviceCodes).toEqual([]);
    expect(() => validateWorkflowSave(orderFor(workflow))).toThrow("Selecione");
  });
  it.each(["DET-02", "PDR-01", "FAR-01", "P3D-01", "P3D-04", "P3D-05"])(
    "não exige tarefas de produção ao mover %s de Lead para Avaliação",
    code => {
      const order = orderFor(createWorkflow([code]));
      expect(transitionIssues(order, "evaluation", dataFor(order))).toEqual([]);
      expect(() => validateWorkflowSave(order, dataFor(order))).not.toThrow();
    }
  );
  it("permite Lead incompleto quanto a fotos, preço, detalhes e prazo", () => {
    const order = orderFor(createWorkflow(["FAR-01"]));
    expect(() => validateWorkflowSave(order)).not.toThrow();
  });
  it("exige contato e veículo completo, inclusive para P3D B2B", () => {
    const order = orderFor(createWorkflow(["P3D-04"])),
      data = dataFor(order);
    data.clients[0].email = "";
    data.vehicles[0].color = "";
    expect(transitionIssues(order, "evaluation", data).join(" ")).toMatch(
      /Contato.*cor/
    );
    expect(
      transitionIssues({ ...order, vehicleId: "" }, "evaluation", data).join(
        " "
      )
    ).toContain("B2B");
    data.vehicles[0].clientId = "outro";
    expect(transitionIssues(order, "evaluation", data).join(" ")).toContain(
      "pertencer"
    );
  });
  it.each(["FAR-01", "PDR-01"])(
    "bloqueia %s antes de orçar e libera com avaliação completa",
    code => {
      const workflow = {
        ...readyWorkflow([code]),
        stage: "evaluation" as const,
      };
      const order = orderFor(workflow);
      expect(
        transitionIssues(order, "quote", dataFor(order)).join(" ")
      ).toContain("Avaliação obrigatória");
      workflow.tasks[code === "FAR-01" ? "FAR-01" : "PDR-01"] = { done: true };
      expect(transitionIssues(order, "quote", dataFor(order))).toEqual([]);
    }
  );
  it("bloqueia dano interno/trinca de farol até alinhar expectativa", () => {
    const workflow = readyWorkflow(["FAR-01"]);
    workflow.details["FAR.damageType"] = "interno / trinca";
    workflow.details["FAR.expectationAligned"] = false;
    expect(validateTaskCompletion(workflow, "FAR-01").join(" ")).toContain(
      "alinhe"
    );
    workflow.details["FAR.expectationAligned"] = true;
    expect(validateTaskCompletion(workflow, "FAR-01")).toEqual([]);
  });
  it("registra explicitamente pintura quebrada e decisão de escopo, sem transformar falso em vazio", () => {
    const workflow = readyWorkflow(["PDR-01", "PDR-02"]);
    workflow.details["PDR.paintIntact"] = false;
    expect(validateTaskCompletion(workflow, "PDR-01")).toEqual([]);
    delete workflow.details["PDR.feasibility"];
    expect(validateTaskCompletion(workflow, "PDR-01").join(" ")).toContain(
      "PDR.feasibility"
    );
  });
  it("exige fotos antes/problema/preço/prazo sem exigir o test spot de produção antes do orçamento", () => {
    const workflow = {
      ...createWorkflow(["DET-02"]),
      stage: "evaluation" as const,
    };
    const order = orderFor(workflow);
    const issues = transitionIssues(order, "quote", dataFor(order)).join(" ");
    expect(issues).toContain("Fotos antes");
    expect(issues).toContain("Descrição");
    expect(issues).toContain("Valor orçado");
    expect(issues).toContain("Prazo");
    expect(issues).not.toContain("test spot");
    order.workflow = { ...readyWorkflow(["DET-02"]), stage: "evaluation" };
    expect(transitionIssues(order, "quote", dataFor(order))).toEqual([]);
  });
  it("não permite pular etapas mesmo com todos os dados já completos", () => {
    const order = paidOrder(complete(readyWorkflow(["DET-01"])));
    expect(
      transitionIssues(order, "aftercare", dataFor(order)).join(" ")
    ).toContain("uma etapa");
  });
  it("bloqueia produção com material nulo e aceita zero lançado conscientemente", () => {
    const workflow = {
      ...readyWorkflow(["DET-01"]),
      stage: "scheduled" as const,
      materialCost: null,
    };
    const order = orderFor(workflow);
    expect(
      transitionIssues(order, "production", dataFor(order)).join(" ")
    ).toContain("Custo de material");
    order.workflow!.materialCost = 0;
    expect(transitionIssues(order, "production", dataFor(order))).toEqual([]);
    order.workflow!.materialCost = 10;
    expect(
      transitionIssues(order, "production", dataFor(order)).join(" ")
    ).toContain("compra");
    order.workflow!.materialPurchasedOn = day;
    expect(transitionIssues(order, "production", dataFor(order))).toEqual([]);
  });
});

describe("sequência operacional e pacotes", () => {
  it("gera apenas add-ons contratados e exige trim, motor e manchas antes da proteção", () => {
    const workflow = readyWorkflow([
      "DET-02",
      "DET-03",
      "DET-04",
      "DET-05",
      "DET-06",
      "DET-07",
    ]);
    const tasks = buildChecklist(workflow);
    expect(
      tasks
        .filter(task => task.step === 7 || task.step === 8)
        .map(task => task.serviceCode)
    ).toEqual(["DET-05", "DET-06", "DET-07", "DET-03", "DET-04"]);
    const protection = tasks.find(task => task.serviceCode === "DET-04")!;
    expect(validateTaskCompletion(workflow, protection.id).join(" ")).toContain(
      "antes da proteção"
    );
    expect(
      buildChecklist(createWorkflow(["DET-01"])).some(
        task => task.step === 5 || task.step === 7 || task.step === 8
      )
    ).toBe(false);
  });
  it("bloqueia expansão da correção antes do test spot e exige parâmetros registrados", () => {
    const workflow = readyWorkflow(["DET-02"]);
    for (const task of buildChecklist(workflow).filter(task => task.step < 5))
      workflow.tasks[task.id] = { done: true };
    expect(validateTaskCompletion(workflow, "DET-05").join(" ")).toContain(
      "Test spot"
    );
    workflow.details["DET.testSpotDone"] = false;
    expect(
      validateTaskCompletion(workflow, "DET-05-test-spot").join(" ")
    ).toContain("test spot");
    workflow.details["DET.testSpotDone"] = true;
    delete workflow.details["DET.compoundPad"];
    expect(
      validateTaskCompletion(workflow, "DET-05-test-spot").join(" ")
    ).toContain("compoundPad");
  });
  it("mantém fit test como portão antes de impressão final, com data, aprovador e CAD", () => {
    const workflow = readyWorkflow(["P3D-01"]);
    for (const task of buildChecklist(workflow).filter(task => task.step < 6))
      workflow.tasks[task.id] = { done: true };
    expect(validateTaskCompletion(workflow, "P3D-07").join(" ")).toContain(
      "FIT TEST"
    );
    workflow.details["P3D.fitApproved"] = false;
    expect(validateTaskCompletion(workflow, "P3D-06").join(" ")).toContain(
      "voltar ao CAD"
    );
    workflow.details["P3D.fitApproved"] = true;
    delete workflow.details["P3D.fitDate"];
    delete workflow.details["P3D.fitApprovedBy"];
    workflow.details["P3D.approvedCadVersion"] = "v2";
    const issues = validateTaskCompletion(workflow, "P3D-06").join(" ");
    expect(issues).toContain("fitDate");
    expect(issues).toContain("fitApprovedBy");
    expect(issues).toContain("histórico");
  });
  it("P3D-04 B2B tem exatamente etapas 1–4, sem protótipo, fit test, impressão ou instalação", () => {
    const workflow = readyWorkflow(["P3D-04"]);
    expect(buildChecklist(workflow).map(task => task.step)).toEqual([
      1, 2, 3, 4,
    ]);
    expect(validateTaskCompletion(workflow, "P3D-06")).toContain(
      "Tarefa não pertence ao checklist atual do job."
    );
    const order = paidOrder({ ...complete(workflow), stage: "quality" });
    delete order.workflow!.details["P3D.projectFolder"];
    expect(
      transitionIssues(order, "delivered", dataFor(order)).join(" ")
    ).toContain("entrega de arquivos");
    order.workflow!.details["P3D.projectFolder"] =
      "https://example.test/project";
    expect(transitionIssues(order, "delivered", dataFor(order))).toEqual([]);
  });
  it.each(["P3D.projectFolder", "P3D.scanFileUrl", "P3D.cadFileUrl"])(
    "B2B exige %s como link HTTPS explícito na entrega e no salvamento",
    key => {
      const order = paidOrder({
        ...complete(readyWorkflow(["P3D-04"])),
        stage: "quality",
      });
      const workflow = order.workflow!;
      for (const value of [
        undefined,
        "",
        " x",
        "http://example.test/project/file",
        "https://",
        "https:example.test/file",
        "https://user:password@example.test/file",
        "data:application/octet-stream;base64,aaa",
      ]) {
        if (value === undefined) delete workflow.details[key];
        else workflow.details[key] = value;
        expect(
          transitionIssues(order, "delivered", dataFor(order)).join(" ")
        ).toContain(key === "P3D.projectFolder" ? "entrega de arquivos" : key);
        workflow.stage = "delivered";
        expect(() => validateWorkflowSave(order, dataFor(order))).toThrow(
          "HTTPS"
        );
        workflow.stage = "quality";
      }
      workflow.details[key] = "https://example.test/project/file?access=token";
      expect(transitionIssues(order, "delivered", dataFor(order))).toEqual([]);
    }
  );
  it("B2B não exige manifesto antes da entrega, mas pasta sozinha não substitui scan e CAD", () => {
    const workflow = {
      ...complete(readyWorkflow(["P3D-04"])),
      stage: "production" as JobWorkflow["stage"],
    };
    delete workflow.details["P3D.scanFileUrl"];
    delete workflow.details["P3D.cadFileUrl"];
    const order = paidOrder(workflow);
    expect(transitionIssues(order, "quality", dataFor(order))).toEqual([]);
    workflow.stage = "quality";
    const issues = transitionIssues(order, "delivered", dataFor(order)).join(
      " "
    );
    expect(issues).toContain("P3D.scanFileUrl");
    expect(issues).toContain("P3D.cadFileUrl");
    expect(buildChecklist(workflow).map(task => task.step)).toEqual([
      1, 2, 3, 4,
    ]);
  });
  it("B2B continua exigindo CAD entregue aprovado no registro, além dos links", () => {
    const order = paidOrder({
      ...complete(readyWorkflow(["P3D-04"])),
      stage: "quality",
    });
    for (const value of [undefined, "", "v2"]) {
      if (value === undefined)
        delete order.workflow!.details["P3D.approvedCadVersion"];
      else order.workflow!.details["P3D.approvedCadVersion"] = value;
      expect(
        transitionIssues(order, "delivered", dataFor(order)).join(" ")
      ).toContain("CAD entregue no histórico");
    }
    order.workflow!.details["P3D.approvedCadVersion"] = "v1";
    expect(transitionIssues(order, "delivered", dataFor(order))).toEqual([]);
  });
  it.each(["P3D.projectFolder", "P3D.scanFileUrl", "P3D.cadFileUrl"])(
    "arquivo físico na etapa 10 exige %s HTTPS, inclusive em reparo e recriação",
    key => {
      for (const scenario of [
        { code: "P3D-01", repairMode: "" },
        { code: "P3D-05", repairMode: "repair" },
        { code: "P3D-05", repairMode: "recreate" },
      ] as const) {
        const workflow = complete({
          ...readyWorkflow([scenario.code]),
          repairMode: scenario.repairMode,
          stage: "production",
        });
        for (const value of [undefined, " x", "http://example.test/file"]) {
          if (value === undefined) delete workflow.details[key];
          else workflow.details[key] = value;
          expect(
            validateTaskCompletion(workflow, "P3D-10").join(" ")
          ).toContain(key);
          expect(() => validateWorkflowSave(orderFor(workflow))).toThrow(key);
          const order = paidOrder(workflow);
          expect(
            transitionIssues(order, "quality", dataFor(order)).join(" ")
          ).toContain(key);
        }
        workflow.details[key] = "https://example.test/project/file";
        expect(validateTaskCompletion(workflow, "P3D-10")).toEqual([]);
      }
    }
  );
  it("aceita registro de medição HTTPS no manifesto quando não há scan 3D", () => {
    const workflow = readyWorkflow(["P3D-02"]);
    workflow.details["P3D.scanFileUrl"] =
      "https://example.test/project/critical-measurements.pdf";
    expect(() => complete(workflow)).not.toThrow();
  });
  it("P3D-05 exige decisão na viabilidade; reparo não força impressão e recriação usa fit test", () => {
    const workflow = readyWorkflow(["P3D-05", "P3D-06"]);
    workflow.tasks["P3D-01"] = { done: true };
    expect(validateTaskCompletion(workflow, "P3D-02").join(" ")).toContain(
      "decida"
    );
    workflow.repairMode = "repair";
    expect(buildChecklist(workflow).map(task => task.step)).toEqual([
      1, 2, 5, 9, 10,
    ]);
    expect(validateTaskCompletion(workflow, "P3D-02")).toEqual([]);
    workflow.repairMode = "recreate";
    expect(buildChecklist(workflow).map(task => task.step)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 9, 10,
    ]);
  });
  it("PCT-01 executa FAR, depois correção e trim DET, e só então as duas proteções e QCs", () => {
    const workflow = readyWorkflow(
      ["DET-02", "DET-04", "DET-05", "FAR-01", "FAR-02"],
      "PCT-01"
    );
    const tasks = buildChecklist(workflow),
      ids = tasks.map(task => task.id);
    expect(ids.slice(0, 5)).toEqual([
      "FAR-01",
      "FAR-02",
      "FAR-03",
      "FAR-04",
      "FAR-05",
    ]);
    expect(ids.indexOf("DET-05")).toBeLessThan(ids.indexOf("DET-07-DET-05"));
    expect(ids.indexOf("DET-07-DET-05")).toBeLessThan(ids.indexOf("FAR-06"));
    expect(ids.indexOf("FAR-06")).toBeLessThan(ids.indexOf("DET-08-DET-04"));
    expect(ids.indexOf("DET-08-DET-04")).toBeLessThan(ids.indexOf("FAR-07"));
    expect(ids.indexOf("FAR-06")).toBeLessThan(ids.indexOf("FAR-08"));
    for (const task of tasks.filter(
      task => task.category === "FAR" && task.step <= 5
    ))
      workflow.tasks[task.id] = { done: true };
    expect(validateTaskCompletion(workflow, "FAR-06").join(" ")).toContain(
      "Trim"
    );
    workflow.tasks["FAR-06"] = { done: true };
    expect(() => validateWorkflowSave(orderFor(workflow))).toThrow(
      "Ordem de execução"
    );
  });
  it("PCT-02 executa todo o PDR primeiro com o carro como chegou", () => {
    const workflow = readyWorkflow(["PDR-01", "PDR-02", "DET-01"], "PCT-02");
    const tasks = buildChecklist(workflow);
    expect(tasks.slice(0, 8).map(task => task.category)).toEqual(
      Array(8).fill("PDR")
    );
    expect(tasks[8].category).toBe("DET");
    expect(validateTaskCompletion(workflow, "DET-01").join(" ")).toContain(
      "amassado"
    );
  });
  it("PCT-03 exige uma única alternativa principal e não remove fit test", () => {
    expect(() => createWorkflow(["P3D-03", "P3D-06"], "PCT-03")).toThrow();
    expect(() =>
      createWorkflow(["P3D-01", "P3D-02", "P3D-03", "P3D-06"], "PCT-03")
    ).toThrow("uma alternativa");
    expect(() => createWorkflow(["P3D-01", "P3D-06"], "PCT-03")).toThrow(
      "componente"
    );
    expect(
      buildChecklist(
        createWorkflow(["P3D-02", "P3D-03", "P3D-06"], "PCT-03")
      ).find(task => task.step === 6)?.required
    ).toBe(true);
    expect(() => createWorkflow(["PCT-03"])).toThrow("explicitamente");
  });
  it.each([
    { codes: ["DET-01"], label: "detailing" },
    {
      codes: ["DET-02", "DET-03", "DET-04", "DET-05", "DET-06", "DET-07"],
      label: "detailing e todos add-ons",
    },
    { codes: ["PDR-01", "PDR-02", "PDR-03"], label: "PDR completo" },
    { codes: ["FAR-01", "FAR-02"], label: "faróis completos" },
    { codes: ["P3D-01", "P3D-03", "P3D-06"], label: "P3D OEM" },
    { codes: ["P3D-02"], label: "P3D custom" },
    { codes: ["P3D-04"], label: "P3D B2B" },
    {
      codes: ["P3D-05", "P3D-06"],
      repairMode: "repair",
      label: "reparo existente",
    },
    {
      codes: ["P3D-05", "P3D-06"],
      repairMode: "recreate",
      label: "recriação da peça",
    },
    {
      codes: ["DET-02", "DET-04", "DET-05", "FAR-01", "FAR-02"],
      packageCode: "PCT-01",
      label: "Bring It Back",
    },
    {
      codes: ["PDR-01", "PDR-02", "DET-01"],
      packageCode: "PCT-02",
      label: "Dent + Detail",
    },
    {
      codes: ["P3D-01", "P3D-03", "P3D-06"],
      packageCode: "PCT-03",
      label: "The Missing Part OEM",
    },
    {
      codes: ["P3D-02", "P3D-03", "P3D-06"],
      packageCode: "PCT-03",
      label: "The Missing Part custom",
    },
  ])(
    "conclui todas as tarefas e os nove status em sequência válida: $label",
    scenario => {
      const workflow = readyWorkflow(scenario.codes, scenario.packageCode);
      if (scenario.repairMode)
        workflow.repairMode = scenario.repairMode as JobWorkflow["repairMode"];
      const order = paidOrder(complete(workflow));
      for (const target of pipeline.slice(1).map(stage => stage.id)) {
        const data = dataFor(structuredClone(order));
        expect(transitionIssues(order, target, data), target).toEqual([]);
        order.workflow!.stage = target;
        expect(() => validateWorkflowSave(order, data), target).not.toThrow();
      }
      expect(order.workflow!.stage).toBe("aftercare");
    }
  );
});

describe("evidências, financeiro e histórico", () => {
  it.each([
    { name: "fake.jpg", contentType: "image/jpeg" },
    {
      name: "pdf.pdf",
      storagePath: "test/pdf",
      contentType: "application/pdf",
    },
    { name: "missing.jpg", storagePath: "test/photo" },
    {
      name: "url.jpg",
      storagePath: "https://example.test/photo.jpg",
      contentType: "image/jpeg",
    },
    { name: "blob.jpg", storagePath: "blob:123", contentType: "image/jpeg" },
    {
      name: "data.jpg",
      storagePath: "data:image/jpeg;base64,aaa",
      contentType: "image/jpeg",
    },
  ])("rejeita evidência falsa, URL ou não-imagem: $name", attachment => {
    const workflow = readyWorkflow(["DET-01"]);
    workflow.beforePhotos = [attachment];
    expect(validateTaskCompletion(workflow, "DET-01").join(" ")).toContain(
      "imagem real"
    );
    expect(() => validateWorkflowSave(orderFor(workflow))).toThrow(
      "Fotos antes"
    );
  });
  it.each([
    "quotedAmount",
    "depositAmount",
    "materialCost",
    "hoursWorked",
    "finalAmount",
  ] as const)("mantém %s nulo mas rejeita negativo/NaN/infinito", key => {
    const workflow = createWorkflow(["DET-01"]),
      order = orderFor(workflow);
    expect(workflow[key]).toBeNull();
    for (const value of [-1, NaN, Infinity, Number.MAX_VALUE]) {
      workflow[key] = value;
      expect(() => validateWorkflowSave(order)).toThrow(key);
    }
    workflow[key] = 0;
    expect(() => validateWorkflowSave(order)).not.toThrow();
  });
  it("exige preços explícitos antes de quote; placeholder zero pendente nunca é cotação", () => {
    const workflow = {
      ...readyWorkflow(["DET-01"]),
      stage: "quote" as const,
      quotedAmount: 0,
    };
    const order = orderFor(workflow);
    order.lines = order.lines.map(line => ({
      ...line,
      unitPrice: 0,
      pricePending: true,
    }));
    expect(() => validateWorkflowSave(order)).toThrow("Preço pendente");
    order.lines = order.lines.map(line => ({ ...line, pricePending: false }));
    expect(() => validateWorkflowSave(order)).not.toThrow();
    workflow.quotedAmount = null as unknown as number;
    expect(() => validateWorkflowSave(order)).toThrow("Valor orçado");
  });
  it("não aceita add-on fantasma declarado no workflow sem sua linha real", () => {
    const order = orderFor(readyWorkflow(["FAR-01", "FAR-02"]));
    order.lines = order.lines.slice(0, 1);
    expect(() => validateWorkflowSave(order)).toThrow("linha");
  });
  it("exige sinal aplicável com valor/data e recibo explícito na lista de pagamentos", () => {
    const workflow = {
      ...readyWorkflow(["DET-01"]),
      stage: "approved" as const,
      depositApplicable: true,
    };
    const order = orderFor(workflow);
    expect(
      transitionIssues(order, "scheduled", dataFor(order)).join(" ")
    ).toContain("Sinal/depósito");
    workflow.depositAmount = 20;
    workflow.depositDate = day;
    expect(
      transitionIssues(order, "scheduled", dataFor(order)).join(" ")
    ).toContain("registro de pagamentos");
    order.payments = [{ id: "deposit", date: day, method: "Cash", amount: 20 }];
    expect(transitionIssues(order, "scheduled", dataFor(order))).toEqual([]);
    expect(workflowPayment(workflow, order.payments)).toEqual({
      balance: 80,
      status: "parcial",
      received: 20,
    });
  });
  it("não trata preço nulo como zero, nem conta depósito novamente além do recibo", () => {
    const workflow = createWorkflow(["DET-01"]);
    expect(workflowPayment(workflow, [])).toEqual({
      balance: null,
      status: "pendente",
      received: 0,
    });
    const payment: Payment = { id: "p", method: "Cash", amount: 20, date: day };
    expect(workflowPayment(workflow, [payment])).toEqual({
      balance: null,
      status: "parcial",
      received: 20,
    });
    workflow.quotedAmount = 100;
    workflow.depositApplicable = true;
    workflow.depositAmount = 20;
    workflow.depositDate = day;
    expect(workflowPayment(workflow, [payment])).toEqual({
      balance: 80,
      status: "parcial",
      received: 20,
    });
    workflow.finalAmount = 80;
    expect(workflowPayment(workflow, [payment])).toEqual({
      balance: 60,
      status: "parcial",
      received: 20,
    });
    workflow.finalAmount = 0;
    expect(workflowPayment(workflow, [])).toEqual({
      balance: 0,
      status: "pago",
      received: 0,
    });
  });
  it("soma centavos exatos e recusa pagamentos não finitos ou negativos", () => {
    const workflow = createWorkflow(["DET-01"]);
    workflow.quotedAmount = 0.3;
    expect(
      workflowPayment(workflow, [
        { id: "a", method: "Cash", amount: 0.1, date: day },
        { id: "b", method: "Cash", amount: 0.2, date: day },
      ])
    ).toEqual({ balance: 0, status: "pago", received: 0.3 });
    for (const amount of [-1, NaN, Infinity])
      expect(() =>
        workflowPayment(workflow, [
          { id: "p", method: "Cash", amount, date: day },
        ])
      ).toThrow("pagamento");
  });
  it.each([
    { amount: 1.005, rounded: 1.01 },
    { amount: 2.675, rounded: 2.68 },
    { amount: 10.075, rounded: 10.08 },
    { amount: 0.005, rounded: 0.01 },
    { amount: 1e-7, rounded: 0 },
  ])(
    "converte $amount com o arredondamento decimal exato do núcleo",
    scenario => {
      const workflow = createWorkflow(["DET-01"]);
      workflow.quotedAmount = scenario.amount;
      expect(workflowPayment(workflow, [])).toEqual({
        balance: scenario.rounded,
        status: scenario.rounded === 0 ? "pago" : "pendente",
        received: 0,
      });
      for (const amount of [scenario.amount, scenario.rounded]) {
        const payment: Payment = { id: "p", method: "Cash", amount, date: day };
        expect(workflowPayment(workflow, [payment])).toEqual({
          balance: 0,
          status: "pago",
          received: scenario.rounded,
        });
        workflow.quotedAmount = 100;
        workflow.finalAmount = scenario.amount;
        expect(workflowPayment(workflow, [payment])).toEqual({
          balance: 0,
          status: "pago",
          received: scenario.rounded,
        });
      }
    }
  );
  it.each([
    { deposit: 1.005, receipt: 1.01, allowed: true },
    { deposit: 1.005, receipt: 1, allowed: false },
    { deposit: 1.004, receipt: 1, allowed: true },
    { deposit: 0.004, receipt: 0, allowed: true },
    { deposit: 10.075, receipt: 10.075, allowed: true },
    { deposit: 10.075, receipt: 10.07, allowed: false },
  ])(
    "compara depósito $deposit e recibo $receipt em centavos exatos",
    scenario => {
      const order = orderFor({
        ...readyWorkflow(["DET-01"]),
        stage: "approved",
        depositApplicable: true,
        depositAmount: scenario.deposit,
        depositDate: day,
      });
      order.payments = [
        { id: "deposit", method: "Cash", amount: scenario.receipt, date: day },
      ];
      const issues = transitionIssues(order, "scheduled", dataFor(order));
      if (scenario.allowed) expect(issues).toEqual([]);
      else expect(issues.join(" ")).toContain("registro de pagamentos");
    }
  );
  it("rejeita valores e soma de recibos fora da precisão segura após conversão exata", () => {
    const workflow = createWorkflow(["DET-01"]);
    workflow.quotedAmount = 90071992547409.9;
    expect(() => validateWorkflowSave(orderFor(workflow))).not.toThrow();
    expect(() => workflowPayment(workflow, [])).not.toThrow();
    for (const amount of [90071992547409.92, Number.MAX_VALUE, Infinity, NaN]) {
      workflow.quotedAmount = amount;
      expect(() => validateWorkflowSave(orderFor(workflow))).toThrow(
        "quotedAmount"
      );
      expect(() => workflowPayment(workflow, [])).toThrow("Valor do job");
      expect(() =>
        workflowPayment(createWorkflow(["DET-01"]), [
          { id: "p", method: "Cash", amount, date: day },
        ])
      ).toThrow("pagamento");
    }
    expect(() =>
      workflowPayment(createWorkflow(["DET-01"]), [
        { id: "a", method: "Cash", amount: 90071992547409.9, date: day },
        { id: "b", method: "Cash", amount: 0.02, date: day },
      ])
    ).toThrow("precisão monetária segura");
  });
  it("entrega considera 1.005 quitado por 1.01, sem saldo falso nem excesso", () => {
    const order = paidOrder({
      ...complete(readyWorkflow(["DET-01"])),
      stage: "quality",
      finalAmount: 1.005,
    });
    order.payments[0].amount = 1.01;
    expect(transitionIssues(order, "delivered", dataFor(order))).toEqual([]);
    order.workflow!.stage = "delivered";
    expect(() => validateWorkflowSave(order, dataFor(order))).not.toThrow();
    order.workflow!.stage = "quality";
    order.payments[0].amount = 1;
    expect(
      transitionIssues(order, "delivered", dataFor(order)).join(" ")
    ).toContain("quitação");
  });
  it("bloqueia qualidade com checklist/foto depois incompletos e entrega com pagamento pendente", () => {
    const workflow = {
      ...readyWorkflow(["DET-01"]),
      stage: "production" as const,
      afterPhotos: [],
    };
    const order = orderFor(workflow);
    const issues = transitionIssues(order, "quality", dataFor(order)).join(" ");
    expect(issues).toContain("Checklist completo");
    expect(issues).toContain("Fotos depois");
    order.workflow = {
      ...complete(readyWorkflow(["DET-01"])),
      stage: "quality",
    };
    expect(
      transitionIssues(order, "delivered", dataFor(order)).join(" ")
    ).toContain("quitação");
    order.payments = [
      { id: "p", method: "Cash", amount: 100, date: "2026-11-10" },
    ];
    expect(transitionIssues(order, "delivered", dataFor(order))).toEqual([]);
    order.payments[0].amount = 101;
    expect(
      transitionIssues(order, "delivered", dataFor(order)).join(" ")
    ).toContain("exceder");
  });
  it("não preenche valor final e pagamento automaticamente para entregar", () => {
    const workflow = {
      ...complete(readyWorkflow(["DET-01"])),
      stage: "quality" as const,
      finalAmount: null,
      paymentMethod: "",
      paymentDate: "",
      deliveryDate: "",
    };
    const order = paidOrder(workflow);
    const issues = transitionIssues(order, "delivered", dataFor(order)).join(
      " "
    );
    expect(issues).toContain("Valor final");
    expect(issues).toContain("Forma de pagamento");
    expect(issues).toContain("Data do pagamento");
    expect(issues).toContain("Data da entrega");
    expect(workflow.finalAmount).toBeNull();
  });
  it("pós-venda aceita não explícito, mas não nulo", () => {
    const order = paidOrder({
      ...complete(readyWorkflow(["DET-01"])),
      stage: "delivered",
      reviewRequested: null,
    });
    expect(
      transitionIssues(order, "aftercare", dataFor(order)).join(" ")
    ).toContain("explicitamente");
    order.workflow!.reviewRequested = false;
    expect(transitionIssues(order, "aftercare", dataFor(order))).toEqual([]);
  });
  it("preserva versões CAD append-only e exige reset após revisão do projeto aprovado", () => {
    const previous = orderFor({
      ...complete(readyWorkflow(["P3D-01"])),
      stage: "production",
    });
    const data = dataFor(previous);
    const changed = structuredClone(previous);
    changed.workflow!.cadVersions = ["v2"];
    expect(() => validateWorkflowSave(changed, data)).toThrow("append-only");
    changed.workflow!.cadVersions = ["v1", "v2"];
    changed.workflow!.details["P3D.approvedCadVersion"] = "v2";
    expect(() => validateWorkflowSave(changed, data)).toThrow("reinicie");
    changed.workflow!.tasks = Object.fromEntries(
      buildChecklist(changed.workflow!)
        .filter(task => task.step < 5)
        .map(task => [task.id, { done: true }])
    );
    changed.workflow!.details["P3D.fitApproved"] = false;
    changed.workflow!.details["P3D.approvedCadVersion"] = "";
    expect(() => validateWorkflowSave(changed, data)).not.toThrow();
  });
  it("fit reprovado reabre CAD sem apagar versões e bloqueia toda impressão final anterior", () => {
    const previous = orderFor({
      ...complete(readyWorkflow(["P3D-02"])),
      stage: "production",
    });
    const changed = structuredClone(previous),
      data = dataFor(previous);
    changed.workflow!.details["P3D.fitApproved"] = false;
    expect(() => validateWorkflowSave(changed, data)).toThrow("nova versão");
    changed.workflow!.cadVersions.push("v2");
    expect(() => validateWorkflowSave(changed, data)).toThrow("reinicie");
    changed.workflow!.tasks = Object.fromEntries(
      buildChecklist(changed.workflow!)
        .filter(task => task.step < 5)
        .map(task => [task.id, { done: true }])
    );
    expect(() => validateWorkflowSave(changed, data)).not.toThrow();
  });
  it("recuo é permitido mas desmarcar tarefa anterior exige reset das posteriores", () => {
    const order = orderFor({
      ...complete(readyWorkflow(["DET-01"])),
      stage: "production",
    });
    expect(transitionIssues(order, "evaluation", dataFor(order))).toEqual([]);
    order.workflow!.tasks["DET-02"].done = false;
    expect(() => validateWorkflowSave(order)).toThrow("Ordem de execução");
    const tasks = buildChecklist(order.workflow!);
    for (const task of tasks.filter(task => task.step >= 2))
      order.workflow!.tasks[task.id] = { done: false };
    order.workflow!.stage = "evaluation";
    expect(() => validateWorkflowSave(order)).not.toThrow();
  });
  it.each(["2026-02-30", "2026-13-01", "2101-01-01", "2026-2-01"])(
    "rejeita datas não reais %s mesmo no rascunho",
    date => {
      const workflow = createWorkflow(["DET-01"]);
      workflow.estimatedDeadline = date;
      expect(() => validateWorkflowSave(orderFor(workflow))).toThrow(
        "data real"
      );
    }
  );
});

describe("leitura de dados históricos sem migração implícita", () => {
  it.each([
    { patch: { completed: true }, stage: "delivered" },
    { patch: { journeyStage: "check" }, stage: "quality" },
    { patch: { journeyStage: "execute" }, stage: "production" },
    { patch: { journeyStage: "develop" }, stage: "production" },
    { patch: { journeyStage: "evaluate" }, stage: "evaluation" },
    { patch: { status: "Enviado" }, stage: "quote" },
    { patch: { status: "Aprovado" }, stage: "approved" },
    { patch: { productionStage: "shipping" }, stage: "delivered" },
  ])(
    "projeta status antigo em $stage sem alterar nem cadastrar serviço do documento",
    scenario => {
      const order = { ...orderFor(), ...scenario.patch } as StudioOrder,
        original = structuredClone(order);
      const workflow = workflowForOrder(order);
      expect(workflow.stage).toBe(scenario.stage);
      expect(workflow.serviceCodes).toEqual([]);
      expect(order).toEqual(original);
      expect("workflow" in order).toBe(false);
      expect(() => validateWorkflowSave(order)).not.toThrow();
    }
  );
  it("clona workflow e anexos no adaptador de leitura para evitar mutação incidental", () => {
    const order = orderFor(readyWorkflow(["DET-01"])),
      original = structuredClone(order);
    const view = workflowForOrder(order);
    view.details["DET.compoundPad"] = "alterado";
    view.beforePhotos[0].name = "alterado.jpg";
    view.cadVersions.push("v2");
    expect(order).toEqual(original);
    const legacy = { ...orderFor(), attachments: [image] };
    workflowForOrder(legacy).beforePhotos[0].name = "outro.jpg";
    expect(legacy.attachments[0].name).toBe("before.jpg");
  });
});

describe("erros previsíveis na interface pública", () => {
  it("transitionIssues retorna lista, não lança exceção, para código desconhecido", () => {
    const workflow = {
      ...readyWorkflow(["DET-01"]),
      stage: "evaluation" as const,
    };
    workflow.serviceCodes = ["PPF"];
    const order = orderFor(workflow);
    expect(() =>
      transitionIssues(order, "quote", dataFor(order))
    ).not.toThrow();
    expect(
      transitionIssues(order, "quote", dataFor(order)).join(" ")
    ).toContain("desconhecido");
  });
  it("validateTaskCompletion retorna dependência inválida, mesmo chamado fora da UI", () => {
    const workflow = readyWorkflow(["FAR-01", "FAR-02"]);
    workflow.serviceCodes = ["FAR-02"];
    expect(validateTaskCompletion(workflow, "FAR-01").join(" ")).toContain(
      "pré-requisito"
    );
    workflow.serviceCodes = ["PPF"];
    expect(() => validateTaskCompletion(workflow, "FAR-01")).not.toThrow();
    expect(validateTaskCompletion(workflow, "FAR-01").join(" ")).toContain(
      "desconhecido"
    );
  });
  it("não altera as entradas ao validar nem nas falhas", () => {
    const order = orderFor(readyWorkflow(["DET-02"])),
      original = structuredClone(order),
      data = dataFor(order);
    transitionIssues(order, "aftercare", data);
    validateTaskCompletion(order.workflow!, "DET-05");
    validateWorkflowSave(order, data);
    expect(order).toEqual(original);
  });
});
