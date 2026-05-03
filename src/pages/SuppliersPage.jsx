// src/pages/SuppliersPage.jsx — Updated with Reorder Items view
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query, getDocs } from "firebase/firestore";
import {
  listenSuppliers, createSupplier, updateSupplier, deleteSupplier,
} from "../firebase/supplierActions";
import { db } from "../firebase/firebaseServices";
import { useAuth } from "../auth/AuthContext";
import {
  PageShell, Field, Input, PrimaryButton,
  SecondaryButton, Pill, ConfirmModal,
} from "../ui/Layout";

const initialForm = {
  name: "", contactPerson: "", email: "", phone: "", address: "", category: "",
};

function reorderQty(item) {
  const min = Number(item.minStockLevel || 0);
  const qty = Number(item.quantity      || 0);
  if (!min) return 10;
  return Math.max(min * 2 - qty, min);
}

/* ── Reorder Items Modal ──────────────────────────────────────────────────── */
function SupplierItemsModal({ supplier, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supplier) return;
    // Watch all inventory items in real time, filter client-side by supplierId or supplierName
    const q = query(collection(db, "inventoryItems"), orderBy("itemName", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const linked = all.filter(
        (it) =>
          it.supplierId === supplier.id ||
          (it.supplierName || "").toLowerCase() === (supplier.name || "").toLowerCase() ||
          (it.supplier     || "").toLowerCase() === (supplier.name || "").toLowerCase()
      );
      setItems(linked);
      setLoading(false);
    });
    return () => unsub();
  }, [supplier?.id]);

  if (!supplier) return null;

  const lowStockCount = items.filter(
    (it) => Number(it.quantity || 0) <= Number(it.minStockLevel || 0)
  ).length;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(2,6,23,0.88)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl bg-slate-900 ring-1 ring-white/10 shadow-2xl p-6 sm:p-8 flex flex-col gap-5"
        style={{ animation: "modalIn 0.18s ease-out" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-white/50 mb-1">Supplier</div>
            <h2 className="text-xl font-semibold text-white">{supplier.name}</h2>
            <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-white/50">
              {supplier.contactPerson && <span>👤 {supplier.contactPerson}</span>}
              {supplier.phone         && <span>📞 {supplier.phone}</span>}
              {supplier.email         && <span>✉ {supplier.email}</span>}
              {supplier.address       && <span>📍 {supplier.address}</span>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl bg-white/5 ring-1 ring-white/15 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/10 transition shrink-0"
          >
            ✕ Close
          </button>
        </div>

        {/* Stats */}
        {!loading && (
          <div className="flex flex-wrap gap-3">
            <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-3 text-sm">
              <div className="text-white/50 text-xs mb-0.5">Linked Items</div>
              <div className="font-semibold text-white">{items.length}</div>
            </div>
            <div className="rounded-2xl bg-amber-500/10 ring-1 ring-amber-500/20 px-4 py-3 text-sm">
              <div className="text-amber-300/70 text-xs mb-0.5">Low Stock</div>
              <div className="font-semibold text-amber-300">{lowStockCount}</div>
            </div>
          </div>
        )}

        {/* Items table */}
        <div className="rounded-2xl ring-1 ring-white/10 overflow-hidden">
          <div className="px-4 py-3 bg-white/5 text-xs font-semibold uppercase tracking-widest text-white/50">
            Inventory Items
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-white/80 min-w-[580px]">
              <thead className="bg-white/[0.03] text-white/60">
                <tr>
                  <th className="px-4 py-2.5">Item</th>
                  <th className="px-4 py-2.5">SKU</th>
                  <th className="px-4 py-2.5 text-right">Qty</th>
                  <th className="px-4 py-2.5 text-right">Min</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Reorder Qty</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="6" className="px-4 py-4 text-white/50">Loading…</td></tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-5 text-white/50">
                      No inventory items linked to this supplier yet.
                      <div className="text-xs mt-1 text-white/35">
                        Link items by selecting this supplier when adding/editing inventory.
                      </div>
                    </td>
                  </tr>
                ) : (
                  items.map((it) => {
                    const qty     = Number(it.quantity      || 0);
                    const min     = Number(it.minStockLevel || 0);
                    const isLow   = qty <= min;
                    const reorder = reorderQty(it);
                    return (
                      <tr
                        key={it.id}
                        className={`border-t border-white/10 ${isLow ? "bg-amber-500/[0.03]" : ""}`}
                      >
                        <td className="px-4 py-3 font-medium">
                          {isLow && <span className="mr-1.5 text-amber-400">⚠</span>}
                          {it.itemName}
                        </td>
                        <td className="px-4 py-3 text-white/50">{it.sku}</td>
                        <td className={`px-4 py-3 text-right font-semibold ${isLow ? "text-amber-300" : "text-white"}`}>
                          {qty}
                        </td>
                        <td className="px-4 py-3 text-right text-white/60">{min}</td>
                        <td className="px-4 py-3">
                          {isLow ? (
                            <span className="inline-flex items-center rounded-full bg-amber-500/15 text-amber-300 text-xs font-semibold px-2.5 py-0.5 ring-1 ring-amber-500/25">
                              Low Stock
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-emerald-500/10 text-emerald-300 text-xs font-semibold px-2.5 py-0.5 ring-1 ring-emerald-500/20">
                              OK
                            </span>
                          )}
                        </td>
                        <td className={`px-4 py-3 text-right font-semibold ${isLow ? "text-amber-200" : "text-white/40"}`}>
                          {isLow ? reorder : "–"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {lowStockCount > 0 && (
          <div className="rounded-2xl bg-amber-500/10 ring-1 ring-amber-500/20 px-4 py-3 text-sm text-amber-200">
            ⚠ {lowStockCount} item{lowStockCount > 1 ? "s are" : " is"} low on stock. Contact {supplier.contactPerson || supplier.name} to reorder.
            {supplier.phone && ` Phone: ${supplier.phone}.`}
          </div>
        )}
      </div>

      <style>{`
        @keyframes modalIn {
          from { opacity:0; transform: scale(0.96) translateY(8px); }
          to   { opacity:1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────────────────────────── */
export default function SuppliersPage() {
  const { user } = useAuth();

  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [msg, setMsg]             = useState("");
  const [busy, setBusy]           = useState(false);
  const [search, setSearch]       = useState("");
  const [mode, setMode]           = useState("add");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm]           = useState(initialForm);
  const [confirmModal, setConfirmModal] = useState(null);
  const [reorderSupplier, setReorderSupplier] = useState(null);
  const [inventory, setInventory] = useState([]);

  useEffect(() => {
    getDocs(collection(db, "inventoryItems")).then(snap => {
      setInventory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }).catch(console.error);

    return listenSuppliers(
      (data) => { setSuppliers(data); setLoading(false); },
      (err)  => { console.error(err); setMsg("Failed to load suppliers."); setLoading(false); }
    );
  }, []);

  const filteredSuppliers = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return suppliers;
    return suppliers.filter((c) =>
      (c.name          || "").toLowerCase().includes(s) ||
      (c.email         || "").toLowerCase().includes(s) ||
      (c.phone         || "").toLowerCase().includes(s) ||
      (c.contactPerson || "").toLowerCase().includes(s) ||
      (c.category      || "").toLowerCase().includes(s)
    );
  }, [suppliers, search]);

  const supplierStats = useMemo(() => {
    let lowStockSuppliers = new Set();
    let reorderNeededItems = 0;
    let estimatedReorderCost = 0;

    for (const item of inventory) {
        const qty = Number(item.quantity || 0);
        const min = Number(item.minStockLevel || 0);
        if (qty <= min) {
            reorderNeededItems++;
            if (item.supplierId) lowStockSuppliers.add(item.supplierId);
            else if (item.supplierName) lowStockSuppliers.add(item.supplierName.toLowerCase());
            
            const reorder = Math.max(min * 2 - qty, min);
            const cost = Number(item.buyingPrice || 0);
            estimatedReorderCost += reorder * cost;
        }
    }

    return {
        totalSuppliers: suppliers.length,
        suppliersWithLowStock: lowStockSuppliers.size,
        reorderNeededItems,
        estimatedReorderCost,
    };
  }, [inventory, suppliers]);

  const exportSupplierReorderCsv = () => {
    const rows = [
      ["Supplier", "Contact Person", "Email", "Phone", "Item", "SKU", "Current Qty", "Min Stock", "Suggested Reorder", "Buying Price", "Estimated Reorder Cost", "Status"]
    ];

    for (const item of inventory) {
        const qty = Number(item.quantity || 0);
        const min = Number(item.minStockLevel || 0);
        if (qty <= min) {
            let sName = item.supplierName || "—";
            let sContact = "—", sEmail = "—", sPhone = "—";
            if (item.supplierId) {
                const s = suppliers.find(sup => sup.id === item.supplierId);
                if (s) {
                    sName = s.name;
                    sContact = s.contactPerson || "—";
                    sEmail = s.email || "—";
                    sPhone = s.phone || "—";
                }
            }

            const reorder = Math.max(min * 2 - qty, min);
            const buying = Number(item.buyingPrice || 0);
            const estCost = reorder * buying;
            const status = qty <= 0 ? "Out of Stock" : "Low Stock";

            rows.push([
                sName, sContact, sEmail, sPhone,
                item.itemName, item.sku || "—", qty, min, reorder, buying, estCost, status
            ]);
        }
    }

    const csvContent = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "supplier_reorder_intelligence.csv";
    link.click();
  };

  function resetForm() { setForm(initialForm); setMode("add"); setEditingId(null); setMsg(""); }

  function startEdit(c) {
    setMode("edit"); setEditingId(c.id);
    setForm({ name: c.name||"", contactPerson: c.contactPerson||"", email: c.email||"", phone: c.phone||"", address: c.address||"", category: c.category||"" });
    setMsg("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onSubmit(e) {
    e.preventDefault(); setMsg("");
    if (!form.name.trim()) return setMsg("Supplier Name is required.");
    if (!form.email.trim() && !form.phone.trim()) return setMsg("Either email or phone is required.");
    setBusy(true);
    try {
      if (mode === "add") { await createSupplier(form, user); setMsg("✅ Supplier added successfully."); }
      else { await updateSupplier(editingId, form, user); setMsg("✅ Supplier updated successfully."); }
      resetForm();
    } catch (err) { console.error(err); setMsg("❌ Failed to save supplier."); }
    finally { setBusy(false); }
  }

  function onDelete(c) {
    setConfirmModal({
      title: "Delete Supplier",
      body: `Are you sure you want to delete ${c.name}? This action cannot be undone.`,
      variant: "danger",
      onConfirm: async () => {
        setBusy(true); setMsg("");
        try {
          await deleteSupplier(c.id, user, { name: c.name, email: c.email });
          setMsg("🗑️ Supplier deleted.");
          if (editingId === c.id) resetForm();
        } catch (err) { console.error(err); setMsg("❌ Failed to delete supplier."); }
        finally { setBusy(false); }
      },
    });
  }

  return (
    <>
      <ConfirmModal state={confirmModal} onClose={() => setConfirmModal(null)} />
      {reorderSupplier && (
        <SupplierItemsModal supplier={reorderSupplier} onClose={() => setReorderSupplier(null)} />
      )}

      <PageShell>
        <div className="grid gap-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <Pill>Supplier Management</Pill>
              <h1 className="mt-3 text-2xl sm:text-3xl font-semibold text-white">Supplier Database</h1>
              <p className="mt-2 text-sm text-white/70">
                Manage your suppliers for inventory intelligence and reordering.
              </p>
            </div>
            <SecondaryButton onClick={exportSupplierReorderCsv}>
              Export Supplier Reorder CSV
            </SecondaryButton>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
              <div className="text-xs text-white/50 mb-1">Total Suppliers</div>
              <div className="text-xl font-semibold text-white">{supplierStats.totalSuppliers}</div>
            </div>
            <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
              <div className="text-xs text-amber-300/80 mb-1">Suppliers w/ Low Stock</div>
              <div className="text-xl font-semibold text-white">{supplierStats.suppliersWithLowStock}</div>
            </div>
            <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
              <div className="text-xs text-orange-300/80 mb-1">Items Need Reorder</div>
              <div className="text-xl font-semibold text-white">{supplierStats.reorderNeededItems}</div>
            </div>
            <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
              <div className="text-xs text-white/50 mb-1">Est. Reorder Cost</div>
              <div className="text-xl font-semibold text-emerald-300">Rs. {supplierStats.estimatedReorderCost.toLocaleString()}</div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-12">
            {/* Form */}
            <div className="lg:col-span-5">
              <div className="rounded-3xl bg-white/[0.06] ring-1 ring-white/10 p-5 sm:p-6 sticky top-24">
                <div className="flex items-center justify-between gap-3 mb-5">
                  <div className="text-sm text-white/70">
                    {mode === "add" ? "Add new supplier" : "Edit supplier"}
                  </div>
                  {mode === "edit" && (
                    <button onClick={resetForm} className="rounded-2xl bg-white/5 ring-1 ring-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10">
                      Cancel Edit
                    </button>
                  )}
                </div>

                <form onSubmit={onSubmit} className="grid gap-4">
                  <Field label="Supplier Name">
                    <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Global Traders Inc." />
                  </Field>
                  <Field label="Category/Type">
                    <Input value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} placeholder="Electronics, Groceries..." />
                  </Field>
                  <Field label="Contact Person">
                    <Input value={form.contactPerson} onChange={(e) => setForm((p) => ({ ...p, contactPerson: e.target.value }))} placeholder="John Smith" />
                  </Field>
                  <Field label="Email Address">
                    <Input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="contact@supplier.com" />
                  </Field>
                  <Field label="Phone Number">
                    <Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="+94 77 123 4567" />
                  </Field>
                  <Field label="Address">
                    <Input value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} placeholder="123 Industrial Park" />
                  </Field>

                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    <PrimaryButton type="submit" disabled={busy}>
                      {busy ? "Saving..." : mode === "add" ? "Add Supplier" : "Save Changes"}
                    </PrimaryButton>
                    <SecondaryButton type="button" onClick={resetForm} disabled={busy}>Clear</SecondaryButton>
                  </div>

                  {msg && (
                    <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-3 text-sm text-white/80">
                      {msg}
                    </div>
                  )}
                </form>
              </div>
            </div>

            {/* Table */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              <div className="rounded-3xl bg-white/[0.04] ring-1 ring-white/10 p-5 sm:p-6">
                <div className="text-sm text-white/70 mb-2">Search Suppliers</div>
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, contact, category..."
                />
              </div>

              <div className="rounded-3xl bg-white/[0.06] ring-1 ring-white/10 p-4 sm:p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Pill>{filteredSuppliers.length} Records</Pill>
                </div>

                <div className="mt-5 space-y-3">
                  {loading ? (
                    <div className="py-12 text-center text-white/50 flex flex-col items-center bg-white/[0.02] rounded-[2rem] ring-1 ring-white/5 shadow-inner">
                      <span className="h-8 w-8 border-2 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin mb-4"></span>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em]">Loading Database...</span>
                    </div>
                  ) : filteredSuppliers.length === 0 ? (
                    <div className="py-12 text-center text-white/40 italic bg-white/[0.02] rounded-[2rem] ring-1 ring-white/5 shadow-inner flex flex-col items-center">
                      <span className="text-4xl mb-4 opacity-20">📭</span>
                      <span className="text-sm font-medium">No suppliers found.</span>
                    </div>
                  ) : (
                    filteredSuppliers.map((c) => (
                      <div 
                        key={c.id} 
                        className="bg-white/[0.02] ring-1 ring-white/10 p-5 rounded-[2rem] transition-all duration-300 hover:bg-white/[0.04] hover:shadow-xl hover:-translate-y-0.5 border border-white/5 flex flex-col md:flex-row gap-5 justify-between items-start md:items-center group"
                      >
                        <div className="flex-1 min-w-0 w-full">
                          <div className="flex items-center gap-3 mb-1.5">
                            <span className="font-black text-white text-base truncate">{c.name}</span>
                            {c.category && (
                              <span className="text-[9px] font-black uppercase tracking-widest text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-md ring-1 ring-indigo-500/20 shrink-0">
                                {c.category}
                              </span>
                            )}
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-4 text-xs text-white/50 bg-white/5 rounded-xl px-3 py-2 w-fit ring-1 ring-white/5">
                            <span className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] opacity-50">👤</span>
                              <span className="font-semibold text-white/70">{c.contactPerson || "No Contact"}</span>
                            </span>
                            {(c.phone || c.email) && <span className="w-px h-3 bg-white/10 shrink-0 hidden sm:block"></span>}
                            {c.phone && (
                              <span className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[10px] opacity-50">📞</span>
                                <span className="font-medium text-white/60">{c.phone}</span>
                              </span>
                            )}
                            {c.email && (
                              <span className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[10px] opacity-50">✉</span>
                                <span className="font-medium text-white/60 truncate max-w-[150px]">{c.email}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-row flex-nowrap items-center gap-2 w-full md:w-auto shrink-0 pt-2 md:pt-0 border-t border-white/5 md:border-none justify-start md:justify-end">
                          <button 
                            onClick={() => setReorderSupplier(c)} 
                            className="h-9 px-4 rounded-xl bg-amber-500/10 ring-1 ring-amber-500/30 text-amber-400 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-amber-500/20 transition-all active:scale-95 shrink-0"
                          >
                            📦 Items
                          </button>
                          <button 
                            onClick={() => startEdit(c)} 
                            className="h-9 px-4 rounded-xl bg-white/10 ring-1 ring-white/20 text-white text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white/20 transition-all active:scale-95 shrink-0"
                          >
                            Edit
                          </button>
                          <button 
                            onClick={() => onDelete(c)} 
                            className="h-9 px-4 rounded-xl bg-red-500/10 ring-1 ring-red-500/30 text-red-400 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-red-500/20 transition-all active:scale-95 shrink-0"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </PageShell>
    </>
  );
}
