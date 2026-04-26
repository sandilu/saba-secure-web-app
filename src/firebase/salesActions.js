// src/firebase/salesActions.js — Multi-item cart sale support
import {
  collection, doc, getDocs, orderBy,
  query, runTransaction, serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebaseServices";
import { logAction } from "./auditLogger";
import { generateInvoiceNumber } from "../utils/saleHelpers";

/**
 * Create a multi-item sale in one atomic Firestore transaction.
 * cartItems = [{ itemId, itemName, sku, quantitySold, unitPrice, buyingPrice }]
 */
export async function createSale({
  cartItems = [],
  soldBy,
  soldByEmail,
  customerId      = null,
  customerName    = "Walk-in Customer",
  customerEmail   = "",
  customerPhone   = "",
  customerCompany = "",
  discountPercent              = 0,
  discountAmount               = 0,
  discountSource               = "none",
  discountReason               = "",
  customerPurchaseCountAtSale  = 0,
  customerTotalSpentBeforeSale = 0,
}) {
  if (!cartItems || cartItems.length === 0) throw new Error("Cart is empty.");

  const invoiceNumber  = generateInvoiceNumber();
  const safeDiscPct    = Math.min(100, Math.max(0, Number(discountPercent || 0)));

  // Prepare item refs
  const itemRefs = cartItems.map((ci) => ({
    ref: doc(db, "inventoryItems", ci.itemId),
    cart: ci,
  }));

  let finalSaleItems = [];
  let subtotal       = 0;
  let totalQuantity  = 0;
  let totalProfit    = 0;
  const lowStockAlerts = [];

  await runTransaction(db, async (tx) => {
    // 1. Read all inventory docs
    const snapshots = await Promise.all(itemRefs.map(({ ref }) => tx.get(ref)));

    // 2. Validate & compute
    finalSaleItems = [];
    subtotal      = 0;
    totalQuantity = 0;
    totalProfit   = 0;

    for (let i = 0; i < snapshots.length; i++) {
      const snap   = snapshots[i];
      const ci     = itemRefs[i].cart;
      const ref    = itemRefs[i].ref;

      if (!snap.exists()) throw new Error(`Item "${ci.itemName}" not found in inventory.`);

      const inv = snap.data();
      const currentQty = Number(inv.quantity    || 0);
      const qtyToSell  = Number(ci.quantitySold || 0);

      if (qtyToSell <= 0)            throw new Error(`Quantity for "${ci.itemName}" must be > 0.`);
      if (currentQty < qtyToSell)    throw new Error(`Not enough stock for "${ci.itemName}". Available: ${currentQty}, requested: ${qtyToSell}.`);

      const unitPrice   = Number(ci.unitPrice   || inv.sellingPrice || 0);
      const buyingPrice = Number(ci.buyingPrice  || inv.buyingPrice  || 0);
      const lineTotal   = unitPrice * qtyToSell;
      const lineProfit  = (unitPrice - buyingPrice) * qtyToSell;
      const updatedQty  = currentQty - qtyToSell;

      finalSaleItems.push({
        itemId:       ci.itemId,
        itemName:     inv.itemName    || ci.itemName || "",
        sku:          inv.sku         || ci.sku      || "",
        quantitySold: qtyToSell,
        unitPrice,
        buyingPrice,
        lineTotal,
        lineProfit,
      });

      subtotal      += lineTotal;
      totalQuantity += qtyToSell;
      totalProfit   += lineProfit;

      // Reduce stock
      tx.update(ref, { quantity: updatedQty, updatedAt: serverTimestamp() });

      // Track low stock
      const minStock = Number(inv.minStockLevel || 0);
      if (updatedQty <= minStock) {
        lowStockAlerts.push({
          itemId:      ci.itemId,
          itemName:    inv.itemName || ci.itemName,
          sku:         inv.sku     || ci.sku,
          updatedQty,
          minStock,
          supplierName: inv.supplierName || inv.supplier || "",
        });
      }
    }

    // 3. Recalculate discount on actual subtotal
    const safeDiscAmt = Math.round((subtotal * safeDiscPct) / 100 * 100) / 100;
    const finalTotal  = Math.max(0, subtotal - safeDiscAmt);
    totalProfit       = totalProfit - safeDiscAmt; // distribute discount from profit

    // 4. Write sale document
    const saleRef = doc(collection(db, "sales"));
    tx.set(saleRef, {
      invoiceNumber,
      items:        finalSaleItems,

      // Totals
      subtotal,
      discountPercent:  safeDiscPct,
      discountAmount:   safeDiscAmt,
      discountSource:   discountSource || "none",
      discountReason:   discountReason || "",
      discountApplied:  safeDiscPct > 0,
      totalBeforeDiscount: subtotal,
      totalAfterDiscount:  finalTotal,
      finalTotal,
      totalQuantity,
      totalProfit,

      // Backward compat
      totalPrice: finalTotal,

      // Customer
      customerId,
      customerName:    customerId ? customerName    : "Walk-in Customer",
      customerEmail:   customerId ? customerEmail   : "",
      customerPhone:   customerId ? customerPhone   : "",
      customerCompany: customerId ? customerCompany : "",
      customerPurchaseCountAtSale:  Number(customerPurchaseCountAtSale  || 0),
      customerTotalSpentBeforeSale: Number(customerTotalSpentBeforeSale || 0),

      soldBy,
      soldByEmail,
      soldAt: serverTimestamp(),
    });
  });

  // Recompute for audit (post-transaction)
  const safeDiscAmt2 = Math.round((subtotal * safeDiscPct) / 100 * 100) / 100;
  const finalTotal2  = Math.max(0, subtotal - safeDiscAmt2);

  // Audit log
  await logAction("SALE_CREATE", soldBy, soldByEmail, {
    invoiceNumber,
    customerName: customerId ? customerName : "Walk-in Customer",
    itemCount:    finalSaleItems.length,
    totalQuantity,
    subtotal,
    discountPercent: safeDiscPct,
    discountAmount:  safeDiscAmt2,
    finalTotal:      finalTotal2,
    discountSource,
    items: finalSaleItems.map((i) => `${i.itemName} ×${i.quantitySold}`).join(", "),
  }, "sale", invoiceNumber).catch(() => {});

  if (customerId) {
    logAction("CUSTOMER_SELECTED_FOR_SALE", soldBy, soldByEmail,
      { customerId, customerName, invoiceNumber }, "sale", customerId
    ).catch(() => {});
  }

  if (safeDiscPct > 0) {
    logAction("DISCOUNT_APPLIED", soldBy, soldByEmail,
      { invoiceNumber, discountPercent: safeDiscPct, discountAmount: safeDiscAmt2, discountSource, discountReason },
      "sale", invoiceNumber
    ).catch(() => {});
  }

  // Low stock notifications
  for (const alert of lowStockAlerts) {
    try {
      const { createNotification } = await import("./notificationActions");
      const hint = alert.supplierName ? ` Supplier: ${alert.supplierName}.` : "";
      await createNotification({
        targetRole: "admin",
        title:   "Low Stock Alert",
        message: `${alert.itemName} (SKU: ${alert.sku}) has ${alert.updatedQty} units remaining — at or below minimum stock level of ${alert.minStock}.${hint}`,
        type:     "warning",
        targetType: "inventory",
        targetId: alert.itemId,
      });
    } catch (err) {
      console.error("Low stock notification failed:", err);
    }
  }

  return { invoiceNumber, finalTotal: finalTotal2, subtotal };
}

export async function getSales() {
  const q = query(collection(db, "sales"), orderBy("soldAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}