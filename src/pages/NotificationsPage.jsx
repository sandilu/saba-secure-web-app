import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/firebaseServices";
import {
  listenNotifications,
  markNotificationRead,
  deleteNotification,
} from "../firebase/notificationActions";
import {
  listenAnomalyAlerts,
  markAnomalyReviewed,
  resolveAnomalyAlert,
} from "../firebase/anomalyActions";
import { useAuth } from "../auth/AuthContext";
import { PageShell, Pill, Card, ConfirmModal } from "../ui/Layout";

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

function SeverityBadge({ severity }) {
  const styles = {
    high:   "bg-red-500/15 text-red-300 ring-red-500/25",
    medium: "bg-amber-500/15 text-amber-300 ring-amber-500/25",
    low:    "bg-slate-500/15 text-slate-300 ring-slate-500/25",
  };
  const icons = { high: "🔴", medium: "🟡", low: "🔵" };
  const cls = styles[severity] || styles.low;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 uppercase ${cls}`}>
      {icons[severity] || "🔵"} {severity || "low"}
    </span>
  );
}

export default function NotificationsPage() {
  const { user, role } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [anomalyAlerts, setAnomalyAlerts] = useState([]);
  const [activeTab, setActiveTab] = useState("all");

  const [confirmModal, setConfirmModal] = useState(null);
  const closeConfirm = () => setConfirmModal(null);

  // Level 2 Resolve Workflow States
  const [resolveTarget, setResolveTarget] = useState(null);
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [resolveError, setResolveError] = useState("");

  const closeResolveModal = () => {
    if (isResolving) return;
    setIsResolveModalOpen(false);
    setResolveTarget(null);
    setResolveError("");
  };

  const handleConfirmResolve = async () => {
    if (!resolveTarget?.id || isResolving) return;

    setIsResolving(true);
    setResolveError("");

    try {
      const success = await resolveAnomalyAlert(resolveTarget.id, user);
      if (success) {
        console.log("[AnomalyAlert] Resolve success:", resolveTarget.id);
        setIsResolveModalOpen(false);
        setResolveTarget(null);
      } else {
        setResolveError("Failed to update status in database.");
      }
    } catch (err) {
      console.error("[AnomalyAlert] Resolve failed:", err);
      setResolveError(err.message || "An unexpected error occurred.");
    } finally {
      setIsResolving(false);
    }
  };

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

  // ── 2. Live Low-Stock synthetic alerts ─────────────────────────────────────
  const [lowStockAlerts, setLowStockAlerts] = useState([]);

  useEffect(() => {
    if (role !== "admin") return;

    const unsub = onSnapshot(
      collection(db, "inventoryItems"),
      (snap) => {
        const alerts = [];

        snap.docs.forEach((d) => {
          const item = d.data();
          const itemName   = String(item.itemName || "").trim();
          const sku        = String(item.sku || "").trim();
          const qty        = Number(item.quantity ?? 0);
          const minStock   = Number(item.minStockLevel ?? 0);

          if (!itemName) return;
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

  // ── 3. Live Anomaly Alerts ──────────────────────────────────────────────────
  useEffect(() => {
    if (role !== "admin") return;
    const unsub = listenAnomalyAlerts((data) => setAnomalyAlerts(data));
    return () => unsub();
  }, [role]);

  // ── 4. Merge & filter ───────────────────────────────────────────────────────
  const allNotifications = [...lowStockAlerts, ...notifications];
  const unreadCount = allNotifications.filter((n) => !n.isRead).length;

  const activeAnomalies = anomalyAlerts.filter((a) => (a.status || "active") !== "resolved");
  const anomalyHighCount = activeAnomalies.filter((a) => a.severity === "high").length;
  const anomalyMedCount = activeAnomalies.filter((a) => a.severity === "medium").length;

  const tabItems =
    activeTab === "anomaly"
      ? anomalyAlerts
      : allNotifications;

  // ── 5. Render ───────────────────────────────────────────────────────────────
  return (
    <PageShell
      right={
        <div className="space-y-3">
          <Pill>Summary</Pill>
          <Card title="Total Notifications" desc={String(allNotifications.length)} />
          <Card title="Unread" desc={String(unreadCount)} />
          {role === "admin" && (
            <>
              <Card title="Anomaly Alerts" desc={String(activeAnomalies.length)} />
              <Card title="High Severity" desc={String(anomalyHighCount)} />
              <Card title="Medium Severity" desc={String(anomalyMedCount)} />
            </>
          )}
        </div>
      }
    >
      <div>
        <Pill>Notification Center</Pill>
        <h1 className="mt-3 text-2xl sm:text-3xl font-semibold text-white">
          System Alerts
        </h1>
        <p className="mt-2 text-sm text-white/70">
          View alerts for low stock, document approvals, anomaly detections, and system activities.
        </p>

        {/* Tab switcher */}
        {role === "admin" && (
          <div className="mt-5 flex gap-2 border-b border-white/10 pb-3">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-4 py-1.5 rounded-xl text-sm font-semibold transition-colors ${
                activeTab === "all"
                  ? "bg-white/15 text-white"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              All Notifications
            </button>
            <button
              onClick={() => setActiveTab("anomaly")}
              className={`px-4 py-1.5 rounded-xl text-sm font-semibold transition-colors flex items-center gap-1.5 ${
                activeTab === "anomaly"
                  ? "bg-red-500/20 text-red-300 ring-1 ring-red-500/30"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              🚨 Anomaly Alerts
              {activeAnomalies.length > 0 && (
                <span className="inline-flex items-center justify-center rounded-full bg-red-500/30 text-red-200 text-[10px] font-bold px-1.5 py-0.5 min-w-[18px]">
                  {activeAnomalies.length}
                </span>
              )}
            </button>
          </div>
        )}

        <div className="mt-6 space-y-3">
          {loading && tabItems.length === 0 ? (
            <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-5 text-center text-sm text-white/70">
              Loading notifications...
            </div>
          ) : tabItems.length === 0 ? (
            <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-5 text-center text-sm text-white/70">
              {activeTab === "anomaly"
                ? "No anomaly alerts detected yet. Alerts appear when suspicious activity is identified."
                : "No notifications yet. Alerts will appear here automatically when low stock is detected, documents are reviewed, or account changes occur."}
            </div>
          ) : activeTab === "anomaly" ? (
            // ── Anomaly Alert Cards ─────────────────────────────────────────
            anomalyAlerts.map((alert) => {
              const status = String(alert.status || "active").toLowerCase();
              const isResolved = status === "resolved";
              const isReviewed = status === "reviewed";

              const statusBadgeStyles = {
                active:   "bg-red-500/10 text-red-300 ring-red-500/20",
                reviewed: "bg-blue-500/10 text-blue-300 ring-blue-500/20",
                resolved: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20",
              };

              return (
                <div
                  key={alert.id}
                  className={`rounded-2xl ring-1 p-5 transition-all flex flex-col sm:flex-row gap-4 justify-between items-start ${
                    isResolved ? "opacity-60 bg-white/[0.02] ring-white/10" :
                    alert.severity === "high"
                      ? "bg-red-500/[0.06] ring-red-500/25 shadow-lg"
                      : alert.severity === "medium"
                      ? "bg-amber-500/[0.06] ring-amber-500/25"
                      : "bg-white/[0.04] ring-white/15"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <SeverityBadge severity={alert.severity} />
                      <span className="inline-flex items-center rounded-md bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-300 ring-1 ring-inset ring-red-500/20 capitalize">
                        {(alert.type || "").replace(/_/g, " ")}
                      </span>
                      <span className="font-semibold text-white">{alert.title}</span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 uppercase tracking-wide ${statusBadgeStyles[status]}`}>
                        {status}
                      </span>
                    </div>
                    <p className="text-sm text-white/80 leading-relaxed">{alert.message}</p>

                    {/* Metadata */}
                    {alert.metadata && Object.keys(alert.metadata).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {alert.metadata.invoiceNumber && (
                          <span className="rounded bg-white/5 ring-1 ring-white/10 px-2 py-0.5 text-[10px] text-white/50">
                            Invoice: {alert.metadata.invoiceNumber}
                          </span>
                        )}
                        {alert.metadata.discountPercent !== undefined && (
                          <span className="rounded bg-white/5 ring-1 ring-white/10 px-2 py-0.5 text-[10px] text-white/50">
                            Discount: {alert.metadata.discountPercent}%
                          </span>
                        )}
                        {alert.metadata.finalTotal !== undefined && (
                          <span className="rounded bg-white/5 ring-1 ring-white/10 px-2 py-0.5 text-[10px] text-white/50">
                            Total: Rs. {Number(alert.metadata.finalTotal).toLocaleString()}
                          </span>
                        )}
                        {alert.metadata.cancellationCount !== undefined && (
                          <span className="rounded bg-white/5 ring-1 ring-white/10 px-2 py-0.5 text-[10px] text-white/50">
                            Cancellations: {alert.metadata.cancellationCount}
                          </span>
                        )}
                        {alert.metadata.returnCount !== undefined && (
                          <span className="rounded bg-white/5 ring-1 ring-white/10 px-2 py-0.5 text-[10px] text-white/50">
                            Returns: {alert.metadata.returnCount}
                          </span>
                        )}
                        {alert.metadata.sensitiveCount !== undefined && (
                          <span className="rounded bg-white/5 ring-1 ring-white/10 px-2 py-0.5 text-[10px] text-white/50">
                            Sensitive Actions: {alert.metadata.sensitiveCount}
                          </span>
                        )}
                        {alert.createdByEmail && (
                          <span className="rounded bg-white/5 ring-1 ring-white/10 px-2 py-0.5 text-[10px] text-white/50">
                            By: {alert.createdByEmail}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Footer Info (Review/Resolve) */}
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                      <div className="text-[11px] text-white/40">Created: {formatDate(alert.createdAt)}</div>
                      {alert.reviewedAt && (
                        <div className="text-[11px] text-blue-400/60">Reviewed: {formatDate(alert.reviewedAt)} {alert.reviewedByEmail && `by ${alert.reviewedByEmail}`}</div>
                      )}
                      {alert.resolvedAt && (
                        <div className="text-[11px] text-emerald-400/60">Resolved: {formatDate(alert.resolvedAt)} {alert.resolvedByEmail && `by ${alert.resolvedByEmail}`}</div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 shrink-0 items-end">
                    {!isResolved && !isReviewed && (
                      <button
                        type="button"
                        onClick={() => {
                          console.log("[AnomalyAlert] Mark Reviewed clicked:", alert.id);
                          markAnomalyReviewed(alert.id, user);
                        }}
                        className="rounded-xl bg-white/5 ring-1 ring-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10 transition"
                      >
                        Mark Reviewed
                      </button>
                    )}
                    {!isResolved && (
                      <button
                        type="button"
                        onClick={() => {
                          console.log("[AnomalyAlert] Resolve clicked:", alert.id, alert);
                          setResolveTarget(alert);
                          setResolveError("");
                          setIsResolveModalOpen(true);
                        }}
                        className="relative z-10 rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/20 transition"
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            // ── Regular Notification Cards ──────────────────────────────────
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

      {confirmModal && (
        <ConfirmModal
          title={confirmModal.title}
          body={confirmModal.body}
          onConfirm={confirmModal.onConfirm}
          onCancel={closeConfirm}
        />
      )}

      {/* ── Resolve Confirmation Modal ────────────────────────────────────── */}
      {isResolveModalOpen && resolveTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={closeResolveModal}
          />
          
          {/* Modal Content */}
          <div className="relative w-full max-w-md rounded-3xl bg-slate-900 ring-1 ring-white/10 p-6 shadow-2xl overflow-hidden">
             {/* Header Gradient */}
             <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
             
             <h2 className="text-xl font-bold text-white flex items-center gap-2">
               <span className="text-emerald-400">🛡️</span> Resolve anomaly alert?
             </h2>
             
             <div className="mt-4 space-y-4">
               <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                 <div className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1">Target Anomaly</div>
                 <div className="text-sm font-medium text-white">{resolveTarget.title}</div>
                 <div className="text-[10px] text-white/30 mt-1">ID: {resolveTarget.id}</div>
               </div>

               <p className="text-sm text-white/70 leading-relaxed">
                 This will mark the anomaly as resolved and remove it from active suspicious activity previews. 
                 The record will remain in Notifications, Reports, and Audit Logs as evidence.
               </p>

               {resolveError && (
                 <div className="rounded-xl bg-red-500/10 ring-1 ring-red-500/20 p-3 text-xs text-red-300">
                   {resolveError}
                 </div>
               )}
             </div>

             <div className="mt-8 flex flex-col sm:flex-row gap-3">
               <button
                 type="button"
                 disabled={isResolving}
                 onClick={closeResolveModal}
                 className="flex-1 rounded-2xl bg-white/5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition disabled:opacity-50"
               >
                 Cancel
               </button>
               <button
                 type="button"
                 disabled={isResolving}
                 onClick={handleConfirmResolve}
                 className="flex-1 rounded-2xl bg-emerald-500 py-3 text-sm font-semibold text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 transition disabled:opacity-50 flex items-center justify-center gap-2"
               >
                 {isResolving ? (
                   <>
                     <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                       <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                       <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                     </svg>
                     Resolving...
                   </>
                 ) : (
                   "Confirm Resolve"
                 )}
               </button>
             </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
