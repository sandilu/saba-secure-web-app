// src/firebase/inventoryActions.js
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

function sanitizeInventoryPayload(data = {}) {
  return {
    itemName: String(data.itemName || "").trim(),
    sku: String(data.sku || "").trim().toUpperCase(),
    category: String(data.category || "").trim(),
    quantity: Number(data.quantity || 0),
    minStockLevel: Number(data.minStockLevel || 0),
    buyingPrice: Number(data.buyingPrice || 0),
    sellingPrice: Number(data.sellingPrice || 0),
    supplier: String(data.supplier || "").trim(),
    location: String(data.location || "").trim(),
  };
}

function validateInventoryPayload(data) {
  if (!data.itemName) throw new Error("Item name is required.");
  if (!data.sku) throw new Error("SKU is required.");
  if (data.quantity < 0) throw new Error("Quantity cannot be negative.");
  if (data.minStockLevel < 0) throw new Error("Minimum stock level cannot be negative.");
  if (data.buyingPrice < 0) throw new Error("Buying price cannot be negative.");
  if (data.sellingPrice < 0) throw new Error("Selling price cannot be negative.");
}

export async function getInventoryItems() {
  const q = query(collection(db, "inventoryItems"), orderBy("itemName", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function listenInventoryItems(callback, onError) {
  const q = query(collection(db, "inventoryItems"), orderBy("itemName", "asc"));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      callback(items);
    },
    (err) => {
      if (onError) onError(err);
      console.error(err);
    }
  );
}

export async function createInventoryItem(data, user) {
  const payload = sanitizeInventoryPayload(data);
  validateInventoryPayload(payload);

  const docRef = await addDoc(collection(db, "inventoryItems"), {
    ...payload,
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await logAction(
    "INVENTORY_CREATE",
    user.uid,
    user.email,
    payload,
    "inventory",
    docRef.id
  );

  return docRef.id;
}

export async function updateInventoryItem(itemId, data, user) {
  const payload = sanitizeInventoryPayload(data);
  validateInventoryPayload(payload);

  await updateDoc(doc(db, "inventoryItems", itemId), {
    ...payload,
    updatedAt: serverTimestamp(),
  });

  await logAction(
    "INVENTORY_UPDATE",
    user.uid,
    user.email,
    payload,
    "inventory",
    itemId
  );
}

export async function deleteInventoryItem(itemId, user, meta = {}) {
  await deleteDoc(doc(db, "inventoryItems", itemId));

  await logAction(
    "INVENTORY_DELETE",
    user.uid,
    user.email,
    meta,
    "inventory",
    itemId
  );
}