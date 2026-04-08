// src/firebase/authActions.js

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";

import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebaseServices";

// ✅ Signup + create user profile with role
export async function signup(email, password, name, role = "staff") {
  const cred = await createUserWithEmailAndPassword(auth, email, password);

  // store role/profile in Firestore
  await setDoc(doc(db, "users", cred.user.uid), {
    uid: cred.user.uid,
    name,
    email,
    role, // "admin" or "staff"
    status: "active",
    createdAt: serverTimestamp(),
  });

  return cred.user;
}

// ✅ Login (Email/Password)
export async function login(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

// ✅ Google Sign-in (Popup)
export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(auth, provider);

  const userRef = doc(db, "users", cred.user.uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    await setDoc(userRef, {
      uid: cred.user.uid,
      name: cred.user.displayName || "Google User",
      email: cred.user.email || "",
      role: "staff",
      status: "active",
      createdAt: serverTimestamp(),
    });
  }

  return cred.user;
}

// ✅ Logout
export async function logout() {
  await signOut(auth);
}