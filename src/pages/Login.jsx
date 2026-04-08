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
      setMsg("Login success ✅");
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
      const fn =
        actions.loginWithGoogle ||
        actions.googleLogin ||
        actions.signInWithGoogle ||
        actions.signInGoogle;

      if (!fn) throw new Error("Google sign-in function not found in authActions.js");

      await fn();
      setMsg("Google login success ✅");
      nav("/dashboard");
    } catch (err) {
      setMsg(err?.message || "Google login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell
      right={
        <div className="space-y-3">
          <Pill>Tip</Pill>
          <Card title="Email + Google" desc="Use email/password or Google to sign in faster." />
          <Card
            title="Role based access"
            desc="After login, you will be routed to Staff/Admin dashboard."
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