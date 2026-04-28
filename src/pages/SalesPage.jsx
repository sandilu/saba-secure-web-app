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
        <div className="space-y-3">
          <Pill>Sales Module</Pill>
          <Card title="Multi-item bills" desc="Add multiple items to one invoice." />
          <Card title="Smart discounts" desc="Milestone suggestions. You apply." />
          <Link to="/sales-history"><SecondaryButton type="button">Sales History</SecondaryButton></Link>
        </div>
      }>
        <div className="max-w-2xl">
          <Pill>Sales</Pill>
          <h1 className="mt-3 text-2xl sm:text-3xl font-semibold text-white">New Sale</h1>

          <form onSubmit={handleSubmit} className="mt-5 space-y-5">

            {/* Customer */}
            <div className="rounded-2xl bg-white/[0.04] ring-1 ring-white/10 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-semibold uppercase tracking-widest text-white/50">Customer (optional)</div>
                {!selectedCustomer && (
                  <button type="button" onClick={() => { setIsNewCustomer(!isNewCustomer); setCustomerSearch(""); }} className="text-xs text-indigo-400 hover:text-indigo-300 transition font-medium">
                    {isNewCustomer ? "Search Existing" : "+ New Customer"}
                  </button>
                )}
              </div>
              
              {selectedCustomer ? (
                <div className="rounded-xl bg-indigo-500/10 ring-1 ring-indigo-500/20 p-3 flex items-start justify-between gap-3">
                  <div className="text-sm">
                    <div className="font-semibold text-white">{selectedCustomer.name}</div>
                    <div className="flex gap-3 text-xs text-white/50 mt-1">
                      {selectedCustomer.phone && <span>📞 {selectedCustomer.phone}</span>}
                      {selectedCustomer.email && <span>✉ {selectedCustomer.email}</span>}
                    </div>
                  </div>
                  <button type="button" onClick={clearCustomer} className="rounded-lg bg-white/5 ring-1 ring-white/15 px-2.5 py-1 text-xs font-semibold text-white/70 hover:bg-white/10 transition shrink-0">Clear</button>
                </div>
              ) : isNewCustomer ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input value={newCustomerName} onChange={e => setNewCustomerName(e.target.value)} placeholder="Customer Name *" required={isNewCustomer} />
                  <Input value={newCustomerPhone} onChange={e => setNewCustomerPhone(e.target.value)} placeholder="Phone Number" />
                </div>
              ) : (
                <div className="relative">
                  <Input value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} placeholder="Search customer…" autoComplete="off" />
                  {customerResults.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-10 rounded-2xl bg-slate-800 ring-1 ring-white/15 shadow-2xl overflow-hidden">
                      {customerResults.map((c) => (
                        <button key={c.id} type="button" onClick={() => selectCustomer(c)} className="w-full text-left px-4 py-3 hover:bg-white/10 transition border-b border-white/5 last:border-0">
                          <div className="text-sm font-semibold text-white">{c.name}</div>
                          <div className="text-xs text-white/40">{c.phone || c.email}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 text-xs text-white/40 px-1">Leave empty for a generic Walk-in Customer bill.</div>
                </div>
              )}
            </div>

            {/* Add item row */}
            <div className="rounded-2xl bg-white/[0.04] ring-1 ring-white/10 p-4 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-widest text-white/50">Add Item to Bill</div>
              <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                <div className="flex-1 min-w-[180px]">
                  <Select value={selItemId} onChange={(e) => setSelItemId(e.target.value)}>
                    <option value="">Select item…</option>
                    {items.map((it) => <option key={it.id} value={it.id}>{it.itemName} — Stock: {it.quantity}</option>)}
                  </Select>
                </div>
                <div className="w-24 shrink-0">
                  <Input type="number" min="1" value={selQty} onChange={(e) => setSelQty(e.target.value)} placeholder="Qty" />
                </div>
                <button type="button" onClick={addToCart}
                  className="shrink-0 rounded-2xl bg-indigo-500/20 ring-1 ring-indigo-500/30 text-indigo-200 text-sm font-semibold px-4 py-2 hover:bg-indigo-500/30 transition">
                  + Add to Bill
                </button>
              </div>
              {cartMsg && <div className="text-xs text-red-300">{cartMsg}</div>}
              {selItemId && (() => {
                const it = items.find((i) => i.id === selItemId);
                return it ? (
                  <div className="text-xs text-white/40 flex gap-4">
                    <span>SKU: {it.sku}</span>
                    <span>Price: {fc(it.sellingPrice)}</span>
                    <span>Available: {it.quantity}</span>
                  </div>
                ) : null;
              })()}
            </div>

            {/* Cart table */}
            {cart.length > 0 && (
              <div className="rounded-2xl overflow-hidden ring-1 ring-white/10">
                <div className="bg-white/5 px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-white/50 flex justify-between">
                  <span>Bill Items ({cart.length})</span>
                  <span className="text-white/30">Tap qty to edit</span>
                </div>
                <table className="w-full text-sm text-white/80">
                  <thead className="bg-white/[0.03] text-white/50 text-xs">
                    <tr>
                      <th className="px-4 py-2 text-left">Item</th>
                      <th className="px-3 py-2 text-right w-20">Qty</th>
                      <th className="px-3 py-2 text-right">Price</th>
                      <th className="px-3 py-2 text-right">Total</th>
                      <th className="px-3 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((ci) => (
                      <tr key={ci.itemId} className="border-t border-white/10">
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-white">{ci.itemName}</div>
                          <div className="text-xs text-white/40">{ci.sku}</div>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <input type="number" min="1" value={ci.quantitySold}
                            onChange={(e) => updateCartQty(ci.itemId, e.target.value)}
                            className="w-16 text-right rounded-lg bg-white/5 ring-1 ring-white/15 px-2 py-1 text-sm text-white outline-none focus:ring-indigo-500/50" />
                        </td>
                        <td className="px-3 py-2.5 text-right text-white/60">{fc(ci.unitPrice)}</td>
                        <td className="px-3 py-2.5 text-right font-semibold">{fc(ci.lineTotal)}</td>
                        <td className="px-3 py-2.5 text-center">
                          <button type="button" onClick={() => removeFromCart(ci.itemId)}
                            className="text-red-400 hover:text-red-300 text-base leading-none transition">✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Discount section */}
            <div className="rounded-2xl bg-white/[0.04] ring-1 ring-white/10 p-4 space-y-4">
              <div className="text-xs font-semibold uppercase tracking-widest text-white/50">Customer Discount</div>

              {!selectedCustomer && !isNewCustomer && !cart.length && (
                <p className="text-xs text-white/40 italic">Add items and select a customer to see discount suggestions.</p>
              )}

              {/* Smart suggestion */}
              {suggestion && !historyLoading && cart.length > 0 && (() => {
                const { eligibleNow, suggestedDiscountPercent, discountName, reason, saleNeededFor100k,
                  previousPurchaseCount, previousTotalSpent, projectedTotalAfterSale,
                  saleIsHighVal, saleIsPremium, loyaltyProgress } = suggestion;
                const isApplied = discountSource === "suggested" && discountPercent === suggestedDiscountPercent;
                return (
                  <div className="space-y-3">
                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {(selectedCustomer || isNewCustomer) && <>
                        <div className="rounded-lg bg-white/5 ring-1 ring-white/10 p-2.5">
                          <div className="text-white/40 mb-0.5">Prev Purchases</div>
                          <div className="font-semibold text-white">{previousPurchaseCount}</div>
                        </div>
                        <div className="rounded-lg bg-white/5 ring-1 ring-white/10 p-2.5">
                          <div className="text-white/40 mb-0.5">Prev Spent</div>
                          <div className="font-semibold text-white">{fc(previousTotalSpent)}</div>
                        </div>
                      </>}
                      <div className="rounded-lg bg-white/5 ring-1 ring-white/10 p-2.5">
                        <div className="text-white/40 mb-0.5">Bill Subtotal</div>
                        <div className="font-semibold text-amber-300">{fc(subtotal)}</div>
                      </div>
                      {(selectedCustomer || isNewCustomer) && (
                        <div className="rounded-lg bg-white/5 ring-1 ring-white/10 p-2.5">
                          <div className="text-white/40 mb-0.5">Projected Lifetime</div>
                          <div className="font-semibold text-blue-300">{fc(projectedTotalAfterSale)}</div>
                        </div>
                      )}
                    </div>

                    {/* Eligible now */}
                    {eligibleNow && (
                      <div className="rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/25 p-3 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold uppercase tracking-widest bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full ring-1 ring-emerald-500/30">Eligible Now</span>
                          <span className="text-sm font-semibold text-emerald-300">{suggestedDiscountPercent}% {discountName}</span>
                        </div>
                        <div className="text-xs text-white/60">{reason}</div>
                        {isApplied ? (
                          <div className="inline-flex items-center gap-1 rounded-xl bg-emerald-500/20 ring-1 ring-emerald-500/30 text-emerald-200 text-xs font-semibold px-3 py-1.5">✓ {suggestedDiscountPercent}% Applied</div>
                        ) : (
                          <button type="button"
                            onClick={() => { setDiscountPercent(suggestedDiscountPercent); setDiscountSource("suggested"); setDiscountReason(`${discountName}: ${reason}`); }}
                            className="inline-flex items-center rounded-xl bg-emerald-500/20 ring-1 ring-emerald-500/30 text-emerald-200 text-xs font-semibold px-3 py-1.5 hover:bg-emerald-500/30 transition">
                            Apply {suggestedDiscountPercent}% Discount
                          </button>
                        )}
                      </div>
                    )}

                    {/* Not eligible */}
                    {!eligibleNow && (
                      <div className="rounded-xl bg-white/[0.03] ring-1 ring-white/10 p-3 text-xs text-white/50 space-y-1">
                        <div className="text-white/60 font-medium">No spending discount for this bill.</div>
                        {saleNeededFor100k > 0 && <div>{fc(saleNeededFor100k)} more in this bill unlocks 5% High Value Discount.</div>}
                        {loyaltyProgress?.reached && <div className="text-indigo-300">5% Loyalty Discount available — customer has {previousPurchaseCount} purchases.</div>}
                      </div>
                    )}

                    {/* Milestone bars */}
                    <div className="rounded-xl bg-white/[0.03] ring-1 ring-white/10 p-3 space-y-2.5 text-xs">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-white/30">Bill Spending Milestones</div>
                      {[{ label: `${fc(100_000)} High Value (5%)`, val: subtotal, max: 100_000, reached: saleIsHighVal, color: "bg-amber-500" },
                        { label: `${fc(250_000)} Premium (10%)`, val: subtotal, max: 250_000, reached: saleIsPremium, color: "bg-purple-500" }
                      ].map(({ label, val, max, reached, color }) => (
                        <div key={label}>
                          <div className="flex justify-between mb-1">
                            <span className={reached ? "text-emerald-300 font-semibold" : "text-white/50"}>{reached ? "✓" : "○"} {label}</span>
                            {!reached && <span className="text-white/30">{fc(Math.max(0, max - val))} left</span>}
                          </div>
                          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${Math.min(100, Math.round((val / max) * 100))}%` }} />
                          </div>
                        </div>
                      ))}
                      {loyaltyProgress && (
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className={loyaltyProgress.reached ? "text-emerald-300 font-semibold" : "text-white/50"}>{loyaltyProgress.reached ? "✓" : "○"} 5 Purchases — Loyalty (5%)</span>
                            <span className="text-white/30">{previousPurchaseCount}/5</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${Math.min(100, (previousPurchaseCount / 5) * 100)}%` }} />
                          </div>
                          {!loyaltyProgress.reached && loyaltyProgress.willReachAfterSale && (
                            <div className="text-blue-300 mt-1">After this sale: loyalty milestone reached for future purchases.</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Manual discount */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Manual Discount %">
                  <Input type="number" min="0" max="100" step="0.5" value={discountPercent} onChange={(e) => handleDiscountInput(e.target.value)} placeholder="0" />
                </Field>
                <div className="flex flex-col justify-end">
                  <div className="text-xs text-white/50 mb-1">Discount Amount</div>
                  <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 px-3 py-2 text-sm text-white font-semibold">{fc(discountAmt)}</div>
                </div>
              </div>
              {discountPercent > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-white/40">Source: <span className="capitalize text-white/60">{discountSource}</span></span>
                  <button type="button" onClick={clearDiscount} className="text-xs text-red-300/70 hover:text-red-300 underline">Clear</button>
                </div>
              )}

              {/* Price summary */}
              {cart.length > 0 && (
                <div className="rounded-xl bg-white/5 ring-1 ring-white/10 p-3 space-y-1.5 text-sm">
                  <div className="flex justify-between text-white/60"><span>Subtotal ({cart.length} item{cart.length > 1 ? "s" : ""})</span><span>{fc(subtotal)}</span></div>
                  {discountAmt > 0 && <div className="flex justify-between text-amber-300"><span>Discount ({safeDiscPct}%)</span><span>− {fc(discountAmt)}</span></div>}
                  <div className="flex justify-between font-semibold text-white border-t border-white/10 pt-1.5"><span>Final Total</span><span className="text-emerald-300">{fc(finalTotal)}</span></div>
                </div>
              )}
            </div>

            <PrimaryButton disabled={loading} type="submit">{loading ? "Saving…" : `Save Sale${cart.length ? ` (${cart.length} item${cart.length > 1 ? "s" : ""})` : ""}`}</PrimaryButton>

            {msg && (
              <div className={`rounded-2xl ring-1 px-4 py-3 text-sm flex items-center justify-between gap-3 ${msgType === "success" ? "bg-emerald-500/10 ring-emerald-500/20 text-emerald-200" : msgType === "error" ? "bg-red-500/10 ring-red-500/20 text-red-200" : "bg-white/5 ring-white/10 text-white/80"}`}>
                <span>{msg}</span>
                {msgType === "success" && lastSale && (
                  <button type="button" onClick={() => setShowInvoice(true)} className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-blue-500/20 ring-1 ring-blue-500/30 text-blue-200 text-xs font-semibold px-3 py-1.5 hover:bg-blue-500/30 transition">🧾 Invoice</button>
                )}
              </div>
            )}
          </form>
        </div>
      </PageShell>
    </>
  );
}