import { useEffect, useMemo, useState } from "react";
import { getSales } from "../firebase/salesActions";
import { getSaleTotal, getSaleQuantity, getSaleItemSummary } from "../utils/saleHelpers";
import { PageShell, Pill, Card, Select, Input } from "../ui/Layout";
import { getDateRangeBoundaries, isDateInRange } from "../utils/dateHelpers";
import InvoicePreview from "../components/InvoicePreview";
import { useAuth } from "../auth/AuthContext";

const fc = (v) => `Rs. ${Number(v || 0).toLocaleString()}`;

function MetricCard({ label, value, sub, icon, color }) {
  const colors = {
    indigo: "bg-indigo-500/5 ring-indigo-500/20 text-indigo-400",
    emerald: "bg-emerald-500/5 ring-emerald-500/20 text-emerald-400",
    blue: "bg-blue-500/5 ring-blue-500/20 text-blue-400",
  };

  return (
    <div className={`rounded-3xl p-5 ring-1 transition hover:bg-white/[0.08] ${colors[color] || colors.indigo}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] font-bold uppercase tracking-widest opacity-60">{label}</div>
        <div className="text-xl">{icon}</div>
      </div>
      <div className="text-2xl font-black text-white tabular-nums">{value}</div>
      <div className="mt-1 text-[11px] text-white/40 font-medium">{sub}</div>
    </div>
  );
}
const fmtDate = (v) => {
  if (!v) return "-";
  if (typeof v?.toDate === "function") return v.toDate().toLocaleString();
  return new Date(v).toLocaleString();
};

export default function StaffMySalesPage() {
  const { user } = useAuth();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("all_time");
  const [search, setSearch] = useState("");
  const [invoiceSale, setInvoiceSale] = useState(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    getSales()
      .then((allSales) => {
        // Filter sales by the logged-in user
        const mySales = allSales.filter((s) => s.soldBy === user.uid || s.soldByEmail === user.email);
        setSales(mySales);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  const filtered = useMemo(() => {
    const { start, end } = getDateRangeBoundaries(dateRange);
    const s = search.trim().toLowerCase();
    return sales.filter((sale) => {
      if (!isDateInRange(sale.soldAt, start, end)) return false;
      if (!s) return true;
      return [sale.customerName, sale.invoiceNumber]
        .some((f) => (f || "").toLowerCase().includes(s));
    });
  }, [sales, dateRange, search]);

  const stats = useMemo(() => {
    let revenue = 0, units = 0, count = 0;
    filtered.forEach((sale) => {
      if (sale.status === "cancelled") return;
      revenue += (getSaleTotal(sale) - Number(sale.refundAmount || 0));
      units += (getSaleQuantity(sale) - (sale.returnedItems || []).reduce((acc, ri) => acc + Number(ri.returnedQty || 0), 0));
      count++;
    });
    return { count, revenue, units };
  }, [filtered]);

  return (
    <>
      {invoiceSale && (
        <InvoicePreview sale={invoiceSale} onClose={() => setInvoiceSale(null)} />
      )}

      <PageShell
        right={
          <div className="space-y-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 ml-1">Performance Metrics</div>
            <MetricCard 
              label="Sales Count" 
              value={stats.count} 
              sub="Transactions handled" 
              icon="📈"
              color="indigo"
            />
            <MetricCard 
              label="Gross Revenue" 
              value={fc(stats.revenue)} 
              sub="Total processed" 
              icon="💰"
              color="emerald"
            />
            <MetricCard 
              label="Units Sold" 
              value={stats.units} 
              sub="Net item volume" 
              icon="📦"
              color="blue"
            />
          </div>
        }
      >
        <div className="space-y-8">
          <div>
            <Pill>Staff Operations</Pill>
            <h1 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight text-white">My Sales History</h1>
            <p className="mt-2 text-base text-white/50 max-w-xl">
              Track your daily performance and manage customer invoices. Only your processed transactions are shown here.
            </p>
          </div>

          <div className="flex flex-wrap gap-4 items-end">
            <div className="w-full sm:w-64 space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-widest text-white/30 ml-1">Filter by Period</div>
              <Select value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
                <option value="all_time">All Time Record</option>
                <option value="today">Today's Sales</option>
                <option value="this_week">This Week</option>
                <option value="this_month">This Month</option>
              </Select>
            </div>
            <div className="flex-1 min-w-[240px] space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-widest text-white/30 ml-1">Quick Search</div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-white/20 group-focus-within:text-indigo-400 transition-colors">🔍</div>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Invoice # or customer name..."
                  className="w-full rounded-2xl bg-white/5 ring-1 ring-white/10 pl-11 pr-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
                />
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {loading ? (
              <div className="py-12 text-center text-white/50 flex flex-col items-center bg-white/[0.02] rounded-[2rem] ring-1 ring-white/5 shadow-inner">
                <div className="h-8 w-8 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Syncing Records...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-white/40 italic bg-white/[0.02] rounded-[2rem] ring-1 ring-white/5 shadow-inner flex flex-col items-center">
                <span className="text-4xl mb-4 opacity-20">📂</span>
                <span className="text-sm font-medium">No transactions found matching your criteria.</span>
              </div>
            ) : (
              filtered.map((sale) => {
                const status = sale.status || "completed";
                const isCancelled = status === "cancelled";
                const isReturned = status === "returned";
                const total = sale.finalTotalAfterReturn ?? getSaleTotal(sale);

                return (
                  <div 
                    key={sale.id} 
                    className={`bg-white/[0.02] ring-1 ring-white/10 p-5 rounded-[2rem] transition-all duration-300 hover:bg-white/[0.04] hover:shadow-xl hover:-translate-y-0.5 border border-white/5 flex flex-col md:flex-row gap-5 justify-between items-start md:items-center group ${isCancelled ? "opacity-50 grayscale" : ""}`}
                  >
                    <div className="flex-1 min-w-0 w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {/* Invoice & Status */}
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="font-bold text-indigo-400 group-hover:text-indigo-300 transition-colors">#{sale.invoiceNumber || sale.id?.slice(-6)}</span>
                          <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-[0.2em] ring-1 ${
                            isCancelled ? "bg-red-500/10 text-red-400 ring-red-500/20" :
                            isReturned ? "bg-purple-500/10 text-purple-400 ring-purple-500/20" :
                            "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20"
                          }`}>
                            {status}
                          </span>
                        </div>
                        <div className="text-[10px] font-bold text-white/30 uppercase tracking-tight">{fmtDate(sale.soldAt)}</div>
                      </div>

                      {/* Customer Info */}
                      <div>
                        <div className="font-bold text-white group-hover:text-indigo-200 transition-colors truncate">{sale.customerName || "Walk-in Customer"}</div>
                        <div className="text-[10px] font-bold text-white/30 mt-1 uppercase tracking-tight truncate">{sale.customerPhone || "Guest Account"}</div>
                      </div>

                      {/* Items */}
                      <div className="flex items-center">
                        <div className="text-xs font-medium text-white/50 truncate max-w-full" title={getSaleItemSummary(sale)}>
                          {getSaleItemSummary(sale)}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-row flex-nowrap items-center gap-4 w-full md:w-auto shrink-0 pt-3 md:pt-0 border-t border-white/5 md:border-none justify-between md:justify-end">
                      <div className={`font-black tabular-nums text-lg ${isCancelled ? "line-through opacity-30" : "text-white group-hover:text-emerald-400 transition-colors"}`}>
                        {fc(total)}
                      </div>
                      <button
                        onClick={() => setInvoiceSale(sale)}
                        className="h-10 px-4 rounded-xl bg-white/5 ring-1 ring-white/10 flex items-center justify-center text-[10px] font-black uppercase tracking-[0.2em] text-white/70 hover:bg-white/10 hover:text-white transition-all shadow-sm shrink-0 active:scale-95"
                      >
                        🧾 Receipt
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </PageShell>
    </>
  );
}
