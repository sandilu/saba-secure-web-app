import { useEffect, useMemo, useState } from "react";
import { getSales, cancelSale } from "../firebase/salesActions";
import { getSaleItems, getSaleTotal, getSaleSubtotal, getSaleQuantity, getSaleItemSummary } from "../utils/saleHelpers";
import { PageShell, Pill, Card, Select, Input, ConfirmModal } from "../ui/Layout";
import { getDateRangeBoundaries, isDateInRange } from "../utils/dateHelpers";
import InvoicePreview from "../components/InvoicePreview";
import ReturnSaleModal from "../components/ReturnSaleModal";
import { useAuth } from "../auth/AuthContext";

const fc      = (v) => `Rs. ${Number(v || 0).toLocaleString()}`;
const fmtDate = (v) => {
  if (!v) return "-";
  if (typeof v?.toDate === "function") return v.toDate().toLocaleString();
  return new Date(v).toLocaleString();
};

/** Normalise sale status to a lowercase string — handles missing/undefined safely */
function normStatus(sale) {
  return String(sale.status || "completed").toLowerCase().trim();
}

/** A sale can be cancelled if it is completed / active / has no status set */
function isCancellable(sale) {
  const s = normStatus(sale);
  return s === "completed" || s === "active";
}

/** A sale can be returned if it is completed or partially returned */
function isReturnable(sale) {
  const s = normStatus(sale);
  return s === "completed" || s === "partially_returned";
}

