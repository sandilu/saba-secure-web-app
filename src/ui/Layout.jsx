import React, { useEffect, useRef, useState } from "react";

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

export function PageShell({ children, right }) {
  return (
    <div className="w-full">
      <div className="grid gap-6 lg:grid-cols-12 lg:items-start min-w-0">
        <div className={cx(right ? "lg:col-span-7" : "lg:col-span-12", "min-w-0")}>
          <div className="rounded-3xl bg-white/[0.06] ring-1 ring-white/10 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] overflow-hidden">
            <div className="p-5 sm:p-8">{children}</div>
          </div>
        </div>

        {right ? (
          <div className="lg:col-span-5 min-w-0">
            <div className="lg:sticky lg:top-24">
              <div className="rounded-3xl bg-white/[0.04] ring-1 ring-white/10 p-6 sm:p-8">
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
    <label className="block">
      <div className="mb-1 text-sm text-white/80">{label}</div>
      {children}
      {hint ? <div className="mt-1 text-xs text-white/55">{hint}</div> : null}
    </label>
  );
}

export function Input({ className = "", ...props }) {
  return (
    <input
      {...props}
      className={cx(
        "w-full rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-3 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-white/25",
        className
      )}
    />
  );
}

export function Select({ className = "", children, ...props }) {
  return (
    <select
      {...props}
      className={cx(
        "w-full rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/25 [&>option]:bg-slate-900 [&>option]:text-white",
        className
      )}
    >
      {children}
    </select>
  );
}

export function TextArea({ className = "", ...props }) {
  return (
    <textarea
      {...props}
      className={cx(
        "w-full rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-3 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-white/25 min-h-[110px]",
        className
      )}
    />
  );
}

export function PrimaryButton({ children, className = "", type = "button", ...props }) {
  return (
    <button
      type={type}
      {...props}
      className={cx(
        "w-full rounded-2xl bg-white text-slate-950 font-semibold px-4 py-3 text-sm hover:opacity-90 disabled:opacity-60 transition",
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
        "w-full rounded-2xl bg-white/5 ring-1 ring-white/15 text-white font-semibold px-4 py-3 text-sm hover:bg-white/10 disabled:opacity-60 transition",
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
        "inline-flex items-center rounded-full bg-white/5 ring-1 ring-white/10 px-3 py-1 text-xs text-white/80",
        className
      )}
    >
      {children}
    </span>
  );
}

export function Card({ title, desc, className = "" }) {
  return (
    <div className={cx("rounded-2xl bg-white/5 ring-1 ring-white/10 p-5", className)}>
      <div className="text-white font-semibold">{title}</div>
      <div className="mt-1 text-sm text-white/70">{desc}</div>
    </div>
  );
}

// ─── ConfirmModal ──────────────────────────────────────────────────────────────
//  Usage:
//    const [confirm, setConfirm] = useState(null);
//    // open:   setConfirm({ title, body, variant:"danger"|"warning", requireReason:bool, onConfirm: (reason)=>{} })
//    // render: <ConfirmModal state={confirm} onClose={()=>setConfirm(null)} />

export function ConfirmModal({ state, onClose }) {
  const [reason, setReason] = useState("");
  const cancelRef = useRef(null);

  // Reset reason when dialog opens
  useEffect(() => {
    if (state) {
      setReason("");
      // Focus cancel button for safety-first keyboard navigation
      setTimeout(() => cancelRef.current?.focus(), 50);
    }
  }, [state]);

  // Close on Escape
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

  const confirmBtnClass =
    variant === "danger"
      ? "rounded-2xl bg-red-500/90 text-white font-semibold px-5 py-2.5 text-sm hover:bg-red-500 disabled:opacity-50 transition"
      : "rounded-2xl bg-amber-500/90 text-slate-950 font-semibold px-5 py-2.5 text-sm hover:bg-amber-400 disabled:opacity-50 transition";

  function handleConfirm() {
    onConfirm(reason.trim());
    onClose();
  }

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(2, 6, 23, 0.80)" }}
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-label={title}
    >
      {/* Panel */}
      <div
        className="w-full max-w-md rounded-3xl bg-slate-900 ring-1 ring-white/10 shadow-2xl p-6 sm:p-7 flex flex-col gap-5"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "modalSlideIn 0.18s ease-out" }}
      >
        {/* Icon + Title */}
        <div className="flex items-start gap-4">
          <div
            className={cx(
              "h-11 w-11 rounded-2xl grid place-items-center text-xl shrink-0",
              variant === "danger"
                ? "bg-red-500/15 text-red-300"
                : "bg-amber-500/15 text-amber-300"
            )}
          >
            {variant === "danger" ? "⚠️" : "🔔"}
          </div>
          <div>
            <div className="text-white font-semibold text-base leading-6">{title}</div>
            {body && (
              <p className="mt-1.5 text-sm text-white/65 leading-6">{body}</p>
            )}
          </div>
        </div>

        {/* Reason textarea */}
        {requireReason && (
          <div>
            <label className="block text-sm text-white/80 mb-1.5">
              Reason <span className="text-white/40 text-xs">(required)</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide a reason for this action..."
              className="w-full rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-3 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-white/25 min-h-[90px] resize-none"
              autoFocus
            />
          </div>
        )}

        {/* Buttons */}
        <div className="flex justify-end gap-3">
          <button
            ref={cancelRef}
            onClick={onClose}
            className="rounded-2xl bg-white/5 ring-1 ring-white/15 text-white font-semibold px-5 py-2.5 text-sm hover:bg-white/10 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={confirmBtnClass}
          >
            Confirm
          </button>
        </div>
      </div>

      <style>{`
        @keyframes modalSlideIn {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);   }
        }
      `}</style>
    </div>
  );
}