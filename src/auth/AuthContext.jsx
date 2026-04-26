import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase/firebaseServices";
import { logout as logoutAction } from "../firebase/authActions";
import { recordLogin, recordLogout } from "../firebase/loginActivityActions";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      setUser(firebaseUser);

      if (!firebaseUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        const userRef = doc(db, "users", firebaseUser.uid);
        const snap = await getDoc(userRef);

        if (snap.exists()) {
          const profileData = snap.data();

          // Sync emailVerified flag if changed
          if (profileData.emailVerified !== !!firebaseUser.emailVerified) {
            try {
              await updateDoc(userRef, {
                emailVerified: !!firebaseUser.emailVerified,
                updatedAt: serverTimestamp(),
              });
            } catch (err) {
              console.warn("Failed to sync emailVerified:", err?.message || err);
            }
          }

          const mergedProfile = {
            ...profileData,
            emailVerified: !!firebaseUser.emailVerified,
          };

          setProfile(mergedProfile);

          // Record login activity (fires once per auth state gain)
          // Detect method from providerData
          const method =
            firebaseUser.providerData?.[0]?.providerId === "google.com"
              ? "google"
              : "email";

          recordLogin(firebaseUser, mergedProfile, method).catch(() => {});
        } else {
          setProfile(null);
        }
      } catch (err) {
        console.warn("Profile fetch failed:", err?.message || err);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  const role = profile?.role || null;
  const status = profile?.status || null;
  const isAdmin = role === "admin";
  const isStaff = role === "staff";
  const isActive = status === "active";
  const isDisabled = status === "disabled";

  const logout = async () => {
    // Capture snapshot before signOut clears the state
    const currentUser = auth.currentUser;
    if (currentUser) {
      await recordLogout(currentUser, profile).catch(() => {});
    }
    await logoutAction();
  };

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      role,
      status,
      isAdmin,
      isStaff,
      isActive,
      isDisabled,
      logout,
    }),
    [user, profile, loading, role, status, isAdmin, isStaff, isActive, isDisabled]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}