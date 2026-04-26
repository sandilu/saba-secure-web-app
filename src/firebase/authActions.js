// src/firebase/authActions.js

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  sendEmailVerification,
  sendPasswordResetEmail,
} from "firebase/auth";

import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

import { auth, db } from "./firebaseServices";

// Signup + create secure default user profile
export async function signup(email, password, name) {
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name.trim();

  const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);

  await sendEmailVerification(cred.user);

  await setDoc(doc(db, "users", cred.user.uid), {
    uid: cred.user.uid,
    name: cleanName,
    email: cleanEmail,
    role: "staff",
    status: "active",
    emailVerified: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return cred.user;
}

// Login with email/password
export async function login(email, password) {
  const cleanEmail = email.trim().toLowerCase();
  const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);

  if (!cred.user.emailVerified) {
    throw new Error("Please verify your email before logging in.");
  }

  return cred.user;
}

// Google Sign-in
export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(auth, provider);

  const userRef = doc(db, "users", cred.user.uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    await setDoc(userRef, {
      uid: cred.user.uid,
      name: cred.user.displayName || "Google User",
      email: (cred.user.email || "").toLowerCase(),
      role: "staff",
      status: "active",
      emailVerified: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else {
    await updateDoc(userRef, {
      name: cred.user.displayName || snap.data().name || "Google User",
      email: (cred.user.email || snap.data().email || "").toLowerCase(),
      emailVerified: !!cred.user.emailVerified,
      updatedAt: serverTimestamp(),
    });
  }

  return cred.user;
}

// Resend verification email
export async function resendVerification() {
  if (!auth.currentUser) {
    throw new Error("No active user found.");
  }

  await sendEmailVerification(auth.currentUser);
}

// Forgot password
export async function forgotPassword(email) {
  const cleanEmail = email.trim().toLowerCase();

  try {
    await sendPasswordResetEmail(auth, cleanEmail);
    return true;
  } catch (error) {
    console.error("sendPasswordResetEmail error:", error);
    throw error;
  }
}

// Logout
export async function logout() {
  await signOut(auth);
}