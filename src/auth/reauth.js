import { EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";

/**
 * Reauthenticates the current user using their password.
 * 
 * @param {import("firebase/auth").User} user - The current Firebase User object
 * @param {string} password - The user's current password
 * @returns {Promise<boolean>} - Resolves to true on success, throws on failure
 */
export async function reauthenticateCurrentUser(user, password) {
  if (!user?.email) {
    throw new Error("No authenticated email user found.");
  }
  
  // Check if user is using email/password provider
  const isEmailUser = user.providerData.some(
    (p) => p.providerId === EmailAuthProvider.PROVIDER_ID
  );
  
  if (!isEmailUser) {
     throw new Error("Password re-authentication is only available for email/password accounts.");
  }

  try {
    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, credential);
    return true;
  } catch (error) {
    console.error("[Reauth] Failed:", error.code, error.message);
    
    if (error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
      throw new Error("Invalid password. Please try again.");
    }
    
    if (error.code === "auth/too-many-requests") {
      throw new Error("Too many failed attempts. Please try again later.");
    }
    
    throw new Error("Re-authentication failed. Please check your password.");
  }
}
