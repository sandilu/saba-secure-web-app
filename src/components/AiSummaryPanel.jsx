// src/components/AiSummaryPanel.jsx
// Reusable AI Business Summary panel component.
// Renders the output of generateBusinessSummary() from aiSummaryRules.js.
// Used in AdminDashboard and ReportsPage.

import { useMemo } from "react";

const fc = (v) => `Rs. ${Number(v || 0).toLocaleString()}`;

// ─── sub-components ─────────────────────────────────────────────────────────

function HealthScoreRing({ score, label }) {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const trackColour =
    score >= 80 ? "#10b981" :   // emerald
    score >= 50 ? "#f59e0b" :   // amber
                  "#ef4444";    // red

  const badgeColour =
    label === "Healthy"          ? "bg-emerald-500/20 text-emerald-300 ring-emerald-500/30" :
    label === "Needs Attention"  ? "bg-amber-500/20  text-amber-300  ring-amber-500/30"  :
                                   "bg-red-500/20    text-red-300    ring-red-500/30";

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
          <circle
            cx="48" cy="48" r={radius}
            fill="none" stroke="rgba(255,255,255,0.06)"
            strokeWidth="8"
          />
          <circle
            cx="48" cy="48" r={radius}
            fill="none" stroke={trackColour}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.8s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-white leading-none">{score}</span>
          <span className="text-[10px] text-white/50 uppercase tracking-wide">/ 100</span>
        </div>
      </div>
      <span className={`text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full ring-1 ${badgeColour}`}>
        {label}
      </span>
    </div>
  );
}

function InsightCard({ title, message, type }) {
  const styles = {
    success: "bg-emerald-500/[0.07] ring-emerald-500/20",
    warning: "bg-amber-500/[0.07]  ring-amber-500/20",
    info:    "bg-blue-500/[0.07]   ring-blue-500/15",
  };
  const badgeStyles = {
    success: "bg-emerald-500/20 text-emerald-300",
    warning: "bg-amber-500/20  text-amber-300",
    info:    "bg-blue-500/20   text-blue-300",
  };
  const icons = { success: "✅", warning: "⚠️", info: "💡" };

  return (
    <div className={`rounded-2xl ring-1 p-4 ${styles[type] || styles.info}`}>
      <div className="flex items-start gap-2.5">
        <span className="text-base shrink-0 mt-0.5">{icons[type] || icons.info}</span>
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${badgeStyles[type] || badgeStyles.info}`}>
              {type === "success" ? "Opportunity" : type === "warning" ? "Warning" : "Insight"}
            </span>
            <span className="font-semibold text-white text-sm">{title}</span>
          </div>
          <p className="text-xs text-white/70 leading-relaxed">{message}</p>
        </div>
      </div>
    </div>
  );
}

function RiskCard({ title, message, severity }) {
  const styles = {
    high:   "bg-red-500/[0.07]    ring-red-500/20",
    medium: "bg-amber-500/[0.07]  ring-amber-500/20",
    low:    "bg-white/[0.04]      ring-white/10",
  };
  const badgeStyles = {
    high:   "bg-red-500/20    text-red-300",
    medium: "bg-amber-500/20  text-amber-300",
    low:    "bg-slate-500/20  text-slate-300",
  };
  const icons = { high: "🚨", medium: "⚠️", low: "✅" };

  return (
    <div className={`rounded-2xl ring-1 p-4 ${styles[severity] || styles.low}`}>
      <div className="flex items-start gap-2.5">
        <span className="text-base shrink-0 mt-0.5">{icons[severity] || icons.low}</span>
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${badgeStyles[severity] || badgeStyles.low}`}>
              {severity === "low" ? "Clear" : severity}
            </span>
            <span className="font-semibold text-white text-sm">{title}</span>
          </div>
          <p className="text-xs text-white/70 leading-relaxed">{message}</p>
        </div>
      </div>
    </div>
  );
}

function ActionCard({ title, message, priority }) {
  const styles = {
    high:   "bg-red-500/[0.07]    ring-red-500/20",
    medium: "bg-indigo-500/[0.07] ring-indigo-500/20",
    low:    "bg-white/[0.04]      ring-white/10",
  };
  const badgeStyles = {
    high:   "bg-red-500/20    text-red-300",
    medium: "bg-indigo-500/20 text-indigo-300",
    low:    "bg-slate-500/20  text-slate-300",
  };
  const icons = { high: "🔴", medium: "🔵", low: "⚪" };

  return (
    <div className={`rounded-2xl ring-1 p-4 ${styles[priority] || styles.low}`}>
      <div className="flex items-start gap-2.5">
        <span className="text-base shrink-0 mt-0.5">{icons[priority] || icons.low}</span>
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${badgeStyles[priority] || badgeStyles.low}`}>
              {priority} priority
            </span>
            <span className="font-semibold text-white text-sm">{title}</span>
          </div>
          <p className="text-xs text-white/70 leading-relaxed">{message}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Section collapsible wrapper ─────────────────────────────────────────────

function SubSection({ title, count, countColour = "bg-indigo-500/20 text-indigo-300", children }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-semibold text-white/80">{title}</span>
        {count !== undefined && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${countColour}`}>
            {count}
          </span>
        )}
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

