import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebaseServices";

/**
 * Logs a sensitive action to the auditLogs collection.
 * @param {string} action - The action identifier (e.g., 'INVENTORY_CREATE').
 * @param {string} performedByUid - User ID who performed the action.
 * @param {string} performedByEmail - Email of the user who performed the action.
 * @param {Object} details - Additional metadata about the action.
 */
export async function logAction(action, performedByUid, performedByEmail, details = {}) {
  try {
    const payload = {
      action,
      performedByUid,
      performedByEmail,
      details,
      timestamp: serverTimestamp(),
    };
    await addDoc(collection(db, "auditLogs"), payload);
    console.log(`[AuditLog]: ${action} success`);
  } catch (err) {
    console.error(`[AuditLog] Failed to log ${action}:`, err);
  }
}
