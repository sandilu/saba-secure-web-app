import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/firebaseServices";
import {
  listenNotifications,
  markNotificationRead,
  deleteNotification,
} from "../firebase/notificationActions";
import { useAuth } from "../auth/AuthContext";
import { PageShell, Pill, Card } from "../ui/Layout";

function formatDate(value) {
  if (!value) return "-";
  if (typeof value?.toDate === "function") {
    return value.toDate().toLocaleString();
  }
  return new Date(value).toLocaleString();
}

function TypeBadge({ type, isSystemPersistent }) {
  if (isSystemPersistent) {
    return (
      <span className="inline-flex items-center rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400 ring-1 ring-inset ring-amber-500/20">
        ⚠ Active Issue
      </span>
    );
  }
  const styles = {
    danger:   "bg-red-500/10 text-red-300 ring-red-500/20",
    warning:  "bg-amber-500/10 text-amber-300 ring-amber-500/20",
    info:     "bg-blue-500/10 text-blue-300 ring-blue-500/20",
    success:  "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20",
    approval: "bg-purple-500/10 text-purple-300 ring-purple-500/20",
    inventory:"bg-orange-500/10 text-orange-300 ring-orange-500/20",
  };
  const cls = styles[type] || styles["info"];
  return (
    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset capitalize ${cls}`}>
      {type || "info"}
    </span>
  );
}

export default function NotificationsPage() {
  const { user, role } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  // ── 1. Real Firestore notifications ────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const unsub = listenNotifications(
      user.uid,
      role,
      (data) => {
        setNotifications(data);
        setLoading(false);
      },
      (err) => {
        console.error("Failed to load notifications:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [user, role]);

  // ── 2. Live Low-Stock synthetic alerts (always current, never stale) ───────
  //    These are derived directly from the inventory collection in real-time.
  //    They are NEVER saved to Firestore — they appear as long as the item
  //    is truly below min stock, and disappear the moment it's restocked.
  const [lowStockAlerts, setLowStockAlerts] = useState([]);

  useEffect(() => {
    if (role !== "admin") return;

    const unsub = onSnapshot(
      collection(db, "inventoryItems"),
      (snap) => {
        const alerts = [];

        snap.docs.forEach((d) => {
          const item = d.data();

          // Skip items with missing essential fields
          const itemName   = String(item.itemName || "").trim();
          const sku        = String(item.sku || "").trim();
          const qty        = Number(item.quantity ?? 0);
          const minStock   = Number(item.minStockLevel ?? 0);

          if (!itemName) return; // skip incomplete docs

          // Only flag when TRULY low stock
          if (qty > minStock) return;

          alerts.push({
            id: `low-stock-${d.id}`,
            title: "Low Stock Alert",
            message: `${itemName} (SKU: ${sku || "–"}) has ${qty} unit${qty === 1 ? "" : "s"} remaining — at or below the minimum stock level of ${minStock}.`,
            type: "warning",
            isRead: false,
            isSystemPersistent: true,
            createdAt: new Date(),
          });
        });

        setLowStockAlerts(alerts);
      },
      (err) => {
        console.error("Failed to watch inventory for low-stock alerts:", err);
      }
    );

    return () => unsub();
  }, [role]);

  // ── 3. Merge: live alerts first, then Firestore notifications ───────────────
  const allNotifications = [...lowStockAlerts, ...notifications];
  const unreadCount = allNotifications.filter((n) => !n.isRead).length;

  // ── 4. Render ───────────────────────────────────────────────────────────────
  return (
    <PageShell
      right={
        <div className="space-y-3">
          <Pill>Summary</Pill>
          <Card title="Total Notifications" desc={String(allNotifications.length)} />
          <Card title="Unread" desc={String(unreadCount)} />
        </div>
      }
    >
      <div>
        <Pill>Notification Center</Pill>
        <h1 className="mt-3 text-2xl sm:text-3xl font-semibold text-white">
          System Alerts
        </h1>
        <p className="mt-2 text-sm text-white/70">
          View alerts for low stock, document approvals, and system activities.
        </p>

        <div className="mt-6 space-y-3">
          {loading && allNotifications.length === 0 ? (
            <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-5 text-center text-sm text-white/70">
              Loading notifications...
            </div>
          ) : allNotifications.length === 0 ? (
            <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-5 text-center text-sm text-white/70">
              No notifications yet. Alerts will appear here automatically when low stock is detected, documents are reviewed, or account changes occur.
            </div>
          ) : (
            allNotifications.map((notif) => (
              <div
                key={notif.id}
                className={`rounded-2xl ring-1 p-5 transition-all flex flex-col sm:flex-row gap-4 justify-between items-start ${
                  notif.isSystemPersistent
                    ? "bg-amber-500/[0.04] ring-amber-500/20 shadow-lg"
                    : notif.isRead
                    ? "bg-white/[0.02] ring-white/10 opacity-60"
                    : "bg-white/[0.06] ring-white/20 shadow-lg"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    {!notif.isRead && (
                      <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0 flex-none" />
                    )}
                    <TypeBadge type={notif.type} isSystemPersistent={notif.isSystemPersistent} />
                    <span className="font-semibold text-white">{notif.title}</span>
                  </div>
                  <p className="text-sm text-white/80 leading-relaxed">{notif.message}</p>
                  <div className="mt-2 text-xs text-white/45">{formatDate(notif.createdAt)}</div>
                </div>

                <div className="flex flex-col gap-2 shrink-0 items-end">
                  {!notif.isRead && !notif.isSystemPersistent && (
                    <button
                      onClick={() => markNotificationRead(notif.id)}
                      className="rounded-xl bg-white/5 ring-1 ring-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10 transition"
                    >
                      Mark Read
                    </button>
                  )}
                  {!notif.isSystemPersistent && (
                    <button
                      onClick={() => deleteNotification(notif.id)}
                      className="rounded-xl bg-red-500/10 ring-1 ring-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-500/20 transition"
                    >
                      Delete
                    </button>
                  )}
                  {notif.isSystemPersistent && (
                    <span className="text-xs text-amber-500/60 italic">
                      Restock item to clear
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </PageShell>
  );
}
