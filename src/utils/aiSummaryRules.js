// src/utils/aiSummaryRules.js
// Rule-based AI-style business summary generator.
// Pure function — no Firestore, no side effects, no external APIs.
// Works entirely from data already fetched from Firestore.

import { getSaleItems, getSaleTotal, getSaleSubtotal, getSaleProfit } from "./saleHelpers";

// ─── helpers ──────────────────────────────────────────────────────────────────

const fc = (v) => `Rs. ${Number(v || 0).toLocaleString()}`;

function resolveStatus(sale) {
  return String(sale.status || "completed").toLowerCase().trim();
}

/** Return a safe, non-empty string, or fallback. */
function safeText(value, fallback = "N/A") {
  if (value === undefined || value === null) return fallback;
  const s = String(value).trim();
  if (s === "" || s === "undefined" || s === "null") return fallback;
  return s;
}

/** Resolve the best display name for an inventory / sale-line item. */
function getItemName(item) {
  if (!item) return "Unknown Item";
  return safeText(
    item.itemName ?? item.name ?? item.title ?? item.productName ??
    item.item ?? item.description ?? item.sku ?? item.SKU ?? item.id,
    "Unknown Item"
  );
}

/** Resolve the best SKU/code for an inventory / sale-line item. */
function getSku(item) {
  if (!item) return "N/A";
  return safeText(
    item.sku ?? item.SKU ?? item.itemSku ?? item.code ?? item.id,
    "N/A"
  );
}

/** Safely convert to a finite number, or return fallback. */
function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Format a number as Sri Lankan Rupees. */
function formatCurrency(value) {
  return `Rs. ${toNumber(value).toLocaleString()}`;
}

// ─── generateBusinessSummary ──────────────────────────────────────────────────

/**
 * Analyse live Firestore data and return a structured business summary
 * that looks and reads like an AI assistant output.
 *
 * @param {Object} param0
 * @param {Array}  param0.sales         - raw sale documents
 * @param {Array}  param0.inventory     - raw inventoryItems documents
 * @param {Array}  param0.customers     - raw customers documents
 * @param {Array}  param0.suppliers     - raw suppliers documents
 * @param {Array}  param0.notifications - raw notifications documents
 * @param {Array}  param0.anomalies     - raw anomalyAlerts documents
 *
 * @returns {{
 *   healthScore: number,
 *   statusLabel: string,
 *   summaryText: string,
 *   keyInsights: Array<{title:string, message:string, type:string}>,
 *   risks: Array<{title:string, message:string, severity:string}>,
 *   recommendedActions: Array<{title:string, message:string, priority:string}>
 * }}
 */
