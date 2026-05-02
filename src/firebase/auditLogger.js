import { addDoc, collection, getDocs, limit, orderBy, query, serverTimestamp } from "firebase/firestore";
import { db } from "./firebaseServices";

// Actions that trigger admin-activity anomaly checks after logging
const SENSITIVE_ANOMALY_ACTIONS = new Set([
  "USER_ROLE_UPDATE",
  "USER_STATUS_UPDATE",
  "INVENTORY_DELETE",
  "DOCUMENT_STATUS_CHANGE",
  "SALE_CANCELLED",
  "SALE_RETURNED",
  "SALE_PARTIALLY_RETURNED",
]);

/**
 * Logs a sensitive action to the auditLogs collection.
 * For sensitive actions, also runs risky-admin-activity anomaly detection (non-blocking).
 */
export async function logAction(
  action,
  performedByUid,
  performedByEmail,
  details = {},
  targetType = "",
  targetId = ""
) {
  // ── Primary: write audit log ─────────────────────────────────────────────
  try {
    await addDoc(collection(db, "auditLogs"), {
      action,
      performedByUid,
      performedByEmail,
      targetType,
      targetId,
      details,
      timestamp: serverTimestamp(),
    });
    console.log(`[AuditLog]: ${action} success`);
  } catch (err) {
    console.error(`[AuditLog] Failed to log ${action}:`, err);
  }

  // ── Secondary (non-blocking): anomaly check for sensitive actions ─────────
  // ANOMALY_ALERT_CREATED is excluded to prevent infinite recursion.
  if (SENSITIVE_ANOMALY_ACTIONS.has(action)) {
    // Run async without awaiting so it never blocks the caller
    (async () => {
      try {
        const { runAuditAnomalyChecks } = await import("../utils/anomalyRules");
        const { createAnomalyAlerts }   = await import("./anomalyActions");

        // Fetch recent audit logs with a limit to avoid large reads
        const recentLogsSnap = await getDocs(
          query(collection(db, "auditLogs"), orderBy("timestamp", "desc"), limit(30))
        );
        const recentLogs = recentLogsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

        const anomalies = runAuditAnomalyChecks({ auditLogs: recentLogs });
        if (anomalies.length > 0) {
          console.log("[AuditLog] Sensitive action triggered anomaly check, found:", anomalies.length);
          await createAnomalyAlerts(anomalies, { uid: performedByUid, email: performedByEmail });
        }
      } catch (anomalyErr) {
        console.warn("[AuditLog] Anomaly check failed (non-critical):", anomalyErr);
      }
    })();
  }
}