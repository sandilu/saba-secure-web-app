// src/pages/Login.jsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  PageShell,
  Field,
  Input,
  PrimaryButton,
  SecondaryButton,
  Card,
  Pill,
} from "../ui/Layout";
import * as actions from "../firebase/authActions";

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setMsg("");
    setLoading(true);

    try {
      await actions.login(email, password);
      nav("/dashboard");
    } catch (err) {
      setMsg(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setMsg("");
    setLoading(true);

    try {
      await actions.loginWithGoogle();
      nav("/dashboard");
    } catch (err) {
      setMsg(err?.message || "Google login failed");
    } finally {
      setLoading(false);
    }
  };

const handleForgotPassword = async () => {
  setMsg("");

  if (!email.trim()) {
    setMsg("Please enter your email address first.");
    return;
  }

  try {
    await actions.forgotPassword(email);
    setMsg("If this email is registered, a password reset email should arrive soon. Please check Inbox, Spam, and Promotions.");
  } catch (err) {
    console.error("Password reset failed:", err);
    setMsg(err?.message || "Password reset failed");
  }
};

  return (
    <PageShell
      right={
        <div className="space-y-6">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1 mb-4">Security Protocol</div>
            <div className="space-y-4">
              <SecurityItem 
                title="Identity Verification" 
                desc="All users must verify their email address before accessing the core workstation." 
                icon="🛡️"
              />
              <SecurityItem 
                title="Encrypted Sessions" 
                desc="Real-time session monitoring and end-to-end encryption are active for all transactions." 
                icon="🔒"
              />
              <SecurityItem 
                title="Role-Based Routing" 
                desc="Access is strictly governed by administrative role assignments and status checks." 
                icon="⚡"
              />
            </div>
          </div>
          
          <div className="rounded-3xl bg-indigo-500/10 ring-1 ring-indigo-500/20 p-6">
            <div className="text-xs font-bold text-indigo-300 uppercase tracking-widest mb-2">Technical Support</div>
            <p className="text-[11px] text-white/50 leading-relaxed">
              Encountering issues with your credentials? Please contact your regional system administrator for manual verification and recovery.
            </p>
          </div>
        </div>
      }
    >
      <div className="max-w-xl py-10 sm:py-20">
        <Pill>System Gateway</Pill>
        <h1 className="mt-4 text-4xl sm:text-5xl font-black tracking-tight text-white leading-none">
          Secure Login
        </h1>
        <p className="mt-4 text-lg text-white/50 font-medium">
          Enter your professional credentials to access the SABA Secure workstation.
        </p>

        <form onSubmit={handleEmailLogin} className="mt-10 space-y-5">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">Professional Email</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-white/20 group-focus-within:text-indigo-400 transition-colors">👤</div>
                <input
                  type="email"
                  placeholder="name@saba-secure.app"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-2xl bg-white/5 ring-1 ring-white/10 pl-11 pr-4 py-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Secure Password</label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Forgot?
                </button>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-white/20 group-focus-within:text-indigo-400 transition-colors">🔑</div>
                <input
                  type="password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-2xl bg-white/5 ring-1 ring-white/10 pl-11 pr-4 py-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
                  required
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 pt-4">
            <button 
              disabled={loading} 
              type="submit"
              className="w-full py-4 rounded-2xl bg-white text-black font-black text-sm uppercase tracking-[0.2em] hover:bg-white/90 active:scale-[0.98] transition-all shadow-xl disabled:opacity-50 disabled:pointer-events-none"
            >
              {loading ? "Authenticating..." : "Authorize Access"}
            </button>

            <button 
              disabled={loading} 
              type="button" 
              onClick={handleGoogle}
              className="w-full py-4 rounded-2xl bg-white/5 ring-1 ring-white/10 text-white font-bold text-sm uppercase tracking-widest hover:bg-white/10 active:scale-[0.98] transition-all"
            >
              Google Authentication
            </button>
          </div>

          <p className="pt-6 text-center text-sm text-white/30">
            Authorization required. Don't have an account?{" "}
            <Link className="font-bold text-white hover:text-indigo-400 transition-colors" to="/register">
              Create Request
            </Link>
          </p>

          {msg && (
            <div className="mt-8 rounded-2xl bg-white/5 ring-1 ring-white/10 p-5 border-l-4 border-indigo-500 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex gap-4">
                <span className="text-xl">🔔</span>
                <p className="text-sm text-white/70 font-medium leading-relaxed">{msg}</p>
              </div>
            </div>
          )}
        </form>
      </div>
    </PageShell>
  );
}

function SecurityItem({ title, desc, icon }) {
  return (
    <div className="group rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-4 hover:bg-white/[0.06] transition-all">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center text-lg group-hover:scale-110 transition-transform">{icon}</div>
        <div>
          <div className="text-[11px] font-bold text-white tracking-wide">{title}</div>
          <div className="text-[10px] text-white/40 mt-0.5 leading-tight">{desc}</div>
        </div>
      </div>
    </div>
  );
}