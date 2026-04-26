// src/pages/CustomersPage.jsx
import { useEffect, useMemo, useState } from "react";
import {
  listenCustomers, createCustomer, updateCustomer,
  deleteCustomer, getCustomerSales,
} from "../firebase/customerActions";
import { useAuth } from "../auth/AuthContext";
import { PageShell, Field, Input, PrimaryButton, SecondaryButton, Pill, ConfirmModal } from "../ui/Layout";
import InvoicePreview from "../components/InvoicePreview";
import {
  getSaleItems, getSaleItemSummary, getSaleSkuSummary,
  getSaleQuantity, getSaleSubtotal, getSaleTotal, getSaleDiscountText,
} from "../utils/saleHelpers";

const fc = (v) => `Rs. ${Number(v || 0).toLocaleString()}`;
const fmtDate = (v) => {
  if (!v) return "–";
  if (typeof v?.toDate === "function") return v.toDate().toLocaleDateString();
  return new Date(v).toLocaleDateString();
};

const initialForm = { name: "", email: "", phone: "", address: "", company: "" };

/* ── Customer History Modal ─────────────────────────────────────────────── */
function CustomerHistoryModal({ customer, onClose }) {
  const [sales,       setSales]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [invoiceSale, setInvoiceSale] = useState(null);

  useEffect(() => {
    if (!customer) return;
    setLoading(true);
    getCustomerSales(customer.id)
      .then(setSales)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [customer?.id]);

  const stats = useMemo(() => {
    // purchaseCount = number of invoices (not items)
    const purchaseCount = sales.length;
    // unitsBought = sum of all item quantities across all invoices
    const unitsBought = sales.reduce((s, sale) => s + getSaleQuantity(sale), 0);
    // totalSpent = sum of finalTotal
    const totalSpent = sales.reduce((s, sale) => s + getSaleTotal(sale), 0);
    const latestAt   = sales[0]?.soldAt || sales[0]?.createdAt;
    const isHighVal  = totalSpent >= 50_000;
    const isLoyal    = purchaseCount >= 3;
    return { purchaseCount, unitsBought, totalSpent, latestAt, isHighVal, isLoyal };
  }, [sales]);

  if (!customer) return null;

  return (
    <>
      {invoiceSale && <InvoicePreview sale={invoiceSale} onClose={() => setInvoiceSale(null)} />}

      <div className="fixed inset-0 z-40 flex items-center justify-center p-4"
        style={{ backgroundColor: "rgba(2,6,23,0.88)" }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>

        <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl bg-slate-900 ring-1 ring-white/10 shadow-2xl p-6 sm:p-8 flex flex-col gap-5"
          style={{ animation: "modalIn 0.18s ease-out" }}>

          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-white/50 mb-1">Customer History</div>
              <h2 className="text-xl font-semibold text-white">{customer.name}</h2>
              <div className="flex flex-wrap gap-3 text-xs text-white/40 mt-1">
                {customer.company && <span>{customer.company}</span>}
                {customer.phone   && <span>📞 {customer.phone}</span>}
                {customer.email   && <span>✉ {customer.email}</span>}
              </div>
            </div>
            <button onClick={onClose}
              className="rounded-xl bg-white/5 ring-1 ring-white/15 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/10 transition shrink-0">
              ✕ Close
            </button>
          </div>

          {/* Badges */}
          {!loading && (
            <div className="flex flex-wrap gap-2">
              {stats.isHighVal && (
                <span className="inline-flex items-center rounded-full bg-amber-500/15 text-amber-300 text-xs font-semibold px-3 py-1 ring-1 ring-amber-500/25">💎 High Value</span>
              )}
              {stats.isLoyal && (
                <span className="inline-flex items-center rounded-full bg-indigo-500/15 text-indigo-300 text-xs font-semibold px-3 py-1 ring-1 ring-indigo-500/25">⭐ Loyal Customer</span>
              )}
            </div>
          )}

          {/* Stats */}
          {!loading && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Purchases",    value: stats.purchaseCount },
                { label: "Units Bought", value: stats.unitsBought },
                { label: "Total Spent",  value: fc(stats.totalSpent) },
                { label: "Last Purchase",value: fmtDate(stats.latestAt) },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
                  <div className="text-xs text-white/40 mb-1">{label}</div>
                  <div className="text-base font-semibold text-white">{value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Purchase history table */}
          <div className="rounded-2xl ring-1 ring-white/10 overflow-hidden">
            <div className="px-4 py-3 bg-white/5 text-xs font-semibold uppercase tracking-widest text-white/40">
              Purchase History ({stats.purchaseCount} invoice{stats.purchaseCount !== 1 ? "s" : ""})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-white/80 min-w-[720px]">
                <thead className="bg-white/[0.03] text-white/50 text-xs">
                  <tr>
                    <th className="px-4 py-2.5">Invoice</th>
                    <th className="px-4 py-2.5">Items</th>
                    <th className="px-4 py-2.5">SKU</th>
                    <th className="px-4 py-2.5 text-right">Qty</th>
                    <th className="px-4 py-2.5 text-right">Subtotal</th>
                    <th className="px-4 py-2.5 text-right">Discount</th>
                    <th className="px-4 py-2.5 text-right">Final Total</th>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="9" className="px-4 py-4 text-white/40">Loading…</td></tr>
                  ) : sales.length === 0 ? (
                    <tr><td colSpan="9" className="px-4 py-4 text-white/40">No purchases yet.</td></tr>
                  ) : sales.map((sale) => {
                    const invNum = sale.invoiceNumber || (sale.id ? `INV-${sale.id.slice(-6).toUpperCase()}` : "–");

                    // ── Inline item extraction (belt-and-suspenders) ──────────
                    let rawItems = [];
                    if (Array.isArray(sale.items) && sale.items.length > 0) {
                      rawItems = sale.items;
                    } else if (sale.items && typeof sale.items === "object") {
                      rawItems = Object.values(sale.items); // Firestore edge case
                    }

                    const isMulti = rawItems.length > 0;

                    // Build item summary directly
                    let itemText = "";
                    let skuText  = "";
                    let qty      = 0;

                    if (isMulti) {
                      const shown = rawItems.slice(0, 3);
                      const extra = rawItems.length - 3;
                      itemText = shown.map((i) => `${i.itemName || "Item"} ×${Number(i.quantitySold || 0)}`).join(", ");
                      if (extra > 0) itemText += ` +${extra} more`;
                      const skus = rawItems.map((i) => i.sku).filter(Boolean).slice(0, 3);
                      skuText = skus.length > 0 ? skus.join(", ") : "—";
                      qty = rawItems.reduce((s, i) => s + Number(i.quantitySold || 0), 0);
                    } else {
                      // Old single-item format
                      itemText = sale.itemName || sale.name || "Unknown Item";
                      skuText  = sale.sku || "—";
                      qty      = Number(sale.quantitySold || 0);
                    }

                    // Totals
                    const sub      = Number(sale.subtotal || sale.totalBeforeDiscount || (isMulti ? rawItems.reduce((s,i)=>s+Number(i.lineTotal||0),0) : sale.totalPrice) || 0);
                    const discPct  = Number(sale.discountPercent || 0);
                    const discAmt  = Number(sale.discountAmount  || 0);
                    const total    = Number(sale.finalTotal || sale.totalAfterDiscount || sale.totalPrice || sub || 0);
                    const dateAt   = sale.soldAt || sale.createdAt;

                    return (
                      <tr key={sale.id} className="border-t border-white/10 hover:bg-white/[0.02] transition align-top">
                        <td className="px-4 py-3">
                          <div className="font-mono text-xs text-indigo-300">{invNum}</div>
                          {isMulti && <div className="text-[10px] text-white/30 mt-0.5">{rawItems.length} items</div>}
                        </td>
                        <td className="px-4 py-3 max-w-[200px]">
                          <div className="text-sm font-medium text-white leading-snug">{itemText}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs text-white/50">{skuText}</div>
                        </td>
                        <td className="px-4 py-3 text-right">{qty || "—"}</td>
                        <td className="px-4 py-3 text-right text-white/60">{fc(sub)}</td>
                        <td className="px-4 py-3 text-right">
                          {discPct > 0 || discAmt > 0 ? (
                            <span className="text-amber-300 text-xs font-semibold">
                              {discPct > 0 ? `${discPct}%` : ""}
                              {discAmt > 0 && <div className="text-white/40">− {fc(discAmt)}</div>}
                            </span>
                          ) : <span className="text-white/30">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-emerald-300">{fc(total)}</td>
                        <td className="px-4 py-3 text-white/40 text-xs whitespace-nowrap">{fmtDate(dateAt)}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => setInvoiceSale(sale)}
                            className="inline-flex items-center rounded-lg bg-blue-500/15 ring-1 ring-blue-500/25 text-blue-200 text-xs font-semibold px-2 py-1 hover:bg-blue-500/25 transition">
                            🧾
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

        <style>{`@keyframes modalIn { from { opacity:0; transform:scale(.96) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }`}</style>
      </div>
    </>
  );
}

/* ── Main Customers Page ────────────────────────────────────────────────── */
export default function CustomersPage() {
  const { user } = useAuth();
  const [customers,       setCustomers]       = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [msg,             setMsg]             = useState("");
  const [busy,            setBusy]            = useState(false);
  const [search,          setSearch]          = useState("");
  const [mode,            setMode]            = useState("add");
  const [editingId,       setEditingId]       = useState(null);
  const [form,            setForm]            = useState(initialForm);
  const [confirmModal,    setConfirmModal]    = useState(null);
  const [historyCustomer, setHistoryCustomer] = useState(null);

  useEffect(() => {
    return listenCustomers(
      (data) => { setCustomers(data); setLoading(false); },
      (err)  => { console.error(err); setMsg("Failed to load customers."); setLoading(false); }
    );
  }, []);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return customers;
    return customers.filter((c) =>
      [c.name, c.email, c.phone, c.company].some((f) => (f || "").toLowerCase().includes(s))
    );
  }, [customers, search]);

  function resetForm() { setForm(initialForm); setMode("add"); setEditingId(null); setMsg(""); }
  function startEdit(c) {
    setMode("edit"); setEditingId(c.id);
    setForm({ name: c.name||"", email: c.email||"", phone: c.phone||"", address: c.address||"", company: c.company||"" });
    setMsg(""); window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onSubmit(e) {
    e.preventDefault(); setMsg("");
    if (!form.name.trim())                         return setMsg("Name is required.");
    if (!form.email.trim() && !form.phone.trim())  return setMsg("Email or phone is required.");
    setBusy(true);
    try {
      if (mode === "add") { await createCustomer(form, user); setMsg("✅ Customer added."); }
      else                { await updateCustomer(editingId, form, user); setMsg("✅ Customer updated."); }
      resetForm();
    } catch { setMsg("❌ Failed to save customer."); }
    finally { setBusy(false); }
  }

  function onDelete(c) {
    setConfirmModal({
      title: "Delete Customer",
      body:  `Delete ${c.name}? This cannot be undone.`,
      variant: "danger",
      onConfirm: async () => {
        setBusy(true);
        try {
          await deleteCustomer(c.id, user, { name: c.name, email: c.email });
          setMsg("🗑️ Deleted."); if (editingId === c.id) resetForm();
        } catch { setMsg("❌ Failed to delete."); }
        finally { setBusy(false); }
      },
    });
  }

  return (
    <>
      <ConfirmModal state={confirmModal} onClose={() => setConfirmModal(null)} />
      {historyCustomer && (
        <CustomerHistoryModal customer={historyCustomer} onClose={() => setHistoryCustomer(null)} />
      )}

      <PageShell>
        <div className="grid gap-6">
          <div>
            <Pill>Customer Management</Pill>
            <h1 className="mt-3 text-2xl sm:text-3xl font-semibold text-white">Customer Database</h1>
            <p className="mt-2 text-sm text-white/60">Manage records for sales, invoicing, and loyalty insights.</p>
          </div>

          <div className="grid gap-6 lg:grid-cols-12">
            {/* Form */}
            <div className="lg:col-span-5">
              <div className="rounded-3xl bg-white/[0.06] ring-1 ring-white/10 p-5 sm:p-6 sticky top-24">
                <div className="flex items-center justify-between gap-3 mb-5">
                  <div className="text-sm text-white/60">{mode === "add" ? "Add new customer" : "Edit customer"}</div>
                  {mode === "edit" && (
                    <button onClick={resetForm} className="rounded-2xl bg-white/5 ring-1 ring-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10">Cancel</button>
                  )}
                </div>
                <form onSubmit={onSubmit} className="grid gap-4">
                  {[["Full Name","name","Jane Doe","text"],["Email","email","jane@example.com","email"],
                    ["Phone","phone","+94 77 123 4567","text"],["Company (Optional)","company","Acme Corp","text"],
                    ["Address","address","123 Main St","text"]].map(([label, key, ph, type]) => (
                    <Field key={key} label={label}>
                      <Input type={type} value={form[key]} placeholder={ph}
                        onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))} />
                    </Field>
                  ))}
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    <PrimaryButton type="submit" disabled={busy}>{busy ? "Saving…" : mode === "add" ? "Add Customer" : "Save Changes"}</PrimaryButton>
                    <SecondaryButton type="button" onClick={resetForm} disabled={busy}>Clear</SecondaryButton>
                  </div>
                  {msg && <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-3 text-sm text-white/80">{msg}</div>}
                </form>
              </div>
            </div>

            {/* Table */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              <div className="rounded-3xl bg-white/[0.04] ring-1 ring-white/10 p-5">
                <div className="text-sm text-white/60 mb-2">Search Customers</div>
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email, phone, company…" />
              </div>

              <div className="rounded-3xl bg-white/[0.06] ring-1 ring-white/10 p-4 sm:p-6">
                <div className="flex items-center gap-2 mb-4"><Pill>{filtered.length} Records</Pill></div>
                <div className="overflow-x-auto rounded-2xl ring-1 ring-white/10">
                  <table className="min-w-[560px] w-full text-sm">
                    <thead className="bg-white/5 text-white/60">
                      <tr>
                        <th className="text-left font-semibold px-4 py-3">Customer</th>
                        <th className="text-left font-semibold px-4 py-3">Contact</th>
                        <th className="text-right font-semibold px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {loading ? (
                        <tr><td className="px-4 py-4 text-white/50" colSpan={3}>Loading…</td></tr>
                      ) : filtered.length === 0 ? (
                        <tr><td className="px-4 py-4 text-white/50" colSpan={3}>No customers found.</td></tr>
                      ) : filtered.map((c) => (
                        <tr key={c.id} className="text-white/80 align-top">
                          <td className="px-4 py-3">
                            <div className="font-medium text-white">{c.name}</div>
                            {c.company && <div className="text-xs text-white/40">{c.company}</div>}
                          </td>
                          <td className="px-4 py-3">
                            <div>{c.email || "–"}</div>
                            <div className="text-xs text-white/40">{c.phone || "–"}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <button onClick={() => setHistoryCustomer(c)}
                                className="rounded-xl bg-indigo-500/15 ring-1 ring-indigo-500/25 px-3 py-2 text-xs font-semibold text-indigo-200 hover:bg-indigo-500/25 transition">
                                📋 History
                              </button>
                              <button onClick={() => startEdit(c)}
                                className="rounded-xl bg-white/5 ring-1 ring-white/15 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10">
                                Edit
                              </button>
                              <button onClick={() => onDelete(c)}
                                className="rounded-xl bg-red-500/15 ring-1 ring-red-500/25 px-3 py-2 text-xs font-semibold text-red-200 hover:bg-red-500/20">
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </PageShell>
    </>
  );
}
