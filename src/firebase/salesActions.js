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
          supplierId:   inv.supplierId || "",
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
      status: "completed", // "completed", "cancelled", "returned", "partially_returned"
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
      const { getDoc } = await import("firebase/firestore");
      
      let hint = alert.supplierName ? ` Supplier: ${alert.supplierName}.` : "";
      if (alert.supplierId) {
          const docSnap = await getDoc(doc(db, "suppliers", alert.supplierId));
          if (docSnap.exists()) {
              const sup = docSnap.data();
              if (sup.contactPerson || sup.phone) {
                  hint += ` Contact: ${sup.contactPerson || sup.name} ${sup.phone ? `(${sup.phone})` : ""}.`;
              }
          }
      }

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

/**
 * Cancel a sale entirely:
 * Restores inventory, marks sale as 'cancelled', and logs actions.
 */
export async function cancelSale({ saleId, reason, user }) {
  if (!saleId) throw new Error("Sale ID is required.");
  if (!reason || !reason.trim()) throw new Error("Cancel reason is required.");

  let invoiceNumber = "";
  let refundAmt = 0;

  await runTransaction(db, async (tx) => {
    const saleRef = doc(db, "sales", saleId);
    const saleSnap = await tx.get(saleRef);
    if (!saleSnap.exists()) throw new Error("Sale not found.");
    const sale = saleSnap.data();

    if (sale.status === "cancelled") throw new Error("Sale is already cancelled.");
    if (sale.status === "returned") throw new Error("Sale is fully returned. Cannot cancel.");

    invoiceNumber = sale.invoiceNumber;
    refundAmt = Number(sale.finalTotalAfterReturn ?? sale.finalTotal ?? sale.totalPrice ?? 0);

    const items = sale.items || [];
    
    // Read all inventory items first (transactions require all reads before writes)
    const invRefs = items.map(ci => ({
      ref: doc(db, "inventoryItems", ci.itemId),
      qtyRestored: Number(ci.quantitySold || 0) - Number(
        (sale.returnedItems || []).find(ri => ri.itemId === ci.itemId)?.returnedQty || 0
      )
    }));

    const invSnaps = await Promise.all(invRefs.map(ir => tx.get(ir.ref)));

    // Restore quantities
    for (let i = 0; i < invSnaps.length; i++) {
      const snap = invSnaps[i];
      const ir = invRefs[i];
      if (snap.exists() && ir.qtyRestored > 0) {
        const inv = snap.data();
        tx.update(ir.ref, { 
          quantity: Number(inv.quantity || 0) + ir.qtyRestored,
          updatedAt: serverTimestamp() 
        });
      }
    }

    // Update Sale status
    tx.update(saleRef, {
      status: "cancelled",
      cancelledAt: serverTimestamp(),
      cancelledByUid: user.uid,
      cancelledByEmail: user.email,
      cancelReason: reason.trim()
    });
  });

  // Audit & Notifications
  await logAction("SALE_CANCELLED", user.uid, user.email, { invoiceNumber, reason }, "sale", saleId).catch(() => {});
  
  try {
    const { createNotification } = await import("./notificationActions");
    await createNotification({
      targetRole: "admin",
      title: "Sale Cancelled",
      message: `Invoice ${invoiceNumber} was cancelled by ${user.email}. Inventory restored.`,
      type: "warning",
      targetType: "sale",
      targetId: saleId,
    });
  } catch (err) { console.error("Notification error:", err); }
}

/**
 * Return partial or full quantities of a sale.
 * returnMap: { [itemId]: qtyToReturn }
 */
