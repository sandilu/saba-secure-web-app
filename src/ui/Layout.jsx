import React, { useEffect, useRef, useState } from "react";

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

export function PageShell({ children, right }) {
  return (
    <div className="w-full">
      <div className="grid gap-6 lg:grid-cols-12 lg:items-start min-w-0">
        <div className={cx(right ? "lg:col-span-7" : "lg:col-span-12", "min-w-0")}>
          <div className="rounded-[2.5rem] bg-white/[0.03] backdrop-blur-xl ring-1 ring-white/10 shadow-2xl overflow-hidden border border-white/5">
            <div className="p-6 sm:p-10">{children}</div>
          </div>
        </div>

        {right ? (
          <div className="lg:col-span-5 min-w-0">
            <div className="lg:sticky lg:top-24">
              <div className="rounded-[2.5rem] bg-gradient-to-b from-white/[0.05] to-transparent backdrop-blur-md ring-1 ring-white/10 p-8 sm:p-10 border border-white/5 shadow-xl">
                {right}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function Field({ label, children, hint }) {
  return (
    <label className="block group">
      <div className="mb-2 text-[11px] font-black uppercase tracking-[0.15em] text-white/40 ml-1 group-focus-within:text-white/70 transition-colors">
        {label}
      </div>
      {children}
      {hint ? <div className="mt-1.5 text-[10px] font-medium text-white/30 ml-1 leading-relaxed">{hint}</div> : null}
    </label>
  );
}

export const Input = React.forwardRef(({ className = "", ...props }, ref) => {
  return (
    <input
      ref={ref}
      {...props}
      className={cx(
        "w-full rounded-2xl bg-white/[0.03] ring-1 ring-white/10 px-5 py-3.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 focus:bg-white/[0.06] transition-all duration-300",
        className
      )}
    />
  );
});
Input.displayName = "Input";

export function Select({ className = "", children, value, onChange, ...props }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const options = React.Children.toArray(children)
    .filter((child) => child.type === "option")
    .map((child) => ({
      value: child.props.value,
      label: child.props.children,
      disabled: child.props.disabled,
    }));

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  const handleSelect = (val) => {
    if (onChange) {
      onChange({ target: { value: val } });
    }
    setIsOpen(false);
  };

  return (
    <div className="relative w-full z-20" ref={containerRef}>
      <div
        className={cx(
          "w-full rounded-2xl bg-white/[0.03] ring-1 ring-white/10 px-5 py-3.5 text-sm text-white focus:outline-none transition-all duration-300 cursor-pointer flex items-center justify-between group select-none shadow-sm",
          isOpen
            ? "ring-2 ring-indigo-500/50 bg-white/[0.06] shadow-[0_0_15px_rgba(99,102,241,0.15)]"
            : "hover:bg-white/[0.05] hover:shadow-md",
          props.disabled && "opacity-50 cursor-not-allowed pointer-events-none",
          className
        )}
        onClick={() => !props.disabled && setIsOpen(!isOpen)}
        tabIndex={props.disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (props.disabled) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        {...props}
      >
        <span className={cx("truncate", !selectedOption?.label && "text-white/40")}>
          {selectedOption?.label || "Select an option..."}
        </span>
        <div
          className={cx(
            "flex items-center justify-center w-6 h-6 rounded-full transition-all duration-300 shrink-0 ml-3",
            isOpen
              ? "bg-indigo-500/20 text-indigo-400 rotate-180"
              : "bg-white/5 text-white/40 group-hover:bg-white/10 group-hover:text-white"
          )}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-[100] w-full mt-2 rounded-[1.5rem] bg-[#0f172a] ring-1 ring-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.5)] border border-white/5 overflow-hidden py-2 animate-in fade-in zoom-in-95 duration-200 origin-top">
          <div className="max-h-[250px] overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/20">
            {options.map((opt, i) => (
              <div
                key={i}
                className={cx(
                  "px-5 py-3 text-sm cursor-pointer transition-all flex items-center justify-between",
                  opt.value === value
                    ? "bg-indigo-500/10 text-indigo-300 font-bold"
                    : "text-white/70 hover:bg-white/5 hover:text-white hover:pl-6",
                  opt.disabled && "opacity-40 cursor-not-allowed hover:bg-transparent hover:pl-5"
                )}
                onClick={() => {
                  if (!opt.disabled) handleSelect(opt.value);
                }}
              >
                <span className="truncate">{opt.label}</span>
                {opt.value === value && (
                  <svg className="w-4 h-4 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export const TextArea = React.forwardRef(({ className = "", ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      {...props}
      className={cx(
        "w-full rounded-2xl bg-white/[0.03] ring-1 ring-white/10 px-5 py-3.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 focus:bg-white/[0.06] transition-all duration-300 min-h-[120px] resize-none",
        className
      )}
    />
  );
});
TextArea.displayName = "TextArea";

export function PrimaryButton({ children, className = "", type = "button", ...props }) {
  return (
    <button
      type={type}
      {...props}
      className={cx(
        "w-full rounded-2xl bg-white text-slate-950 font-black text-[11px] uppercase tracking-[0.2em] px-6 py-4 hover:bg-white/90 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none transition-all duration-300 shadow-[0_8px_30px_rgb(0,0,0,0.12)]",
        className
      )}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ children, className = "", type = "button", ...props }) {
  return (
    <button
      type={type}
      {...props}
      className={cx(
        "w-full rounded-2xl bg-white/[0.03] ring-1 ring-white/10 text-white font-black text-[11px] uppercase tracking-[0.2em] px-6 py-4 hover:bg-white/[0.08] hover:ring-white/20 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none transition-all duration-300",
        className
      )}
    >
      {children}
    </button>
  );
}

export function Pill({ children, className = "" }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full bg-white/[0.05] ring-1 ring-white/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-white/60",
        className
      )}
    >
      {children}
    </span>
  );
}

export function Card({ title, desc, className = "" }) {
  return (
    <div className={cx("rounded-3xl bg-white/[0.03] ring-1 ring-white/10 p-6 border border-white/5 hover:bg-white/[0.05] transition-all duration-300 shadow-lg group", className)}>
      <div className="text-white font-bold text-base group-hover:text-white/100 transition-colors">{title}</div>
      <div className="mt-1.5 text-[11px] font-medium text-white/40 leading-relaxed">{desc}</div>
    </div>
  );
}

// Modern Metric Card for Dashboards
export function MetricCard({ label, value, sub, color = "indigo", alert = false, icon }) {
  const colors = {
    indigo: "from-indigo-500/10 to-transparent ring-indigo-500/20 text-indigo-400",
    emerald: "from-emerald-500/10 to-transparent ring-emerald-500/20 text-emerald-400",
    blue: "from-blue-500/10 to-transparent ring-blue-500/20 text-blue-400",
    purple: "from-purple-500/10 to-transparent ring-purple-500/20 text-purple-400",
    amber: "from-amber-500/10 to-transparent ring-amber-500/20 text-amber-400",
    red: "from-red-500/10 to-transparent ring-red-500/20 text-red-400",
  };

  return (
    <div className={cx(
      "relative overflow-hidden rounded-3xl p-6 ring-1 transition-all duration-500 hover:shadow-2xl hover:-translate-y-1 bg-gradient-to-br border border-white/5 shadow-xl group",
      colors[color] || colors.indigo,
      alert ? "ring-red-500/40 animate-pulse" : ""
    )}>
      <div className="relative z-10">
        <div className="flex justify-between items-start">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 group-hover:opacity-60 transition-opacity">{label}</div>
          {icon && <div className="text-xl opacity-30 group-hover:scale-110 transition-transform duration-500">{icon}</div>}
        </div>
        <div className="mt-4 text-3xl font-black text-white tracking-tight">{value}</div>
        <div className="mt-1 text-[11px] font-medium opacity-40 group-hover:opacity-60 transition-opacity tracking-wide">{sub}</div>
      </div>
      
      {/* Decorative gradient orb */}
      <div className="absolute -right-10 -bottom-10 h-32 w-32 rounded-full bg-current opacity-5 blur-3xl group-hover:opacity-10 transition-opacity" />
    </div>
  );
}

// ─── ConfirmModal ──────────────────────────────────────────────────────────────
export function ConfirmModal({ state, onClose }) {
  const [reason, setReason] = useState("");
  const cancelRef = useRef(null);

  useEffect(() => {
    if (state) {
      setReason("");
      setTimeout(() => cancelRef.current?.focus(), 50);
    }
  }, [state]);

  useEffect(() => {
    if (!state) return;
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, onClose]);

  if (!state) return null;

  const { title, body, variant = "danger", requireReason = false, onConfirm } = state;

  const canConfirm = !requireReason || reason.trim().length >= 3;

  const confirmBtnClass = cx(
    "rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] px-8 py-4 transition-all active:scale-[0.97] shadow-xl disabled:opacity-40 disabled:pointer-events-none",
    variant === "danger"
      ? "bg-red-500 text-white hover:bg-red-600 shadow-red-500/20"
      : "bg-amber-500 text-slate-950 hover:bg-amber-600 shadow-amber-500/20"
  );

  function handleConfirm() {
    onConfirm(reason.trim());
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-md transition-all duration-300"
      style={{ backgroundColor: "rgba(2, 6, 23, 0.7)" }}
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="w-full max-w-xl rounded-[2.5rem] bg-slate-900 ring-1 ring-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-10 sm:p-12 border border-white/5 flex flex-col gap-8 animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-8">
          <div
            className={cx(
              "h-16 w-16 rounded-3xl grid place-items-center text-3xl shrink-0 ring-1 shadow-inner",
              variant === "danger"
                ? "bg-red-500/10 text-red-400 ring-red-500/20"
                : "bg-amber-500/10 text-amber-400 ring-amber-500/20"
            )}
          >
            {variant === "danger" ? "🚨" : "🛡️"}
          </div>
          <div className="pt-1">
            <div className="text-white font-black text-2xl tracking-tight leading-none">{title}</div>
            {body && (
              <p className="mt-4 text-sm text-white/50 leading-relaxed font-medium">{body}</p>
            )}
          </div>
        </div>

        {requireReason && (
          <div className="space-y-3">
            <label className="text-[11px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">
              Operational Justification
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide executive summary for this override..."
              className="w-full rounded-[1.5rem] bg-white/[0.03] ring-1 ring-white/10 px-6 py-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 min-h-[120px] resize-none transition-all"
              autoFocus
            />
          </div>
        )}

        <div className="flex justify-end gap-4 pt-4">
          <button
            ref={cancelRef}
            onClick={onClose}
            className="px-8 py-4 rounded-2xl bg-white/[0.03] ring-1 ring-white/10 text-white font-black text-[11px] uppercase tracking-[0.2em] hover:bg-white/[0.08] transition-all"
          >
            Decline
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={confirmBtnClass}
          >
            Authorize
          </button>
        </div>
      </div>
    </div>
  );
}
