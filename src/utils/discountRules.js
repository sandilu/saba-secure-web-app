// src/utils/discountRules.js
// Smart discount suggestion for SABA Secure App.
//
// ELIGIBILITY RULES (final, corrected):
//   Spending milestone → based on currentSaleSubtotal ONLY (not projected lifetime total)
//     >= Rs. 250,000  → 10% Premium Customer Discount
//     >= Rs. 100,000  → 5%  High Value Discount
//   Loyalty milestone → based on previousPurchaseCount ONLY (current sale excluded)
//     >= 5 purchases  → 5%  Loyalty Discount
//
//   Best eligible discount wins. No stacking.
//   Never auto-apply — user must click Apply.
//
// projectedTotal (prevSpent + currentSubtotal) is used ONLY for:
//   • Display ("customer lifetime spending after this sale")
//   • Future eligibility messages
//   • Progress bars

/**
 * @param {object} p
 * @param {number} p.purchaseCount     Previous completed purchases (not counting current sale)
 * @param {number} p.totalSpent        Previous total Rs spent (not counting current sale)
 * @param {number} [p.currentSubtotal] This sale's subtotal = unitPrice × qty
 * @returns {DiscountInfo}
 */
export function getSmartDiscount({ purchaseCount, totalSpent, currentSubtotal = 0 }) {
  const prevCount = Math.max(0, Number(purchaseCount   || 0));
  const prevSpent = Math.max(0, Number(totalSpent      || 0));
  const curSub    = Math.max(0, Number(currentSubtotal || 0));
  const projected = prevSpent + curSub;         // lifetime display only

  // ── Spending milestone eligibility (currentSaleSubtotal only) ─────────────
  const saleIsPremium  = curSub >= 250_000;     // this one sale alone >= 250k
  const saleIsHighVal  = curSub >= 100_000;     // this one sale alone >= 100k

  // ── Loyalty eligibility (previous purchases only) ─────────────────────────
  const isLoyal = prevCount >= 5;

  // ── Best eligible discount (no stacking) ─────────────────────────────────
  let suggestedDiscountPercent = 0;
  let discountName             = "";
  let reason                   = "";
  let eligibleNow              = false;

  // 1. Highest tier: 10% Premium (current sale ONLY)
  if (saleIsPremium) {
    suggestedDiscountPercent = 10;
    discountName = "Premium Customer Discount";
    reason = `This sale subtotal is ${fmtRs(curSub)}, crossing the Rs. 250k premium threshold.`;
    eligibleNow = true;
  }
  // 2. Middle tier: 5% High Value (current sale ONLY)
  else if (saleIsHighVal) {
    suggestedDiscountPercent = 5;
    discountName = "High Value Discount";
    reason = `This sale subtotal is ${fmtRs(curSub)}, crossing the Rs. 100k high-value threshold.`;
    eligibleNow = true;
  }
  // 3. Middle tier alternative: 5% Loyalty (purchases count)
  else if (isLoyal) {
    suggestedDiscountPercent = 5;
    discountName = "Loyalty Discount";
    reason = `Customer has completed ${prevCount} previous purchases (loyalty milestone: 5+ purchases).`;
    eligibleNow = true;
  }

  // ── "How close is THIS SALE to next spending milestone" ──────────────────
  // Used for "Rs. X more in this sale needed" messages
  const saleNeededFor100k  = Math.max(0, 100_000  - curSub);
  const saleNeededFor250k  = Math.max(0, 250_000  - curSub);

  // ── Loyalty milestone progress ────────────────────────────────────────────
  const loyaltyProgress = {
    prevCount,
    neededForLoyalty:   Math.max(0, 5 - prevCount),
    reached:            isLoyal,
    willReachAfterSale: !isLoyal && prevCount + 1 >= 5,
  };

  // ── Future eligibility messages (projected lifetime) ─────────────────────
  const futureMessages = [];
  if (curSub > 0) {
    if (!saleIsPremium && projected >= 250_000 && prevSpent < 250_000) {
      futureMessages.push(
        `After this sale, projected lifetime spending becomes ${fmtRs(projected)}, crossing the Rs. 250,000 milestone — 10% Premium Discount will apply on a future purchase.`
      );
    } else if (!saleIsHighVal && !saleIsPremium && projected >= 100_000 && prevSpent < 100_000) {
      futureMessages.push(
        `After this sale, projected lifetime spending becomes ${fmtRs(projected)}, crossing the Rs. 100,000 milestone — 5% High Value Discount will apply on a future purchase.`
      );
    }
    if (!isLoyal && loyaltyProgress.willReachAfterSale) {
      futureMessages.push(
        `After this sale, purchase count becomes ${prevCount + 1} — 5% Loyalty Discount will apply on future purchases.`
      );
    }
  }

  return {
    // Eligibility for this sale
    eligibleNow,
    suggestedDiscountPercent,
    discountName,
    reason,

    // Flags
    saleIsPremium,
    saleIsHighVal,
    isLoyal,

    // Customer snapshot
    previousPurchaseCount:    prevCount,
    previousTotalSpent:       prevSpent,
    currentSubtotal:          curSub,
    projectedTotalAfterSale:  projected,

    // "How far is this sale from spending milestone"
    saleNeededFor100k,
    saleNeededFor250k,

    // Loyalty
    loyaltyProgress,

    // Future messages
    futureMessages,
  };
}

function fmtRs(v) {
  return `Rs. ${Number(v || 0).toLocaleString()}`;
}
