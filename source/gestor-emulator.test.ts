import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { deleteApp, initializeApp, type FirebaseApp } from "firebase/app";
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  deleteObject,
  getBytes,
  type StorageReference,
  uploadBytes,
} from "firebase/storage";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestContext,
} from "@firebase/rules-unit-testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  saveOrderAtomic,
  convertEstimateAtomic,
  saveRevisionAtomic,
} from "./client/src/gestor/repository";
import { demoData, normalizeStudioOrder } from "./client/src/gestor/domain";
import { createWorkflow } from "./client/src/gestor/jobWorkflow";
import { findService } from "./client/src/gestor/serviceCatalog";
import type { StudioData, StudioOrder } from "./client/src/gestor/types";
import type { Firestore } from "firebase/firestore";

const PROJECT_ID = "demo-reverso-qa";
const WORKSPACE_ID = "reverso-private";
const WORKSPACE_PATH = `workspaces/${WORKSPACE_ID}`;
const OWNER_UID = "owner-uid";
const MEMBER_UID = "member-uid";
const OUTSIDER_UID = "outsider-uid";
const OWNER_EMAIL = "owner@example.test";
const MEMBER_EMAIL = "member@example.test";
const OUTSIDER_EMAIL = "outsider@example.test";
const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;
const MAX_STL_BYTES = 50 * 1024 * 1024;

const firestoreRules = readFileSync(
  fileURLToPath(new URL("../firestore.rules", import.meta.url)),
  "utf8"
);
const storageRules = readFileSync(
  fileURLToPath(new URL("../storage.rules", import.meta.url)),
  "utf8"
);

type EmulatorAddress = { host: string; port: number };
// RulesTestContext is configured by the test package not to ever reach production.
type TestFirestore = ReturnType<RulesTestContext["firestore"]>;
type TestStorage = ReturnType<RulesTestContext["storage"]>;

let testEnv: Awaited<ReturnType<typeof initializeTestEnvironment>>;
let authApp: FirebaseApp | undefined;

function localEmulatorAddress(variable: string): EmulatorAddress {
  const rawAddress = process.env[variable];
  if (!rawAddress) {
    throw new Error(
      `${variable} não foi definido. Execute somente por scripts/test-emulators.sh para impedir conexões fora dos emuladores.`
    );
  }

  const endpoint = new URL(
    rawAddress.includes("://") ? rawAddress : `http://${rawAddress}`
  );
  const localHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
  const port = Number(endpoint.port);

  if (
    endpoint.protocol !== "http:" ||
    !localHosts.has(endpoint.hostname) ||
    !Number.isInteger(port) ||
    port <= 0
  ) {
    throw new Error(
      `${variable} deve apontar para um emulador HTTP local; recebeu ${rawAddress}.`
    );
  }

  return { host: endpoint.hostname, port };
}

function workspaceDocument(database: TestFirestore) {
  return database.doc(WORKSPACE_PATH);
}

function emulatorStorageReference(storage: TestStorage, path: string) {
  // Firebase modular APIs unwrap compat references supplied by rules-unit-testing.
  return storage.ref(path) as unknown as StorageReference;
}

function documentPath(fileName: string) {
  return `${WORKSPACE_PATH}/documents/order-1/${fileName}`;
}

function stlPath(fileName: string) {
  return `${WORKSPACE_PATH}/stl/${fileName}`;
}

function ownerContext() {
  return testEnv.authenticatedContext(OWNER_UID, { email: OWNER_EMAIL });
}

function memberContext(uid = MEMBER_UID) {
  // The uppercase claim verifies that rules normalize a member e-mail before matching it.
  return testEnv.authenticatedContext(uid, {
    email: MEMBER_EMAIL.toUpperCase(),
  });
}

function outsiderContext() {
  return testEnv.authenticatedContext(OUTSIDER_UID, { email: OUTSIDER_EMAIL });
}

