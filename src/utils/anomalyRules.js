// src/utils/anomalyRules.js
// Pure anomaly detection functions — no Firestore, no side effects.
// Supports both old and new sale schemas.

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolve the effective discount percentage from a sale object,
 * supporting all known field name variants.
 *
 * Checks (in priority order):
 *  1. discountPercent
 *  2. manualDiscountPercent
 *  3. Calculated: (discountAmount / subtotal) * 100
 *  4. Calculated: (discountAmount / totalPrice) * 100
 */
function resolveDiscountPercent(sale) {
  // Explicit percent fields
  const dp = Number(sale.discountPercent || sale.manualDiscountPercent || 0);
  if (dp > 0) return dp;

  // Calculate from amount
  const discAmt = Number(sale.discountAmount || 0);
  if (discAmt <= 0) return 0;

  const base = Number(sale.subtotal || sale.totalBeforeDiscount || sale.totalPrice || 0);
  if (base <= 0) return 0;

  return Math.round((discAmt / base) * 10000) / 100; // round to 2 decimal places
}

/**
 * Resolve the effective final total from a sale object.
 */
function resolveFinalTotal(sale) {
  return Number(
    sale.finalTotal ||
    sale.totalAfterDiscount ||
    sale.totalPrice ||
    sale.subtotal ||
    0
  );
}

/**
 * Resolve the effective subtotal (before discount) from a sale object.
 */
function resolveSubtotal(sale) {
  return Number(
    sale.subtotal ||
    sale.totalBeforeDiscount ||
    sale.totalPrice ||
    0
  );
}

// ─── detectHighDiscount ───────────────────────────────────────────────────────

/**
 * Detect a suspiciously high discount.
 * Threshold: discountPercent >= 15 (from any source, calculated or explicit).
 *
 * Note: "suggested" loyalty discounts >= 15% are also flagged because a
 * human approved them — they are still worth auditing.
 */
export function detectHighDiscount(sale) {
  const discPct = resolveDiscountPercent(sale);
  const discAmt = Number(sale.discountAmount || 0);
  const source  = String(sale.discountSource || "manual").toLowerCase();

  // Only skip fully system-generated discounts that the user did NOT apply
  // (none means no discount was chosen — effectively no discount at all)
  if (source === "none" && discPct === 0) return null;

  console.log(`[anomalyRules] detectHighDiscount: discPct=${discPct} source=${source}`);

  if (discPct >= 15) {
    const finalTotal = resolveFinalTotal(sale);
    return {
      type:     "high_discount",
      severity: discPct >= 25 ? "high" : "medium",
      title:    "High Discount Applied",
      message:  `A ${discPct}% discount (${source}) was applied to invoice ${sale.invoiceNumber || "N/A"}, reducing the bill by Rs. ${discAmt.toLocaleString()} to a final total of Rs. ${finalTotal.toLocaleString()}.`,
      metadata: {
        invoiceNumber:   sale.invoiceNumber,
        discountPercent: discPct,
        discountAmount:  discAmt,
        discountSource:  source,
        finalTotal,
        soldByEmail:     sale.soldByEmail,
        customerName:    sale.customerName,
      },
    };
  }
  return null;
}

// ─── detectLargeSale ─────────────────────────────────────────────────────────

/**
 * Detect an unusually large sale.
 * Threshold: finalTotal OR subtotal >= 100,000.
 */
export function detectLargeSale(sale) {
  const finalTotal = resolveFinalTotal(sale);
  const subtotal   = resolveSubtotal(sale);
  const effective  = Math.max(finalTotal, subtotal);

  console.log(`[anomalyRules] detectLargeSale: finalTotal=${finalTotal} subtotal=${subtotal}`);

  if (effective >= 100000) {
    return {
      type:     "large_sale",
      severity: effective >= 500000 ? "high" : "medium",
      title:    "Large Sale Detected",
      message:  `Invoice ${sale.invoiceNumber || "N/A"} recorded a total of Rs. ${effective.toLocaleString()}, which exceeds the Rs. 100,000 threshold.`,
      metadata: {
        invoiceNumber: sale.invoiceNumber,
        finalTotal,
        subtotal,
        customerName:  sale.customerName,
        soldByEmail:   sale.soldByEmail,
        itemCount:     (sale.items || []).length,
      },
    };
  }
  return null;
}

// ─── detectSuddenStockDrop ────────────────────────────────────────────────────

/**
 * Detect a sudden stock drop.
 * Triggers when any item quantity sold >= 20, OR sold >= 50% of pre-sale stock.
 *
 * @param {Object} sale
 * @param {Array}  inventoryItems - current inventory snapshot (post-sale)
 */
export function detectSuddenStockDrop(sale, inventoryItems = []) {
  const items    = sale.items || [];
  const triggers = [];

  for (const si of items) {
    const qtySold = Number(si.quantitySold || si.quantity || 0);

    if (qtySold >= 20) {
      triggers.push({ itemName: si.itemName, qtySold, reason: "large_qty" });
      continue;
    }

    const invItem = inventoryItems.find((inv) => inv.id === si.itemId);
    if (invItem) {
      // Stock BEFORE the sale = current (post-sale) + qty sold
      const stockBefore = Number(invItem.quantity || 0) + qtySold;
      if (stockBefore > 0 && qtySold / stockBefore >= 0.5) {
        triggers.push({ itemName: si.itemName, qtySold, stockBefore, reason: "pct_drop" });
      }
    }
  }

  if (triggers.length > 0) {
    const itemList = triggers.map((t) => `${t.itemName} (×${t.qtySold})`).join(", ");
    return {
      type:     "stock_drop",
      severity: triggers.some((t) => t.qtySold >= 50) ? "high" : "medium",
      title:    "Sudden Stock Drop Detected",
      message:  `Invoice ${sale.invoiceNumber || "N/A"} caused a significant stock reduction: ${itemList}.`,
      metadata: {
        invoiceNumber: sale.invoiceNumber,
        triggers,
        soldByEmail:   sale.soldByEmail,
      },
    };
  }
  return null;
}