export default function SalesHistory() {
  const { user } = useAuth();
  const [sales,       setSales]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [cancelling,  setCancelling]  = useState(false);
  const [dateRange,   setDateRange]   = useState("all_time");
  const [custSearch,  setCustSearch]  = useState("");
  const [invoiceSale, setInvoiceSale] = useState(null);

  const [returnSaleTarget, setReturnSaleTarget] = useState(null);
  // cancelModal stores { sale } when open, null when closed
  const [cancelModal, setCancelModal] = useState(null);

  function loadData() {
    getSales()
      .then((d) => setSales(d))
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadData(); }, []);

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

  const totals = useMemo(() => {
    let revenue = 0, units = 0, discounted = 0, cancelled = 0, returned = 0;
    filtered.forEach((sale) => {
      const status = normStatus(sale);
      if (status === "cancelled") { cancelled++; return; }
      const total  = getSaleTotal(sale);
      const refund = Number(sale.refundAmount || 0);
      revenue += (total - refund);
      const qty    = getSaleQuantity(sale);
      const retQty = (sale.returnedItems || []).reduce((s, ri) => s + Number(ri.returnedQty || 0), 0);
      units += (qty - retQty);
      if (status === "returned" || status === "partially_returned") returned++;
      if (Number(sale.discountPercent || 0) > 0) discounted++;
    });
    return { count: filtered.length, revenue, units, discounted, cancelled, returned };
  }, [filtered]);

  // ── Cancel handlers ────────────────────────────────────────────────────────
  function openCancelModal(sale) {
    console.log("[SalesHistory] Opening cancel modal for sale:", sale.id, sale.invoiceNumber);
    setCancelModal({ sale });
  }

  function closeCancelModal() {
    setCancelModal(null);
  }

  async function handleConfirmCancel(reason) {
    if (!cancelModal?.sale) return;
    const sale = cancelModal.sale;
    console.log("[SalesHistory] Confirming cancel for:", sale.id, "reason:", reason);
    setCancelling(true);
    closeCancelModal();
    try {
      await cancelSale({ saleId: sale.id, reason, user });
      console.log("[SalesHistory] Cancel succeeded for:", sale.id);
      loadData();
    } catch (err) {
      console.error("[SalesHistory] Cancel failed:", err);
      alert(err.message || "Cancel failed. Please try again.");
    } finally {
      setCancelling(false);
    }
  }

  // ── ConfirmModal state object (matches Layout.jsx ConfirmModal API exactly) ─
  // Layout reads: { title, body, variant, requireReason, onConfirm }
  const confirmModalState = cancelModal
    ? {
        title: `Cancel Invoice ${cancelModal.sale.invoiceNumber || cancelModal.sale.id?.slice(-6) || ""}`,
        body: "Are you sure you want to cancel this sale? Inventory quantities will be restored. This action cannot be undone.",
        variant: "danger",
        requireReason: true,
        onConfirm: handleConfirmCancel,
      }
    : null;

  return (
    <>
      {/* Invoice Preview */}
      {invoiceSale && (
        <InvoicePreview sale={invoiceSale} onClose={() => setInvoiceSale(null)} />
      )}

      {/* Return Modal */}
      {returnSaleTarget && (
        <ReturnSaleModal
          sale={returnSaleTarget}
          onClose={() => setReturnSaleTarget(null)}
          onSuccess={() => { setReturnSaleTarget(null); loadData(); }}
        />
      )}

      {/* Cancel Confirm Modal — ConfirmModal reads onConfirm from state object */}
      <ConfirmModal
        state={confirmModalState}
        onClose={closeCancelModal}
      />

      <PageShell
        right={
          <div className="space-y-3">
            <Pill>Summary</Pill>
            <Card title="Invoices"    desc={String(totals.count)} />
            <Card title="Units Sold"  desc={String(totals.units)} />
            <Card title="Revenue"     desc={fc(totals.revenue)} />
            <div className="grid grid-cols-2 gap-3">
              <Card title="Cancelled" desc={String(totals.cancelled)} />
              <Card title="Returns"   desc={String(totals.returned)} />
            </div>
          </div>
        }
      >
        <div>
          <Pill>Sales History</Pill>
          <h1 className="mt-3 text-2xl sm:text-3xl font-semibold text-white">Sales Transactions</h1>
          {cancelling && (
            <div className="mt-2 text-sm text-amber-300 animate-pulse">Processing cancellation…</div>
          )}

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
              <Input
                value={custSearch}
                onChange={(e) => setCustSearch(e.target.value)}
                placeholder="Filter by customer, invoice number…"
              />
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
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td className="px-4 py-4 text-white/50" colSpan={10}>Loading…</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td className="px-4 py-4 text-white/50" colSpan={10}>No sales found.</td></tr>
                  ) : filtered.map((sale) => {
                    const sub          = getSaleSubtotal(sale);
                    const total        = getSaleTotal(sale);
                    const qty          = getSaleQuantity(sale);
                    const disc         = Number(sale.discountPercent || 0);
                    const discA        = Number(sale.discountAmount  || 0);
                    const status       = normStatus(sale);
                    const isCancelled  = status === "cancelled";
                    const isReturned   = status === "returned";
                    const isPartial    = status === "partially_returned";
                    const finalDisplay = sale.finalTotalAfterReturn ?? total;
                    const canCancel    = isCancellable(sale);
                    const canReturn    = isReturnable(sale);

                    return (
                      <tr
                        key={sale.id}
                        className={`border-t border-white/10 hover:bg-white/[0.02] transition ${isCancelled ? "opacity-60" : ""}`}
                      >
                        <td className="px-4 py-3">
                          <div className="font-mono text-xs text-indigo-300">
                            {sale.invoiceNumber || sale.id?.slice(-6)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{sale.customerName || "Walk-in"}</div>
                          {sale.customerPhone && (
                            <div className="text-xs text-white/40">{sale.customerPhone}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 max-w-[200px]">
                          <div className="text-xs text-white/70 truncate">{getSaleItemSummary(sale)}</div>
                        </td>
                        <td className="px-4 py-3 text-right">{qty}</td>
                        <td className="px-4 py-3 text-right text-white/60">{fc(sub)}</td>
                        <td className="px-4 py-3 text-right">
                          {disc > 0 ? (
                            <span className="text-amber-300 text-xs font-semibold">
                              {disc}%
                              <div className="text-white/40">−{fc(discA)}</div>
                            </span>
                          ) : (
                            <span className="text-white/30">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isCancelled ? (
                            <span className="line-through text-red-400/50">{fc(total)}</span>
                          ) : (
                            <div className="font-semibold text-emerald-300">
                              {fc(finalDisplay)}
                              {sale.refundAmount > 0 && (
                                <div className="text-[10px] text-red-400 font-normal">
                                  −{fc(sale.refundAmount)}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {isCancelled  ? <span className="inline-block px-2 py-0.5 rounded bg-red-500/20    text-red-300    text-[10px] font-bold uppercase tracking-wider">Cancelled</span>  :
                           isReturned   ? <span className="inline-block px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-bold uppercase tracking-wider">Returned</span>   :
                           isPartial    ? <span className="inline-block px-2 py-0.5 rounded bg-amber-500/20  text-amber-300  text-[10px] font-bold uppercase tracking-wider">Partial Ret</span> :
                                          <span className="inline-block px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase tracking-wider">Completed</span>}
                        </td>
                        <td className="px-4 py-3 text-white/50 text-xs whitespace-nowrap">{fmtDate(sale.soldAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 justify-end flex-wrap">
                            {/* Cancel — only for cancellable statuses */}
                            {canCancel && (
                              <button
                                type="button"
                                onClick={() => openCancelModal(sale)}
                                className="rounded-lg bg-red-500/10 ring-1 ring-red-500/20 text-red-300 text-xs font-semibold px-2.5 py-1.5 hover:bg-red-500/20 transition cursor-pointer"
                              >
                                Cancel
                              </button>
                            )}
                            {/* Return — completed or partially returned */}
                            {canReturn && (
                              <button
                                type="button"
                                onClick={() => setReturnSaleTarget(sale)}
                                className="rounded-lg bg-amber-500/10 ring-1 ring-amber-500/20 text-amber-300 text-xs font-semibold px-2.5 py-1.5 hover:bg-amber-500/20 transition cursor-pointer"
                              >
                                Return
                              </button>
                            )}
                            {/* Invoice — always available */}
                            <button
                              type="button"
                              onClick={() => setInvoiceSale(sale)}
                              className="inline-flex items-center gap-1 rounded-lg bg-blue-500/15 ring-1 ring-blue-500/25 text-blue-200 text-xs font-semibold px-2.5 py-1.5 hover:bg-blue-500/25 transition cursor-pointer"
                            >
                              🧾 Invoice
                            </button>
                          </div>
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