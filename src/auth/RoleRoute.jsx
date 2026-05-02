import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function RoleRoute({ allow = [], children }) {
  const { user, profile, loading, role, isDisabled } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-slate-200">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!profile) {
    return <Navigate to="/login" replace />;
  }

  if (isDisabled) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (!allow.includes(role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}