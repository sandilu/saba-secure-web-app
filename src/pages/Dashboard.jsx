// src/pages/Dashboard.jsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell, Pill, Card } from "../ui/Layout";
import { useAuth } from "../auth/AuthContext";

export default function Dashboard() {
  const { profile, loading } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (loading) return;
    const role = profile?.role || "staff";
    nav(role === "admin" ? "/admin" : "/staff", { replace: true });
  }, [loading, profile, nav]);

  return (
    <PageShell right={<Card title="Routing..." desc="Redirecting based on your Firestore role." />}>
      <div className="space-y-3">
        <Pill>Dashboard</Pill>
        <div className="text-white text-lg font-semibold">Loading dashboard…</div>
        <div className="text-white/70 text-sm">Please wait a moment.</div>
      </div>
    </PageShell>
  );
}