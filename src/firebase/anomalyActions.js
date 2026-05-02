// src/firebase/anomalyActions.js
// Firestore CRUD for the anomalyAlerts collection.
// Also writes to notifications collection and audit log.
//
// ⚠  Index note: Firestore requires a single-field index for orderBy.
//    If the anomalyAlerts collection is brand-new the index is built
//    automatically the first time onSnapshot fires.  Until then we fall
//    back to an unordered snapshot and sort client-side.

import {
  collection,
  addDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  limit,
  updateDoc,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "./firebaseServices";

const COLLECTION = "anomalyAlerts";

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Convert a Firestore Timestamp | Date | string | null → ms epoch */
function toMs(val) {
  if (!val) return 0;
  if (typeof val.toDate === "function") return val.toDate().getTime();
  if (val instanceof Date) return val.getTime();
  return new Date(val).getTime();
}

/** Sort an array of alert docs newest-first, client-side */
function sortNewest(docs) {
  return [...docs].sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
}

// ─── createAnomalyAlert ────────────────────────────────────────────────────────

/**
 * Save a single anomaly alert to Firestore.
 * Writes a matching notification + audit log.
 *
 * @param {Object} anomaly     - Object from anomalyRules.js
 * @param {Object} userProfile - { uid, email, name? }
 * @returns {string|null} docId
 */
export async function createAnomalyAlert(anomaly, userProfile = {}) {
  if (!anomaly || !anomaly.type) return null;

  console.log("[AnomalyAlert] Creating alert:", anomaly.type, anomaly.severity, anomaly.title);

  // ── De-duplicate: skip if an ACTIVE alert of the same type was created
  //    within the last 60 minutes.  We intentionally avoid compound queries
  //    that require composite indexes (type + status + orderBy) since those
  //    may not exist on a fresh deployment.
  try {
    const dupQ = query(
      collection(db, COLLECTION),
      where("type", "==", anomaly.type),
      limit(10)
    );
    const dupSnap = await getDocs(dupQ);
    if (!dupSnap.empty) {
      const recent = dupSnap.docs.find((d) => {
        const data = d.data();
        if (data.status !== "active") return false;
        const ms = toMs(data.createdAt);
        return ms > 0 && Date.now() - ms < 60 * 60 * 1000; // within last 60 min
      });
      if (recent) {
        const age = Math.round((Date.now() - toMs(recent.data().createdAt)) / 60000);
        console.log(`[AnomalyAlert] Skipping duplicate ${anomaly.type} (created ${age} min ago)`);
        return recent.id;
      }
    }
  } catch (dupErr) {
    // Proceed without de-dup if the query fails for any reason
    console.warn("[AnomalyAlert] De-dup skipped:", dupErr.code || dupErr.message);
  }

  // ── Write anomaly alert document ──────────────────────────────────────────
  const payload = {
    type:           anomaly.type,
    severity:       anomaly.severity || "medium",
    title:          anomaly.title,
    message:        anomaly.message,
    metadata:       anomaly.metadata || {},
    status:         "active",
    read:           false,
    createdAt:      serverTimestamp(),
    createdByUid:   userProfile.uid   || "",
    createdByEmail: userProfile.email || "",
    createdByName:  userProfile.name || userProfile.displayName || userProfile.email || "",
  };

  let docRef;
  try {
    docRef = await addDoc(collection(db, COLLECTION), payload);
    console.log("[AnomalyAlert] ✅ Saved to anomalyAlerts collection:", docRef.id);
  } catch (writeErr) {
    console.error("[AnomalyAlert] ❌ Failed to write alert:", writeErr);
    return null;
  }

  // ── Write notification (shows up in Notifications page + Dashboard) ────────
  try {
    const { createNotification } = await import("./notificationActions");
    await createNotification({
      targetRole: "admin",
      type:       "warning",
      category:   "anomaly",
      severity:   anomaly.severity || "medium",
      title:      `🚨 ${anomaly.title}`,
      message:    anomaly.message,
      metadata:   anomaly.metadata || {},
      // No targetId intentionally — dedup in createNotification is skipped
    });
    console.log("[AnomalyAlert] ✅ Anomaly notification written.");
  } catch (notifErr) {
    console.warn("[AnomalyAlert] Notification failed (non-critical):", notifErr);
  }

  // ── Write audit log ───────────────────────────────────────────────────────
  try {
    const { logAction } = await import("./auditLogger");
    await logAction(
      "ANOMALY_ALERT_CREATED",
      userProfile.uid   || "",
      userProfile.email || "",
      { type: anomaly.type, severity: anomaly.severity, title: anomaly.title },
      "anomaly",
      docRef.id
    );
  } catch (auditErr) {
    console.warn("[AnomalyAlert] Audit log failed (non-critical):", auditErr);
  }

  return docRef.id;
}

// ─── markAnomalyReviewed ──────────────────────────────────────────────────────

/**
 * Mark an anomaly alert as reviewed.
 */
export async function markAnomalyReviewed(anomalyId, currentUser) {
  if (!anomalyId || !currentUser) return false;

  console.log("[AnomalyAlert] Marking as reviewed:", anomalyId);

  try {
    const docRef = doc(db, COLLECTION, anomalyId);
    await updateDoc(docRef, {
      status:          "reviewed",
      reviewedAt:      serverTimestamp(),
      reviewedByUid:   currentUser.uid   || "",
      reviewedByEmail: currentUser.email || "",
    });

    // Write audit log
    try {
      const { logAction } = await import("./auditLogger");
      await logAction(
        "ANOMALY_REVIEWED",
        currentUser.uid   || "",
        currentUser.email || "",
        { status: "reviewed" },
        "anomaly",
        anomalyId
      );
    } catch (auditErr) {
      console.warn("[AnomalyAlert] Audit log failed:", auditErr);
    }

    return true;
  } catch (err) {
    console.error("[AnomalyAlert] Failed to mark reviewed:", err);
    return false;
  }
}

// ─── resolveAnomaly ──────────────────────────────────────────────────────────

/**
 * Mark an anomaly alert as resolved.
 */
export async function resolveAnomalyAlert(alertId, actor = {}) {
  if (!alertId) {
    console.error("[AnomalyAlert] Missing ID for resolution");
    return false;
  }

  console.log("[AnomalyAlert] Resolving alert:", alertId);

  try {
    const alertRef = doc(db, COLLECTION, alertId);
    const snap = await getDoc(alertRef);

    if (!snap.exists()) {
      console.warn("[AnomalyAlert] Alert not found for resolution:", alertId);
      return false;
    }

    const currentData = snap.data();
    const previousStatus = String(currentData.status || "active").toLowerCase();

    // 1. Update document
    await updateDoc(alertRef, {
      status:          "resolved",
      resolvedAt:      serverTimestamp(),
      resolvedByUid:   actor.uid   || actor.resolvedByUid   || "",
      resolvedByEmail: actor.email || actor.resolvedByEmail || "",
      updatedAt:       serverTimestamp(),
    });

    // 2. Write audit log
    try {
      const { logAction } = await import("./auditLogger");
      await logAction(
        "ANOMALY_RESOLVED",
        actor.uid   || "",
        actor.email || "",
        {
          notificationId: alertId,
          anomalyId:      alertId,
          previousStatus,
          status:         "resolved",
          type:           currentData.type     || "",
          title:          currentData.title    || "",
          invoiceNumber:  currentData.metadata?.invoiceNumber || "",
          saleId:         currentData.metadata?.saleId        || "",
          severity:       currentData.severity || "",
        },
        "anomaly",
        alertId
      );
    } catch (auditErr) {
      console.warn("[AnomalyAlert] Audit log failed (non-critical):", auditErr);
    }

    console.log("[AnomalyAlert] Resolve success:", alertId);
    return true;
  } catch (err) {
    console.error("[AnomalyAlert] Failed to resolve anomaly:", err);
    return false;
  }
}

// ─── createAnomalyAlerts (batch) ──────────────────────────────────────────────

export async function createAnomalyAlerts(anomalies = [], userProfile = {}) {
  if (!anomalies || anomalies.length === 0) return [];
  console.log("[AnomalyAlerts] Processing", anomalies.length, "anomaly candidate(s):", anomalies.map(a => a.type).join(", "));
  const results = [];
  for (const anomaly of anomalies) {
    try {
      const id = await createAnomalyAlert(anomaly, userProfile);
      if (id) results.push(id);
    } catch (err) {
      console.warn("[AnomalyAlerts] Failed to save anomaly:", anomaly.type, err);
    }
  }
  return results;
}

// ─── getAnomalyAlerts ─────────────────────────────────────────────────────────

/**
 * One-time fetch — works even without a Firestore index by sorting client-side.
 */
export async function getAnomalyAlerts() {
  try {
    // Try ordered query first (works once index is built)
    const q = query(collection(db, COLLECTION), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    console.log("[AnomalyAlerts] getAnomalyAlerts fetched:", docs.length);
    return docs;
  } catch (_indexErr) {
    // Fall back to unordered fetch + client-side sort
    console.warn("[AnomalyAlerts] orderBy index not ready — fetching unordered");
    try {
      const snap = await getDocs(collection(db, COLLECTION));
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      return sortNewest(docs);
    } catch (fallbackErr) {
      console.error("[AnomalyAlerts] getAnomalyAlerts fallback failed:", fallbackErr);
      return [];
    }
  }
}

// ─── listenAnomalyAlerts ──────────────────────────────────────────────────────

/**
 * Real-time listener — falls back to unordered collection watch if the
 * single-field index on `createdAt` has not been built yet.
 *
 * @param {Function} callback - receives alert array (newest first)
 * @returns unsubscribe function
 */
export function listenAnomalyAlerts(callback) {
  // Attempt ordered listener first
  let unsubOrdered = null;
  let unsubFallback = null;
  let usedFallback = false;

  function setupOrdered() {
    const q = query(collection(db, COLLECTION), orderBy("createdAt", "desc"));
    unsubOrdered = onSnapshot(
      q,
      (snap) => {
        const alerts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        console.log("[AnomalyAlerts] 🔴 Live (ordered) count:", alerts.length);
        callback(alerts);
      },
      (err) => {
        // Index not ready — fall back to unordered listener
        console.warn("[AnomalyAlerts] Ordered listener failed, switching to fallback:", err.code || err.message);
        unsubOrdered?.();
        unsubOrdered = null;
        if (!usedFallback) {
          usedFallback = true;
          setupFallback();
        }
      }
    );
  }

  function setupFallback() {
    unsubFallback = onSnapshot(
      collection(db, COLLECTION),
      (snap) => {
        const alerts = sortNewest(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        console.log("[AnomalyAlerts] 🟡 Live (fallback, unordered) count:", alerts.length);
        callback(alerts);
      },
      (err) => {
        console.error("[AnomalyAlerts] Fallback listener failed:", err);
        callback([]);
      }
    );
  }

  setupOrdered();

  return () => {
    unsubOrdered?.();
    unsubFallback?.();
  };
}
