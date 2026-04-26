import { Link } from "react-router-dom";
import { PageShell, Card, Pill, PrimaryButton } from "../ui/Layout";

export default function Unauthorized() {
  return (
    <PageShell
      right={
        <div className="space-y-3">
          <Pill>Access Control</Pill>
          <Card
            title="Permission denied"
            desc="Your account does not have the required role to access this page."
          />
        </div>
      }
    >
      <div className="max-w-xl">
        <Pill>Unauthorized</Pill>
        <h1 className="mt-3 text-2xl sm:text-3xl font-semibold text-white">
          You do not have permission to access this page
        </h1>
        <p className="mt-3 text-sm text-white/70">
          Please go back to your dashboard or contact an administrator if you believe this is a mistake.
        </p>

        <div className="mt-6">
          <Link to="/dashboard">
            <PrimaryButton type="button">Go to Dashboard</PrimaryButton>
          </Link>
        </div>
      </div>
    </PageShell>
  );
}