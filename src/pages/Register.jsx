// src/pages/Register.jsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { PageShell, Field, Input, PrimaryButton, Card, Pill } from "../ui/Layout";
import { signup } from "../firebase/authActions";

function validatePassword(password) {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(password)) return "Password must include at least one uppercase letter.";
  if (!/[a-z]/.test(password)) return "Password must include at least one lowercase letter.";
  if (!/[0-9]/.test(password)) return "Password must include at least one number.";
  return "";
}

export default function Register() {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setMsg("");

    if (!name.trim()) {
      setMsg("Full name is required.");
      return;
    }

    if (!email.trim() || !email.includes("@")) {
      setMsg("Please enter a valid email address.");
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setMsg(passwordError);
      return;
    }

    setLoading(true);
    try {
      await signup(email, password, name);
      setMsg("Account created successfully. Please verify your email before login.");
      setTimeout(() => {
        nav("/login");
      }, 1500);
    } catch (err) {
      setMsg(err?.message || "Register failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell
      right={
        <div className="space-y-6">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1 mb-4">Registration Policy</div>
            <div className="space-y-4">
              <SecurityItem 
                title="Staff Tier Assignment" 
                desc="All self-registered entities are provisioned with Staff level clearance by default." 
                icon="🎟️"
              />
              <SecurityItem 
                title="Credential Validation" 
                desc="Passwords must meet strict complexity requirements including multi-case and numeric checks." 
                icon="🗝️"
              />
              <SecurityItem 
                title="Activation Sequence" 
                desc="Access is strictly prohibited until the designated email channel is verified." 
                icon="📩"
              />
            </div>
          </div>
          
          <div className="rounded-3xl bg-indigo-500/10 ring-1 ring-indigo-500/20 p-6">
            <div className="text-xs font-bold text-indigo-300 uppercase tracking-widest mb-2">Access Control</div>
            <p className="text-[11px] text-white/50 leading-relaxed">
              Administrative elevation requires manual review. Contact the System Director after initial account activation for role upgrades.
            </p>
          </div>
        </div>
      }
    >
      <div className="max-w-xl py-10 sm:py-20">
        <Pill>System Enrollment</Pill>
        <h1 className="mt-4 text-4xl sm:text-5xl font-black tracking-tight text-white leading-none">
          New Account
        </h1>
        <p className="mt-4 text-lg text-white/50 font-medium">
          Initialize your professional profile to join the SABA Secure workstation.
        </p>

        <form onSubmit={handleRegister} className="mt-10 space-y-5">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">Full Legal Name</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-white/20 group-focus-within:text-indigo-400 transition-colors">👤</div>
                <input
                  placeholder="Johnathan Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-2xl bg-white/5 ring-1 ring-white/10 pl-11 pr-4 py-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">Professional Email</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-white/20 group-focus-within:text-indigo-400 transition-colors">✉️</div>
                <input
                  type="email"
                  placeholder="name@organization.app"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-2xl bg-white/5 ring-1 ring-white/10 pl-11 pr-4 py-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">Secure Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-white/20 group-focus-within:text-indigo-400 transition-colors">🔐</div>
                <input
                  type="password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-2xl bg-white/5 ring-1 ring-white/10 pl-11 pr-4 py-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
                  required
                />
              </div>
              <div className="px-1 text-[10px] text-white/30 font-medium italic">
                Requirement: 8+ chars, uppercase, lowercase, and numeric sequence.
              </div>
            </div>
          </div>

          <div className="pt-4">
            <button 
              disabled={loading} 
              type="submit"
              className="w-full py-4 rounded-2xl bg-white text-black font-black text-sm uppercase tracking-[0.2em] hover:bg-white/90 active:scale-[0.98] transition-all shadow-xl disabled:opacity-50 disabled:pointer-events-none"
            >
              {loading ? "Processing..." : "Initialize Enrollment"}
            </button>
          </div>

          <p className="pt-6 text-center text-sm text-white/30">
            Already registered?{" "}
            <Link className="font-bold text-white hover:text-indigo-400 transition-colors" to="/login">
              Authorized Login
            </Link>
          </p>

          {msg && (
            <div className="mt-8 rounded-2xl bg-white/5 ring-1 ring-white/10 p-5 border-l-4 border-indigo-500 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex gap-4">
                <span className="text-xl">🛡️</span>
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