// src/pages/Register.jsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { PageShell, Field, Input, Select, PrimaryButton, Card, Pill } from "../ui/Layout";
import { signup } from "../firebase/authActions";

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
    setLoading(true);
    try {
      await signup(email, password, name, "staff");
      setMsg("Account created ✅");
      nav("/dashboard");
    } catch (err) {
      setMsg(err?.message || "Register failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell
      right={
        <div className="space-y-3">
          <Pill>Notes</Pill>
          <Card
            title="Account Types"
            desc="All new accounts are created as Staff. Reach out to an Admin if you need elevated privileges."
          />
          <Card
            title="Profile stored"
            desc="User profile will be safely stored in Firestore."
          />
        </div>
      }
    >
      <div className="max-w-xl">
        <Pill>Create account</Pill>
        <h1 className="mt-3 text-2xl sm:text-3xl font-semibold text-white">
          Register a new user
        </h1>
        <p className="mt-2 text-sm text-white/70">
          Already have an account?{" "}
          <Link className="underline text-white" to="/login">
            Login
          </Link>
        </p>

        <form onSubmit={handleRegister} className="mt-6 space-y-4">
          <Field label="Full name">
            <Input
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>

          <Field label="Email">
            <Input
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>

          <Field label="Password" hint="Use at least 6 characters.">
            <Input
              placeholder="••••••••"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>

          <PrimaryButton disabled={loading} type="submit">
            {loading ? "Creating..." : "Create Account"}
          </PrimaryButton>

          {msg ? (
            <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-3 text-sm text-white/80">
              {msg}
            </div>
          ) : null}
        </form>
      </div>
    </PageShell>
  );
}