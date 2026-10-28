import { initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
  type User,
} from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { deleteObject, getBlob, getStorage, ref as storageRef, uploadBytes } from "firebase/storage";
import type { Attachment } from "./models";
import { sanitizeFileName } from "./finance";

const firebaseConfig = {
  apiKey: "AIzaSyCZC7S6h5xqRPElWjSqc60guG8gOkuT9dQ",
  authDomain: "reverso-works.firebaseapp.com",
  projectId: "reverso-works",
  storageBucket: "reverso-works.firebasestorage.app",
  messagingSenderId: "222670798861",
  appId: "1:222670798861:web:fd87d681048bdded5e1544",
};

export const WORKSPACE_ID = "reverso-private";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
void setPersistence(auth, browserLocalPersistence);

export function workspaceDoc() {
  return doc(db, "workspaces", WORKSPACE_ID);
}

export function workspaceCollection(name: string) {
  return collection(db, "workspaces", WORKSPACE_ID, name);
}

export async function prepareWorkspace(user: User) {
  const email = user.email?.trim().toLowerCase();
  if (!email) {
    throw new Error("A conta autenticada não possui e-mail.");
  }

  const ref = workspaceDoc();
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    await setDoc(ref, {
      name: "Reverso Works",
      ownerUid: user.uid,
      allowedEmails: [email],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  const workspace = await getDoc(ref);
  const allowedEmails = (workspace.data()?.allowedEmails ?? []).map((item: string) =>
    item.toLowerCase(),
  );

  if (!allowedEmails.includes(email)) {
    throw new Error("Esta conta não está autorizada para o espaço Reverso Works.");
  }

  return workspace.data();
}

export async function addWorkspaceEmail(email: string) {
  const ref = workspaceDoc();
  const snapshot = await getDoc(ref);
  const allowedEmails = (snapshot.data()?.allowedEmails ?? []).map((item: string) =>
    item.toLowerCase(),
  );
  const normalized = email.trim().toLowerCase();

  if (!normalized || allowedEmails.includes(normalized)) return;

  await updateDoc(ref, {
    allowedEmails: [...allowedEmails, normalized],
    updatedAt: serverTimestamp(),
  });
}

export async function logActivity(
  type: string,
  title: string,
  detail: string,
  metadata: Record<string, unknown> = {},
) {
  await addDoc(workspaceCollection("calendar"), {
    type,
    title,
    detail,
    date: new Date().toISOString(),
    metadata,
    createdAt: serverTimestamp(),
  });
}

export async function uploadStlAttachment(recordId: string, file: File): Promise<Attachment> {
  if (!file.name.toLowerCase().endsWith(".stl")) {
    throw new Error("Selecione um arquivo .STL.");
  }
  if (file.size <= 0 || file.size >= 50 * 1024 * 1024) {
    throw new Error("O arquivo .STL deve ter menos de 50 MB.");
  }

  const baseName = file.name.replace(/\.stl$/i, "");
  const objectName = `${sanitizeFileName(recordId)}--${crypto.randomUUID()}--${sanitizeFileName(baseName)}.stl`;
  const path = `workspaces/${WORKSPACE_ID}/stl/${objectName}`;
  const reference = storageRef(storage, path);
  await uploadBytes(reference, file, {
    contentType: "model/stl",
    customMetadata: { recordId, originalName: file.name },
  });

  return {
    id: crypto.randomUUID(),
    name: file.name,
    storagePath: path,
    size: file.size,
    contentType: "model/stl",
    uploadedAt: new Date().toISOString(),
  };
}

const documentTypes: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  stl: "model/stl",
};

export async function uploadDocumentAttachment(recordId: string, file: File): Promise<Attachment> {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const contentType = documentTypes[extension];
  if (!contentType) throw new Error("Anexe apenas PDF, PNG, JPG ou STL.");
  if (file.size <= 0 || file.size > 15 * 1024 * 1024) {
    throw new Error("O arquivo deve ter entre 1 byte e 15 MB.");
  }

  const objectName = `${crypto.randomUUID()}--${sanitizeFileName(file.name)}`;
  const path = `workspaces/${WORKSPACE_ID}/documents/${sanitizeFileName(recordId)}/${objectName}`;
  const reference = storageRef(storage, path);
  await uploadBytes(reference, file, {
    contentType,
    customMetadata: { recordId, originalName: file.name },
  });

  return {
    id: crypto.randomUUID(),
    name: file.name,
    storagePath: path,
    size: file.size,
    contentType,
    uploadedAt: new Date().toISOString(),
  };
}

export async function downloadStoredAttachment(attachment: Attachment): Promise<void> {
  const path = attachment.storagePath;
  const allowedPrefixes = [
    `workspaces/${WORKSPACE_ID}/documents/`,
    `workspaces/${WORKSPACE_ID}/stl/`,
  ];
  if (!path || !allowedPrefixes.some((prefix) => path.startsWith(prefix))) {
    throw new Error("O arquivo não possui um caminho autenticado válido neste workspace.");
  }

  const blob = await getBlob(storageRef(storage, path));
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = attachment.name;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
}

export async function deleteStoredAttachment(attachment: Attachment): Promise<void> {
  if (!attachment.storagePath) return;
  const allowedPrefixes = [
    `workspaces/${WORKSPACE_ID}/documents/`,
    `workspaces/${WORKSPACE_ID}/stl/`,
  ];
  if (!allowedPrefixes.some((prefix) => attachment.storagePath?.startsWith(prefix))) {
    throw new Error("O caminho do anexo não pertence às áreas autorizadas deste workspace.");
  }
  await deleteObject(storageRef(storage, attachment.storagePath));
}
