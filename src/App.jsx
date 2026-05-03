import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "./auth/AuthContext";
import { listenNotifications } from "./firebase/notificationActions";

function NavItem({ to, label, badge }) {
  const { pathname } = useLocation();
  const active = pathname === to;

  return (
    <Link
      to={to}
      className={[
        "px-3 py-2 rounded-xl text-sm ring-1 ring-white/10 transition whitespace-nowrap",
        active
          ? "bg-white/15 text-white"
          : "bg-white/5 text-slate-200 hover:bg-white/10",
      ].join(" ")}
    >
      {label}
      {badge > 0 && (
        <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}

export default function AppLayout() {
  const navigate = useNavigate();
  const { user, profile, role, logout } = useAuth();
  const [unreadNotifs, setUnreadNotifs] = useState(0);

  useEffect(() => {
    if (!user) return;
    const unsub = listenNotifications(
      user.uid,
      role,
      (data) => setUnreadNotifs(data.filter((n) => !n.isRead).length),
      (err) => console.error("Failed to load notifications nav badge", err)
    );
    return () => unsub();
  }, [user, role]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/70 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-2xl bg-white/10 ring-1 ring-white/10 grid place-items-center shrink-0">
              🔒
            </div>

            <div className="min-w-0">
              <div className="font-semibold leading-5 truncate">SABA Secure App</div>
              <div className="text-xs text-slate-300 truncate">
                Secure Inventory, Sales & Business Analyzer
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            {!user ? (
              <>
                <NavItem to="/login" label="Login" />
                <NavItem to="/register" label="Register" />
              </>
            ) : (
              <>
                <NavItem to="/dashboard" label="Dashboard" />

                {(role === "admin" || role === "staff") && (
                  <>
                    <NavItem to="/sales" label="Sales" />
                    <NavItem to="/notifications" label="Notifications" badge={unreadNotifs} />
                  </>
                )}

                {role === "staff" && (
                  <>
                    <NavItem to="/staff/my-sales" label="My Sales" />
                    <NavItem to="/staff/inventory" label="Inventory" />
                    <NavItem to="/staff/customers" label="Customers" />
                  </>
                )}

                {role === "admin" && (
                  <>
                    <NavItem to="/customers" label="Customers" />
                    <NavItem to="/suppliers" label="Suppliers" />
                    <NavItem to="/reports" label="Reports" />
                    <NavItem to="/audit-logs" label="Audit Logs" />
                    <NavItem to="/login-activity" label="Login Activity" />
                  </>
                )}

                <span className="hidden lg:inline text-xs text-slate-300 px-3 py-2 rounded-xl bg-white/5 ring-1 ring-white/10 whitespace-nowrap">
                  {profile?.name || user?.email} • {role || "staff"}
                </span>

                <button
                  onClick={handleLogout}
                  className="px-3 py-2 rounded-xl text-sm bg-white/10 hover:bg-white/15 ring-1 ring-white/10 transition whitespace-nowrap"
                >
                  Logout
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:py-10">
        <div 
          key={useLocation().pathname} 
          className="animate-in fade-in zoom-in-[0.98] slide-in-from-bottom-4 duration-500 ease-out fill-mode-both"
        >
          <Outlet />
        </div>
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-4 py-6 text-xs text-slate-400">
          © {new Date().getFullYear()} SABA Secure App • Built with React + Firebase
        </div>
      </footer>
    </div>
  );
}