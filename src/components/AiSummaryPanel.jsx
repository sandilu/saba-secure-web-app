// src/components/AiSummaryPanel.jsx
// Reusable AI Business Summary panel component.
// Renders the output of generateBusinessSummary() from aiSummaryRules.js.
// Used in AdminDashboard and ReportsPage.

import { useMemo } from "react";

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

const fc = (v) => `Rs. ${Number(v || 0).toLocaleString()}`;

// ─── sub-components ─────────────────────────────────────────────────────────

function HealthScoreRing({ score, label }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const trackColour =
    score >= 80 ? "#10b981" :   // emerald
    score >= 50 ? "#f59e0b" :   // amber
                  "#ef4444";    // red

  const badgeColour =
    label === "Healthy"          ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20" :
    label === "Needs Attention"  ? "bg-amber-500/10  text-amber-400  ring-amber-500/20"  :
                                   "bg-red-500/10    text-red-400    ring-red-500/20";

  return (
    <div className="flex flex-col items-center gap-4 group">
      <div className="relative w-28 h-28">
        <svg className="w-28 h-28 -rotate-90 drop-shadow-[0_0_8px_rgba(255,255,255,0.05)]" viewBox="0 0 100 100">
          <circle
            cx="50" cy="50" r={radius}
            fill="none" stroke="rgba(255,255,255,0.03)"
            strokeWidth="10"
          />
          <circle
            cx="50" cy="50" r={radius}
            fill="none" stroke={trackColour}
            strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
            style={{ filter: `drop-shadow(0 0 6px ${trackColour}40)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black text-white leading-none tracking-tighter group-hover:scale-110 transition-transform duration-500">{score}</span>
          <span className="text-[10px] font-black text-white/20 uppercase tracking-widest mt-1">Score</span>
        </div>
      </div>
      <span className={cx("text-[9px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-full ring-1 shadow-lg transition-all duration-500", badgeColour)}>
        {label}
      </span>
    </div>
  );
}

function StatusModule({ title, message, type, severity, priority }) {
  const isInsight = !!type;
  const isRisk = !!severity;
  const isAction = !!priority;

  const config = {
    // Insight types
    success: { style: "bg-emerald-500/5 ring-emerald-500/10", badge: "bg-emerald-500/10 text-emerald-400", label: "Opportunity", icon: "💎" },
    warning: { style: "bg-amber-500/5 ring-amber-500/10", badge: "bg-amber-500/10 text-amber-400", label: "Signal", icon: "⚠️" },
    info:    { style: "bg-blue-500/5 ring-blue-500/10", badge: "bg-blue-500/10 text-blue-400", label: "Analysis", icon: "📡" },
    // Risk types
    high:    { style: "bg-red-500/5 ring-red-500/20", badge: "bg-red-500/10 text-red-400", label: "Critical", icon: "🚨" },
    medium:  { style: "bg-amber-500/5 ring-amber-500/10", badge: "bg-amber-500/10 text-amber-400", label: "Elevated", icon: "🛡️" },
    low:     { style: "bg-white/[0.02] ring-white/5", badge: "bg-white/10 text-white/40", label: "Nominal", icon: "✅" },
  };

  const active = isInsight ? config[type] : isRisk ? config[severity] : config[priority === 'high' ? 'high' : priority === 'medium' ? 'medium' : 'low'];
  if (!active) return null;

  return (
    <div className={cx("group rounded-[1.5rem] ring-1 p-5 transition-all duration-500 hover:bg-white/[0.04] hover:shadow-xl hover:-translate-y-0.5", active.style)}>
      <div className="flex items-start gap-4">
        <div className="h-10 w-10 rounded-2xl bg-white/5 ring-1 ring-white/10 flex items-center justify-center text-lg shadow-inner group-hover:scale-110 transition-transform duration-500">
          {active.icon}
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className={cx("text-[8px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-md ring-1", active.badge)}>
              {active.label}
            </span>
          </div>
          <div className="text-sm font-black text-white group-hover:text-white transition-colors">{title}</div>
          <p className="mt-2 text-[13px] text-white/40 leading-relaxed font-medium group-hover:text-white/60 transition-colors">{message}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Section collapsible wrapper ─────────────────────────────────────────────

function SubSection({ title, count, icon, children }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between mb-6 px-2">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/40">{title}</span>
          <span className="h-px w-8 bg-white/10"></span>
        </div>
        {count !== undefined && (
          <span className="text-[10px] font-black text-white/20 bg-white/5 px-2 py-0.5 rounded">
            {count}
          </span>
        )}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

// ─── Main exported component ─────────────────────────────────────────────────

export default function AiSummaryPanel({ summary, compact = false }) {
  if (!summary) {
    return (
      <div className="rounded-[2.5rem] bg-white/[0.03] backdrop-blur-xl ring-1 ring-white/10 p-10 text-sm text-white/20 italic text-center animate-pulse">
        Initializing cognitive synthesis protocols...
      </div>
    );
  }

  const {
    healthScore,
    statusLabel,
    summaryText,
    keyInsights,
    risks,
    recommendedActions,
  } = summary;

  const sortedRisks = [...risks].sort((a, b) => (a.severity === 'high' ? -1 : 1));
  const sortedActions = [...recommendedActions].sort((a, b) => (a.priority === 'high' ? -1 : 1));

  return (
    <div className="rounded-[3rem] bg-gradient-to-br from-indigo-500/[0.08] via-slate-900 to-transparent ring-1 ring-white/10 p-8 sm:p-12 space-y-12 shadow-2xl relative overflow-hidden border border-white/5">
      
      {/* Decorative background effects */}
      <div className="absolute top-0 right-0 h-96 w-96 bg-indigo-500/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      <div className="absolute bottom-0 left-0 h-96 w-96 bg-purple-500/5 blur-[120px] rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none" />

      {/* ── Header ── */}
      <div className="relative z-10 flex items-start justify-between gap-10 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] bg-white/5 text-white/50 px-4 py-1.5 rounded-full ring-1 ring-white/10 shadow-inner">
              Strategic Intelligence Protocol
            </span>
            <div className="flex items-center gap-1">
              <span className="h-1 w-1 rounded-full bg-emerald-400 animate-ping"></span>
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400/70">Real-time Analysis</span>
            </div>
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tighter leading-none mb-6">
            Business Health <br/>Synthesis
          </h2>
          <div className="max-w-2xl text-[15px] font-medium leading-relaxed text-white/40 italic border-l-2 border-indigo-500/20 pl-6">
            "{summaryText}"
          </div>
        </div>

        <HealthScoreRing score={healthScore} label={statusLabel} />
      </div>

      {/* ── Analytical Grid ── */}
      <div className={cx("relative z-10 grid gap-10", compact ? "grid-cols-1" : "xl:grid-cols-3")}>
        
        {/* Key Insights */}
        <SubSection title="Insight telemetry" count={keyInsights.length}>
          {keyInsights.map((ins, i) => (
            <StatusModule key={i} {...ins} />
          ))}
        </SubSection>

        {/* Risk Assessment */}
        <SubSection title="Threat matrix" count={risks.length}>
          {sortedRisks.map((r, i) => (
            <StatusModule key={i} {...r} />
          ))}
        </SubSection>

        {/* Operational Directives */}
        <SubSection title="Active directives" count={recommendedActions.length}>
          {sortedActions.map((a, i) => (
            <StatusModule key={i} {...a} />
          ))}
        </SubSection>
      </div>

      {/* ── Footer ── */}
      <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-6 pt-10 border-t border-white/5">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20">
          Cognitive Logic Engine v2.0 · Automated Strategic Audit
        </div>
        <div className="flex items-center gap-4 text-[10px] font-bold text-white/30">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-white/5 ring-1 ring-white/10" />
            Zero External API Costs
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-white/5 ring-1 ring-white/10" />
            100% Privacy Compliant
          </div>
        </div>
      </div>
    </div>
  );
}