async function seedWorkspace() {
  await testEnv.withSecurityRulesDisabled(async context => {
    await context
      .firestore()
      .doc(WORKSPACE_PATH)
      .set({
        name: "Reverso Works",
        ownerUid: OWNER_UID,
        allowedEmails: [OWNER_EMAIL, MEMBER_EMAIL],
      });
  });
}

async function seedStorageObject(
  path: string,
  contents: Uint8Array,
  contentType: string
) {
  await testEnv.withSecurityRulesDisabled(async context => {
    await uploadBytes(
      emulatorStorageReference(context.storage(), path),
      contents,
      {
        contentType,
      }
    );
  });
}

async function reserveMaterialAtomically(
  database: TestFirestore,
  orderId: string,
  grams: number
) {
  const data = demoData();
  data.materials[0] = { ...data.materials[0], id: "pla", availableGrams: 10 };
  const order = {
    ...data.orders[0],
    id: orderId,
    materialId: "pla",
    materialGrams: grams,
  };
  await saveOrderAtomic(
    (database as any)._delegate as Firestore,
    WORKSPACE_ID,
    order,
    data
  );
}

function repositoryFixture(
  id: string,
  codes = ["P3D-04"],
  packageCode?: string
) {
  const data = demoData();
  const base = data.orders[0];
  const order: StudioOrder = normalizeStudioOrder(
    {
      ...base,
      id,
      documentType: "Orçamento",
      startDate: "2026-11-04",
      workflow: {
        ...createWorkflow(codes, packageCode),
        quotedAmount: codes.length * 100,
      },
      lines: codes.map(code => ({
        ...base.lines[0],
        id: `line-${code}`,
        serviceCode: code,
        label: findService(code)!.name,
        unitPrice: 100,
        pricePending: false,
      })),
    },
    { ...data, orders: [] }
  );
  order.updatedAt = "2026-11-04T12:00:00.000Z";
  data.orders = [order];
  return { data, order };
}

async function seedRepositoryOrder(data: StudioData, order: StudioOrder) {
  await testEnv.withSecurityRulesDisabled(async context => {
    const database = context.firestore();
    await database
      .doc(`${WORKSPACE_PATH}/clients/${order.clientId}`)
      .set(data.clients[0]);
    await database
      .doc(`${WORKSPACE_PATH}/vehicles/${order.vehicleId}`)
      .set(data.vehicles[0]);
    await database.doc(`${WORKSPACE_PATH}/orders/${order.id}`).set(
      JSON.parse(
        JSON.stringify({
          ...order,
          historicalMetadata: { source: "preserve-me" },
        })
      )
    );
  });
}

