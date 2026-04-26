// src/firebase/supplierActions.js
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebaseServices";
import { logAction } from "./auditLogger";

export function listenSuppliers(callback, onError) {
  const q = query(collection(db, "suppliers"), orderBy("name", "asc"));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => { if (onError) onError(err); console.error(err); }
  );
}

export async function getSuppliers() {
  const q = query(collection(db, "suppliers"), orderBy("name", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createSupplier(data, user) {
  const payload = {
    name:          String(data.name          || "").trim(),
    contactPerson: String(data.contactPerson || "").trim(),
    email:         String(data.email         || "").trim(),
    phone:         String(data.phone         || "").trim(),
    address:       String(data.address       || "").trim(),
    category:      String(data.category      || "").trim(),
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const docRef = await addDoc(collection(db, "suppliers"), payload);
  await logAction("SUPPLIER_CREATE", user.uid, user.email, payload, "supplier", docRef.id);
  return docRef.id;
}

export async function updateSupplier(id, data, user) {
  const payload = {
    name:          String(data.name          || "").trim(),
    contactPerson: String(data.contactPerson || "").trim(),
    email:         String(data.email         || "").trim(),
    phone:         String(data.phone         || "").trim(),
    address:       String(data.address       || "").trim(),
    category:      String(data.category      || "").trim(),
    updatedAt: serverTimestamp(),
  };
  await updateDoc(doc(db, "suppliers", id), payload);
  await logAction("SUPPLIER_UPDATE", user.uid, user.email, payload, "supplier", id);
}

export async function deleteSupplier(id, user, meta = {}) {
  await deleteDoc(doc(db, "suppliers", id));
  await logAction("SUPPLIER_DELETE", user.uid, user.email, meta, "supplier", id);
}
