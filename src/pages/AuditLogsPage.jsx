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

        <div className="mt-6 overflow-hidden rounded-2xl ring-1 ring-white/10 bg-white/5">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-white/80">
              <thead className="bg-white/5 text-white/90">
                <tr>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Target Type</th>
                  <th className="px-4 py-3">Target ID</th>
                  <th className="px-4 py-3">Details</th>
                  <th className="px-4 py-3">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-4 py-4" colSpan="6">
                      Loading audit logs...
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4" colSpan="6">
                      No audit logs found.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="border-t border-white/10">
                      <td className="px-4 py-3">{log.action}</td>
                      <td className="px-4 py-3">{log.performedByEmail}</td>
                      <td className="px-4 py-3">{log.targetType || "-"}</td>
                      <td className="px-4 py-3">{log.targetId || "-"}</td>
                      <td className="px-4 py-3">
                        <pre className="whitespace-pre-wrap text-xs text-white/70 max-h-32 overflow-y-auto">
                          {JSON.stringify(log.details || {}, null, 2)}
                        </pre>
                      </td>
                      <td className="px-4 py-3">{formatDate(log.timestamp)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PageShell>
  );
}