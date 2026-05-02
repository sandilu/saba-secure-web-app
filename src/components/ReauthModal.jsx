import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { reauthenticateCurrentUser } from "../auth/reauth";
import { Input, Pill } from "../ui/Layout";

/**
 * ReauthModal Component
 * Requies the admin to re-enter their password before performing risky actions.
 * 
 * @param {Object} props
 * @param {Object} props.state - { title, body, onConfirm } or null
 * @param {Function} props.onClose - Function to close the modal
 */
export default function ReauthModal({ state, onClose }) {
  const { user } = useAuth();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const cancelRef = useRef(null);
  const passwordRef = useRef(null);

  // Reset state when modal opens
  useEffect(() => {
    if (state) {
      setPassword("");
      setError("");
      setLoading(false);
      // Short delay to ensure DOM is ready for focus
      setTimeout(() => passwordRef.current?.focus(), 100);
    }
  }, [state]);

  // Handle global keys
  useEffect(() => {
    if (!state) return;
    function onKey(e) {
      if (e.key === "Escape") onClose();
      // Enter key submits if password is present and not loading
      if (e.key === "Enter" && password.trim() && !loading) {
        handleConfirm();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, onClose, password, loading]);

  if (!state) return null;

  const { title, body, onConfirm } = state;

  async function handleConfirm() {
    if (!password.trim()) return;
    
    setLoading(true);
    setError("");

    try {
      // Perform Firebase re-authentication
      await reauthenticateCurrentUser(user, password);
      
      // If successful, run the actual risky action
      await onConfirm();
      
      // Close modal on success
      onClose();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 overflow-y-auto"
      style={{ backgroundColor: "rgba(2, 6, 23, 0.85)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="w-full max-w-md rounded-3xl bg-slate-900 ring-1 ring-white/10 shadow-2xl p-6 sm:p-8 flex flex-col gap-6 border border-white/5"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "modalSlideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)" }}
      >
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-2xl grid place-items-center text-xl shrink-0 bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-500/20 shadow-inner">
            🔒
          </div>
          <div className="min-w-0">
            <h2 className="text-white font-semibold text-lg leading-tight">Admin Verification</h2>
            <p className="mt-2 text-sm text-white/60 leading-relaxed">
              {body || "You are performing a sensitive administrative action. Please verify your identity by entering your account password."}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl bg-white/[0.03] p-3 flex items-center gap-3 ring-1 ring-white/5">
            <div className="h-8 w-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-xs font-bold text-indigo-300">
              {user?.email?.charAt(0).toUpperCase() || "A"}
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-widest text-white/30 font-bold">Acting As</div>
              <div className="text-xs text-white/80 truncate">{user?.email}</div>
            </div>
          </div>

          <div>
            <label className="block text-sm text-white/80 mb-2 font-medium">Administrator Password</label>
            <Input
              ref={passwordRef}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your current password"
              disabled={loading}
              className="bg-white/5 border-none"
            />
            {error && (
              <div className="mt-3 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400 animate-pulse">
                {error}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
          <button
            ref={cancelRef}
            onClick={onClose}
            disabled={loading}
            className="rounded-2xl bg-white/5 ring-1 ring-white/10 text-white font-semibold px-6 py-3 text-sm hover:bg-white/10 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!password.trim() || loading}
            className="rounded-2xl bg-white text-slate-950 font-bold px-6 py-3 text-sm hover:opacity-90 disabled:opacity-50 transition shadow-lg shadow-white/5 min-w-[120px]"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4 text-slate-950" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Verifying...
              </span>
            ) : "Verify & Confirm"}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes modalSlideIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);    }
        }
      `}</style>
    </div>
  );
}
