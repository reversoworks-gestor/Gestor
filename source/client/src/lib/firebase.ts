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
