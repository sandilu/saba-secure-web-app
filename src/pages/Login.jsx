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
        <div className="space-y-3">
          <Pill>Security</Pill>
          <Card
            title="Verified accounts only"
            desc="Email/password users must verify their email before login."
          />
          <Card
            title="Password recovery"
            desc="Users can securely reset their password using email."
          />
          <Card
            title="Role-based access"
            desc="After login, users are redirected based on their role."
          />
        </div>
      }
    >
      <div className="max-w-xl">
        <Pill>Login</Pill>
        <h1 className="mt-3 text-2xl sm:text-3xl font-semibold text-white">
          Sign in to your account
        </h1>

        <p className="mt-2 text-sm text-white/70">
          Don’t have an account?{" "}
          <Link className="underline text-white" to="/register">
            Create one
          </Link>
        </p>

        <form onSubmit={handleEmailLogin} className="mt-6 space-y-4">
          <Field label="Email">
            <Input
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>

          <Field label="Password">
            <Input
              placeholder="••••••••"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <PrimaryButton disabled={loading} type="submit">
              {loading ? "Signing in..." : "Login"}
            </PrimaryButton>

            <SecondaryButton disabled={loading} type="button" onClick={handleGoogle}>
              Sign in with Google
            </SecondaryButton>
          </div>

          <button
            type="button"
            onClick={handleForgotPassword}
            className="text-sm underline text-white/80"
          >
            Forgot password?
          </button>

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