export async function returnSale({ saleId, returnMap, reason, user }) {
  if (!saleId) throw new Error("Sale ID is required.");
  if (!reason || !reason.trim()) throw new Error("Return reason is required.");
  if (!returnMap || Object.keys(returnMap).length === 0) throw new Error("No items selected for return.");

  let invoiceNumber = "";
  let refundAmt = 0;
  let isFullReturn = false;

  await runTransaction(db, async (tx) => {
    const saleRef = doc(db, "sales", saleId);
    const saleSnap = await tx.get(saleRef);
    if (!saleSnap.exists()) throw new Error("Sale not found.");
    const sale = saleSnap.data();

    if (sale.status === "cancelled") throw new Error("Sale is cancelled. Cannot return.");
    if (sale.status === "returned") throw new Error("Sale is already fully returned.");

    invoiceNumber = sale.invoiceNumber;
    const items = sale.items || [];
    const prevReturned = sale.returnedItems || [];
    const discountPct = Number(sale.discountPercent || 0);

    // Validate and prep returns
    let totalReturnAddedQty = 0;
    const invUpdates = [];
    const newReturnedItems = [...prevReturned];

    for (const itemId of Object.keys(returnMap)) {
      const returningQty = Number(returnMap[itemId]);
      if (returningQty <= 0) continue;

      const soldItem = items.find(i => i.itemId === itemId);
      if (!soldItem) throw new Error("Item not found in sale.");

      const prevRetItem = prevReturned.find(r => r.itemId === itemId);
      const prevQty = prevRetItem ? Number(prevRetItem.returnedQty || 0) : 0;
      const maxCanReturn = Number(soldItem.quantitySold || 0) - prevQty;

      if (returningQty > maxCanReturn) {
        throw new Error(`Cannot return ${returningQty} of ${soldItem.itemName}. Only ${maxCanReturn} remaining.`);
      }

      // Calculate unit refund taking discount into account
      const effectiveUnitPrice = soldItem.unitPrice * (1 - discountPct / 100);
      refundAmt += returningQty * effectiveUnitPrice;
      totalReturnAddedQty += returningQty;

      // Prepare updated returned items array
      if (prevRetItem) {
        prevRetItem.returnedQty += returningQty;
        prevRetItem.returnReason = reason.trim();
        prevRetItem.returnedAt = new Date(); // Stored locally to avoid serverTimestamp arrays
      } else {
        newReturnedItems.push({
          itemId,
          itemName: soldItem.itemName,
          returnedQty: returningQty,
          returnReason: reason.trim(),
          returnedAt: new Date()
        });
      }

      invUpdates.push({ ref: doc(db, "inventoryItems", itemId), addQty: returningQty });
    }

    if (totalReturnAddedQty === 0) throw new Error("Total returned quantity is zero.");

    // Read all inventory items before writing
    const invSnaps = await Promise.all(invUpdates.map(u => tx.get(u.ref)));

    // Restore quantities
    for (let i = 0; i < invSnaps.length; i++) {
      const snap = invSnaps[i];
      const u = invUpdates[i];
      if (snap.exists()) {
        const inv = snap.data();
        tx.update(u.ref, { 
          quantity: Number(inv.quantity || 0) + u.addQty,
          updatedAt: serverTimestamp() 
        });
      }
    }

    // Check if fully returned
    const totalSoldQty = items.reduce((sum, ci) => sum + Number(ci.quantitySold || 0), 0);
    const totalNowReturnedQty = newReturnedItems.reduce((sum, ri) => sum + Number(ri.returnedQty || 0), 0);
    isFullReturn = totalNowReturnedQty >= totalSoldQty;

    const prevRefundAmount = Number(sale.refundAmount || 0);
    const newTotalRefund = prevRefundAmount + refundAmt;
    const finalTotalAfterReturn = Math.max(0, Number(sale.finalTotal || sale.totalPrice || 0) - newTotalRefund);

    // Update Sale
    tx.update(saleRef, {
      status: isFullReturn ? "returned" : "partially_returned",
      returnedItems: newReturnedItems,
      returnedAt: serverTimestamp(),
      returnedByUid: user.uid,
      returnedByEmail: user.email,
      returnReason: reason.trim(),
      refundAmount: newTotalRefund,
      finalTotalAfterReturn
    });
  });

  // Audit & Notifications
  const actionType = isFullReturn ? "SALE_RETURNED" : "SALE_PARTIALLY_RETURNED";
  await logAction(actionType, user.uid, user.email, { invoiceNumber, refundAmount: refundAmt, reason }, "sale", saleId).catch(() => {});
  
  try {
    const { createNotification } = await import("./notificationActions");
    await createNotification({
      targetRole: "admin",
      title: isFullReturn ? "Sale Returned" : "Partial Return",
      message: `Invoice ${invoiceNumber} was ${isFullReturn ? "fully" : "partially"} returned by ${user.email}. Refund: Rs. ${refundAmt.toLocaleString()}`,
      type: "info",
      targetType: "sale",
      targetId: saleId,
    });
  } catch (err) { console.error("Notification error:", err); }
}