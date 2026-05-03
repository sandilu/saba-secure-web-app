import { Card, Pill } from "../ui/Layout";

const fc = (v) => `Rs. ${Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

/**
 * AiForecastPanel Component
 * Displays the sales forecast analytics in a professional UI.
 * 
 * @param {Object} props
 * @param {Object} props.forecast - The forecast data object from generateSalesForecast
 */
export default function AiForecastPanel({ forecast, compact = false }) {
  if (!forecast) return null;

  const {
    next7DaysRevenue,
    next30DaysRevenue,
    trend,
    confidence,
    predictedTopItem,
    reorderRisks,
    validSalesCount
  } = forecast;

  const trendColor = trend === "Increasing" ? "text-emerald-400" : trend === "Decreasing" ? "text-red-400" : "text-amber-400";
  const confidenceColor = confidence === "High" ? "text-emerald-400" : confidence === "Medium" ? "text-amber-400" : "text-red-400";

  return (
    <div className="rounded-3xl bg-white/[0.03] ring-1 ring-white/10 p-6 border border-white/5 shadow-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Pill>AI Analytics</Pill>
            {!compact && <span className="text-xs text-white/40">Rule-based statistical model</span>}
          </div>
          <h2 className={compact ? "text-lg font-bold text-white" : "text-xl font-semibold text-white"}>
            Sales & Inventory Forecasting
          </h2>
        </div>
        {!compact && (
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest text-white/30 font-bold mb-1">Forecast Confidence</div>
            <div className={`text-sm font-bold ${confidenceColor}`}>{confidence}</div>
          </div>
        )}
      </div>

      <div className={cx("grid gap-4", compact ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-4")}>
        <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4 transition hover:bg-white/[0.08]">
          <div className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-1">Next 7 Days</div>
          <div className="text-base font-semibold text-white">{fc(next7DaysRevenue)}</div>
        </div>
        <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4 transition hover:bg-white/[0.08]">
          <div className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-1">Next 30 Days</div>
          <div className="text-base font-semibold text-white">{fc(next30DaysRevenue)}</div>
        </div>
        <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4 transition hover:bg-white/[0.08]">
          <div className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-1">Sales Trend</div>
          <div className={`text-base font-semibold ${trendColor}`}>{trend}</div>
        </div>
        <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4 transition hover:bg-white/[0.08]">
          <div className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-1">Top Item</div>
          <div className="text-base font-semibold text-indigo-300 truncate" title={predictedTopItem}>
            {predictedTopItem === "Insufficient Data" ? <span className="text-white/30 text-xs italic">Insufficient</span> : predictedTopItem}
          </div>
        </div>
      </div>

      <div className={cx("mt-8 grid gap-6", compact ? "grid-cols-1" : "lg:grid-cols-2")}>
        {/* Reorder Risks */}
        <div>
          <h3 className="text-sm font-semibold text-white/90 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]"></span>
            Forecast-based Reorder Risks
          </h3>
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {reorderRisks.length === 0 ? (
              <div className="rounded-xl bg-white/5 border border-dashed border-white/10 p-6 text-center text-xs text-white/40 italic">
                No stockout risks predicted based on current velocity.
              </div>
            ) : reorderRisks.map(risk => (
              <div key={risk.id} className="rounded-xl bg-white/5 ring-1 ring-white/10 p-3 flex items-center justify-between gap-4 transition hover:ring-white/20">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white truncate">{risk.itemName}</div>
                  <div className="text-[10px] text-white/40 flex gap-3">
                    <span>SKU: {risk.sku}</span>
                    <span>Velocity: {risk.velocity}/day</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${risk.risk === "Critical" ? "text-red-400" : "text-amber-400"}`}>
                    {risk.risk} Risk
                  </div>
                  <div className="text-[10px] text-white/60">Est. Stock (7d): {risk.predictedStock7}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Intelligence Explanation */}
        <div>
          <h3 className="text-sm font-semibold text-white/90 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.5)]"></span>
            Forecasting Methodology
          </h3>
          <div className="rounded-2xl bg-indigo-500/5 ring-1 ring-indigo-500/20 p-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
            <p className="text-xs text-indigo-100/70 leading-relaxed relative z-10">
              The AI engine utilizes <strong>Sales Velocity Extrapolation</strong> to predict future inventory needs and revenue. By analyzing recent completed transactions and adjusting for returns, it identifies patterns that basic stock alerts might miss.
            </p>
            <ul className="mt-4 space-y-2 relative z-10">
              <li className="flex items-start gap-2 text-[11px] text-indigo-100/60">
                <span className="text-emerald-400 shrink-0">✓</span>
                Analyzes <strong>revenue momentum</strong> by comparing week-over-week growth.
              </li>
              <li className="flex items-start gap-2 text-[11px] text-indigo-100/60">
                <span className="text-emerald-400 shrink-0">✓</span>
                Identifies <strong>replenishment gaps</strong> by mapping daily sales rate against lead times.
              </li>
              <li className="flex items-start gap-2 text-[11px] text-indigo-100/60">
                <span className="text-emerald-400 shrink-0">✓</span>
                Confidence is derived from <strong>sample size</strong> ({validSalesCount} valid records analysed).
              </li>
            </ul>
            <div className="mt-5 pt-4 border-t border-indigo-500/10 flex items-center justify-between">
              <p className="text-[10px] text-white/20 italic">
                * Zero external API calls. 100% privacy-compliant.
              </p>
              <div className="h-1 w-20 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500/50" style={{ width: confidence === "High" ? '90%' : confidence === "Medium" ? '50%' : '20%' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
