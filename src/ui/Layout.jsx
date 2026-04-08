// src/ui/Layout.jsx
import React from "react";
import { Link, useLocation } from "react-router-dom";

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="h-10 w-10 rounded-2xl bg-white/10 ring-1 ring-white/15 grid place-items-center">
        <span className="text-lg">🔒</span>
      </div>
      <div className="leading-tight">
        <div className="text-white font-semibold">SABA Secure App</div>
        <div className="text-xs text-white/70">
          Secure Inventory & Document Management
        </div>
      </div>
    </div>
  );
}

function TopNav() {
  const { pathname } = useLocation();
  const btn =
    "rounded-xl px-3 py-2 text-sm font-medium ring-1 ring-white/15 bg-white/5 hover:bg-white/10 transition";

  return (
    <div className="flex items-center gap-2">
      <Link className={`${btn} ${pathname === "/login" ? "bg-white/15" : ""}`} to="/login">
        Login
      </Link>
      <Link
        className={`${btn} ${pathname === "/register" ? "bg-white/15" : ""}`}
        to="/register"
      >
        Register
      </Link>
    </div>
  );
}

export function PageShell({ children, right }) {
  return (
    <div className="min-h-screen w-full bg-[#070A12] overflow-x-hidden">
      {/* Background glows */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute top-24 right-10 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between py-6">
          <Logo />
          <TopNav />
        </div>

        {/* Main grid */}
        <div className="grid gap-6 lg:grid-cols-12 lg:items-start min-w-0">
          {/* LEFT */}
          <div className={`${right ? "lg:col-span-7" : "lg:col-span-12"} min-w-0`}>
            <div className="rounded-3xl bg-white/[0.06] ring-1 ring-white/10 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] overflow-hidden">
              <div className="p-5 sm:p-8">{children}</div>
            </div>

            <div className="mt-6 text-xs text-white/55">
              © 2026 SABA Secure App • Built with React + Firebase
            </div>
          </div>

          {/* RIGHT */}
          {right ? (
            <div className="lg:col-span-5">
              <div className="lg:sticky lg:top-6">
                <div className="rounded-3xl bg-white/[0.04] ring-1 ring-white/10 p-6 sm:p-8">
                  {right}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="h-10" />
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

export function Input(props) {
  return (
    <input
      {...props}
      className={
        "w-full rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-3 text-sm text-white " +
        "placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-white/25"
      }
    />
  );
}

export function Select(props) {
  return (
    <select
      {...props}
      className={
        "w-full rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-3 text-sm text-white " +
        "focus:outline-none focus:ring-2 focus:ring-white/25"
      }
    />
  );
}

export function PrimaryButton({ children, ...props }) {
  return (
    <button
      {...props}
      className={
        "w-full rounded-2xl bg-white text-slate-950 font-semibold px-4 py-3 text-sm " +
        "hover:opacity-90 disabled:opacity-60 transition"
      }
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ children, ...props }) {
  return (
    <button
      {...props}
      className={
        "w-full rounded-2xl bg-white/5 ring-1 ring-white/15 text-white font-semibold px-4 py-3 text-sm " +
        "hover:bg-white/10 disabled:opacity-60 transition"
      }
    >
      {children}
    </button>
  );
}

export function Pill({ children }) {
  return (
    <span className="inline-flex items-center rounded-full bg-white/5 ring-1 ring-white/10 px-3 py-1 text-xs text-white/80">
      {children}
    </span>
  );
}

export function Card({ title, desc }) {
  return (
    <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-5">
      <div className="text-white font-semibold">{title}</div>
      <div className="mt-1 text-sm text-white/70">{desc}</div>
    </div>
  );
}