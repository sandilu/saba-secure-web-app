import { Link } from "react-router-dom";
import { PageShell, Card, Pill, PrimaryButton } from "../ui/Layout";
import { useAuth } from "../auth/AuthContext";

export default function Unauthorized() {
  const { isDisabled, logout } = useAuth();

  return (
    <PageShell
      right={
        <div className="space-y-3">
          <Pill>Access Control</Pill>
          <Card
            title={isDisabled ? "Account Disabled" : "Permission denied"}
            desc={isDisabled 
              ? "Your account has been deactivated by an administrator." 
              : "Your account does not have the required role to access this page."}
          />
        </div>
      }
    >
      <div className="max-w-xl">
        <Pill>Unauthorized</Pill>
        <h1 className="mt-3 text-2xl sm:text-3xl font-semibold text-white">
          {isDisabled 
            ? "Your account is currently disabled" 
            : "You do not have permission to access this page"}
        </h1>
        <p className="mt-3 text-sm text-white/70">
          {isDisabled 
            ? "Please contact the system administrator to request reactivation of your access."
            : "Please go back to your dashboard or contact an administrator if you believe this is a mistake."}
        </p>

        <div className="mt-6 flex gap-3">
          {!isDisabled ? (
            <Link to="/dashboard">
              <PrimaryButton type="button">Go to Dashboard</PrimaryButton>
            </Link>
          ) : (
            <PrimaryButton type="button" onClick={logout}>
              Logout
            </PrimaryButton>
          )}
        </div>
      </div>
    </PageShell>
  );
}