// ─── detectRepeatedReturns ────────────────────────────────────────────────────

/**
 * Threshold: 3 or more returned/partially_returned sales in the sample.
 */
export function detectRepeatedReturns(recentSales = []) {
  const returns = recentSales.filter(
    (s) => s.status === "returned" || s.status === "partially_returned"
  );
  if (returns.length >= 3) {
    return {
      type:     "repeated_returns",
      severity: returns.length >= 5 ? "high" : "medium",
      title:    "Repeated Returns Detected",
      message:  `${returns.length} return transaction(s) found in recent records. This may indicate product quality issues or a fraudulent return pattern.`,
      metadata: {
        returnCount: returns.length,
        invoices:    returns.map((s) => s.invoiceNumber || s.id).slice(0, 5),
      },
    };
  }
  return null;
}

// ─── detectRepeatedCancellations ──────────────────────────────────────────────

/**
 * Threshold: 3 or more cancelled sales in the sample.
 */
export function detectRepeatedCancellations(recentSales = []) {
  const cancellations = recentSales.filter((s) => s.status === "cancelled");
  console.log(`[anomalyRules] detectRepeatedCancellations: total=${recentSales.length} cancelled=${cancellations.length}`);
  if (cancellations.length >= 3) {
    return {
      type:     "repeated_cancellations",
      severity: cancellations.length >= 5 ? "high" : "medium",
      title:    "Repeated Cancellations Detected",
      message:  `${cancellations.length} sale cancellation(s) found in recent records. This may indicate operational issues or suspicious activity.`,
      metadata: {
        cancellationCount: cancellations.length,
        invoices:          cancellations.map((s) => s.invoiceNumber || s.id).slice(0, 5),
      },
    };
  }
  return null;
}

// ─── detectRiskyAdminActivity ──────────────────────────────────────────────────

const SENSITIVE_ACTIONS = new Set([
  "USER_ROLE_UPDATE",
  "USER_STATUS_UPDATE",
  "INVENTORY_DELETE",
  "DOCUMENT_STATUS_CHANGE",
  "SALE_CANCELLED",
  "SALE_RETURNED",
  "SALE_PARTIALLY_RETURNED",
]);

export function detectRiskyAdminActivity(recentAuditLogs = []) {
  const sensitiveLog = recentAuditLogs.filter((log) => SENSITIVE_ACTIONS.has(log.action));
  if (sensitiveLog.length >= 3) {
    const actionSummary = sensitiveLog.reduce((acc, log) => {
      acc[log.action] = (acc[log.action] || 0) + 1;
      return acc;
    }, {});
    return {
      type:     "risky_admin_activity",
      severity: sensitiveLog.length >= 6 ? "high" : "medium",
      title:    "Risky Admin Activity Detected",
      message:  `${sensitiveLog.length} sensitive admin action(s) recorded recently. A manual review is recommended.`,
      metadata: {
        sensitiveCount: sensitiveLog.length,
        actionSummary,
        performedBy: [...new Set(sensitiveLog.map((l) => l.performedByEmail))].slice(0, 3),
      },
    };
  }
  return null;
}

// ─── composite runners ────────────────────────────────────────────────────────

/**
 * Run all sale-level anomaly checks.
 * Returns an array of anomaly objects (empty if none triggered).
 */
export function runSaleAnomalyChecks({ sale, inventoryItems = [] }) {
  console.log("[anomalyRules] Running sale anomaly checks for invoice:", sale.invoiceNumber,
    "| discountPercent:", sale.discountPercent,
    "| discountSource:", sale.discountSource,
    "| discountAmount:", sale.discountAmount,
    "| subtotal:", sale.subtotal,
    "| finalTotal:", sale.finalTotal);

  const results = [];

  const highDiscount = detectHighDiscount(sale);
  if (highDiscount) {
    console.log("[anomalyRules] ✅ HIGH DISCOUNT anomaly triggered");
    results.push(highDiscount);
  }

  const largeSale = detectLargeSale(sale);
  if (largeSale) {
    console.log("[anomalyRules] ✅ LARGE SALE anomaly triggered");
    results.push(largeSale);
  }

  const stockDrop = detectSuddenStockDrop(sale, inventoryItems);
  if (stockDrop) {
    console.log("[anomalyRules] ✅ STOCK DROP anomaly triggered");
    results.push(stockDrop);
  }

  console.log("[anomalyRules] Sale checks complete —", results.length, "anomaly(ies) found");
  return results;
}

/**
 * Run return/cancellation anomaly checks.
 */
export function runReturnCancelAnomalyChecks({ recentSales = [] }) {
  const results = [];

  const repeatedReturns = detectRepeatedReturns(recentSales);
  if (repeatedReturns) results.push(repeatedReturns);

  const repeatedCancellations = detectRepeatedCancellations(recentSales);
  if (repeatedCancellations) results.push(repeatedCancellations);

  return results;
}

/**
 * Run audit-log anomaly checks.
 */
export function runAuditAnomalyChecks({ auditLogs = [] }) {
  const results = [];

  const riskyAdmin = detectRiskyAdminActivity(auditLogs);
  if (riskyAdmin) results.push(riskyAdmin);

  return results;
}
