import { useEffect, useMemo, useState } from "react";
import { getSales } from "../firebase/salesActions";
import { getSaleItems, getSaleTotal, getSaleSubtotal, getSaleQuantity, getSaleItemSummary } from "../utils/saleHelpers";
import { PageShell, Pill, Card, Select, Input } from "../ui/Layout";
import { getDateRangeBoundaries, isDateInRange } from "../utils/dateHelpers";
import InvoicePreview from "../components/InvoicePreview";

const fc  = (v) => `Rs. ${Number(v || 0).toLocaleString()}`;
const fmtDate = (v) => { if (!v) return "-"; if (typeof v?.toDate === "function") return v.toDate().toLocaleString(); return new Date(v).toLocaleString(); };

export default function SalesHistory() {
  const [sales,       setSales]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [dateRange,   setDateRange]   = useState("all_time");
  const [custSearch,  setCustSearch]  = useState("");
  const [invoiceSale, setInvoiceSale] = useState(null);

  useEffect(() => {
    let m = true;
    getSales().then((d) => { if (m) setSales(d); }).catch(console.error).finally(() => { if (m) setLoading(false); });
    return () => { m = false; };
  }, []);

  const filtered = useMemo(() => {
    const { start, end } = getDateRangeBoundaries(dateRange);
    const s = custSearch.trim().toLowerCase();
    return sales.filter((sale) => {
      if (!isDateInRange(sale.soldAt, start, end)) return false;
      if (!s) return true;
      return [sale.customerName, sale.customerEmail, sale.customerPhone, sale.invoiceNumber]
        .some((f) => (f || "").toLowerCase().includes(s));
    });
  }, [sales, dateRange, custSearch]);

  const totals = useMemo(() => ({
    count:   filtered.length,
    revenue: filtered.reduce((s, x) => s + getSaleTotal(x), 0),
    units:   filtered.reduce((s, x) => s + getSaleQuantity(x), 0),
    discounted: filtered.filter((s) => Number(s.discountPercent || 0) > 0).length,
  }), [filtered]);

  return (
    <>
      {invoiceSale && <InvoicePreview sale={invoiceSale} onClose={() => setInvoiceSale(null)} />}
      <PageShell right={
        <div className="space-y-3">
          <Pill>Summary</Pill>
          <Card title="Invoices"         desc={String(totals.count)} />
          <Card title="Units Sold"       desc={String(totals.units)} />
          <Card title="Revenue"          desc={fc(totals.revenue)} />
          <Card title="Discounted Bills" desc={String(totals.discounted)} />
        </div>
      }>
        <div>
          <Pill>Sales History</Pill>
          <h1 className="mt-3 text-2xl sm:text-3xl font-semibold text-white">Sales Transactions</h1>

          <div className="mt-4 flex flex-wrap gap-3">
            <div className="w-full sm:w-56">
              <Select value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
                <option value="all_time">All Time</option>
                <option value="today">Today</option>
                <option value="this_week">This Week</option>
                <option value="this_month">This Month</option>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <Input value={custSearch} onChange={(e) => setCustSearch(e.target.value)} placeholder="Filter by customer, invoice number…" />
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl ring-1 ring-white/10 bg-white/5">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-white/80 min-w-[900px]">
                <thead className="bg-white/5 text-white/90">
                  <tr>
                    <th className="px-4 py-3">Invoice</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Items</th>
                    <th className="px-4 py-3 text-right">Qty</th>
                    <th className="px-4 py-3 text-right">Subtotal</th>
                    <th className="px-4 py-3 text-right">Discount</th>
                    <th className="px-4 py-3 text-right">Final Total</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td className="px-4 py-4 text-white/50" colSpan="9">Loading…</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td className="px-4 py-4 text-white/50" colSpan="9">No sales found.</td></tr>
                  ) : filtered.map((sale) => {
                    const sub   = getSaleSubtotal(sale);
                    const total = getSaleTotal(sale);
                    const qty   = getSaleQuantity(sale);
                    const disc  = Number(sale.discountPercent || 0);
                    const discA = Number(sale.discountAmount  || 0);
                    return (
                      <tr key={sale.id} className="border-t border-white/10 hover:bg-white/[0.02] transition">
                        <td className="px-4 py-3">
                          <div className="font-mono text-xs text-indigo-300">{sale.invoiceNumber || sale.id?.slice(-6)}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{sale.customerName || "Walk-in"}</div>
                          {sale.customerPhone && <div className="text-xs text-white/40">{sale.customerPhone}</div>}
                        </td>
                        <td className="px-4 py-3 max-w-[200px]">
                          <div className="text-xs text-white/70 truncate">{getSaleItemSummary(sale)}</div>
                        </td>
                        <td className="px-4 py-3 text-right">{qty}</td>
                        <td className="px-4 py-3 text-right text-white/60">{fc(sub)}</td>
                        <td className="px-4 py-3 text-right">
                          {disc > 0 ? (
                            <span className="text-amber-300 text-xs font-semibold">{disc}%<div className="text-white/40">−{fc(discA)}</div></span>
                          ) : <span className="text-white/30">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-emerald-300">{fc(total)}</td>
                        <td className="px-4 py-3 text-white/50 text-xs whitespace-nowrap">{fmtDate(sale.soldAt)}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => setInvoiceSale(sale)}
                            className="inline-flex items-center gap-1 rounded-xl bg-blue-500/15 ring-1 ring-blue-500/25 text-blue-200 text-xs font-semibold px-2.5 py-1.5 hover:bg-blue-500/25 transition">
                            🧾 Invoice
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </PageShell>
    </>
  );
}