import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function RoleRoute({ allow = [], children }) {
  const { profile, loading } = useAuth();

  if (loading) return <div className="text-slate-200">Loading...</div>;
  if (!profile) return <Navigate to="/login" replace />;

  const role = profile.role || "staff";
  if (!allow.includes(role)) return <Navigate to="/dashboard" replace />;

  return children;
}
