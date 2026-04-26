import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { PageShell } from "../ui/Layout";

function FeatureCard({ title, desc }) {
  return (
    <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-5">
      <div className="text-white font-semibold">{title}</div>
      <div className="mt-1 text-sm text-white/70">{desc}</div>
    </div>
  );
}

export default function Home() {
  const { user, profile } = useAuth();

  return (
    <PageShell>
      <div className="grid gap-6">
        {/* Hero */}
        <section className="rounded-3xl bg-white/[0.06] ring-1 ring-white/10 p-6 md:p-10">
          <div className="inline-flex items-center gap-2 rounded-2xl bg-white/5 ring-1 ring-white/10 px-3 py-1 text-xs text-white/80">
            2026 Final Year Project • React + Firebase
          </div>

          <div className="mt-6 grid gap-10 lg:grid-cols-12 lg:items-center">
            {/* Left */}
            <div className="lg:col-span-7">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-white leading-tight">
                SABA Secure App
              </h1>

              <p className="mt-4 max-w-2xl text-lg text-white/70">
                Secure Inventory, Sales and Business Analyzer web application with
                role-based access control, cloud data management, audit logging,
                and security-focused design for SMEs.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                {!user ? (
                  <>
                    <Link
                      to="/login"
                      className="rounded-2xl px-6 py-3 text-sm bg-white text-slate-950 font-semibold hover:opacity-90 transition"
                    >
                      Login
                    </Link>

                    <Link
                      to="/register"
                      className="rounded-2xl px-6 py-3 text-sm bg-white/10 hover:bg-white/15 ring-1 ring-white/10 text-white transition"
                    >
                      Create Account
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      to="/dashboard"
                      className="rounded-2xl px-6 py-3 text-sm bg-white text-slate-950 font-semibold hover:opacity-90 transition"
                    >
                      Go to Dashboard
                    </Link>

                    <div className="flex items-center rounded-2xl px-4 py-3 text-sm bg-white/10 ring-1 ring-white/10 text-white">
                      Signed in as{" "}
                      <b className="ml-1 mr-1">{profile?.name || user.email}</b> •
                      <b className="ml-1 px-2 py-0.5 rounded-full bg-white/20 text-xs">
                        {profile?.role || "staff"}
                      </b>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Right */}
            <div className="lg:col-span-5 relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 to-purple-500/10 rounded-3xl blur-2xl"></div>

              <div className="relative rounded-3xl bg-white/[0.04] ring-1 ring-white/10 p-6 md:p-8 backdrop-blur-sm">
                <div className="text-sm font-medium text-white/70 mb-4">
                  Core Features
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FeatureCard title="Authentication" desc="Secure Firebase login with email and Google sign-in." />
                  <FeatureCard title="Role Based Access" desc="Admin and staff access control with protected routing." />
                  <FeatureCard title="Inventory & Sales" desc="Manage stock records and capture business sales transactions." />
                  <FeatureCard title="Audit & Reports" desc="Track sensitive actions and export business report data." />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Bottom feature section */}
        <section className="grid gap-4 sm:grid-cols-3 mt-4">
          <FeatureCard
            title="Security"
            desc="Strong authentication, role-based access control, Firestore rules and audit logging."
          />
          <FeatureCard
            title="Business Management"
            desc="Inventory tracking, sales handling, low stock visibility and operational insights."
          />
          <FeatureCard
            title="Cloud Platform"
            desc="Cloud Firestore live updates, scalable architecture and responsive web access."
          />
        </section>
      </div>
    </PageShell>
  );
}