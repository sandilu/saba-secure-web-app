import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "../firebase/firebaseServices";
import { PageShell, Pill, Input, Select, SecondaryButton } from "../ui/Layout";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getDateRangeBoundaries, isDateInRange } from "../utils/dateHelpers";
import { downloadCsv } from "../utils/exportHelpers";

function formatDate(value) {
  if (!value) return "-";
  if (typeof value?.toDate === "function") {
    return value.toDate().toLocaleString();
  }
  return new Date(value).toLocaleString();
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterType, setFilterType] = useState("");
  const [dateRange, setDateRange] = useState("all_time");

  useEffect(() => {
    async function loadLogs() {
      try {
        const q = query(collection(db, "auditLogs"), orderBy("timestamp", "desc"));
        const snap = await getDocs(q);
        setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Failed to load audit logs:", err);
      } finally {
        setLoading(false);
      }
    }

    loadLogs();
  }, []);

  const uniqueActions = useMemo(() => {
    const actions = new Set(logs.map((l) => l.action).filter(Boolean));
    return Array.from(actions).sort();
  }, [logs]);

  const uniqueTypes = useMemo(() => {
    const types = new Set(logs.map((l) => l.targetType).filter(Boolean));
    return Array.from(types).sort();
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const { start, end } = getDateRangeBoundaries(dateRange);

    return logs.filter((log) => {
      // Date filter
      if (!isDateInRange(log.timestamp, start, end)) return false;

      // Search filter (email or details)
      if (search) {
        const q = search.toLowerCase();
        const emailMatch = String(log.performedByEmail || "").toLowerCase().includes(q);
        const detailsMatch = JSON.stringify(log.details || {}).toLowerCase().includes(q);
        if (!emailMatch && !detailsMatch) return false;
      }

      // Action filter
      if (filterAction && log.action !== filterAction) return false;

      // Target Type filter
      if (filterType && log.targetType !== filterType) return false;

      return true;
    });
  }, [logs, search, filterAction, filterType, dateRange]);

  const exportCsv = () => {
    const rows = [
      ["Timestamp", "Action", "User Email", "Target Type", "Target ID", "Details"],
      ...filteredLogs.map((log) => [
        formatDate(log.timestamp),
        log.action || "",
        log.performedByEmail || "",
        log.targetType || "",
        log.targetId || "",
        JSON.stringify(log.details || {}),
      ]),
    ];
    downloadCsv("audit_logs.csv", rows);
  };

  const exportPdf = () => {
    const doc = new jsPDF("landscape");
    doc.setFontSize(18);
    doc.text("SABA Secure App - Audit Logs", 14, 18);
    doc.setFontSize(10);
    doc.text(`Generated on ${new Date().toLocaleString()}`, 14, 25);
    doc.setLineWidth(0.3);
    doc.line(14, 29, 283, 29);

    autoTable(doc, {
      startY: 35,
      head: [["Timestamp", "Action", "User", "Type", "Target ID", "Details"]],
      body: filteredLogs.map((log) => [
        formatDate(log.timestamp),
        log.action || "-",
        log.performedByEmail || "-",
        log.targetType || "-",
        log.targetId || "-",
        JSON.stringify(log.details || {}).substring(0, 50) + (JSON.stringify(log.details || {}).length > 50 ? "..." : ""),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 41, 59] },
    });

    doc.save("audit_logs.pdf");
  };

  return (
    <PageShell>
      <div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Pill>Audit Logs</Pill>
            <h1 className="mt-3 text-2xl sm:text-3xl font-semibold text-white">
              Security Audit Trail
            </h1>
            <p className="mt-2 text-sm text-white/70">
              Review logged actions for accountability and monitoring.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <SecondaryButton onClick={exportCsv}>Export CSV</SecondaryButton>
            <SecondaryButton onClick={exportPdf}>Export PDF</SecondaryButton>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 bg-white/5 p-4 rounded-2xl ring-1 ring-white/10">
          <div>
            <label className="block text-xs text-white/70 mb-1">Search</label>
            <Input
              placeholder="Search email or details..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-white/70 mb-1">Date Range</label>
            <Select value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
              <option value="all_time">All Time</option>
              <option value="today">Today</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
            </Select>
          </div>
          <div>
            <label className="block text-xs text-white/70 mb-1">Filter by Action</label>
            <Select value={filterAction} onChange={(e) => setFilterAction(e.target.value)}>
              <option value="">All Actions</option>
              {uniqueActions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-xs text-white/70 mb-1">Filter by Type</label>
            <Select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="">All Types</option>
              {uniqueTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {loading ? (
            <div className="py-12 text-center text-white/50 flex flex-col items-center bg-white/[0.02] rounded-[2rem] ring-1 ring-white/5 shadow-inner">
              <div className="h-8 w-8 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Loading Audit Logs...</span>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-white/40 italic bg-white/[0.02] rounded-[2rem] ring-1 ring-white/5 shadow-inner flex flex-col items-center">
              <div className="text-4xl mb-4 opacity-20">🛡️</div>
              <div className="text-sm font-medium">No audit logs found matching criteria.</div>
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div 
                key={log.id} 
                className="bg-white/[0.02] ring-1 ring-white/10 p-5 rounded-[2rem] transition-all duration-300 hover:bg-white/[0.04] hover:shadow-xl hover:-translate-y-0.5 border border-white/5 flex flex-col gap-4 group"
              >
                <div className="flex flex-col md:flex-row gap-5 justify-between items-start md:items-center">
                  <div className="flex-1 min-w-0 w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Action & Timestamp */}
                    <div>
                      <div className="font-bold text-indigo-400 group-hover:text-indigo-300 transition-colors truncate">{log.action || "UNKNOWN_ACTION"}</div>
                      <div className="text-[10px] font-bold text-white/30 mt-1 uppercase tracking-tight truncate">{formatDate(log.timestamp)}</div>
                    </div>

                    {/* User Info */}
                    <div className="flex flex-col gap-1 justify-center items-start">
                      <span className="px-3 py-1 rounded-lg bg-white/5 text-[10px] font-bold text-white/50 group-hover:text-white/70 transition-colors uppercase tracking-[0.1em] ring-1 ring-white/5 truncate max-w-full">
                        {log.performedByEmail || "System"}
                      </span>
                    </div>

                    {/* Target Type & ID */}
                    <div className="flex flex-col justify-center">
                      <div className="text-xs font-bold text-white/70 truncate">{log.targetType ? log.targetType.toUpperCase() : "N/A"}</div>
                      <div className="text-[10px] font-bold text-white/30 mt-1 truncate tracking-tight">{log.targetId || "-"}</div>
                    </div>
                  </div>
                </div>

                {/* Details Section (Full Width below) */}
                {Object.keys(log.details || {}).length > 0 && (
                  <div className="mt-2 pt-4 border-t border-white/5">
                    <pre className="whitespace-pre-wrap text-[11px] text-white/50 font-mono bg-black/20 p-4 rounded-xl ring-1 ring-white/5 overflow-x-auto [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/20">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </PageShell>
  );
}