/**
 * src/utils/aiForecast.js
 * Rule-based statistical forecasting for sales and inventory.
 * Pure function - no Firestore, no side effects.
 */

import { getSaleItems, getSaleTotal } from "./saleHelpers";

/**
 * Calculates a statistical forecast based on historical sales and inventory data.
 * 
 * @param {Object} param0 
 * @param {Array} param0.sales - raw sales documents
 * @param {Array} param0.inventory - raw inventory documents
 * @returns {Object} Forecast results
 */
export function generateSalesForecast({ sales = [], inventory = [] } = {}) {
  const now = new Date();
  const msInDay = 24 * 60 * 60 * 1000;

  // 1. Filter valid sales (non-cancelled, adjust for returns)
  const validSales = sales.filter(s => {
    const status = String(s.status || "completed").toLowerCase().trim();
    return status !== "cancelled";
  });

  // 2. Identify sales in time buckets for trend analysis
  const sevenDaysAgo = now.getTime() - (7 * msInDay);
  const fourteenDaysAgo = now.getTime() - (14 * msInDay);
  const thirtyDaysAgo = now.getTime() - (30 * msInDay);

  let revenueLast7 = 0;
  let revenuePrev7 = 0;
  let revenueLast30 = 0;
  let itemVelocityLast30 = {}; // (itemId or sku) -> totalQtySold

  validSales.forEach(s => {
    const ts = s.soldAt?.toDate ? s.soldAt.toDate().getTime() : new Date(s.soldAt ?? 0).getTime();
    const total = getSaleTotal(s) - Number(s.refundAmount || 0);

    if (ts >= sevenDaysAgo) {
      revenueLast7 += total;
    } else if (ts >= fourteenDaysAgo && ts < sevenDaysAgo) {
      revenuePrev7 += total;
    }

    if (ts >= thirtyDaysAgo) {
      revenueLast30 += total;
      
      const items = getSaleItems(s);
      items.forEach(item => {
        const qty = Number(item.quantitySold || 0);
        const retQty = Number((s.returnedItems || []).find(r => r.itemId === item.itemId)?.returnedQty || 0);
        const effectiveQty = Math.max(0, qty - retQty);
        
        const key = item.itemId || item.sku;
        if (key) {
          itemVelocityLast30[key] = (itemVelocityLast30[key] || 0) + effectiveQty;
        }
      });
    }
  });

  // 3. Daily Velocity Calculation (based on last 30 days)
  // If we have less than 30 days of data, we still divide by 30 to stay conservative,
  // or we could divide by actual days passed if we knew the store start date.
  const avgDailyRevenue = revenueLast30 / 30;
  const next7DaysRevenue = avgDailyRevenue * 7;
  const next30DaysRevenue = avgDailyRevenue * 30;

  // 4. Trend Determination
  let trend = "Stable";
  if (revenueLast7 > revenuePrev7 * 1.15) trend = "Increasing";
  else if (revenueLast7 < revenuePrev7 * 0.85) trend = "Decreasing";

  // 5. Confidence Score
  let confidence = "Low";
  if (validSales.length >= 30) confidence = "High";
  else if (validSales.length >= 10) confidence = "Medium";

  // 6. Predicted Top Seller
  const topSellingKey = Object.keys(itemVelocityLast30).sort((a, b) => itemVelocityLast30[b] - itemVelocityLast30[a])[0];
  let predictedTopItem = "Insufficient Data";
  if (topSellingKey) {
    const sampleSale = validSales.find(s => getSaleItems(s).some(i => (i.itemId || i.sku) === topSellingKey));
    if (sampleSale) {
      const item = getSaleItems(sampleSale).find(i => (i.itemId || i.sku) === topSellingKey);
      predictedTopItem = item.itemName || item.sku || "Unknown Item";
    }
  }

  // 7. Forecast-based Reorder Risk (Demand velocity vs Current Stock)
  const reorderRisks = inventory.map(item => {
    const key = item.id || item.sku;
    const velocity = (itemVelocityLast30[key] || 0) / 30; // units per day
    const currentQty = Number(item.quantity || 0);
    const minStock = Number(item.minStockLevel || 0);
    
    // Predicted stock in 7 days if velocity continues
    const predictedUsage7 = velocity * 7;
    const predictedStock7 = currentQty - predictedUsage7;
    
    // Risk if predicted stock drops below min stock OR hits zero
    if (velocity > 0 && (predictedStock7 <= minStock)) {
       return {
         id: item.id,
         itemName: item.itemName,
         sku: item.sku,
         currentQty,
         minStock,
         velocity: velocity.toFixed(2),
         predictedStock7: Math.max(0, predictedStock7).toFixed(1),
         risk: predictedStock7 <= 0 ? "Critical" : "High"
       };
    }
    return null;
  }).filter(Boolean).sort((a, b) => (b.risk === "Critical" ? 1 : 0) - (a.risk === "Critical" ? 1 : 0));

  return {
    next7DaysRevenue,
    next30DaysRevenue,
    trend,
    confidence,
    predictedTopItem,
    reorderRisks: reorderRisks.slice(0, 8),
    validSalesCount: validSales.length,
    avgDailyRevenue
  };
}
