// src/firebase/customerActions.js
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
  where,
} from "firebase/firestore";
import { db } from "./firebaseServices";
import { logAction } from "./auditLogger";

export function listenCustomers(callback, onError) {
  const q = query(collection(db, "customers"), orderBy("name", "asc"));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => { if (onError) onError(err); console.error(err); }
  );
}

export async function getCustomers() {
  const q = query(collection(db, "customers"), orderBy("name", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createCustomer(data, user) {
  const payload = {
    name:    String(data.name    || "").trim(),
    email:   String(data.email   || "").trim(),
    phone:   String(data.phone   || "").trim(),
    company: String(data.company || "").trim(),
    address: String(data.address || "").trim(),
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const docRef = await addDoc(collection(db, "customers"), payload);
  await logAction("CUSTOMER_CREATE", user.uid, user.email, payload, "customer", docRef.id);
  return docRef.id;
}

export async function updateCustomer(id, data, user) {
  const payload = {
    name:    String(data.name    || "").trim(),
    email:   String(data.email   || "").trim(),
    phone:   String(data.phone   || "").trim(),
    company: String(data.company || "").trim(),
    address: String(data.address || "").trim(),
    updatedAt: serverTimestamp(),
  };
  await updateDoc(doc(db, "customers", id), payload);
  await logAction("CUSTOMER_UPDATE", user.uid, user.email, payload, "customer", id);
}

export async function deleteCustomer(id, user, meta = {}) {
  await deleteDoc(doc(db, "customers", id));
  await logAction("CUSTOMER_DELETE", user.uid, user.email, meta, "customer", id);
}

// Get all sales for a specific customer
// Note: we do NOT use orderBy here to avoid needing a Firestore composite index.
// Instead we sort client-side after fetching.
export async function getCustomerSales(customerId) {
  const q = query(
    collection(db, "sales"),
    where("customerId", "==", customerId)
  );
  const snap = await getDocs(q);
  const results = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Sort newest first client-side
  results.sort((a, b) => {
    const ta = a.soldAt?.toDate?.() ?? new Date(a.soldAt ?? 0);
    const tb = b.soldAt?.toDate?.() ?? new Date(b.soldAt ?? 0);
    return tb - ta;
  });

  return results;
}
