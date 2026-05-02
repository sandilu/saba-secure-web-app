import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function ProtectedRoute({ children }) {
  const { user, profile, loading, isDisabled } = useAuth();

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
    return (
      <div className="min-h-screen grid place-items-center text-slate-200">
        User profile not found.
      </div>
    );
  }

  if (isDisabled) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}