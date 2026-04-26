import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebaseServices";

/**
 * Logs a sensitive action to the auditLogs collection.
 * @param {string} action
 * @param {string} performedByUid
 * @param {string} performedByEmail
 * @param {Object} details
 * @param {string} targetType
 * @param {string} targetId
 */
export async function logAction(
  action,
  performedByUid,
  performedByEmail,
  details = {},
  targetType = "",
  targetId = ""
) {
  try {
    const payload = {
      action,
      performedByUid,
      performedByEmail,
      targetType,
      targetId,
      details,
      timestamp: serverTimestamp(),
    };

    await addDoc(collection(db, "auditLogs"), payload);
    console.log(`[AuditLog]: ${action} success`);
  } catch (err) {
    console.error(`[AuditLog] Failed to log ${action}:`, err);
  }
}