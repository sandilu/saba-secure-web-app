import { useState } from "react";
import { PrimaryButton, SecondaryButton, Input } from "../ui/Layout";
import { returnSale } from "../firebase/salesActions";
import { useAuth } from "../auth/AuthContext";

export default function ReturnSaleModal({ sale, onClose, onSuccess }) {
  const { user } = useAuth();
  const [reason, setReason] = useState("");
  const [returnMap, setReturnMap] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!sale) return null;

  const items = sale.items || [];
  const returnedItems = sale.returnedItems || [];

  function handleQtyChange(itemId, val, maxCanReturn) {
    const num = Math.min(maxCanReturn, Math.max(0, parseInt(val) || 0));
    setReturnMap(prev => ({ ...prev, [itemId]: num }));
  }

  const totalSelected = Object.values(returnMap).reduce((a, b) => a + b, 0);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (totalSelected <= 0) { setError("Select at least one item to return."); return; }
    if (!reason.trim()) { setError("Reason is required."); return; }

    setSubmitting(true);
    try {
      await returnSale({ saleId: sale.id, returnMap, reason, user });
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message || "Failed to process return.");
      setSubmitting(false);
    }
  }

  return (
    <>
      <style>{`@keyframes iSlide{from{opacity:0;transform:scale(.96) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ backgroundColor: "rgba(2,6,23,0.88)" }}
        onClick={(e) => { if (e.target === e.currentTarget && !submitting) onClose(); }}>
        <div className="w-full max-w-lg rounded-3xl bg-slate-900 ring-1 ring-white/10 shadow-2xl flex flex-col overflow-hidden" style={{ animation: "iSlide 0.18s ease-out" }}>
          <div className="p-5 border-b border-white/5 flex justify-between items-center bg-slate-800/50">
            <h2 className="text-lg font-semibold text-white">Return Sale - {sale.invoiceNumber}</h2>
            <button type="button" onClick={onClose} disabled={submitting} className="text-white/50 hover:text-white transition">✕</button>
          </div>
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {error && <div className="p-3 rounded-xl bg-red-500/10 text-red-400 text-sm">{error}</div>}

            <div className="space-y-3">
              <div className="text-sm font-semibold text-white/70 uppercase tracking-wide">Select quantities to return</div>
              {items.map(item => {
                const prevQty = returnedItems.find(r => r.itemId === item.itemId)?.returnedQty || 0;
                const maxCanReturn = Number(item.quantitySold || 0) - prevQty;
                if (maxCanReturn <= 0) return null;

                return (
                  <div key={item.itemId} className="flex items-center justify-between gap-4 p-3 rounded-xl bg-white/5 ring-1 ring-white/10">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-white truncate">{item.itemName}</div>
                      <div className="text-xs text-white/50">Sold: {item.quantitySold} | Already returned: {prevQty}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input 
                        type="number" 
                        min="0" 
                        max={maxCanReturn}
                        value={returnMap[item.itemId] || ""}
                        onChange={(e) => handleQtyChange(item.itemId, e.target.value, maxCanReturn)}
                        placeholder="0"
                        className="w-20 text-center"
                      />
                      <span className="text-xs text-white/50">/ {maxCanReturn}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-2 pt-2">
              <label className="text-xs font-semibold uppercase tracking-widest text-white/50">Reason for return</label>
              <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="E.g., defective, customer changed mind" required />
            </div>

            <div className="pt-4 flex gap-3">
              <div className="flex-1">
                <SecondaryButton type="button" onClick={onClose} disabled={submitting}>Cancel</SecondaryButton>
              </div>
              <div className="flex-1">
                <PrimaryButton type="submit" disabled={submitting || totalSelected === 0}>
                  {submitting ? "Processing..." : `Return ${totalSelected} Items`}
                </PrimaryButton>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
