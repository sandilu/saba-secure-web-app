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

          <div className="mt-5 space-y-4">
            {loading ? (
              <div className="py-16 text-center text-white/50 flex flex-col items-center justify-center bg-white/[0.02] rounded-[2rem] ring-1 ring-white/5 shadow-inner">
                <span className="h-8 w-8 border-2 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin mb-4"></span>
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Syncing Ledger...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center text-white/40 italic bg-white/[0.02] rounded-[2rem] ring-1 ring-white/5 shadow-inner flex flex-col items-center">
                <span className="text-4xl mb-4 opacity-20">📭</span>
                <span className="text-sm font-medium">No sales records found matching your criteria.</span>
              </div>
            ) : (
              filtered.map((sale) => {
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

                const displayInvoice = sale.invoiceNumber 
                  ? (sale.invoiceNumber.startsWith("INV-") ? sale.invoiceNumber : `INV-${sale.invoiceNumber}`) 
                  : `INV-${sale.id?.slice(-6)?.toUpperCase()}`;

                return (
                  <div 
                    key={sale.id}
                    className={`bg-white/[0.02] ring-1 ring-white/10 p-5 sm:p-6 rounded-[2rem] transition-all duration-500 hover:bg-white/[0.04] hover:shadow-2xl hover:shadow-indigo-500/5 hover:-translate-y-0.5 border border-white/5 relative overflow-hidden group ${isCancelled ? "opacity-50 saturate-0" : ""}`}
                  >
                    {/* Top Row: Status, ID & Date (Left) | Actions (Right) */}
                    <div className="flex flex-col md:flex-row justify-between items-start gap-4 border-b border-white/5 pb-4 mb-4">
                      {/* Left: ID and Date (Always stacked consistently) */}
                      <div className="flex flex-col gap-2.5">
                        <div className="flex items-center gap-3">
                          {isCancelled  ? <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.6)]"></span> :
                           isReturned   ? <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.6)]"></span> :
                           isPartial    ? <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.6)]"></span> :
                                          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.6)]"></span>}
                          <span className="font-mono text-[11px] font-black uppercase tracking-widest text-indigo-300 bg-indigo-500/10 px-2.5 py-1 rounded-md ring-1 ring-indigo-500/20">
                            {displayInvoice}
                          </span>
                        </div>
                        <div className="pl-6">
                          <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">{fmtDate(sale.soldAt)}</span>
                        </div>
                      </div>

                      {/* Right: Actions (Always single row, right aligned) */}
                      <div className="flex flex-row flex-nowrap justify-end items-center gap-2 w-full md:w-auto pt-1 md:pt-0">
                        {canCancel && (
                          <button
                            type="button"
                            onClick={() => openCancelModal(sale)}
                            className="shrink-0 h-8 px-4 rounded-xl bg-red-500/10 ring-1 ring-red-500/30 text-red-400 text-[9px] font-black uppercase tracking-[0.2em] hover:bg-red-500/20 hover:ring-red-500/50 transition-all active:scale-95"
                          >
                            Cancel
                          </button>
                        )}
                        {canReturn && (
                          <button
                            type="button"
                            onClick={() => setReturnSaleTarget(sale)}
                            className="shrink-0 h-8 px-4 rounded-xl bg-amber-500/10 ring-1 ring-amber-500/30 text-amber-400 text-[9px] font-black uppercase tracking-[0.2em] hover:bg-amber-500/20 hover:ring-amber-500/50 transition-all active:scale-95"
                          >
                            Return
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setInvoiceSale(sale)}
                          className="shrink-0 h-8 px-4 rounded-xl bg-white/10 ring-1 ring-white/20 text-white text-[9px] font-black uppercase tracking-[0.2em] hover:bg-white/20 hover:ring-white/40 transition-all active:scale-95"
                        >
                          Receipt
                        </button>
                      </div>
                    </div>

                    {/* Bottom Row: Customer & Items (Left) | Financials (Right) */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
                      <div className="flex-1 min-w-0 w-full">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="font-black text-white text-base truncate">{sale.customerName || "Walk-in Customer"}</span>
                          {sale.customerPhone && <span className="text-[9px] font-black text-white/40 uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/5 ring-1 ring-white/10">{sale.customerPhone}</span>}
                        </div>
                        <div className="text-xs text-white/50 flex flex-wrap items-center gap-3 bg-white/5 rounded-xl px-3 py-2 w-fit max-w-full ring-1 ring-white/5">
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 shrink-0">{qty} Items</span>
                          <span className="w-px h-3 bg-white/10 shrink-0"></span>
                          <span className="truncate font-medium">{getSaleItemSummary(sale)}</span>
                        </div>
                      </div>

                      <div className="w-full sm:w-auto shrink-0 text-left sm:text-right bg-black/20 sm:bg-transparent p-4 sm:p-0 rounded-2xl ring-1 ring-white/5 sm:ring-0">
                        <div className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30 mb-1.5">Net Finalized</div>
                        {isCancelled ? (
                          <div className="line-through text-red-400/50 font-black text-xl tabular-nums">{fc(total)}</div>
                        ) : (
                          <div className="flex flex-col sm:items-end">
                            <div className="font-black text-emerald-400 text-2xl tabular-nums drop-shadow-[0_0_15px_rgba(16,185,129,0.15)] leading-none">{fc(finalDisplay)}</div>
                            <div className="flex flex-wrap gap-2 mt-2 justify-start sm:justify-end">
                              {disc > 0 && <span className="text-[8px] font-black text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded uppercase tracking-[0.2em] ring-1 ring-amber-500/20">-{disc}%</span>}
                              {sale.refundAmount > 0 && <span className="text-[8px] font-black text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded uppercase tracking-[0.2em] ring-1 ring-red-500/20">Ref: {fc(sale.refundAmount)}</span>}
                            </div>
                          </div>
                        )}
                      </div>
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