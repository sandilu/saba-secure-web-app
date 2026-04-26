// src/components/BulkImportModal.jsx
// CSV bulk import for inventory items.

import { useState, useRef } from "react";
import { createInventoryItem } from "../firebase/inventoryActions";
import { logAction } from "../firebase/auditLogger";

const REQUIRED_COLUMNS = [
  "itemName",
  "sku",
  "category",
  "quantity",
  "minStockLevel",
  "buyingPrice",
  "sellingPrice",
];

const ALL_COLUMNS = [...REQUIRED_COLUMNS, "supplier", "location"];

function parseCsv(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows = lines.slice(1).map((line) => {
    // Handle quoted fields
    const values = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    values.push(current.trim());
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
  });

  return { headers, rows };
}

function validateRow(row, index, existingSkus) {
  const errors = [];
  for (const col of REQUIRED_COLUMNS) {
    if (!String(row[col] ?? "").trim()) {
      errors.push(`Row ${index + 1}: "${col}" is required.`);
    }
  }
  const sku = String(row.sku ?? "").trim().toUpperCase();
  if (sku && existingSkus.has(sku)) {
    errors.push(`Row ${index + 1}: SKU "${sku}" already exists in inventory.`);
  }
  if (isNaN(Number(row.quantity))) errors.push(`Row ${index + 1}: quantity must be a number.`);
  if (isNaN(Number(row.minStockLevel))) errors.push(`Row ${index + 1}: minStockLevel must be a number.`);
  if (isNaN(Number(row.buyingPrice))) errors.push(`Row ${index + 1}: buyingPrice must be a number.`);
  if (isNaN(Number(row.sellingPrice))) errors.push(`Row ${index + 1}: sellingPrice must be a number.`);
  return errors;
}