describe.sequential("Firebase emulator security boundaries", () => {
  beforeAll(async () => {
    const firestore = localEmulatorAddress("FIRESTORE_EMULATOR_HOST");
    const storage = localEmulatorAddress("FIREBASE_STORAGE_EMULATOR_HOST");
    const auth = localEmulatorAddress("FIREBASE_AUTH_EMULATOR_HOST");

    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        host: firestore.host,
        port: firestore.port,
        rules: firestoreRules,
      },
      storage: {
        host: storage.host,
        port: storage.port,
        rules: storageRules,
      },
    });

    authApp = initializeApp(
      {
        apiKey: "demo-reverso-qa-key",
        authDomain: `${PROJECT_ID}.firebaseapp.com`,
        projectId: PROJECT_ID,
        storageBucket: `${PROJECT_ID}.appspot.com`,
      },
      `auth-emulator-${randomUUID()}`
    );
    connectAuthEmulator(getAuth(authApp), `http://${auth.host}:${auth.port}`, {
      disableWarnings: true,
    });
  }, 30_000);

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await testEnv.clearStorage();
    await seedWorkspace();
  }, 30_000);

  afterAll(async () => {
    await testEnv.cleanup();
    if (authApp) await deleteApp(authApp);
  }, 30_000);

  it("uses the Auth emulator for an isolated account instead of a real Firebase account", async () => {
    const auth = getAuth(authApp!);
    const email = `emulator-${randomUUID()}@example.test`;
    const password = "Emulator-only-password-123";

    const created = await createUserWithEmailAndPassword(auth, email, password);
    expect(created.user.email).toBe(email);
    expect(created.user.uid).not.toHaveLength(0);

    await signOut(auth);
    const signedIn = await signInWithEmailAndPassword(auth, email, password);
    expect(signedIn.user.uid).toBe(created.user.uid);

    await deleteUser(signedIn.user);
  }, 30_000);

  it("denies unauthenticated Firestore reads and writes", async () => {
    const guest = testEnv.unauthenticatedContext();
    const database = guest.firestore();

    await assertFails(workspaceDocument(database).get());
    await assertFails(
      database.doc(`${WORKSPACE_PATH}/clients/guest-client`).set({
        id: "guest-client",
        name: "Unauthorized write",
      })
    );
  });

  it("allows member reads, denies member writes, and rejects a non-member", async () => {
    const member = memberContext();
    const memberDatabase = member.firestore();
    const outsiderDatabase = outsiderContext().firestore();

    const workspace = await assertSucceeds(
      workspaceDocument(memberDatabase).get()
    );
    expect(workspace.data()?.allowedEmails).toEqual([
      OWNER_EMAIL,
      MEMBER_EMAIL,
    ]);

    await assertFails(
      memberDatabase.doc(`${WORKSPACE_PATH}/clients/member-client`).set({
        id: "member-client",
        name: "Authorized member write",
      })
    );
    await assertFails(workspaceDocument(outsiderDatabase).get());
    await assertFails(
      outsiderDatabase.doc(`${WORKSPACE_PATH}/clients/outsider-client`).set({
        id: "outsider-client",
        name: "Unauthorized member write",
      })
    );
  });

  it("restricts workspace settings and allowedEmails updates to the owner", async () => {
    const ownerDatabase = ownerContext().firestore();
    const memberDatabase = memberContext().firestore();

    await assertSucceeds(
      workspaceDocument(ownerDatabase).update({
        allowedEmails: [OWNER_EMAIL, MEMBER_EMAIL, "new.member@example.test"],
      })
    );
    const updated = await assertSucceeds(
      workspaceDocument(ownerDatabase).get()
    );
    expect(updated.data()?.allowedEmails).toContain("new.member@example.test");

    await assertFails(
      workspaceDocument(memberDatabase).update({
        allowedEmails: [MEMBER_EMAIL],
      })
    );
    const unchanged = await assertSucceeds(
      workspaceDocument(ownerDatabase).get()
    );
    expect(unchanged.data()?.allowedEmails).toEqual([
      OWNER_EMAIL,
      MEMBER_EMAIL,
      "new.member@example.test",
    ]);
  });

  it("permits valid owner uploads and authenticated reads without bearer URLs", async () => {
    const member = ownerContext();
    const storage = member.storage();
    const pdfPath = documentPath("inspection.pdf");
    const modelPath = stlPath("headlight-bracket.stl");
    const pdfPayload = new TextEncoder().encode(
      "%PDF-1.7 authenticated inspection"
    );
    const stlPayload = new TextEncoder().encode(
      "solid bracket\nendsolid bracket"
    );

    const documentUpload = await assertSucceeds(
      uploadBytes(emulatorStorageReference(storage, pdfPath), pdfPayload, {
        contentType: "application/pdf",
      })
    );
    const stlUpload = await assertSucceeds(
      uploadBytes(emulatorStorageReference(storage, modelPath), stlPayload, {
        contentType: "model/stl",
      })
    );
    expect(documentUpload.metadata.contentType).toBe("application/pdf");
    expect(stlUpload.metadata.contentType).toBe("model/stl");

    const attachment = {
      id: "attachment-1",
      name: "inspection.pdf",
      storagePath: pdfPath,
      size: pdfPayload.byteLength,
      contentType: "application/pdf",
    };
    const downloaded = await assertSucceeds(
      getBytes(emulatorStorageReference(storage, attachment.storagePath))
    );

    expect(new TextDecoder().decode(downloaded)).toBe(
      "%PDF-1.7 authenticated inspection"
    );
    expect(attachment).not.toHaveProperty("downloadUrl");
  });

  it("denies unauthenticated Storage access and rejects invalid MIME types", async () => {
    const protectedPath = documentPath("protected.pdf");
    await seedStorageObject(
      protectedPath,
      new TextEncoder().encode("protected document"),
      "application/pdf"
    );

    const guestStorage = testEnv.unauthenticatedContext().storage();
    const memberStorage = ownerContext().storage();

    await assertFails(
      getBytes(emulatorStorageReference(guestStorage, protectedPath))
    );
    await assertFails(
      deleteObject(emulatorStorageReference(guestStorage, protectedPath))
    );
    await assertFails(
      uploadBytes(
        emulatorStorageReference(guestStorage, documentPath("guest.pdf")),
        new Uint8Array([1]),
        {
          contentType: "application/pdf",
        }
      )
    );
    await assertFails(
      uploadBytes(
        emulatorStorageReference(
          memberStorage,
          documentPath("not-allowed.txt")
        ),
        new Uint8Array([1]),
        {
          contentType: "text/plain",
        }
      )
    );
    await assertFails(
      uploadBytes(
        emulatorStorageReference(memberStorage, stlPath("wrong-mime.stl")),
        new Uint8Array([1]),
        {
          contentType: "application/sla",
        }
      )
    );
  });

  it("enforces the exact document and STL size limits", async () => {
    const storage = ownerContext().storage();

    await assertFails(
      uploadBytes(
        emulatorStorageReference(storage, documentPath("over-15-mib.pdf")),
        new Uint8Array(MAX_DOCUMENT_BYTES + 1),
        { contentType: "application/pdf" }
      )
    );
    await assertFails(
      uploadBytes(
        emulatorStorageReference(storage, stlPath("at-50-mib.stl")),
        new Uint8Array(MAX_STL_BYTES),
        { contentType: "model/stl" }
      )
    );
  }, 90_000);

  it("allows a member to delete an authorized file and keeps non-members out", async () => {
    const removablePath = documentPath("removable.pdf");
    await seedStorageObject(
      removablePath,
      new TextEncoder().encode("remove me"),
      "application/pdf"
    );

    await assertFails(
      deleteObject(
        emulatorStorageReference(outsiderContext().storage(), removablePath)
      )
    );
    await assertSucceeds(
      deleteObject(
        emulatorStorageReference(ownerContext().storage(), removablePath)
      )
    );
    await expect(
      getBytes(
        emulatorStorageReference(ownerContext().storage(), removablePath)
      )
    ).rejects.toMatchObject({
      code: "storage/object-not-found",
    });
  });

  it("commits only one concurrent stock reservation and never oversells material", async () => {
    await testEnv.withSecurityRulesDisabled(async context => {
      const data = demoData();
      await context
        .firestore()
        .doc(`${WORKSPACE_PATH}/clients/demo-client`)
        .set(data.clients[0]);
      await context
        .firestore()
        .doc(`${WORKSPACE_PATH}/vehicles/demo-vehicle`)
        .set(data.vehicles[0]);
      await context.firestore().doc(`${WORKSPACE_PATH}/materials/pla`).set({
        id: "pla",
        availableGrams: 10,
        reorderAtGrams: 2,
        pricePerGram: 0.03,
      });
    });

    const reservations = await Promise.allSettled([
      reserveMaterialAtomically(ownerContext().firestore(), "order-a", 7),
      reserveMaterialAtomically(ownerContext().firestore(), "order-b", 7),
    ]);
    const committed = reservations.filter(
      (reservation): reservation is PromiseFulfilledResult<void> =>
        reservation.status === "fulfilled"
    );
    const rejected = reservations.filter(
      (reservation): reservation is PromiseRejectedResult =>
        reservation.status === "rejected"
    );

    expect(committed).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toBeInstanceOf(Error);
    expect((rejected[0]?.reason as Error).message).toContain(
      "Estoque insuficiente"
    );

    const ownerDatabase = ownerContext().firestore();
    const material = await assertSucceeds(
      ownerDatabase.doc(`${WORKSPACE_PATH}/materials/pla`).get()
    );
    const orders = await assertSucceeds(
      ownerDatabase.collection(`${WORKSPACE_PATH}/orders`).get()
    );

    expect(material.data()?.availableGrams).toBe(3);
    expect(orders.docs).toHaveLength(1);
    expect(orders.docs[0]?.data()).toMatchObject({
      materialId: "pla",
      materialGrams: 7,
    });
  }, 30_000);
  it("denies workspace bootstrap by an arbitrary authenticated client", async () => {
    await testEnv.clearFirestore();
    const outsider = outsiderContext().firestore();
    await assertFails(
      outsider
        .doc(WORKSPACE_PATH)
        .set({ ownerUid: OUTSIDER_UID, allowedEmails: [OUTSIDER_EMAIL] })
    );
  });
  it("enforces owner-only settings and rejects negative direct writes", async () => {
    const data = demoData();
    const member = memberContext().firestore();
    const owner = ownerContext().firestore();
    await assertFails(
      member.doc(`${WORKSPACE_PATH}/settings/studio`).set(data.settings[0])
    );
    await assertSucceeds(
      owner.doc(`${WORKSPACE_PATH}/settings/studio`).set(data.settings[0])
    );
    await assertFails(
      member
        .doc(`${WORKSPACE_PATH}/catalogItems/negative`)
        .set({ name: "Invalid", unitPrice: -2 })
    );
    await assertFails(
      member
        .doc(`${WORKSPACE_PATH}/materials/negative`)
        .set({ ...data.materials[0], availableGrams: -1 })
    );
  });
  it("uses the real repository to convert once and preserve an invoice snapshot", async () => {
    const data = demoData();
    const estimate = normalizeStudioOrder(
      {
        ...data.orders[0],
        lines: data.orders[0].lines.map(line => ({
          ...line,
          unitPrice: 25,
          pricePending: false,
        })),
        id: "estimate-source",
        documentType: "Estimativa",
        clientSnapshot: undefined,
      },
      data
    );
    await testEnv.withSecurityRulesDisabled(async context => {
      const database = context.firestore();
      await database
        .doc(`${WORKSPACE_PATH}/clients/demo-client`)
        .set(data.clients[0]);
      await database
        .doc(`${WORKSPACE_PATH}/vehicles/demo-vehicle`)
        .set(data.vehicles[0]);
      await database
        .doc(`${WORKSPACE_PATH}/orders/estimate-source`)
        .set(JSON.parse(JSON.stringify(estimate)));
    });
    const db = (ownerContext().firestore() as any)._delegate as Firestore;
    const a = await convertEstimateAtomic(db, WORKSPACE_ID, estimate.id, data),
      b = await convertEstimateAtomic(db, WORKSPACE_ID, estimate.id, data);
    expect(a.id).toBe(b.id);
    data.clients[0].name = "Changed later";
    await saveOrderAtomic(
      db,
      WORKSPACE_ID,
      { ...a, title: "Edited invoice" },
      data
    );
    const saved = await ownerContext()
      .firestore()
      .doc(`${WORKSPACE_PATH}/orders/${a.id}`)
      .get();
    expect(saved.data()?.clientSnapshot.name).toBe("Cliente de demonstração");
  });
  it("moves revision pointers atomically using the actual repository", async () => {
    const data = demoData();
    data.parts = [
      {
        id: "part-a",
        name: "A",
        invoiceIds: [],
        createdAt: "2026-11-04T12:00:00.000Z",
      },
      {
        id: "part-b",
        name: "B",
        invoiceIds: [],
        createdAt: "2026-11-04T12:00:00.000Z",
      },
    ];
    await testEnv.withSecurityRulesDisabled(async context => {
      for (const part of data.parts)
        await context
          .firestore()
          .doc(`${WORKSPACE_PATH}/parts/${part.id}`)
          .set(part);
    });
    const db = (ownerContext().firestore() as any)._delegate as Firestore;
    const revision = {
      id: "revision-1",
      partId: "part-a",
      title: "Bracket",
      version: "v1",
      notes: "",
      invoiceIds: [],
      attachments: [],
      createdAt: "2026-11-04T12:00:00.000Z",
    };
    await saveRevisionAtomic(db, WORKSPACE_ID, revision, data);
    await saveRevisionAtomic(
      db,
      WORKSPACE_ID,
      { ...revision, partId: "part-b" },
      data
    );
    const owner = ownerContext().firestore();
    expect(
      (await owner.doc(`${WORKSPACE_PATH}/parts/part-a`).get()).data()
        ?.currentRevisionId
    ).toBeUndefined();
    expect(
      (await owner.doc(`${WORKSPACE_PATH}/parts/part-b`).get()).data()
        ?.currentRevisionId
    ).toBe(revision.id);
  });

  it("accepts only one concurrent editor and preserves the winning CAD and payment arrays", async () => {
    const { data, order } = repositoryFixture("race-order");
    order.workflow!.cadVersions = ["v1"];
    await seedRepositoryOrder(data, order);
    const firstDb = (ownerContext().firestore() as any)._delegate as Firestore;
    const secondDb = (ownerContext().firestore() as any)._delegate as Firestore;
    const outcomes = await Promise.allSettled([
      saveOrderAtomic(
        firstDb,
        WORKSPACE_ID,
        {
          ...order,
          title: "Primeiro editor",
          workflow: { ...order.workflow!, cadVersions: ["v1", "v2-first"] },
          payments: [
            {
              id: "first-payment",
              amount: 20,
              method: "Cash",
              date: "2026-11-04",
            },
          ],
        },
        data
      ),
      saveOrderAtomic(
        secondDb,
        WORKSPACE_ID,
        {
          ...order,
          title: "Segundo editor",
          workflow: { ...order.workflow!, cadVersions: ["v1", "v2-second"] },
          payments: [
            {
              id: "second-payment",
              amount: 30,
              method: "Cash",
              date: "2026-11-04",
            },
          ],
        },
        data
      ),
    ]);
    const successes = outcomes.filter(
      (result): result is PromiseFulfilledResult<StudioOrder> =>
        result.status === "fulfilled"
    );
    const failures = outcomes.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected"
    );
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(failures[0].reason.message).toContain("alterado");
    const winner = successes[0].value;
    const owner = ownerContext().firestore();
    const saved = (
      await owner.doc(`${WORKSPACE_PATH}/orders/${order.id}`).get()
    ).data()!;
    expect(saved.title).toBe(winner.title);
    expect(saved.workflow.cadVersions).toEqual(winner.workflow!.cadVersions);
    expect(saved.payments).toEqual(winner.payments);
    expect(saved.updatedAt).toBe(winner.updatedAt);
    expect(
      (await owner.collection(`${WORKSPACE_PATH}/calendar`).get()).docs
    ).toHaveLength(1);
    await expect(
      saveOrderAtomic(
        secondDb,
        WORKSPACE_ID,
        { ...order, title: "Editor ainda desatualizado" },
        data
      )
    ).rejects.toThrow("alterado");
  }, 30_000);

  it("rejects truncating server CAD history even with a current token and stale local history", async () => {
    const { data, order } = repositoryFixture("cad-order");
    order.workflow!.cadVersions = ["v1"];
    const actual = {
      ...order,
      workflow: { ...order.workflow!, cadVersions: ["v1", "v2"] },
    };
    await seedRepositoryOrder(data, actual);
    const db = (ownerContext().firestore() as any)._delegate as Firestore;
    await expect(
      saveOrderAtomic(db, WORKSPACE_ID, order, data)
    ).rejects.toThrow("append-only");
    const owner = ownerContext().firestore();
    const saved = (
      await owner.doc(`${WORKSPACE_PATH}/orders/${order.id}`).get()
    ).data()!;
    expect(saved.workflow.cadVersions).toEqual(["v1", "v2"]);
    expect(saved.updatedAt).toBe(order.updatedAt);
    expect(
      (await owner.collection(`${WORKSPACE_PATH}/calendar`).get()).docs
    ).toHaveLength(0);
  });

  it("replaces the whole workflow map so cleared booleans, details, task metadata and package stay cleared", async () => {
    const { data, order } = repositoryFixture(
      "clear-workflow",
      ["PDR-01", "PDR-02", "DET-01"],
      "PCT-02"
    );
    order.workflow!.details = {
      "PDR.paintIntact": true,
      "PDR.panel": "Porta",
      "DET.upsellApproved": true,
    };
    order.workflow!.tasks = {
      "DET-01": { done: false, completedAt: "2026-11-04T12:00:00.000Z" },
    };
    order.workflow!.depositApplicable = true;
    await seedRepositoryOrder(data, order);
    const cleared = {
      ...order.workflow!,
      packageCode: undefined,
      depositApplicable: false,
      details: { "PDR.paintIntact": false },
      tasks: { "DET-01": { done: false } },
    };
    const db = (ownerContext().firestore() as any)._delegate as Firestore;
    const result = await saveOrderAtomic(
      db,
      WORKSPACE_ID,
      { ...order, workflow: cleared },
      data
    );
    const saved = (
      await ownerContext()
        .firestore()
        .doc(`${WORKSPACE_PATH}/orders/${order.id}`)
        .get()
    ).data()!;
    expect(saved.workflow).toEqual(result.workflow);
    expect(saved.workflow.packageCode).toBeUndefined();
    expect(saved.workflow.details).toEqual({ "PDR.paintIntact": false });
    expect(saved.workflow.depositApplicable).toBe(false);
    expect(saved.workflow.tasks).toEqual({ "DET-01": { done: false } });
    expect(saved.historicalMetadata).toEqual({ source: "preserve-me" });
  });

  it("allows a tokenless legacy edit only once and rejects a new-ID collision with an existing versioned record", async () => {
    const { data, order } = repositoryFixture("legacy-token");
    order.updatedAt = undefined;
    await seedRepositoryOrder(data, order);
    const db = (ownerContext().firestore() as any)._delegate as Firestore;
    const saved = await saveOrderAtomic(db, WORKSPACE_ID, order, data);
    expect(saved.updatedAt).toBeTruthy();
    await expect(
      saveOrderAtomic(
        db,
        WORKSPACE_ID,
        { ...order, title: "Tentativa de colisão" },
        { ...data, orders: [] }
      )
    ).rejects.toThrow("alterado");
    const readback = (
      await ownerContext()
        .firestore()
        .doc(`${WORKSPACE_PATH}/orders/${order.id}`)
        .get()
    ).data()!;
    expect(readback.updatedAt).toBe(saved.updatedAt);
    expect(readback.title).toBe(order.title);
  });

  it("converts an approved official source using its actual server stage, not a stale local Lead", async () => {
    const { data, order } = repositoryFixture("official-estimate", ["DET-01"]);
    const actual = normalizeStudioOrder(
      {
        ...order,
        workflow: {
          ...order.workflow!,
          stage: "approved",
          problem: "Escopo avaliado",
          estimatedDeadline: "2026-11-10",
          beforePhotos: [
            {
              name: "before.jpg",
              contentType: "image/jpeg",
              storagePath: "test/before.jpg",
            },
          ],
        },
      },
      {
        ...data,
        orders: [
          { ...order, workflow: { ...order.workflow!, stage: "quote" } },
        ],
      }
    );
    await seedRepositoryOrder(data, actual);
    const db = (ownerContext().firestore() as any)._delegate as Firestore;
    const invoice = await convertEstimateAtomic(
      db,
      WORKSPACE_ID,
      order.id,
      data
    );
    expect(invoice.workflow!.stage).toBe("approved");
    expect(invoice.sourceEstimateId).toBe(order.id);
    expect(invoice.completed).toBe(false);
    expect(
      (
        await ownerContext()
          .firestore()
          .doc(`${WORKSPACE_PATH}/orders/${invoice.id}`)
          .get()
      ).data()?.workflow.stage
    ).toBe("approved");
  });
});
