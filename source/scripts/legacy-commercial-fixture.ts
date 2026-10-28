import { writeFileSync } from "node:fs";
import { demoData } from "../client/src/gestor/domain";
const data = demoData();
const base = {
  ...data.orders[0],
  documentType: "Estimativa",
  status: "Rascunho",
  updatedAt: undefined,
};
data.orders = [
  {
    ...base,
    id: "qa-missing-date",
    title: "QA Documento sem data",
    createdAt: undefined,
    serviceType: "legacy-service",
  },
  {
    ...base,
    id: "qa-numeric-date",
    title: "QA Documento época",
    createdAt: 1609459200000,
  },
  {
    ...base,
    id: "qa-firestore-date",
    title: "QA Documento Firestore",
    createdAt: { seconds: 1609459260, nanoseconds: 0 },
  },
  {
    ...base,
    id: "qa-iso-date",
    title: "QA Documento ISO",
    createdAt: "2021-01-01T00:02:00.000Z",
  },
] as unknown as typeof data.orders;
writeFileSync(
  "../qa/legacy-commercial-fixture.json",
  JSON.stringify(data, null, 2) + "\n"
);
