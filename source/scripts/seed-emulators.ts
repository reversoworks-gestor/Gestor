import process from "node:process";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { demoData } from "../client/src/gestor/domain";

const project = "demo-reverso-qa";
const host = process.env.FIRESTORE_EMULATOR_HOST;
if (
  host !== "127.0.0.1:8080" ||
  process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099"
)
  throw new Error("Seed permitido exclusivamente nos emuladores locais de QA.");
async function account(email: string) {
  const base =
    "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:";
  const body = { email, password: "DemoQA!Local2026", returnSecureToken: true };
  let response = await fetch(base + "signUp?key=demo-only-public-key", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let value = await response.json();
  if (value.error?.message === "EMAIL_EXISTS") {
    response = await fetch(
      base + "signInWithPassword?key=demo-only-public-key",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    value = await response.json();
  }
  if (!value.localId) throw new Error(JSON.stringify(value));
  return value.localId as string;
}
const owner = await account("owner@qa.example.test");
await account("member@qa.example.test");
await account("outsider@qa.example.test");
const environment = await initializeTestEnvironment({
  projectId: project,
  firestore: { host: "127.0.0.1", port: 8080 },
});
const data = demoData();
data.orders[0].privateNote =
  "Informação interna sintética de QA; não exportar.";
await environment.withSecurityRulesDisabled(async context => {
  const db = context.firestore();
  await db
    .doc("workspaces/reverso-private")
    .set({
      ownerUid: owner,
      allowedEmails: ["owner@qa.example.test", "member@qa.example.test"],
      name: "QA Reverso isolado",
    });
  for (const [collection, records] of Object.entries(data))
    for (const record of records as Array<{ id: string }>)
      await db
        .doc(`workspaces/reverso-private/${collection}/${record.id}`)
        .set(JSON.parse(JSON.stringify(record)));
});
await environment.cleanup();
console.log(
  "QA local provisionado: owner/member/outsider e dados exclusivamente sintéticos."
);