// ─── Main exported component ─────────────────────────────────────────────────

/**
 * @param {Object} props
 * @param {Object} props.summary   - return value of generateBusinessSummary()
 * @param {boolean} [props.compact] - if true, renders a condensed single-column layout
 */
export default function AiSummaryPanel({ summary, compact = false }) {
  if (!summary) {
    return (
      <div className="rounded-3xl bg-white/[0.04] ring-1 ring-white/10 p-6 text-sm text-white/50">
        Generating AI Business Summary…
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

  const highActions  = recommendedActions.filter((a) => a.priority === "high");
  const medActions   = recommendedActions.filter((a) => a.priority === "medium");
  const lowActions   = recommendedActions.filter((a) => a.priority === "low");

  const highRisks    = risks.filter((r) => r.severity === "high");
  const medRisks     = risks.filter((r) => r.severity === "medium");
  const lowRisks     = risks.filter((r) => r.severity === "low");

  return (
    <div className="rounded-3xl bg-gradient-to-br from-indigo-500/[0.06] via-purple-500/[0.04] to-slate-900/0 ring-1 ring-indigo-500/20 p-5 sm:p-7 space-y-8">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-widest bg-indigo-500/20 text-indigo-300 px-2.5 py-1 rounded-full ring-1 ring-indigo-500/30">
              Level 2 · Step 4
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest bg-purple-500/20 text-purple-300 px-2.5 py-1 rounded-full ring-1 ring-purple-500/30">
              Rule-Based AI
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">AI Business Summary</h2>
          <p className="mt-1.5 text-sm text-white/60">
            Generated from live sales, inventory, customer, supplier, and anomaly data.
          </p>
        </div>

        <HealthScoreRing score={healthScore} label={statusLabel} />
      </div>

      {/* ── Business Summary Paragraph ── */}
      <div className="rounded-2xl bg-white/[0.04] ring-1 ring-white/10 p-5">
        <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-300 mb-2">
          Executive Summary
        </div>
        <p className="text-sm text-white/80 leading-relaxed">{summaryText}</p>
      </div>

      {/* ── Key Insights / Risks / Actions ── */}
      <div className={compact ? "space-y-8" : "grid gap-8 xl:grid-cols-3"}>

        {/* Key Insights */}
        <div className="space-y-3">
          <SubSection
            title="Key Insights"
            count={keyInsights.length}
            countColour="bg-blue-500/20 text-blue-300"
          >
            {keyInsights.map((ins, i) => (
              <InsightCard key={i} {...ins} />
            ))}
          </SubSection>
        </div>

        {/* Risk Summary */}
        <div className="space-y-3">
          <SubSection
            title="Risk Summary"
            count={risks.filter((r) => r.severity !== "low").length + " issues"}
            countColour={highRisks.length > 0 ? "bg-red-500/20 text-red-300" : "bg-amber-500/20 text-amber-300"}
          >
            {highRisks.map((r, i)  => <RiskCard key={`h${i}`} {...r} />)}
            {medRisks.map((r, i)   => <RiskCard key={`m${i}`} {...r} />)}
            {lowRisks.map((r, i)   => <RiskCard key={`l${i}`} {...r} />)}
          </SubSection>
        </div>

        {/* Recommended Actions */}
        <div className="space-y-3">
          <SubSection
            title="Recommended Actions"
            count={recommendedActions.length}
            countColour={highActions.length > 0 ? "bg-red-500/20 text-red-300" : "bg-indigo-500/20 text-indigo-300"}
          >
            {highActions.map((a, i)  => <ActionCard key={`h${i}`} {...a} />)}
            {medActions.map((a, i)   => <ActionCard key={`m${i}`} {...a} />)}
            {lowActions.map((a, i)   => <ActionCard key={`l${i}`} {...a} />)}
          </SubSection>
        </div>
      </div>

      {/* ── Footer note ── */}
      <div className="text-[11px] text-white/30 border-t border-white/10 pt-4">
        This summary is generated by rule-based analysis of live Firestore data. It does not use an external AI API and requires no additional cost or configuration.
      </div>
    </div>
  );
}
