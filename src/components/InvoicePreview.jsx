import { useRef, useState } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { getSaleItems } from "../utils/saleHelpers";

const fc  = (v) => `Rs. ${Number(v || 0).toLocaleString()}`;
const fmtDate = (v) => { if (!v) return "-"; if (typeof v?.toDate === "function") return v.toDate().toLocaleString(); return new Date(v).toLocaleString(); };

async function captureCanvas(ref) {
  return html2canvas(ref, { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false });
}

export default function InvoicePreview({ sale, onClose }) {
  const invoiceRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [printing,  setPrinting]  = useState(false);
  if (!sale) return null;

  const invNum      = sale.invoiceNumber || (sale.id ? `INV-${String(sale.id).slice(-6).toUpperCase()}` : "INV-000000");
  const saleItems   = getSaleItems(sale);
  const subtotal    = Number(sale.subtotal    || sale.totalBeforeDiscount || 0) || saleItems.reduce((s, i) => s + i.lineTotal, 0);
  const discPct     = Number(sale.discountPercent || 0);
  const discAmt     = Number(sale.discountAmount  || 0);
  const finalTotal  = Number(sale.finalTotal  || sale.totalAfterDiscount || sale.totalPrice || 0);

  async function handleSavePdf() {
    if (!invoiceRef.current) return; setExporting(true);
    try {
      const canvas  = await captureCanvas(invoiceRef.current);
      const imgData = canvas.toDataURL("image/png");
      const pdf     = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW   = pdf.internal.pageSize.getWidth();
      const pageH   = pdf.internal.pageSize.getHeight();
      const imgH    = (canvas.height * pageW) / canvas.width;
      let y = 0;
      while (y < imgH) { if (y > 0) pdf.addPage(); pdf.addImage(imgData, "PNG", 0, -y, pageW, imgH); y += pageH; }
      pdf.save(`${invNum}.pdf`);
    } catch (err) { console.error(err); alert("PDF export failed."); }
    finally { setExporting(false); }
  }

  async function handlePrint() {
    if (!invoiceRef.current) return; setPrinting(true);
    try {
      const canvas  = await captureCanvas(invoiceRef.current);
      const imgData = canvas.toDataURL("image/png");
      const win     = window.open("", "_blank", "width=900,height=700");
      if (!win) { alert("Pop-up blocked."); return; }
      win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${invNum}</title>
        <style>*{margin:0;padding:0;box-sizing:border-box}body{background:#fff}img{width:100%;display:block}
        @media print{body{margin:0}}</style></head><body><img src="${imgData}" alt="Invoice"/>
        <script>window.onload=function(){window.print();window.onafterprint=function(){window.close();};}<\/script>
        </body></html>`);
      win.document.close();
    } catch (err) { console.error(err); alert("Print failed."); }
    finally { setPrinting(false); }
  }

  const busy = exporting || printing;
  const th = { padding: "9px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#475569" };
  const thR = { ...th, textAlign: "right" };

  return (
    <>
      <style>{`@keyframes iSlide{from{opacity:0;transform:scale(.96) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(2,6,23,0.88)" }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white shadow-2xl flex flex-col" style={{ animation: "iSlide 0.18s ease-out" }}>

          {/* Action bar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 rounded-t-3xl shrink-0 flex-wrap gap-2">
            <span className="text-sm font-semibold text-slate-600">{invNum}</span>
            <div className="flex gap-2">
              <button onClick={handleSavePdf} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 text-white text-sm font-semibold px-4 py-2 hover:bg-blue-700 disabled:opacity-60 transition">
                {exporting ? "Exporting…" : "⬇ PDF"}
              </button>
              <button onClick={handlePrint} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-700 text-white text-sm font-semibold px-4 py-2 hover:bg-slate-800 disabled:opacity-60 transition">
                {printing ? "Preparing…" : "🖨 Print"}
              </button>
              <button onClick={onClose} disabled={busy} className="rounded-xl bg-slate-100 text-slate-500 text-sm font-semibold px-4 py-2 hover:bg-slate-200 disabled:opacity-60 transition">✕ Close</button>
            </div>
          </div>

          {/* Printable body */}
          <div ref={invoiceRef} className="bg-white p-10 relative overflow-hidden" style={{ fontFamily: "'Segoe UI',system-ui,Arial,sans-serif" }}>
            
            {sale.status === "cancelled" && (
              <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%) rotate(-30deg)", fontSize: "100px", fontWeight: "900", color: "rgba(239, 68, 68, 0.1)", zIndex: 0, pointerEvents: "none", whiteSpace: "nowrap" }}>
                CANCELLED
              </div>
            )}
            {(sale.status === "returned" || sale.status === "partially_returned") && (
              <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%) rotate(-30deg)", fontSize: "80px", fontWeight: "900", color: "rgba(245, 158, 11, 0.1)", zIndex: 0, pointerEvents: "none", whiteSpace: "nowrap" }}>
                {sale.status === "returned" ? "FULLY RETURNED" : "PARTIALLY RETURNED"}
              </div>
            )}

            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#0f172a" }}>SABA Secure</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>Inventory & Sales Management</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#2563eb" }}>INVOICE</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>{invNum}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>{fmtDate(sale.soldAt)}</div>
              </div>
            </div>

            <div style={{ borderTop: "1.5px solid #e2e8f0", marginBottom: 24 }} />

            {/* Bill To / Sold By */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 28 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8", marginBottom: 6 }}>Bill To</div>
                <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.7 }}>
                  <strong style={{ color: "#0f172a" }}>{sale.customerName || "Walk-in Customer"}</strong>
                  {sale.customerId && sale.customerPhone && <><br />{sale.customerPhone}</>}
                  {sale.customerId && sale.customerEmail && <><br />{sale.customerEmail}</>}
                  {sale.customerId && sale.customerCompany && <><br />{sale.customerCompany}</>}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8", marginBottom: 6 }}>Sold By</div>
                <div style={{ fontSize: 13, color: "#334155" }}>{sale.soldByEmail || "–"}</div>
              </div>
            </div>

            {/* Items table */}
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
              <thead>
                <tr style={{ background: "#f1f5f9" }}>
                  <th style={th}>Item</th>
                  <th style={th}>SKU</th>
                  <th style={thR}>Qty</th>
                  <th style={thR}>Unit Price</th>
                  <th style={thR}>Total</th>
                </tr>
              </thead>
              <tbody>
                {saleItems.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ padding: "12px", borderBottom: "1px solid #e2e8f0", fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{item.itemName}</td>
                    <td style={{ padding: "12px", borderBottom: "1px solid #e2e8f0", fontSize: 12, color: "#64748b" }}>{item.sku}</td>
                    <td style={{ padding: "12px", borderBottom: "1px solid #e2e8f0", fontSize: 13, textAlign: "right", color: "#334155" }}>{item.quantitySold}</td>
                    <td style={{ padding: "12px", borderBottom: "1px solid #e2e8f0", fontSize: 13, textAlign: "right", color: "#334155" }}>{fc(item.unitPrice)}</td>
                    <td style={{ padding: "12px", borderBottom: "1px solid #e2e8f0", fontSize: 13, textAlign: "right", fontWeight: 600, color: "#334155" }}>{fc(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 36, position: "relative", zIndex: 10 }}>
              <div style={{ width: 320 }}>
                {/* Returns summary if any */}
                {sale.returnedItems && sale.returnedItems.length > 0 && (
                  <div style={{ marginBottom: 16, padding: "12px", background: "#fffbeb", borderRadius: "8px", border: "1px solid #fde68a" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#d97706", marginBottom: 6, textTransform: "uppercase" }}>Returned Items Summary</div>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <tbody>
                        {sale.returnedItems.map((ri, idx) => (
                          <tr key={idx}>
                            <td style={{ padding: "2px 0", fontSize: 12, color: "#92400e" }}>{ri.itemName}</td>
                            <td style={{ padding: "2px 0", fontSize: 12, color: "#92400e", textAlign: "right", fontWeight: 600 }}>Qty: {ri.returnedQty}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div style={{ width: 280 }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13, color: "#64748b" }}>
                  <span>Subtotal</span><span>{fc(subtotal)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13, color: discPct > 0 ? "#d97706" : "#94a3b8" }}>
                  <span>Discount {discPct > 0 ? `(${discPct}%)` : ""}</span>
                  <span>{discPct > 0 ? `− ${fc(discAmt)}` : "—"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderTop: "2px solid #e2e8f0", paddingTop: 10, marginTop: 4, fontSize: 16, fontWeight: 800, color: "#0f172a" }}>
                  <span>{sale.status === "partially_returned" || sale.status === "returned" ? "Original Total" : "Total"}</span>
                  <span style={{ color: sale.status === "cancelled" ? "#ef4444" : "#16a34a", textDecoration: sale.status === "cancelled" ? "line-through" : "none" }}>{fc(finalTotal)}</span>
                </div>
                {(sale.status === "returned" || sale.status === "partially_returned") && (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13, color: "#ef4444", marginTop: 4 }}>
                      <span>Refund Amount</span><span>− {fc(sale.refundAmount)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", borderTop: "2px solid #e2e8f0", paddingTop: 10, marginTop: 4, fontSize: 16, fontWeight: 800, color: "#0f172a" }}>
                      <span>Final Total</span><span style={{ color: "#16a34a" }}>{fc(sale.finalTotalAfterReturn)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div style={{ textAlign: "center", fontSize: 11, color: "#94a3b8" }}>
              Thank you for your business. This invoice was generated by SABA Secure App.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
