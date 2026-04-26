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
        <div className="space-y-3">
          <Pill>Security</Pill>
          <Card
            title="Default user role"
            desc="All self-registered users are created as Staff by default."
          />
          <Card
            title="Email verification"
            desc="Users must verify their email address before they can log in."
          />
          <Card
            title="Strong passwords"
            desc="Passwords must include uppercase, lowercase and numeric characters."
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

          <Field label="Password" hint="Minimum 8 characters with uppercase, lowercase and number.">
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