export default function BulkImportModal({ existingItems, user, onClose, onSuccess }) {
  const [step, setStep] = useState("upload"); // "upload" | "preview" | "importing" | "done"
  const [parseError, setParseError] = useState("");
  const [rows, setRows] = useState([]);
  const [rowErrors, setRowErrors] = useState([]);
  const [validRows, setValidRows] = useState([]);
  const [importLog, setImportLog] = useState([]);
  const fileRef = useRef(null);

  const existingSkus = new Set(
    existingItems.map((it) => String(it.sku ?? "").trim().toUpperCase())
  );

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setParseError("");
    setRows([]);
    setRowErrors([]);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const { headers, rows: parsed } = parseCsv(text);

      const missingCols = REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
      if (missingCols.length > 0) {
        setParseError(
          `CSV is missing required columns: ${missingCols.join(", ")}`
        );
        return;
      }

      const allErrors = [];
      const valid = [];
      parsed.forEach((row, i) => {
        const errs = validateRow(row, i, existingSkus);
        if (errs.length > 0) {
          allErrors.push(...errs);
        } else {
          valid.push(row);
        }
      });

      setRows(parsed);
      setRowErrors(allErrors);
      setValidRows(valid);
      setStep("preview");
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    setStep("importing");
    const log = [];

    for (const row of validRows) {
      try {
        await createInventoryItem(
          {
            itemName: String(row.itemName).trim(),
            sku: String(row.sku).trim(),
            category: String(row.category).trim(),
            quantity: Number(row.quantity),
            minStockLevel: Number(row.minStockLevel),
            buyingPrice: Number(row.buyingPrice),
            sellingPrice: Number(row.sellingPrice),
            supplier: String(row.supplier ?? "").trim(),
            location: String(row.location ?? "").trim(),
          },
          user
        );
        log.push({ sku: row.sku, status: "ok" });
      } catch (err) {
        log.push({ sku: row.sku, status: "error", error: err.message });
      }
    }

    // Audit log
    try {
      await logAction(
        "BULK_INVENTORY_IMPORT",
        user.uid,
        user.email,
        { imported: log.filter((l) => l.status === "ok").length, failed: log.filter((l) => l.status === "error").length },
        "inventory",
        "bulk"
      );
    } catch (_) {}

    setImportLog(log);
    setStep("done");
    onSuccess?.();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(2,6,23,0.85)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl bg-slate-900 ring-1 ring-white/10 shadow-2xl p-6 sm:p-8 flex flex-col gap-5"
        style={{ animation: "modalSlideIn 0.18s ease-out" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-white/50 mb-1">
              Inventory
            </div>
            <h2 className="text-xl font-semibold text-white">Bulk Inventory Import</h2>
            <p className="mt-1 text-sm text-white/60">
              Upload a CSV file to import multiple inventory items at once.
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-xl bg-white/5 ring-1 ring-white/15 px-3 py-1.5 text-sm text-white hover:bg-white/10 transition"
          >
            ✕ Close
          </button>
        </div>

        {/* ── STEP: Upload ── */}
        {step === "upload" && (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
              <p className="text-sm text-white/80 font-semibold mb-2">Required CSV columns:</p>
              <code className="text-xs text-emerald-300 block leading-6">
                {ALL_COLUMNS.join(", ")}
              </code>
              <p className="text-xs text-white/50 mt-2">
                Columns marked with * are required:{" "}
                <span className="text-white/70">{REQUIRED_COLUMNS.join(", ")}</span>
              </p>
            </div>

            {parseError && (
              <div className="rounded-2xl bg-red-500/10 ring-1 ring-red-500/20 px-4 py-3 text-sm text-red-200">
                ❌ {parseError}
              </div>
            )}

            <div className="flex gap-3 flex-wrap">
              <label className="cursor-pointer inline-flex items-center gap-2 rounded-2xl bg-indigo-500/90 text-white font-semibold px-5 py-2.5 text-sm hover:bg-indigo-500 transition">
                📂 Choose CSV File
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  onChange={handleFile}
                />
              </label>
              <a
                href={`data:text/csv;charset=utf-8,${encodeURIComponent(
                  ALL_COLUMNS.join(",") + "\nExample Item,ITEM-001,Groceries,100,10,150,200,Supplier Name,Rack A1"
                )}`}
                download="inventory_import_template.csv"
                className="inline-flex items-center gap-2 rounded-2xl bg-white/5 ring-1 ring-white/15 text-white font-semibold px-5 py-2.5 text-sm hover:bg-white/10 transition"
              >
                ⬇ Download Template
              </a>
            </div>
          </div>
        )}

        {/* ── STEP: Preview ── */}
        {step === "preview" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 text-emerald-300 px-3 py-1 text-xs font-semibold ring-1 ring-emerald-500/20">
                ✓ {validRows.length} valid rows
              </span>
              {rowErrors.length > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 text-red-300 px-3 py-1 text-xs font-semibold ring-1 ring-red-500/20">
                  ✕ {rowErrors.length} errors
                </span>
              )}
            </div>

            {rowErrors.length > 0 && (
              <div className="rounded-2xl bg-red-500/5 ring-1 ring-red-500/20 p-4 max-h-40 overflow-y-auto">
                <p className="text-sm font-semibold text-red-300 mb-2">Rows with errors (will be skipped):</p>
                <ul className="text-xs text-red-200/80 space-y-1">
                  {rowErrors.map((err, i) => (
                    <li key={i}>• {err}</li>
                  ))}
                </ul>
              </div>
            )}

            {validRows.length > 0 && (
              <div className="overflow-x-auto rounded-2xl ring-1 ring-white/10">
                <table className="w-full text-xs text-left text-white/80 min-w-[700px]">
                  <thead className="bg-white/5 text-white/60">
                    <tr>
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Item Name</th>
                      <th className="px-3 py-2">SKU</th>
                      <th className="px-3 py-2">Category</th>
                      <th className="px-3 py-2">Qty</th>
                      <th className="px-3 py-2">Min</th>
                      <th className="px-3 py-2">Buy</th>
                      <th className="px-3 py-2">Sell</th>
                      <th className="px-3 py-2">Supplier</th>
                      <th className="px-3 py-2">Location</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {validRows.map((row, i) => (
                      <tr key={i} className="hover:bg-white/5">
                        <td className="px-3 py-2 text-white/40">{i + 1}</td>
                        <td className="px-3 py-2 font-medium text-white">{row.itemName}</td>
                        <td className="px-3 py-2">{row.sku}</td>
                        <td className="px-3 py-2">{row.category}</td>
                        <td className="px-3 py-2">{row.quantity}</td>
                        <td className="px-3 py-2">{row.minStockLevel}</td>
                        <td className="px-3 py-2">{row.buyingPrice}</td>
                        <td className="px-3 py-2">{row.sellingPrice}</td>
                        <td className="px-3 py-2">{row.supplier || "–"}</td>
                        <td className="px-3 py-2">{row.location || "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex gap-3 flex-wrap justify-end">
              <button
                onClick={() => { setStep("upload"); setRows([]); setRowErrors([]); setValidRows([]); if (fileRef.current) fileRef.current.value = ""; }}
                className="rounded-2xl bg-white/5 ring-1 ring-white/15 text-white font-semibold px-5 py-2.5 text-sm hover:bg-white/10 transition"
              >
                ← Back
              </button>
              <button
                onClick={handleImport}
                disabled={validRows.length === 0}
                className="rounded-2xl bg-emerald-500/90 text-white font-semibold px-5 py-2.5 text-sm hover:bg-emerald-500 disabled:opacity-40 transition"
              >
                ✓ Import {validRows.length} Items
              </button>
            </div>
          </div>
        )}

        {/* ── STEP: Importing ── */}
        {step === "importing" && (
          <div className="flex flex-col items-center gap-4 py-10">
            <div className="h-10 w-10 rounded-full border-4 border-white/20 border-t-indigo-400 animate-spin" />
            <p className="text-sm text-white/70">Importing items to Firestore...</p>
          </div>
        )}

        {/* ── STEP: Done ── */}
        {step === "done" && (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/20 p-4">
              <p className="font-semibold text-emerald-300 mb-1">Import complete!</p>
              <p className="text-sm text-white/70">
                {importLog.filter((l) => l.status === "ok").length} items imported
                successfully. {importLog.filter((l) => l.status === "error").length > 0 && (
                  <span className="text-red-300">
                    {importLog.filter((l) => l.status === "error").length} failed.
                  </span>
                )}
              </p>
            </div>

            {importLog.filter((l) => l.status === "error").length > 0 && (
              <ul className="text-xs text-red-200/80 space-y-1">
                {importLog.filter((l) => l.status === "error").map((l, i) => (
                  <li key={i}>• SKU {l.sku}: {l.error}</li>
                ))}
              </ul>
            )}

            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="rounded-2xl bg-indigo-500/90 text-white font-semibold px-5 py-2.5 text-sm hover:bg-indigo-500 transition"
              >
                Done
              </button>
            </div>
          </div>
        )}

        <style>{`
          @keyframes modalSlideIn {
            from { opacity: 0; transform: scale(0.96) translateY(8px); }
            to   { opacity: 1; transform: scale(1)    translateY(0);   }
          }
        `}</style>
      </div>
    </div>
  );
}
