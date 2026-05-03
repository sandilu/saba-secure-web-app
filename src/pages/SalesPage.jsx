import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { Link } from "react-router-dom";
import { PageShell, Field, Input, Select, PrimaryButton, SecondaryButton, Pill, Card } from "../ui/Layout";
import { db } from "../firebase/firebaseServices";
import { createSale } from "../firebase/salesActions";
import { listenCustomers, getCustomerSales, createCustomer } from "../firebase/customerActions";
import { useAuth } from "../auth/AuthContext";
import InvoicePreview from "../components/InvoicePreview";
import { getSmartDiscount } from "../utils/discountRules";
import { getSaleItems, getSaleTotal } from "../utils/saleHelpers";

const fc = (v) => `Rs. ${Number(v || 0).toLocaleString()}`;

export default function SalesPage() {
  const { user } = useAuth();

  const [items, setItems] = useState([]);
  useEffect(() => {
    const q = query(collection(db, "inventoryItems"), orderBy("itemName", "asc"));
    return onSnapshot(q, (snap) => setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, []);

  const [customers, setCustomers] = useState([]);
  useEffect(() => listenCustomers((d) => setCustomers(d), console.error), []);

  // Discount
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountSource, setDiscountSource] = useState("none");
  const [discountReason, setDiscountReason] = useState("");
  function clearDiscount() { setDiscountPercent(0); setDiscountSource("none"); setDiscountReason(""); }
  function handleDiscountInput(val) {
    const n = Math.min(100, Math.max(0, Number(val) || 0));
    setDiscountPercent(n); setDiscountSource(n > 0 ? "manual" : "none");
    setDiscountReason(n > 0 ? "Manual discount by staff." : "");
  }

  // Customer
  const [customerHistory, setCustomerHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");

  const customerResults = useMemo(() => {
    const s = customerSearch.trim().toLowerCase();
    if (!s || selectedCustomer) return [];
    return customers.filter((c) =>
      [c.name, c.email, c.phone, c.company].some((f) => (f || "").toLowerCase().includes(s))
    ).slice(0, 6);
  }, [customerSearch, customers, selectedCustomer]);

  async function selectCustomer(c) {
    setSelectedCustomer(c); setCustomerSearch(""); setHistoryLoading(true);
    setCustomerHistory(null); clearDiscount();
    try {
      const sales = await getCustomerSales(c.id);
      const purchaseCount = sales.length;
      const totalSpent = sales.reduce((s, x) => s + getSaleTotal(x), 0);
      setCustomerHistory({ purchaseCount, totalSpent });
    } catch { setCustomerHistory({ purchaseCount: 0, totalSpent: 0 }); }
    finally { setHistoryLoading(false); }
  }
  function clearCustomer() { setSelectedCustomer(null); setCustomerSearch(""); setCustomerHistory(null); clearDiscount(); }

  useEffect(() => {
    if (isNewCustomer) {
      clearCustomer();
    }
  }, [isNewCustomer]);

  // Cart
  const [cart, setCart] = useState([]);
  const [selItemId, setSelItemId] = useState("");
  const [selQty, setSelQty] = useState(1);
  const [cartMsg, setCartMsg] = useState("");

  function addToCart() {
    setCartMsg("");
    if (!selItemId) { setCartMsg("Please select an item."); return; }
    const qty = Number(selQty);
    if (qty <= 0) { setCartMsg("Quantity must be > 0."); return; }
    const invItem = items.find((i) => i.id === selItemId);
    if (!invItem) { setCartMsg("Item not found."); return; }
    const existing = cart.find((c) => c.itemId === selItemId);
    const alreadyInCart = existing ? existing.quantitySold : 0;
    const totalNeeded = alreadyInCart + qty;
    if (totalNeeded > Number(invItem.quantity || 0)) {
      setCartMsg(`Not enough stock. Available: ${invItem.quantity}, in cart: ${alreadyInCart}, requested: ${qty}.`);
      return;
    }
    if (existing) {
      setCart((prev) => prev.map((c) => c.itemId === selItemId ? { ...c, quantitySold: c.quantitySold + qty, lineTotal: (c.quantitySold + qty) * c.unitPrice } : c));
    } else {
      const unitPrice = Number(invItem.sellingPrice || 0);
      setCart((prev) => [...prev, {
        itemId: selItemId, itemName: invItem.itemName, sku: invItem.sku,
        quantitySold: qty, unitPrice, buyingPrice: Number(invItem.buyingPrice || 0),
        lineTotal: qty * unitPrice,
      }]);
    }
    setSelItemId(""); setSelQty(1);
  }

  function removeFromCart(itemId) { setCart((prev) => prev.filter((c) => c.itemId !== itemId)); }
  function updateCartQty(itemId, qty) {
    const n = Number(qty);
    if (n <= 0) { removeFromCart(itemId); return; }
    const invItem = items.find((i) => i.id === itemId);
    if (invItem && n > Number(invItem.quantity || 0)) { setCartMsg(`Max available stock: ${invItem.quantity}`); return; }
    setCart((prev) => prev.map((c) => c.itemId === itemId ? { ...c, quantitySold: n, lineTotal: n * c.unitPrice } : c));
  }

  // Totals
  const subtotal = cart.reduce((s, c) => s + c.lineTotal, 0);
  const safeDiscPct = Math.min(100, Math.max(0, Number(discountPercent || 0)));
  const discountAmt = Math.round((subtotal * safeDiscPct) / 100 * 100) / 100;
  const finalTotal = Math.max(0, subtotal - discountAmt);

  const suggestion = useMemo(() => {
    if ((!selectedCustomer && !isNewCustomer) || (selectedCustomer && !customerHistory)) return null;
    const pCount = isNewCustomer ? 0 : (customerHistory?.purchaseCount || 0);
    const tSpent = isNewCustomer ? 0 : (customerHistory?.totalSpent || 0);
    return getSmartDiscount({ purchaseCount: pCount, totalSpent: tSpent, currentSubtotal: subtotal });
  }, [selectedCustomer, customerHistory, subtotal, isNewCustomer]);

  // Submit
  const [msg, setMsg] = useState(""); const [msgType, setMsgType] = useState("neutral");
  const [loading, setLoading] = useState(false);
  const [lastSale, setLastSale] = useState(null); const [showInvoice, setShowInvoice] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault(); setMsg(""); setMsgType("neutral");
    if (cart.length === 0) { setMsg("Cart is empty. Add at least one item."); setMsgType("error"); return; }
    
    if (isNewCustomer && !newCustomerName.trim()) {
      setMsg("Please enter the new customer's name."); setMsgType("error"); return;
    }

    setLoading(true);
    try {
      let finalCustomerId = selectedCustomer?.id || null;
      let finalCustomerName = selectedCustomer?.name || "Walk-in Customer";
      let finalCustomerPhone = selectedCustomer?.phone || "";
      let finalCustomerEmail = selectedCustomer?.email || "";
      let finalCustomerCompany = selectedCustomer?.company || "";

      if (isNewCustomer && newCustomerName.trim()) {
        const newId = await createCustomer({ name: newCustomerName, phone: newCustomerPhone }, user);
        finalCustomerId = newId;
        finalCustomerName = newCustomerName.trim();
        finalCustomerPhone = newCustomerPhone.trim();
      }

      const result = await createSale({
        cartItems: cart, soldBy: user.uid, soldByEmail: user.email,
        customerId: finalCustomerId, customerName: finalCustomerName,
        customerEmail: finalCustomerEmail, customerPhone: finalCustomerPhone,
        customerCompany: finalCustomerCompany,
        discountPercent: safeDiscPct, discountAmount: discountAmt, discountSource, discountReason,
        customerPurchaseCountAtSale: isNewCustomer ? 0 : (customerHistory?.purchaseCount || 0),
        customerTotalSpentBeforeSale: isNewCustomer ? 0 : (customerHistory?.totalSpent || 0),
      });
      setLastSale({
        id: result.invoiceNumber, invoiceNumber: result.invoiceNumber,
        items: cart, subtotal, discountPercent: safeDiscPct, discountAmount: discountAmt,
        finalTotal, totalPrice: finalTotal, soldByEmail: user.email, soldAt: new Date(),
        customerId: finalCustomerId, customerName: finalCustomerName,
        customerEmail: finalCustomerEmail, customerPhone: finalCustomerPhone,
        customerCompany: finalCustomerCompany,
      });
      setMsg(`✅ Sale saved — ${result.invoiceNumber}`); setMsgType("success");
      setCart([]); setSelItemId(""); setSelQty(1); clearDiscount(); clearCustomer();
      setNewCustomerName(""); setNewCustomerPhone(""); setIsNewCustomer(false);
      setShowInvoice(true);
    } catch (err) { setMsg(err?.message || "Failed to save sale."); setMsgType("error"); }
    finally { setLoading(false); }
  }

  return (
    <>
      {showInvoice && lastSale && <InvoicePreview sale={lastSale} onClose={() => setShowInvoice(false)} />}
      <PageShell right={
        <div className="space-y-6">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-4 px-2">Operational Context</div>
            <div className="space-y-3">
              <Card title="Multi-item bills" desc="Add multiple items to one invoice." />
              <Card title="Smart discounts" desc="Milestone suggestions. You apply." />
            </div>
          </div>

          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-4 px-2">Records & Archives</div>
            <Link to="/sales-history" className="block group">
              <div className="rounded-[2rem] bg-white/[0.03] ring-1 ring-white/10 p-6 border border-white/5 transition-all duration-500 hover:bg-indigo-500/10 hover:ring-indigo-500/30 hover:shadow-2xl hover:shadow-indigo-500/10 active:scale-[0.98]">
                <div className="flex items-center justify-between mb-4">
                  <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 ring-1 ring-indigo-500/20 flex items-center justify-center text-2xl transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3">
                    📂
                  </div>
                  <div className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center text-white/20 group-hover:text-indigo-400 group-hover:bg-indigo-500/10 transition-all">
                    →
                  </div>
                </div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider group-hover:text-indigo-300 transition-colors">Sales History</h3>
                <p className="mt-2 text-[11px] font-medium text-white/40 leading-relaxed group-hover:text-white/60 transition-colors">Review past transactions, verify invoices, and handle returns.</p>
              </div>
            </Link>
          </div>
          
          <div className="rounded-2xl bg-amber-500/5 ring-1 ring-amber-500/10 p-5 border border-amber-500/10">
            <div className="flex items-center gap-3 mb-3">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse"></span>
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400/70">Session Integrity</span>
            </div>
            <p className="text-[10px] font-medium text-amber-400/40 leading-relaxed">Your current session is cryptographically linked to your staff ID for audit transparency.</p>
          </div>
        </div>
      }>
        <div className="max-w-3xl">
          <div className="flex items-center gap-3 mb-8">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] bg-white/5 text-white/50 px-4 py-1.5 rounded-full ring-1 ring-white/10 shadow-inner">
              Transaction Terminal
            </span>
            <div className="flex items-center gap-1">
              <span className="h-1 w-1 rounded-full bg-emerald-400 animate-ping"></span>
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400/70">System Ready</span>
            </div>
          </div>

          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tighter leading-none mb-10">
            Create New <br/><span className="text-indigo-400">Sales Invoice</span>
          </h1>

          <form onSubmit={handleSubmit} className="mt-5 space-y-5">

            {/* Customer Section */}
            <div className="rounded-3xl bg-white/[0.04] ring-1 ring-white/10 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-white/40">Customer Details</div>
                  <div className="text-sm font-semibold text-white mt-0.5">Who are we billing?</div>
                </div>
                {!selectedCustomer && (
                  <button 
                    type="button" 
                    onClick={() => { setIsNewCustomer(!isNewCustomer); setCustomerSearch(""); }} 
                    className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      isNewCustomer 
                        ? "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20" 
                        : "bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/20 hover:bg-indigo-500/20"
                    }`}
                  >
                    {isNewCustomer ? "← Back to Search" : "+ New Customer"}
                  </button>
                )}
              </div>
              
              {selectedCustomer ? (
                <div className="rounded-2xl bg-indigo-500/10 ring-1 ring-indigo-500/30 p-4 flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-indigo-500/20 flex items-center justify-center text-xl">👤</div>
                    <div>
                      <div className="font-bold text-white text-base">{selectedCustomer.name}</div>
                      <div className="flex gap-3 text-xs text-white/50 mt-0.5 font-medium">
                        {selectedCustomer.phone && <span>📞 {selectedCustomer.phone}</span>}
                        {selectedCustomer.email && <span className="opacity-60 hidden sm:inline">|</span>}
                        {selectedCustomer.email && <span className="hidden sm:inline">✉ {selectedCustomer.email}</span>}
                      </div>
                    </div>
                  </div>
                  <button type="button" onClick={clearCustomer} className="h-10 w-10 rounded-xl bg-white/5 ring-1 ring-white/10 flex items-center justify-center text-white/50 hover:bg-red-500/20 hover:text-red-400 hover:ring-red-500/30 transition-all">✕</button>
                </div>
              ) : isNewCustomer ? (
                <div className="grid gap-4 sm:grid-cols-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase font-bold text-white/30 ml-1">Full Name</div>
                    <Input value={newCustomerName} onChange={e => setNewCustomerName(e.target.value)} placeholder="Customer Name *" required={isNewCustomer} />
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase font-bold text-white/30 ml-1">Contact No.</div>
                    <Input value={newCustomerPhone} onChange={e => setNewCustomerPhone(e.target.value)} placeholder="Phone (Optional)" />
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-white/20 group-focus-within:text-indigo-400 transition-colors">🔍</div>
                    <input 
                      value={customerSearch} 
                      onChange={(e) => setCustomerSearch(e.target.value)} 
                      placeholder="Search by name, phone or email..." 
                      autoComplete="off"
                      className="w-full rounded-2xl bg-white/5 ring-1 ring-white/10 pl-11 pr-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all shadow-inner"
                    />
                  </div>
                  {customerResults.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl bg-slate-900/95 ring-1 ring-white/15 shadow-2xl overflow-hidden backdrop-blur-xl animate-in zoom-in-95 duration-200 border border-white/10">
                      {customerResults.map((c) => (
                        <button key={c.id} type="button" onClick={() => selectCustomer(c)} className="w-full text-left px-5 py-4 hover:bg-white/10 transition-all border-b border-white/5 last:border-0 flex items-center justify-between group">
                          <div>
                            <div className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">{c.name}</div>
                            <div className="text-xs text-white/40 mt-0.5">{c.phone || c.email || "No contact info"}</div>
                          </div>
                          <div className="text-white/20 group-hover:text-white/40 transition-colors">→</div>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 text-[11px] text-white/30 px-1 flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-white/20"></span>
                    Leave empty for a generic Walk-in Customer bill.
                  </div>
                </div>
              )}
            </div>

            {/* Item Selection Section */}
            <div className="rounded-3xl bg-white/[0.04] ring-1 ring-white/10 p-6 shadow-sm">
              <div className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-4">Add Items to Bill</div>
              <div className="flex gap-3 flex-wrap sm:flex-nowrap items-end">
                <div className="flex-1 min-w-[200px] space-y-1">
                  <div className="text-[10px] uppercase font-bold text-white/30 ml-1">Select Product</div>
                  <Select value={selItemId} onChange={(e) => setSelItemId(e.target.value)}>
                    <option value="">Choose an item...</option>
                    {items.map((it) => <option key={it.id} value={it.id}>{it.itemName} — {it.quantity} in stock</option>)}
                  </Select>
                </div>
                <div className="w-24 shrink-0 space-y-1">
                  <div className="text-[10px] uppercase font-bold text-white/30 ml-1">Qty</div>
                  <Input type="number" min="1" value={selQty} onChange={(e) => setSelQty(e.target.value)} placeholder="1" />
                </div>
                <button type="button" onClick={addToCart}
                  className="h-[46px] px-6 rounded-2xl bg-white text-slate-950 text-sm font-bold hover:bg-indigo-50 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg flex items-center justify-center gap-2">
                  <span>Add</span>
                </button>
              </div>
              
              {cartMsg && (
                <div className="mt-3 px-4 py-2 rounded-xl bg-red-500/10 text-red-300 text-[11px] font-medium ring-1 ring-red-500/20 animate-in fade-in duration-200">
                  ⚠️ {cartMsg}
                </div>
              )}

              {selItemId && (() => {
                const it = items.find((i) => i.id === selItemId);
                return it ? (
                  <div className="mt-4 flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-white/30 bg-white/5 p-3 rounded-xl ring-1 ring-white/5">
                    <span className="flex items-center gap-1.5"><span className="text-white/50">SKU:</span> <span className="text-white/70">{it.sku}</span></span>
                    <span className="flex items-center gap-1.5"><span className="text-white/50">UNIT PRICE:</span> <span className="text-indigo-400">{fc(it.sellingPrice)}</span></span>
                    <span className="flex items-center gap-1.5"><span className="text-white/50">AVAILABILITY:</span> <span className={Number(it.quantity) < 10 ? "text-amber-400" : "text-emerald-400"}>{it.quantity}</span></span>
                  </div>
                ) : null;
              })()}
            </div>

            {/* Bill Table Section */}
            {cart.length > 0 && (
              <div className="rounded-3xl overflow-hidden ring-1 ring-white/10 bg-white/[0.02] shadow-sm animate-in fade-in zoom-in-95 duration-300">
                <div className="bg-white/5 px-6 py-4 flex justify-between items-center border-b border-white/5">
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">Current Bill Items <span className="ml-2 text-indigo-400">({cart.length})</span></div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-white/20">Edit quantity in row</div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-white/80">
                    <thead className="bg-white/[0.03] text-white/30 text-[10px] font-bold uppercase tracking-widest">
                      <tr>
                        <th className="px-6 py-4 text-left font-bold">Product</th>
                        <th className="px-3 py-4 text-center w-24 font-bold">Qty</th>
                        <th className="px-3 py-4 text-right font-bold">Price</th>
                        <th className="px-3 py-4 text-right font-bold">Total</th>
                        <th className="px-6 py-4 w-12 font-bold"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {cart.map((ci) => (
                        <tr key={ci.itemId} className="hover:bg-white/5 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="font-bold text-white group-hover:text-indigo-300 transition-colors">{ci.itemName}</div>
                            <div className="text-[10px] font-bold text-white/30 mt-1 uppercase tracking-wider">{ci.sku}</div>
                          </td>
                          <td className="px-3 py-4 text-center">
                            <input 
                              type="number" 
                              min="1" 
                              value={ci.quantitySold}
                              onChange={(e) => updateCartQty(ci.itemId, e.target.value)}
                              className="w-16 text-center rounded-xl bg-white/5 ring-1 ring-white/10 px-2 py-1.5 text-xs font-bold text-white outline-none focus:ring-indigo-500/50 transition-all hover:bg-white/10" 
                            />
                          </td>
                          <td className="px-3 py-4 text-right text-white/40 font-medium tabular-nums">{fc(ci.unitPrice)}</td>
                          <td className="px-3 py-4 text-right font-bold text-white tabular-nums">{fc(ci.lineTotal)}</td>
                          <td className="px-6 py-4 text-right">
                            <button type="button" onClick={() => removeFromCart(ci.itemId)}
                              className="h-8 w-8 rounded-lg flex items-center justify-center text-red-400/50 hover:text-red-400 hover:bg-red-400/10 transition-all text-lg leading-none">✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Discount section */}
            <div className="rounded-3xl bg-white/[0.04] ring-1 ring-white/10 p-6 space-y-6 shadow-sm">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-white/40">Loyalty & Discounts</div>
                <div className="text-sm font-semibold text-white mt-0.5">Rewards for your customers</div>
              </div>

              {!selectedCustomer && !isNewCustomer && !cart.length && (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div className="text-3xl opacity-20 mb-2">🎁</div>
                  <p className="text-xs text-white/30 italic max-w-[200px]">Add items and select a customer to see discount suggestions.</p>
                </div>
              )}

              {/* Smart suggestion */}
              {suggestion && !historyLoading && cart.length > 0 && (() => {
                const { eligibleNow, suggestedDiscountPercent, discountName, reason, saleNeededFor100k,
                  previousPurchaseCount, previousTotalSpent, projectedTotalAfterSale,
                  saleIsHighVal, saleIsPremium, loyaltyProgress } = suggestion;
                const isApplied = discountSource === "suggested" && discountPercent === suggestedDiscountPercent;
                return (
                  <div className="space-y-4 animate-in fade-in duration-500">
                    {/* Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      {(selectedCustomer || isNewCustomer) && <>
                        <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-3">
                          <div className="text-white/30 text-[9px] uppercase font-bold tracking-wider mb-1">History</div>
                          <div className="font-bold text-white">{previousPurchaseCount} Orders</div>
                        </div>
                        <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-3">
                          <div className="text-white/30 text-[9px] uppercase font-bold tracking-wider mb-1">Spent</div>
                          <div className="font-bold text-white truncate">{fc(previousTotalSpent)}</div>
                        </div>
                      </>}
                      <div className="rounded-2xl bg-amber-500/10 ring-1 ring-amber-500/20 p-3">
                        <div className="text-amber-400/50 text-[9px] uppercase font-bold tracking-wider mb-1">Subtotal</div>
                        <div className="font-bold text-amber-400 tabular-nums">{fc(subtotal)}</div>
                      </div>
                      {(selectedCustomer || isNewCustomer) && (
                        <div className="rounded-2xl bg-blue-500/10 ring-1 ring-blue-500/20 p-3">
                          <div className="text-blue-400/50 text-[9px] uppercase font-bold tracking-wider mb-1">Lifetime</div>
                          <div className="font-bold text-blue-400 tabular-nums">{fc(projectedTotalAfterSale)}</div>
                        </div>
                      )}
                    </div>

                    {/* Eligible now */}
                    {eligibleNow && (
                      <div className="rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/25 p-4 space-y-3 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform duration-500 text-4xl">✨</div>
                        <div className="flex items-center gap-2 flex-wrap relative z-10">
                          <span className="text-[10px] font-bold uppercase tracking-widest bg-emerald-500/30 text-emerald-200 px-2.5 py-1 rounded-full ring-1 ring-emerald-500/40">Special Offer</span>
                          <span className="text-base font-bold text-emerald-300">{suggestedDiscountPercent}% {discountName}</span>
                        </div>
                        <div className="text-xs text-white/60 leading-relaxed relative z-10">{reason}</div>
                        {isApplied ? (
                          <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold px-4 py-2 shadow-lg shadow-emerald-500/20 transition-all">
                            <span>✓ Applied to Bill</span>
                          </div>
                        ) : (
                          <button type="button"
                            onClick={() => { setDiscountPercent(suggestedDiscountPercent); setDiscountSource("suggested"); setDiscountReason(`${discountName}: ${reason}`); }}
                            className="inline-flex items-center rounded-xl bg-white text-slate-950 text-xs font-bold px-4 py-2 hover:bg-emerald-50 transition-all hover:scale-[1.02] active:scale-95 shadow-lg">
                            Apply Discount
                          </button>
                        )}
                      </div>
                    )}

                    {/* Milestone bars */}
                    <div className="rounded-3xl bg-white/[0.03] ring-1 ring-white/10 p-5 space-y-4">
                      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 flex items-center gap-2">
                        <span className="h-px flex-1 bg-white/5"></span>
                        Progress Milestones
                        <span className="h-px flex-1 bg-white/5"></span>
                      </div>
                      
                      <div className="space-y-4">
                        {[{ label: `High Value (${fc(100_000)})`, val: subtotal, max: 100_000, reached: saleIsHighVal, color: "bg-amber-400" },
                          { label: `Premium (${fc(250_000)})`, val: subtotal, max: 250_000, reached: saleIsPremium, color: "bg-purple-400" }
                        ].map(({ label, val, max, reached, color }) => (
                          <div key={label}>
                            <div className="flex justify-between items-end mb-2">
                              <span className={`text-[11px] font-bold tracking-tight ${reached ? "text-emerald-400" : "text-white/40"}`}>{reached ? "✓" : "○"} {label}</span>
                              {!reached && <span className="text-[10px] font-bold text-white/20 tabular-nums">{fc(Math.max(0, max - val))} to go</span>}
                            </div>
                            <div className="h-2 rounded-full bg-white/5 overflow-hidden ring-1 ring-white/5">
                              <div className={`h-full rounded-full ${color} transition-all duration-700 ease-out shadow-[0_0_10px_rgba(255,255,255,0.1)]`} style={{ width: `${Math.min(100, Math.round((val / max) * 100))}%` }} />
                            </div>
                          </div>
                        ))}
                        
                        {loyaltyProgress && (
                          <div>
                            <div className="flex justify-between items-end mb-2">
                              <span className={`text-[11px] font-bold tracking-tight ${loyaltyProgress.reached ? "text-emerald-400" : "text-white/40"}`}>{loyaltyProgress.reached ? "✓" : "○"} Loyalty Milestone (5 Purchases)</span>
                              <span className="text-[10px] font-bold text-white/20 tabular-nums">{previousPurchaseCount}/5 Orders</span>
                            </div>
                            <div className="h-2 rounded-full bg-white/5 overflow-hidden ring-1 ring-white/5">
                              <div className="h-full rounded-full bg-indigo-500 transition-all duration-700 ease-out shadow-[0_0_10px_rgba(99,102,241,0.2)]" style={{ width: `${Math.min(100, (previousPurchaseCount / 5) * 100)}%` }} />
                            </div>
                            {!loyaltyProgress.reached && loyaltyProgress.willReachAfterSale && (
                              <div className="text-[10px] font-bold text-indigo-400/70 mt-2 flex items-center gap-1.5">
                                <span className="h-1 w-1 rounded-full bg-indigo-400"></span>
                                Milestone will be reached after this sale.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Manual discount */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="text-[10px] uppercase font-bold text-white/30 ml-1">Manual Disc. %</div>
                  <Input type="number" min="0" max="100" step="0.5" value={discountPercent} onChange={(e) => handleDiscountInput(e.target.value)} placeholder="0" />
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] uppercase font-bold text-white/30 ml-1">Disc. Amount</div>
                  <div className="h-[46px] rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 flex items-center text-sm text-white/60 font-bold tabular-nums italic">
                    {discountAmt > 0 ? `- ${fc(discountAmt)}` : "—"}
                  </div>
                </div>
              </div>

              {discountPercent > 0 && (
                <div className="flex items-center justify-between px-4 py-2 rounded-xl bg-white/5 ring-1 ring-white/5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">Source: <span className="text-white/60">{discountSource}</span></span>
                  <button type="button" onClick={clearDiscount} className="text-[10px] font-bold uppercase tracking-widest text-red-400/70 hover:text-red-400 transition-colors">Reset</button>
                </div>
              )}

              {/* Price summary */}
              {cart.length > 0 && (
                <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-5 space-y-3">
                  <div className="flex justify-between items-center text-xs font-bold text-white/40 uppercase tracking-wider">
                    <span>Subtotal ({cart.length} item{cart.length > 1 ? "s" : ""})</span>
                    <span className="tabular-nums">{fc(subtotal)}</span>
                  </div>
                  {discountAmt > 0 && (
                    <div className="flex justify-between items-center text-xs font-bold text-emerald-400 uppercase tracking-wider">
                      <span>Discount ({safeDiscPct}%)</span>
                      <span className="tabular-nums">− {fc(discountAmt)}</span>
                    </div>
                  )}
                  <div className="pt-3 border-t border-white/10 flex justify-between items-center">
                    <span className="text-sm font-bold text-white uppercase tracking-widest">Total Payable</span>
                    <span className="text-2xl font-black text-emerald-400 tabular-nums drop-shadow-[0_0_15px_rgba(52,211,153,0.2)]">{fc(finalTotal)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2">
              <PrimaryButton 
                disabled={loading} 
                type="submit"
                className="h-14 !rounded-3xl shadow-xl shadow-white/5 flex items-center justify-center gap-3 group"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-slate-950/20 border-t-slate-950 rounded-full animate-spin"></span>
                    Processing...
                  </span>
                ) : (
                  <>
                    <span className="text-base">Complete Sale</span>
                    {cart.length > 0 && <span className="bg-slate-950/10 px-2 py-0.5 rounded-lg text-xs">{cart.length}</span>}
                  </>
                )}
              </PrimaryButton>
            </div>

            {msg && (
              <div className={`rounded-3xl ring-1 px-6 py-4 text-sm font-semibold flex items-center justify-between gap-4 animate-in slide-in-from-bottom-4 duration-300 ${msgType === "success" ? "bg-emerald-500/10 ring-emerald-500/30 text-emerald-300" : msgType === "error" ? "bg-red-500/10 ring-red-500/30 text-red-300" : "bg-white/5 ring-white/10 text-white/80"}`}>
                <div className="flex items-center gap-3">
                  <span>{msgType === "success" ? "✅" : msgType === "error" ? "❌" : "ℹ️"}</span>
                  <span>{msg}</span>
                </div>
                {msgType === "success" && lastSale && (
                  <button type="button" onClick={() => setShowInvoice(true)} className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-white text-slate-950 text-xs font-bold px-4 py-2 hover:bg-indigo-50 transition-all shadow-lg active:scale-95">
                    <span>🧾 Invoice</span>
                  </button>
                )}
              </div>
            )}
          </form>
        </div>
      </PageShell>
    </>
  );
}