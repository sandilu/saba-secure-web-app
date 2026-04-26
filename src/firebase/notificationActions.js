import {
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "./firebaseServices";

// Listen to notifications.
// Admins get all notifications.
// Other roles run TWO separate queries (by role + by uid) and merge them client-side
// to avoid needing a Firestore composite index for `or()` + `orderBy()`.
export function listenNotifications(userId, role, onUpdate, onError) {
  if (role === "admin") {
    const q = query(
      collection(db, "notifications"),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        onUpdate(list);
      },
      (err) => onError(err)
    );
  }

  // Non-admin: merge two real-time listeners client-side
  let byRole = [];
  let byUid  = [];
  let unsubRole = null;
  let unsubUid  = null;
  let stopped = false;

  function merge() {
    if (stopped) return;
    // Deduplicate by id, then sort newest first
    const all = [...byRole, ...byUid];
    const seen = new Set();
    const deduped = all.filter((n) => {
      if (seen.has(n.id)) return false;
      seen.add(n.id);
      return true;
    });
    deduped.sort((a, b) => {
      const ta = a.createdAt?.toDate?.() ?? new Date(a.createdAt ?? 0);
      const tb = b.createdAt?.toDate?.() ?? new Date(b.createdAt ?? 0);
      return tb - ta;
    });
    onUpdate(deduped);
  }

  try {
    const qRole = query(
      collection(db, "notifications"),
      where("targetRole", "==", role),
      orderBy("createdAt", "desc")
    );
    unsubRole = onSnapshot(
      qRole,
      (snap) => {
        byRole = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        merge();
      },
      (err) => onError(err)
    );

    const qUid = query(
      collection(db, "notifications"),
      where("targetUid", "==", userId),
      orderBy("createdAt", "desc")
    );
    unsubUid = onSnapshot(
      qUid,
      (snap) => {
        byUid = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        merge();
      },
      (err) => onError(err)
    );
  } catch (err) {
    onError(err);
  }

  // Return a combined unsubscribe function
  return () => {
    stopped = true;
    unsubRole?.();
    unsubUid?.();
  };
}

export async function createNotification(data) {
  // Prevent duplicate spam for the same targetId + type (unread only)
  if (data.targetId && data.type) {
    try {
      const qDuplicate = query(
        collection(db, "notifications"),
        where("targetId", "==", data.targetId),
        where("type", "==", data.type),
        where("isRead", "==", false)
      );
      const snap = await getDocs(qDuplicate);
      if (!snap.empty) {
        // Unread notification already exists for this event — skip.
        return snap.docs[0].id;
      }
    } catch (_) {
      // If the index doesn't exist yet, skip dedup check and just create
    }
  }

  const payload = {
    ...data,
    isRead: false,
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, "notifications"), payload);
  return docRef.id;
}

export async function markNotificationRead(id) {
  const ref = doc(db, "notifications", id);
  await updateDoc(ref, {
    isRead: true,
    readAt: serverTimestamp(),
  });
}

export async function deleteNotification(id) {
  await deleteDoc(doc(db, "notifications", id));
}
