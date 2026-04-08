import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { logout } from "./firebase/authActions";

function NavItem({ to, label }) {
  const { pathname } = useLocation();
  const active = pathname === to;

  return (
    <Link
      to={to}
      className={[
        "px-3 py-2 rounded-xl text-sm ring-1 ring-white/10",
        active ? "bg-white/15 text-white" : "bg-white/5 text-slate-200 hover:bg-white/10",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

export default function AppLayout() {
  const { user, profile } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/60 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-white/10 ring-1 ring-white/10 grid place-items-center">
              🔒
            </div>
            <div>
              <div className="font-semibold leading-5">SABA Secure App</div>
              <div className="text-xs text-slate-300">Secure Inventory & Document Management</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!user ? (
              <>
                <NavItem to="/login" label="Login" />
                <NavItem to="/register" label="Register" />
              </>
            ) : (
              <>
                <span className="hidden sm:inline text-xs text-slate-300 px-3 py-2 rounded-xl bg-white/5 ring-1 ring-white/10">
                  {profile?.name || user?.email} • {profile?.role || "staff"}
                </span>
                <button
                  onClick={logout}
                  className="px-3 py-2 rounded-xl text-sm bg-white/10 hover:bg-white/15 ring-1 ring-white/10"
                >
                  Logout
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="mx-auto max-w-5xl px-4 py-10">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10">
        <div className="mx-auto max-w-5xl px-4 py-6 text-xs text-slate-400">
          © {new Date().getFullYear()} SABA Secure App • Built with React + Firebase
        </div>
      </footer>
    </div>
  );
}