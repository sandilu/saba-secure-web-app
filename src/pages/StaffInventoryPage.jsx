import { useEffect, useMemo, useState } from "react";
import { PageShell, Pill, Input, Card } from "../ui/Layout";
import { listenInventoryItems } from "../firebase/inventoryActions";

const fc = (v) => `Rs. ${Number(v || 0).toLocaleString()}`;

export default function StaffInventoryPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    setLoading(true);
    const unsub = listenInventoryItems(
      (data) => {
        setItems(data);
        setLoading(false);
      },
      (e) => {
        setErr(e?.message || "Failed to load inventory.");
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return items.filter((i) =>
      [i.itemName, i.sku, i.category, i.location].some((f) =>
        (f || "").toLowerCase().includes(s)
      )
    );
  }, [items, search]);

  const stats = useMemo(() => {
    const lowStock = items.filter((i) => Number(i.quantity || 0) <= Number(i.minStockLevel || 0));
    return {
      total: items.length,
      lowStock: lowStock.length,
    };
  }, [items]);

  return (
    <PageShell
      right={
        <div className="space-y-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 ml-1">Live Inventory Stats</div>
          <div className="rounded-3xl bg-white/[0.04] ring-1 ring-white/10 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-bold uppercase tracking-widest text-white/40">Total Unique SKU</div>
              <div className="h-2 w-2 rounded-full bg-indigo-400"></div>
            </div>
            <div className="text-3xl font-black text-white tabular-nums">{stats.total}</div>
            <div className="text-[11px] text-white/30 font-medium leading-tight italic">Currently tracked in active database.</div>
          </div>
          
          <div className={`rounded-3xl ring-1 p-5 space-y-4 transition-all duration-500 ${stats.lowStock > 0 ? "bg-amber-500/10 ring-amber-500/30" : "bg-emerald-500/10 ring-emerald-500/30"}`}>
            <div className="flex items-center justify-between">
              <div className={`text-[10px] font-bold uppercase tracking-widest ${stats.lowStock > 0 ? "text-amber-400/60" : "text-emerald-400/60"}`}>Stock Health Alert</div>
              <div className={`h-2 w-2 rounded-full animate-pulse ${stats.lowStock > 0 ? "bg-amber-400" : "bg-emerald-400"}`}></div>
            </div>
            <div className={`text-3xl font-black tabular-nums ${stats.lowStock > 0 ? "text-amber-400" : "text-emerald-400"}`}>{stats.lowStock}</div>
            <div className={`text-[11px] font-bold leading-tight ${stats.lowStock > 0 ? "text-amber-400/50" : "text-emerald-400/50"}`}>
              {stats.lowStock > 0 ? "Immediate replenishment recommended." : "All stock levels within safe boundaries."}
            </div>
          </div>
        </div>
      }
    >
      <div className="space-y-8">
        <div>
          <Pill>Inventory Registry</Pill>
          <h1 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight text-white">Stock Directory</h1>
          <p className="mt-2 text-base text-white/50 max-w-xl">
            Real-time view of all products in stock. Contact an administrator to request stock adjustments or new SKU additions.
          </p>
        </div>

        <div className="flex flex-wrap gap-4 items-center max-w-3xl">
          <div className="flex-1 min-w-[280px]">
            <div className="relative group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-white/20 group-focus-within:text-indigo-400 transition-colors">🔍</div>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, SKU or category..."
                className="w-full rounded-2xl bg-white/5 ring-1 ring-white/10 pl-11 pr-4 py-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all shadow-xl"
              />
            </div>
          </div>
        </div>

        {err && (
          <div className="rounded-2xl bg-red-500/10 ring-1 ring-red-500/30 px-4 py-3 text-sm text-red-200">
            {err}
          </div>
        )}

        <div className="mt-5 space-y-3">
          {loading ? (
            <div className="py-12 text-center text-white/50 flex flex-col items-center bg-white/[0.02] rounded-[2rem] ring-1 ring-white/5 shadow-inner">
              <div className="h-8 w-8 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Fetching Inventory...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-white/40 italic bg-white/[0.02] rounded-[2rem] ring-1 ring-white/5 shadow-inner flex flex-col items-center">
              <div className="text-4xl mb-4 opacity-20">📦</div>
              <div className="text-sm font-medium">No items found matching "{search}"</div>
            </div>
          ) : (
            filtered.map((item) => {
              const qty = Number(item.quantity || 0);
              const min = Number(item.minStockLevel || 0);
              const isLow = qty <= min;
              const isOut = qty <= 0;

              return (
                <div 
                  key={item.id} 
                  className="bg-white/[0.02] ring-1 ring-white/10 p-5 rounded-[2rem] transition-all duration-300 hover:bg-white/[0.04] hover:shadow-xl hover:-translate-y-0.5 border border-white/5 flex flex-col md:flex-row gap-5 justify-between items-start md:items-center group"
                >
                  <div className="flex-1 min-w-0 w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Item Details */}
                    <div>
                      <div className="font-bold text-white group-hover:text-indigo-300 transition-colors truncate">{item.itemName || "Unnamed Item"}</div>
                      <div className="text-[10px] font-bold text-white/30 mt-1 uppercase tracking-tight truncate">SKU: {item.sku || "N/A"}</div>
                    </div>

                    {/* Classification & Location */}
                    <div className="flex flex-col gap-2 justify-center items-start">
                      <span className="px-3 py-1 rounded-lg bg-white/5 text-[10px] font-bold text-white/50 group-hover:text-white/70 transition-colors uppercase tracking-[0.1em] ring-1 ring-white/5 truncate max-w-full">
                        {item.category || "General"}
                      </span>
                      <div className="flex items-center gap-1.5 text-xs text-white/40 truncate">
                        <span className="h-1 w-1 rounded-full bg-white/30 shrink-0"></span>
                        <span className="truncate">{item.location || "Main Store"}</span>
                      </div>
                    </div>

                    {/* Stock Status */}
                    <div className="flex items-center gap-4">
                      <div>
                        <div className={`font-black tabular-nums text-lg ${isLow ? "text-amber-400" : "text-white"}`}>{qty}</div>
                        <div className="text-[9px] font-bold text-white/20 uppercase tracking-tighter">Current Count</div>
                      </div>
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ring-1 ${
                        isOut ? "bg-red-500/10 text-red-400 ring-red-500/20" :
                        isLow ? "bg-amber-500/10 text-amber-400 ring-amber-500/20" :
                        "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20"
                      }`}>
                        {isOut ? "Out of Stock" : isLow ? "Low Supply" : "Stable"}
                      </span>
                    </div>
                  </div>

                  {/* Selling Price */}
                  <div className="flex flex-row flex-nowrap items-center gap-4 w-full md:w-auto shrink-0 pt-3 md:pt-0 border-t border-white/5 md:border-none justify-start md:justify-end">
                    <div className="flex flex-col items-start md:items-end">
                      <div className="text-[9px] font-bold text-white/20 uppercase tracking-tighter mb-0.5 md:hidden">Selling Price</div>
                      <div className="font-black tabular-nums text-lg text-white group-hover:text-emerald-400 transition-colors">
                        {fc(item.sellingPrice)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </PageShell>
  );
}
