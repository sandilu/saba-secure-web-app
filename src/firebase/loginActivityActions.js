// src/firebase/loginActivityActions.js
// Tracks login and logout events for security monitoring and audit trail.

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebaseServices";

/**
 * Records a login event to the loginActivities collection.
 * @param {Object} user       - Firebase Auth user object
 * @param {Object} profile    - Firestore profile (role, name, etc.)
 * @param {string} method     - "email" | "google"
 */
export async function recordLogin(user, profile = null, method = "email") {
  try {
    await addDoc(collection(db, "loginActivities"), {
      uid: user.uid,
      email: user.email || "",
      name: profile?.name || user.displayName || "",
      role: profile?.role || "staff",
      event: "LOGIN",
      method,
      loginAt: serverTimestamp(),
      logoutAt: null,
      timestamp: serverTimestamp(),
      sessionId: _generateSessionId(),
      userAgent:
        typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
    });
  } catch (err) {
    console.error("[LoginActivity] Failed to record login:", err);
  }
}

/**
 * Records a logout event to the loginActivities collection.
 * @param {Object} user    - Firebase Auth user object (snapshot before signOut)
 * @param {Object} profile - Firestore profile snapshot
 */
export async function recordLogout(user, profile = null) {
  try {
    await addDoc(collection(db, "loginActivities"), {
      uid: user.uid,
      email: user.email || "",
      name: profile?.name || user.displayName || "",
      role: profile?.role || "staff",
      event: "LOGOUT",
      method: null,
      loginAt: null,
      logoutAt: serverTimestamp(),
      timestamp: serverTimestamp(),
      sessionId: null,
      userAgent:
        typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
    });
  } catch (err) {
    console.error("[LoginActivity] Failed to record logout:", err);
  }
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function _generateSessionId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
