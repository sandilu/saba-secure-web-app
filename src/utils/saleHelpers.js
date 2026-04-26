// src/utils/saleHelpers.js
// Backward-compatible helpers for old single-item and new multi-item sale formats.

/** Safely extract items array from ANY sale format */
export function getSaleItems(sale) {
  if (!sale) return [];

  // New multi-item format: sale.items is an array
  let arr = sale.items;

  // Firestore sometimes returns arrays as plain objects keyed by index — handle that
  if (arr && !Array.isArray(arr) && typeof arr === "object") {
    arr = Object.values(arr);
  }

  if (Array.isArray(arr) && arr.length > 0) {
    return arr.map((i) => ({
      itemId:       i.itemId       || "",
      itemName:     i.itemName     || i.name || "Item",
      sku:          i.sku          || "",
      quantitySold: Number(i.quantitySold || i.qty || 0),
      unitPrice:    Number(i.unitPrice    || i.price || 0),
      buyingPrice:  Number(i.buyingPrice  || 0),
      lineTotal:    Number(i.lineTotal    || i.total || 0),
      lineProfit:   Number(i.lineProfit   || i.profit || 0),
    }));
  }

  // Old single-item format: fields directly on sale document
  if (sale.itemId || sale.itemName) {
    const qty   = Number(sale.quantitySold || 0);
    const price = Number(sale.unitPrice    || 0);
    return [{
      itemId:       sale.itemId    || "",
      itemName:     sale.itemName  || sale.name || "Unknown Item",
      sku:          sale.sku       || "",
      quantitySold: qty,
      unitPrice:    price,
      buyingPrice:  Number(sale.buyingPrice || 0),
      lineTotal:    Number(sale.subtotal || sale.totalPrice || sale.finalTotal || qty * price || 0),
      lineProfit:   Number(sale.profit   || 0),
    }];
  }

  return [];
}

/** Returns "Item A ×2, Item B ×1" — never blank */
export function getSaleItemSummary(sale, maxShow = 3) {
  const items = getSaleItems(sale);
  if (!items.length) return sale?.invoiceNumber ? `Invoice ${sale.invoiceNumber}` : "Sale Record";
  const shown = items.slice(0, maxShow).map((i) => `${i.itemName} ×${i.quantitySold}`);
  const extra = items.length - maxShow;
  return extra > 0 ? `${shown.join(", ")} +${extra} more` : shown.join(", ");
}

/** Returns "SKU-001, SKU-002" */
export function getSaleSkuSummary(sale, maxShow = 3) {
  const items = getSaleItems(sale);
  const skus  = items.map((i) => i.sku).filter(Boolean);
  if (!skus.length) return "—";
  const shown = skus.slice(0, maxShow);
  const extra = skus.length - maxShow;
  return extra > 0 ? `${shown.join(", ")} +${extra}` : shown.join(", ");
}

/** Total units across all items */
export function getSaleQuantity(sale) {
  if (!sale) return 0;
  if (typeof sale.totalQuantity === "number" && sale.totalQuantity > 0) return sale.totalQuantity;
  const items = getSaleItems(sale);
  if (items.length > 0) return items.reduce((s, i) => s + Number(i.quantitySold || 0), 0);
  return Number(sale.quantitySold || 0);
}

/** Subtotal before discount */
export function getSaleSubtotal(sale) {
  if (!sale) return 0;
  if (typeof sale.subtotal === "number")             return sale.subtotal;
  if (typeof sale.totalBeforeDiscount === "number")  return sale.totalBeforeDiscount;
  const items = getSaleItems(sale);
  if (items.length > 0) return items.reduce((s, i) => s + Number(i.lineTotal || 0), 0);
  return Number(sale.totalPrice || 0);
}

/** Final total after discount */
export function getSaleTotal(sale) {
  if (!sale) return 0;
  return Number(sale.finalTotal || sale.totalAfterDiscount || sale.totalPrice || getSaleSubtotal(sale) || 0);
}

/** Profit from the sale */
export function getSaleProfit(sale) {
  if (!sale) return 0;
  if (typeof sale.totalProfit === "number") return sale.totalProfit;
  return Number(sale.profit || 0);
}

/** "5% − Rs. 5,190" or "—" */
export function getSaleDiscountText(sale) {
  if (!sale) return "—";
  const pct = Number(sale.discountPercent || 0);
  const amt = Number(sale.discountAmount  || 0);
  if (pct <= 0 && amt <= 0) return "—";
  const amtStr = `Rs. ${amt.toLocaleString()}`;
  return pct > 0 ? `${pct}% − ${amtStr}` : `− ${amtStr}`;
}

export function generateInvoiceNumber() {
  const ts   = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `INV-${ts}-${rand}`;
}