export function generateBusinessSummary({
  sales        = [],
  inventory    = [],
  customers    = [],
  suppliers    = [],
  notifications = [],
  anomalies    = [],
} = {}) {

  // ── 1. Sales stats ──────────────────────────────────────────────────────────
  let totalRevenue    = 0;
  let totalProfit     = 0;
  let totalUnitsSold  = 0;
  let totalSalesCount = 0;
  let cancelledCount  = 0;
  let returnedCount   = 0;
  let discountedCount = 0;

  const itemSalesMap = {}; // itemId → { itemName, totalUnits, totalRevenue, totalProfit }

  for (const sale of sales) {
    const status = resolveStatus(sale);
    if (status === "cancelled") { cancelledCount++; continue; }
    if (status === "returned")  { returnedCount++;  continue; }
    if (status === "partially_returned") { returnedCount++; /* still counts revenue below */ }

    totalSalesCount++;
    const saleTotal = getSaleTotal(sale);
    const refund    = Number(sale.refundAmount || 0);
    totalRevenue   += (saleTotal - refund);
    totalProfit    += getSaleProfit(sale);

    if (Number(sale.discountPercent || 0) > 0) discountedCount++;

    const items = getSaleItems(sale);
    for (const item of items) {
      const qty = Number(item.quantitySold || 0);
      const retQty = Number(
        (sale.returnedItems || []).find((r) => r.itemId === item.itemId)?.returnedQty || 0
      );
      const effectiveQty = Math.max(0, qty - retQty);
      totalUnitsSold += effectiveQty;

      const key = item.itemId || item.sku || item.itemName || "unknown";
      if (!itemSalesMap[key]) {
        itemSalesMap[key] = {
          itemId:       item.itemId || "",
          itemName:     item.itemName || "Unknown Item",
          sku:          item.sku || "",
          totalUnits:   0,
          totalRevenue: 0,
          totalProfit:  0,
        };
      }
      itemSalesMap[key].totalUnits   += effectiveQty;
      itemSalesMap[key].totalRevenue += Number(item.unitPrice || 0) * effectiveQty;
      itemSalesMap[key].totalProfit  +=
        (effectiveQty > 0 && qty > 0)
          ? (Number(item.lineProfit || 0) / qty) * effectiveQty
          : 0;
    }
  }

  const sortedItems    = Object.values(itemSalesMap).sort((a, b) => b.totalUnits - a.totalUnits);
  const topSeller      = sortedItems[0] || null;
  const topProfitable  = [...sortedItems].sort((a, b) => b.totalProfit - a.totalProfit)[0] || null;

  // ── 2. Inventory stats ──────────────────────────────────────────────────────
  const lowStockItems   = inventory.filter(
    (it) => Number(it.quantity || 0) <= Number(it.minStockLevel || 0) && Number(it.quantity || 0) > 0
  );
  const outOfStockItems = inventory.filter((it) => Number(it.quantity || 0) <= 0);
  const soldSkus        = new Set(Object.values(itemSalesMap).map((e) => e.sku).filter(Boolean));
  const deadStockItems  = inventory.filter(
    (it) => it.sku && !soldSkus.has(it.sku) && Number(it.quantity || 0) > 0
  );

  // ── 3. Customer stats ───────────────────────────────────────────────────────
  const customerSpendMap = {};
  const customerPurchaseMap = {};
  for (const sale of sales) {
    if (!sale.customerId) continue;
    const status = resolveStatus(sale);
    if (status === "cancelled") continue;
    const spend = getSaleTotal(sale) - Number(sale.refundAmount || 0);
    customerSpendMap[sale.customerId]    = (customerSpendMap[sale.customerId]    || 0) + spend;
    customerPurchaseMap[sale.customerId] = (customerPurchaseMap[sale.customerId] || 0) + 1;
  }

  const enrichedCustomers = customers.map((c) => ({
    ...c,
    computedSpent:    customerSpendMap[c.id]    || 0,
    computedPurchases: customerPurchaseMap[c.id] || 0,
  }));

  const highValueCustomers = enrichedCustomers.filter((c) => c.computedSpent >= 100_000);
  const loyalCustomers     = enrichedCustomers.filter((c) => c.computedPurchases >= 5);
  const topCustomer        = enrichedCustomers.sort((a, b) => b.computedSpent - a.computedSpent)[0] || null;

  // ── 4. Anomaly stats ────────────────────────────────────────────────────────
  const highSeverityAnomalies   = anomalies.filter((a) => a.severity === "high");
  const mediumSeverityAnomalies = anomalies.filter((a) => a.severity === "medium");
  const highDiscountAnomalies   = anomalies.filter((a) => a.type === "high_discount");
  const largeSaleAnomalies      = anomalies.filter((a) => a.type === "large_sale");
  const cancellationAnomalies   = anomalies.filter((a) => a.type === "repeated_cancellations");
  const returnAnomalies         = anomalies.filter((a) => a.type === "repeated_returns");

  // ── 5. Supplier mapping ─────────────────────────────────────────────────────
  // Link low-stock items to suppliers by name
  const lowStockWithSupplier = lowStockItems
    .filter((it) => it.supplier || it.supplierName)
    .map((it) => {
      const supplierName = it.supplierName || it.supplier || "";
      const matched = suppliers.find(
        (s) => s.name?.toLowerCase() === supplierName.toLowerCase()
      );
      return { item: it, supplier: matched || null, supplierName };
    });

  // ── 6. Health score ─────────────────────────────────────────────────────────
  let healthScore = 100;
  if (lowStockItems.length > 0)           healthScore -= 10;
  if (outOfStockItems.length > 0)         healthScore -= 15;
  if (highSeverityAnomalies.length > 0)   healthScore -= 10;
  if (mediumSeverityAnomalies.length > 0) healthScore -= 5;
  if (cancelledCount + returnedCount >= 3) healthScore -= 10;
  if (deadStockItems.length > 0)          healthScore -= 5;
  healthScore = Math.max(0, healthScore);

  const statusLabel =
    healthScore >= 80 ? "Healthy" :
    healthScore >= 50 ? "Needs Attention" :
                        "High Risk";

  // ── 7. Summary text ─────────────────────────────────────────────────────────
  const focusItems = [
    lowStockItems.length > 0     ? "restocking low-inventory items"           : null,
    outOfStockItems.length > 0   ? "urgently replenishing out-of-stock items" : null,
    highSeverityAnomalies.length > 0 ? "reviewing high-severity anomaly alerts"  : null,
    cancelledCount >= 3          ? "investigating the elevated cancellation rate" : null,
    deadStockItems.length > 0    ? "clearing or promoting dead-stock items"   : null,
    highValueCustomers.length > 0 ? "retaining high-value customers"          : null,
  ].filter(Boolean);

  const focusSentence = focusItems.length > 0
    ? `Recommended focus areas: ${focusItems.join(", ")}.`
    : "The business is operating smoothly with no immediate action required.";

  const summaryText =
    `The business is currently in ${statusLabel} condition with ${fc(totalRevenue)} in net revenue ` +
    `and an estimated profit of ${fc(totalProfit)}. ` +
    `The system recorded ${totalSalesCount} completed sale${totalSalesCount !== 1 ? "s" : ""} ` +
    `totalling ${totalUnitsSold} unit${totalUnitsSold !== 1 ? "s" : ""} sold. ` +
    (cancelledCount > 0 ? `There ${cancelledCount === 1 ? "was" : "were"} ${cancelledCount} cancelled sale${cancelledCount !== 1 ? "s" : ""}. ` : "") +
    (lowStockItems.length > 0
      ? `${lowStockItems.length} inventory item${lowStockItems.length !== 1 ? "s are" : " is"} at or below minimum stock level. `
      : "All inventory items are above minimum stock levels. ") +
    (outOfStockItems.length > 0
      ? `${outOfStockItems.length} item${outOfStockItems.length !== 1 ? "s are" : " is"} completely out of stock. `
      : "") +
    (anomalies.length > 0
      ? `${anomalies.length} anomaly alert${anomalies.length !== 1 ? "s" : ""} ` +
        `(${highSeverityAnomalies.length} high-severity) require${anomalies.length === 1 ? "s" : ""} attention. `
      : "No anomaly alerts detected. ") +
    (topCustomer && topCustomer.computedSpent > 0
      ? `Top customer: ${topCustomer.name || topCustomer.email || "N/A"} (${fc(topCustomer.computedSpent)} lifetime spend). `
      : "") +
    (topSeller
      ? `Best-performing product: ${topSeller.itemName} (${topSeller.totalUnits} units sold). `
      : "") +
    focusSentence;

  // ── 8. Key Insights ─────────────────────────────────────────────────────────
  const keyInsights = [];

  if (totalSalesCount === 0) {
    keyInsights.push({
      title:   "No Sales Recorded",
      message: "No completed sales found in the current dataset. Create your first sale to start seeing business insights.",
      type:    "info",
    });
  } else {
    if (topSeller) {
      keyInsights.push({
        title:   `Top Seller: ${topSeller.itemName}`,
        message: `${topSeller.itemName} leads with ${topSeller.totalUnits} units sold and ${fc(topSeller.totalRevenue)} in revenue. Consider ensuring adequate stock levels.`,
        type:    "success",
      });
    }
    if (topProfitable && topProfitable.totalProfit > 0) {
      keyInsights.push({
        title:   `High-Margin Product: ${topProfitable.itemName}`,
        message: `${topProfitable.itemName} generated ${fc(topProfitable.totalProfit)} in estimated profit. Prioritise promotion and stock availability.`,
        type:    "success",
      });
    }
    if (discountedCount > 0) {
      const discountRate = Math.round((discountedCount / totalSalesCount) * 100);
      keyInsights.push({
        title:   `Discount Usage: ${discountRate}% of Sales`,
        message: `${discountedCount} out of ${totalSalesCount} sales used a discount. ${discountRate > 30 ? "High discount frequency may indicate pricing pressure." : "Discount usage appears within normal range."}`,
        type:    discountRate > 30 ? "warning" : "info",
      });
    }
    if (highValueCustomers.length > 0) {
      keyInsights.push({
        title:   `${highValueCustomers.length} High-Value Customer${highValueCustomers.length > 1 ? "s" : ""} Detected`,
        message: `${highValueCustomers.length} customer${highValueCustomers.length > 1 ? "s have" : " has"} spent Rs. 100,000 or more. These accounts drive significant revenue and deserve priority attention.`,
        type:    "success",
      });
    }
    if (loyalCustomers.length > 0) {
      keyInsights.push({
        title:   `${loyalCustomers.length} Loyal Customer${loyalCustomers.length > 1 ? "s" : ""}`,
        message: `${loyalCustomers.length} customer${loyalCustomers.length > 1 ? "s have" : " has"} made 5+ purchases. Loyalty rewards and personalised offers can strengthen retention.`,
        type:    "success",
      });
    }
    if (topCustomer && topCustomer.computedSpent > 0) {
      keyInsights.push({
        title:   `Top Customer: ${topCustomer.name || "Unknown"}`,
        message: `${topCustomer.name || topCustomer.email || "Top customer"} has spent ${fc(topCustomer.computedSpent)} total across ${topCustomer.computedPurchases} purchase${topCustomer.computedPurchases !== 1 ? "s" : ""}.`,
        type:    "info",
      });
    }
  }

  if (inventory.length === 0) {
    keyInsights.push({
      title:   "No Inventory Data",
      message: "No inventory items found. Add items to the inventory module to enable stock and reorder analysis.",
      type:    "warning",
    });
  } else if (lowStockItems.length === 0 && outOfStockItems.length === 0) {
    keyInsights.push({
      title:   "Stock Levels Healthy",
      message: `All ${inventory.length} inventory items are above their minimum stock thresholds. No restocking required at this time.`,
      type:    "success",
    });
  }

  if (anomalies.length === 0 && totalSalesCount > 0) {
    keyInsights.push({
      title:   "No Anomalies Detected",
      message: "All recent sales, returns, and admin actions passed anomaly checks. The system is operating within normal parameters.",
      type:    "success",
    });
  }

  // ── 9. Risks ────────────────────────────────────────────────────────────────
  const risks = [];

  if (outOfStockItems.length > 0) {
    const names = outOfStockItems.slice(0, 3).map((it) => getItemName(it)).join(", ");
    risks.push({
      title:    `Out of Stock: ${outOfStockItems.length} Item${outOfStockItems.length > 1 ? "s" : ""}`,
      message:  `${names}${outOfStockItems.length > 3 ? ` and ${outOfStockItems.length - 3} more` : ""} are completely out of stock. Sales may be lost until replenished.`,
      severity: "high",
    });
  }

  if (lowStockItems.length > 0) {
    const names = lowStockItems.slice(0, 3).map((it) => getItemName(it)).join(", ");
    risks.push({
      title:    `Low Stock: ${lowStockItems.length} Item${lowStockItems.length > 1 ? "s" : ""}`,
      message:  `${names}${lowStockItems.length > 3 ? ` and ${lowStockItems.length - 3} more` : ""} are at or below minimum stock level. Reorder soon to avoid stockouts.`,
      severity: "medium",
    });
  }

  if (highSeverityAnomalies.length > 0) {
    risks.push({
      title:    `${highSeverityAnomalies.length} High-Severity Anomaly Alert${highSeverityAnomalies.length > 1 ? "s" : ""}`,
      message:  `High-severity anomalies detected: ${[...new Set(highSeverityAnomalies.map((a) => a.title))].slice(0, 3).join(", ")}. Immediate review recommended.`,
      severity: "high",
    });
  }

  if (highDiscountAnomalies.length > 0) {
    risks.push({
      title:    `High Discount Anomaly (${highDiscountAnomalies.length})`,
      message:  `${highDiscountAnomalies.length} sale${highDiscountAnomalies.length > 1 ? "s" : ""} triggered high-discount alerts (≥15%). Manual discounts at this level may reduce profitability.`,
      severity: "medium",
    });
  }

  if (largeSaleAnomalies.length > 0) {
    risks.push({
      title:    `Large Sale Anomaly (${largeSaleAnomalies.length})`,
      message:  `${largeSaleAnomalies.length} sale${largeSaleAnomalies.length > 1 ? "s" : ""} exceeded Rs. 100,000. These warrant verification to ensure proper authorisation.`,
      severity: "medium",
    });
  }

  if (cancelledCount + returnedCount >= 3) {
    risks.push({
      title:    "High Cancellation / Return Rate",
      message:  `${cancelledCount} cancellation${cancelledCount !== 1 ? "s" : ""} and ${returnedCount} return${returnedCount !== 1 ? "s" : ""} detected. A rising rate may indicate product quality, pricing, or fulfilment issues.`,
      severity: cancelledCount + returnedCount >= 6 ? "high" : "medium",
    });
  }

  if (deadStockItems.length > 0) {
    risks.push({
      title:    `Dead Stock: ${deadStockItems.length} Item${deadStockItems.length > 1 ? "s" : ""}`,
      message:  `${deadStockItems.length} item${deadStockItems.length > 1 ? "s have" : " has"} stock on hand but no recorded sales. Capital is tied up in slow-moving inventory.`,
      severity: "medium",
    });
  }

  if (risks.length === 0) {
    risks.push({
      title:    "No Major Risks Detected",
      message:  "The system found no critical risks. Continue monitoring stock levels, anomaly alerts, and customer activity regularly.",
      severity: "low",
    });
  }

  // ── 10. Recommended Actions ─────────────────────────────────────────────────
  const recommendedActions = [];

  // Out-of-stock reorders take highest priority
  for (const it of outOfStockItems.slice(0, 2)) {
    const lsw = lowStockWithSupplier.find((x) => x.item.id === it.id);
    const supplierHint = lsw?.supplierName ? ` Contact ${safeText(lsw.supplierName)}.` : "";
    const itemName = getItemName(it);
    const itemSku  = getSku(it);
    recommendedActions.push({
      title:    `Reorder ${itemName}`,
      message:  `${itemName} (SKU: ${itemSku}) is completely out of stock.${supplierHint} Place a restock order immediately.`,
      priority: "high",
    });
  }

  // Low-stock reorders
  for (const it of lowStockItems.slice(0, 2)) {
    const lsw = lowStockWithSupplier.find((x) => x.item.id === it.id);
    const supplierHint = lsw?.supplierName ? ` Supplier: ${safeText(lsw.supplierName)}.` : "";
    const qty = toNumber(it.quantity);
    const minQty = toNumber(it.minStockLevel);
    recommendedActions.push({
      title:    `Restock ${getItemName(it)}`,
      message:  `Only ${qty} unit${qty !== 1 ? "s" : ""} left (min: ${minQty}).${supplierHint}`,
      priority: "high",
    });
  }

  // Supplier follow-up for low-stock items with matched supplier
  const uniqueSuppliers = [...new Map(
    lowStockWithSupplier
      .filter((x) => x.supplier)
      .map((x) => [x.supplier.id, x])
  ).values()].slice(0, 2);

  for (const { supplier, item } of uniqueSuppliers) {
    const supplierName   = safeText(supplier.name, "Supplier");
    const contactPerson  = safeText(supplier.contactPerson, "");
    const phone          = safeText(supplier.phone, "");
    const contactHint    = contactPerson ? `Contact: ${contactPerson}.` : "";
    const phoneHint      = phone ? `Phone: ${phone}.` : "";
    recommendedActions.push({
      title:    `Contact ${supplierName}`,
      message:  `${supplierName} supplies ${getItemName(item)} which is low on stock. ${contactHint} ${phoneHint}`.trim(),
      priority: "medium",
    });
  }

  // High-discount anomaly invoices to review
  for (const a of highDiscountAnomalies.slice(0, 2)) {
    const inv = safeText(a.metadata?.invoiceNumber ?? a.invoiceNumber, "");
    recommendedActions.push({
      title:    `Review ${inv ? `Invoice ${inv}` : "High-Discount Sale"}`,
      message:  `${safeText(a.message, "A high discount was applied to this sale.")} Verify that the discount was properly authorised.`,
      priority: "medium",
    });
  }

  // Reward top customer
  if (topCustomer && topCustomer.computedSpent >= 100_000) {
    const custName = safeText(topCustomer.name ?? topCustomer.email, "Top Customer");
    recommendedActions.push({
      title:    `Reward ${custName}`,
      message:  `${custName} has spent ${fc(topCustomer.computedSpent)}. A personalised discount or loyalty reward can strengthen retention and drive repeat business.`,
      priority: "medium",
    });
  }

  // Promote high-profit item
  if (topProfitable && topProfitable.totalProfit > 0) {
    const profitName = safeText(topProfitable.itemName, "Unknown Item");
    recommendedActions.push({
      title:    `Promote ${profitName}`,
      message:  `${profitName} is your highest-profit product at ${fc(topProfitable.totalProfit)} estimated profit. Feature it prominently and ensure stock is maintained.`,
      priority: "medium",
    });
  }

  // Dead stock action
  for (const it of deadStockItems.slice(0, 2)) {
    const deadName = getItemName(it);
    const deadQty  = toNumber(it.quantity);
    recommendedActions.push({
      title:    `Review Dead Stock: ${deadName}`,
      message:  `${deadName} (${deadQty} units) has not been sold. Consider discounting, bundling with popular items, or returning it to the supplier.`,
      priority: "low",
    });
  }

  // Repeated cancellations anomaly
  if (cancellationAnomalies.length > 0) {
    recommendedActions.push({
      title:    "Investigate Repeated Cancellations",
      message:  "Multiple sale cancellations have been flagged. Review the cancelled invoices to identify root causes such as pricing issues, stock shortages, or payment failures.",
      priority: "high",
    });
  }

  if (recommendedActions.length === 0) {
    recommendedActions.push({
      title:    "Continue Monitoring",
      message:  "No immediate actions required. Keep tracking sales performance, inventory levels, and customer activity for any emerging patterns.",
      priority: "low",
    });
  }

  // ── Return composite summary ─────────────────────────────────────────────────
  return {
    healthScore,
    statusLabel,
    summaryText,
    keyInsights,
    risks,
    recommendedActions,
    // Derived stats exposed for CSV export
    _stats: {
      totalRevenue,
      totalProfit,
      totalSalesCount,
      totalUnitsSold,
      cancelledCount,
      returnedCount,
      lowStockCount:        lowStockItems.length,
      outOfStockCount:      outOfStockItems.length,
      deadStockCount:       deadStockItems.length,
      highValueCustomers:   highValueCustomers.length,
      loyalCustomers:       loyalCustomers.length,
      totalAnomalies:       anomalies.length,
      highSeverityAnomalies: highSeverityAnomalies.length,
      mediumSeverityAnomalies: mediumSeverityAnomalies.length,
    },
  };
}
