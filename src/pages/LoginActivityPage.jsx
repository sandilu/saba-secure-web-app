import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "../firebase/firebaseServices";
import { PageShell, Pill, Input, Select } from "../ui/Layout";
import { getDateRangeBoundaries, isDateInRange } from "../utils/dateHelpers";

function formatDate(value) {
  if (!value) return "-";
  if (typeof value?.toDate === "function") {
    return value.toDate().toLocaleString();
  }
  return new Date(value).toLocaleString();
}

export default function LoginActivityPage() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterEvent, setFilterEvent] = useState("");
  const [dateRange, setDateRange] = useState("all_time");

  useEffect(() => {
    async function loadActivities() {
      try {
        const snap = await getDocs(collection(db, "loginActivities"));
        let data = snap.docs.map((d) => {
          const docData = d.data();
          return {
            id: d.id,
            ...docData,
            // Fallback for older documents missing timestamp
            timestamp: docData.timestamp || docData.loginAt || docData.logoutAt,
          };
        });

        // Sort descending
        data.sort((a, b) => {
          const tA = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
          const tB = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
          return tB - tA;
        });

        setActivities(data);
      } catch (err) {
        console.error("Failed to load login activities:", err);
      } finally {
        setLoading(false);
      }
    }

    loadActivities();
  }, []);

  const filteredActivities = useMemo(() => {
    const { start, end } = getDateRangeBoundaries(dateRange);

    return activities.filter((act) => {
      // Date filter
      if (!isDateInRange(act.timestamp, start, end)) return false;

      // Search filter (email or name)
      if (search) {
        const q = search.toLowerCase();
        const emailMatch = String(act.email || "").toLowerCase().includes(q);
        const nameMatch = String(act.name || "").toLowerCase().includes(q);
        if (!emailMatch && !nameMatch) return false;
      }

      // Event filter
      if (filterEvent && act.event !== filterEvent) return false;

      return true;
    });
  }, [activities, search, filterEvent, dateRange]);

  return (
    <PageShell>
      <div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Pill>System Audit</Pill>
            <h1 className="mt-3 text-2xl sm:text-3xl font-semibold text-white">
              Login Activity History
            </h1>
            <p className="mt-2 text-sm text-white/70">
              Monitor user session events, login methods, and timestamps.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3 bg-white/5 p-4 rounded-2xl ring-1 ring-white/10">
          <div>
            <label className="block text-xs text-white/70 mb-1">Search User</label>
            <Input
              placeholder="Search by email or name..."
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
            <label className="block text-xs text-white/70 mb-1">Filter by Event</label>
            <Select value={filterEvent} onChange={(e) => setFilterEvent(e.target.value)}>
              <option value="">All Events</option>
              <option value="LOGIN">Login</option>
              <option value="LOGOUT">Logout</option>
            </Select>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl ring-1 ring-white/10 bg-white/5">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-white/80">
              <thead className="bg-white/5 text-white/90">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-4 py-4 text-center" colSpan="5">
                      Loading activity...
                    </td>
                  </tr>
                ) : filteredActivities.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-center" colSpan="5">
                      No activities found.
                    </td>
                  </tr>
                ) : (
                  filteredActivities.map((act) => (
                    <tr key={act.id} className="border-t border-white/10">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">{act.name || "-"}</div>
                        <div className="text-xs text-white/60">{act.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="capitalize">{act.role || "-"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                            act.event === "LOGIN"
                              ? "bg-emerald-500/15 text-emerald-200"
                              : "bg-slate-500/20 text-slate-300"
                          }`}
                        >
                          {act.event}
                        </span>
                      </td>
                      <td className="px-4 py-3">{act.method || "-"}</td>
                      <td className="px-4 py-3">{formatDate(act.timestamp)}</td>
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
