// src/firebase/inventoryActions.js
import {
  collection,
  getDocs,
  query,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db } from "./firebaseServices";

// one-time fetch (simple)
export async function getInventoryItems() {
  const q = query(collection(db, "inventoryItems"), orderBy("name", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// realtime listener (recommended)
export function listenInventoryItems(callback, onError) {
  const q = query(collection(db, "inventoryItems"), orderBy("name", "asc"));
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