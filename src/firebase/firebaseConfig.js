// src/firebase/firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAXdhML17_Lshd42iVlg4RzgDxDyOwjL1A",
  authDomain: "saba-app-c5e99.firebaseapp.com",
  projectId: "saba-app-c5e99",
  storageBucket: "saba-app-c5e99.firebasestorage.app",
  messagingSenderId: "110582876531",
  appId: "1:110582876531:web:015e7dca0090ab3c369d06",
};

export const app = initializeApp(firebaseConfig);

// ✅ Auth + Firestore exports
export const auth = getAuth(app);
export const db = getFirestore(app);