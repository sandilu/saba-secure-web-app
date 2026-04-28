import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";

import { db } from "../firebase/firebaseServices";
import { useAuth } from "../auth/AuthContext";
import {
  PageShell,
  Field,
  Input,
  PrimaryButton,
  SecondaryButton,
  Pill,
  Card,
  ConfirmModal,
} from "../ui/Layout";
import { logAction } from "../firebase/auditLogger";
import {
  listenInventoryItems,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
} from "../firebase/inventoryActions";
import { getSales } from "../firebase/salesActions";
import { getSaleItems, getSaleTotal, getSaleQuantity, getSaleItemSummary } from "../utils/saleHelpers";
import { listenNotifications } from "../firebase/notificationActions";
import { listenSuppliers } from "../firebase/supplierActions";
import { listenCustomers } from "../firebase/customerActions";
import BulkImportModal from "../components/BulkImportModal";

const initialForm = {
  itemName: "",
  sku: "",
  category: "",
  quantity: 0,
  minStockLevel: 0,
  buyingPrice: 0,
  sellingPrice: 0,
  supplier: "",
  location: "",
};
// Supplier linking is handled separately via selectedSupplier state

const PIE_COLORS = ["#fb7185", "#818cf8"];

function sanitizeNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatDate(value) {
  if (!value) return "-";
  if (typeof value?.toDate === "function") {
    return value.toDate().toLocaleString();
  }
  return new Date(value).toLocaleString();
}

function formatCurrency(value) {
  return `Rs. ${Number(value || 0).toLocaleString()}`;
}

function truncateLabel(value, max = 12) {
  const text = String(value || "");
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function CustomBarTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0]?.payload || {};
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/95 px-4 py-3 text-sm text-white shadow-xl">
      <div className="font-semibold">{data.fullName || label}</div>
      <div className="mt-1 text-white/75">Units sold: {payload[0]?.value ?? 0}</div>
      <div className="text-white/60">Revenue: {formatCurrency(data.revenue || 0)}</div>
    </div>
  );
}

function CustomLineTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/95 px-4 py-3 text-sm text-white shadow-xl">
      <div className="font-semibold">Date: {label}</div>
      <div className="mt-1 text-white/75">
        Revenue: {formatCurrency(payload[0]?.value || 0)}
      </div>
    </div>
  );
}

function CustomPieTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;

  const item = payload[0];
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/95 px-4 py-3 text-sm text-white shadow-xl">
      <div className="font-semibold">{item.name}</div>
      <div className="mt-1 text-white/75">Count: {item.value}</div>
    </div>
  );
}

function SectionTitle({ eyebrow, title, pill }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-sm text-white/70">{eyebrow}</div>
        <div className="mt-1 text-lg font-semibold text-white">{title}</div>
      </div>
      {pill ? <Pill>{pill}</Pill> : null}
    </div>
  );
}

export default function AdminDashboard() {
  const { user, profile } = useAuth();

  const [activeTab, setActiveTab] = useState("inventory");

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState("add");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");

  const [sales, setSales] = useState([]);
  const [salesLoading, setSalesLoading] = useState(true);

  const [usersList, setUsersList] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [userMsg, setUserMsg] = useState("");
  const [userSearch, setUserSearch] = useState("");

  const [docsList, setDocsList] = useState([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [docMsg, setDocMsg] = useState("");
  const [docBusy, setDocBusy] = useState(false);
  const [docSearch, setDocSearch] = useState("");

  // ─── Confirm modal state ─────────────────────────────────────────────────────
  // Shape: { title, body, variant, requireReason, onConfirm } | null
  const [confirmModal, setConfirmModal] = useState(null);
  function openConfirm(opts) { setConfirmModal(opts); }
  function closeConfirm() { setConfirmModal(null); }

  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [lowStockPreviewAlerts, setLowStockPreviewAlerts] = useState([]);
  const [showBulkImport, setShowBulkImport] = useState(false);

  // Supplier linking state for inventory form
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [supplierSearch, setSupplierSearch] = useState("");

  const [customers, setCustomers] = useState([]);

  useEffect(() => {
    return listenCustomers(
      (data) => setCustomers(data),
      (err)  => console.error("Failed to load customers:", err)
    );
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsub = listenNotifications(
      user.uid,
      profile?.role,
      (data) => {
        setNotifications(data.slice(0, 3)); // Only preview the latest 3
        setNotificationsLoading(false);
      },
      (err) => {
        console.error(err);
        setNotificationsLoading(false);
      }
    );
    return () => unsub();
  }, [user, profile?.role]);

  // Live low-stock alerts for dashboard preview (mirrors NotificationsPage logic)
  useEffect(() => {
    if (!items.length) return;
    const alerts = items
      .filter((it) => String(it.itemName || "").trim() && Number(it.quantity ?? 0) <= Number(it.minStockLevel ?? 0))
      .slice(0, 3)
      .map((it) => ({
        id: `low-stock-${it.id}`,
        title: "Low Stock Alert",
        message: `${it.itemName} (SKU: ${it.sku || "–"}) has ${it.quantity ?? 0} units remaining — at or below min level of ${it.minStockLevel ?? 0}.`,
        isRead: false,
        createdAt: new Date(),
      }));
    setLowStockPreviewAlerts(alerts);
  }, [items]);

  // Load suppliers for inventory form
  useEffect(() => {
    return listenSuppliers(
      (data) => setSuppliers(data),
      (err)  => console.error("Failed to load suppliers:", err)
    );
  }, []);

  useEffect(() => {
    const unsub = listenInventoryItems(
      (data) => {
        setItems(data);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setMsg("Failed to load inventory items.");
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadSales() {
      try {
        const data = await getSales();
        if (mounted) setSales(data);
      } catch (err) {
        console.error(err);
      } finally {
        if (mounted) setSalesLoading(false);
      }
    }

    loadSales();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setUsersList(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setUsersLoading(false);
      },
      (err) => {
        console.error(err);
        setUserMsg("Failed to load users.");
        setUsersLoading(false);
      }
    );

    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "documents"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setDocsList(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setDocsLoading(false);
      },
      (err) => {
        console.error(err);
        setDocMsg("Failed to load documents.");
        setDocsLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const filteredItems = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return items;

    return items.filter((it) => {
      const itemName = String(it.itemName || "").toLowerCase();
      const sku = String(it.sku || "").toLowerCase();
      const category = String(it.category || "").toLowerCase();
      const supplier = String(it.supplier || "").toLowerCase();
      const location = String(it.location || "").toLowerCase();

      return (
        itemName.includes(s) ||
        sku.includes(s) ||
        category.includes(s) ||
        supplier.includes(s) ||
        location.includes(s)
      );
    });
  }, [items, search]);

  const lowStockCount = useMemo(() => {
    return items.filter(
      (it) => Number(it.quantity || 0) <= Number(it.minStockLevel || 0)
    ).length;
  }, [items]);

  const filteredUsers = useMemo(() => {
    const s = userSearch.trim().toLowerCase();
    if (!s) return usersList;

    return usersList.filter((u) => {
      const name = String(u.name || "").toLowerCase();
      const email = String(u.email || "").toLowerCase();
      const role = String(u.role || "").toLowerCase();
      const status = String(u.status || "").toLowerCase();

      return (
        name.includes(s) ||
        email.includes(s) ||
        role.includes(s) ||
        status.includes(s)
      );
    });
  }, [usersList, userSearch]);

  const filteredDocs = useMemo(() => {
    const s = docSearch.trim().toLowerCase();
    if (!s) return docsList;

    return docsList.filter((d) => {
      const title = String(d.title || "").toLowerCase();
      const ownerName = String(d.ownerName || "").toLowerCase();
      const status = String(d.status || "").toLowerCase();
      return title.includes(s) || ownerName.includes(s) || status.includes(s);
    });
  }, [docsList, docSearch]);

  const totalRevenueEstimate = useMemo(() => {
    return items.reduce(
      (sum, item) => sum + Number(item.quantity || 0) * Number(item.sellingPrice || 0),
      0
    );
  }, [items]);

  const salesAnalytics = useMemo(() => {
    let totalSalesCount = 0;
    let totalRevenue = 0;
    let totalUnitsSold = 0;
    let totalProfit = 0;
    const salesByItem = {};
    const recentSales = [];

    for (const sale of sales) {
      const status = sale.status || "completed";
      
      if (recentSales.length < 5) recentSales.push(sale); // Add to recents BEFORE filtering cancelled
      
      if (status === "cancelled") continue; // Exclude entirely from stats

      totalSalesCount++;
      const saleTotal = getSaleTotal(sale);
      const refundAmt = Number(sale.refundAmount || 0);
      const revenue = saleTotal - refundAmt;
      
      totalRevenue += revenue;

      const itemsInSale = getSaleItems(sale);
      let saleProfit = 0;
      let effectiveQtyTotal = 0;
      
      for (const item of itemsInSale) {
        const soldQty = Number(item.quantitySold || 0);
        const retQty = Number((sale.returnedItems || []).find(r => r.itemId === item.itemId)?.returnedQty || 0);
        const effectiveQty = soldQty - retQty;
        
        if (effectiveQty <= 0) continue;

        totalUnitsSold += effectiveQty;
        effectiveQtyTotal += effectiveQty;

        const key = item.itemId || item.sku || item.itemName || "unknown";
        
        // Calculate item profit
        let itemProfitPerUnit = 0;
        if (item.lineProfit && soldQty > 0) {
           itemProfitPerUnit = Number(item.lineProfit) / soldQty;
        } else {
           const matchedItem = items.find(i => i.id === item.itemId);
           const buyingPrice = matchedItem ? Number(matchedItem.buyingPrice || 0) : 0;
           itemProfitPerUnit = Number(item.unitPrice || 0) - buyingPrice;
        }
        
        const thisItemProfit = itemProfitPerUnit * effectiveQty;
        saleProfit += thisItemProfit;

        if (!salesByItem[key]) {
          salesByItem[key] = {
            itemId: item.itemId || "",
            itemName: item.itemName || "Unknown Item",
            sku: item.sku || "-",
            totalUnits: 0,
            totalRevenue: 0,
            totalProfit: 0,
            transactions: 0,
          };
        }

        salesByItem[key].totalUnits += effectiveQty;
        salesByItem[key].totalRevenue += (Number(item.unitPrice || 0) * effectiveQty); // Gross estimate
        salesByItem[key].totalProfit += thisItemProfit;
        salesByItem[key].transactions += 1;
      }
      
      // Proportionate discount reduction on profit
      const totalEffectiveSubtotal = itemsInSale.reduce((acc, item) => {
         const sq = Number(item.quantitySold || 0);
         const rq = Number((sale.returnedItems || []).find(r => r.itemId === item.itemId)?.returnedQty || 0);
         return acc + ((sq - rq) * Number(item.unitPrice || 0));
      }, 0);
      const effectiveDiscount = totalEffectiveSubtotal * (Number(sale.discountPercent || 0) / 100);
      totalProfit += (saleProfit - effectiveDiscount);
    }

    const topSellingItems = Object.values(salesByItem)
      .sort((a, b) => b.totalUnits - a.totalUnits)
      .slice(0, 5);
      
    const topProfitableItems = Object.values(salesByItem)
      .sort((a, b) => b.totalProfit - a.totalProfit)
      .slice(0, 5);

    return {
      totalSalesCount,
      totalRevenue,
      totalProfit,
      totalUnitsSold,
      salesByItem,
      topSellingItems,
      topProfitableItems,
      recentSales,
    };
  }, [sales, items]);

  const chartData = useMemo(() => {
    const salesByItemChart = salesAnalytics.topSellingItems.map((item) => ({
      name: truncateLabel(item.itemName, 14),
      units: item.totalUnits,
      revenue: item.totalRevenue,
      fullName: item.itemName,
    }));

    const revenueByDateMap = sales.reduce((acc, sale) => {
      const status = sale.status || "completed";
      if (status === "cancelled") return acc;

      const rawDate =
        typeof sale.soldAt?.toDate === "function"
          ? sale.soldAt.toDate()
          : sale.soldAt
          ? new Date(sale.soldAt)
          : null;

      if (!rawDate || Number.isNaN(rawDate.getTime())) return acc;

      const key = rawDate.toISOString().slice(0, 10);
      if (!acc[key]) {
        acc[key] = {
          date: key,
          revenue: 0,
        };
      }
      acc[key].revenue += (getSaleTotal(sale) - Number(sale.refundAmount || 0));
      return acc;
    }, {});

    const revenueTrend = Object.values(revenueByDateMap)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-7)
      .map((entry) => ({
        label: entry.date.slice(5),
        revenue: entry.revenue,
      }));

    const profitByItemChart = salesAnalytics.topProfitableItems.map((item) => ({
      name: truncateLabel(item.itemName, 14),
      profit: item.totalProfit,
      fullName: item.itemName,
    }));

    return {
      salesByItemChart,
      revenueTrend,
      profitByItemChart,
    };
  }, [sales, salesAnalytics.topSellingItems, salesAnalytics.topProfitableItems]);

  const discountUsagePieData = useMemo(() => {
    let none = 0, loyalty = 0, highValue = 0, premium = 0, other = 0;
    sales.forEach(s => {
      const src = s.discountSource || "";
      if (!s.discountApplied) none++;
      else if (src.includes("Loyalty")) loyalty++;
      else if (src.includes("High Value")) highValue++;
      else if (src.includes("Premium")) premium++;
      else other++;
    });
    return [
      { name: "No Discount", value: none },
      { name: "Loyalty (5%)", value: loyalty },
      { name: "High Value (5%)", value: highValue },
      { name: "Premium (10%)", value: premium },
      { name: "Manual/Other", value: other },
    ].filter(d => d.value > 0);
  }, [sales]);

  const customerValuePieData = useMemo(() => {
    let regular = 0, highValue = 0, premium = 0;
    const cidMap = {};
    sales.forEach(s => {
      if (!s.customerId) return;
      if (!cidMap[s.customerId]) cidMap[s.customerId] = 0;
      cidMap[s.customerId] += Number(s.totalPrice || 0);
    });

    customers.forEach(c => {
      const spent = cidMap[c.id] || 0;
      if (spent >= 250000) premium++;
      else if (spent >= 100000) highValue++;
      else regular++;
    });

    return [
      { name: "Premium (250k+)", value: premium },
      { name: "High Value (100k+)", value: highValue },
      { name: "Regular (<100k)", value: regular },
    ].filter(d => d.value > 0);
  }, [sales, customers]);

  const lowStockPieData = useMemo(() => {
    return [
      { name: "Low Stock", value: lowStockCount },
      { name: "Healthy Stock", value: Math.max(items.length - lowStockCount, 0) },
    ];
  }, [items.length, lowStockCount]);

  const aiInsights = useMemo(() => {
    const insights = [];
    const recommendations = [];

    const salesBySku = {};
    Object.values(salesAnalytics.salesByItem || {}).forEach((entry) => {
      if (entry.sku) {
        salesBySku[entry.sku] = entry;
      }
    });

    const lowStockItems = items.filter(
      (item) => Number(item.quantity || 0) <= Number(item.minStockLevel || 0)
    );

    const noSalesItems = items.filter((item) => !salesBySku[item.sku]);
    const topSeller = salesAnalytics.topSellingItems[0];

    if (topSeller) {
      insights.push({
        type: "success",
        title: "Top performer detected",
        text: `${topSeller.itemName} is currently the best-selling item with ${topSeller.totalUnits} units sold and ${formatCurrency(
          topSeller.totalRevenue
        )} revenue.`,
      });
    }

    if (lowStockItems.length > 0) {
      const criticalLow = [...lowStockItems]
        .sort((a, b) => Number(a.quantity || 0) - Number(b.quantity || 0))
        .slice(0, 3);

      insights.push({
        type: "warning",
        title: "Low stock risk detected",
        text: `${lowStockItems.length} item(s) are at or below minimum stock level. Most urgent: ${criticalLow
          .map((item) => `${item.itemName} (${item.quantity} left)`)
          .join(", ")}.`,
      });
    }

    if (noSalesItems.length > 0) {
      const sampleNoSales = noSalesItems.slice(0, 3);

      insights.push({
        type: "info",
        title: "Slow-moving stock detected",
        text: `${noSalesItems.length} inventory item(s) have no recorded sales yet. Example: ${sampleNoSales
          .map((item) => item.itemName)
          .join(", ")}.`,
      });
    }

    if (salesAnalytics.totalRevenue > 0 && salesAnalytics.topSellingItems.length > 0) {
      const topRevenueItem = [...salesAnalytics.topSellingItems].sort(
        (a, b) => b.totalRevenue - a.totalRevenue
      )[0];

      const contribution = Math.round(
        (Number(topRevenueItem.totalRevenue || 0) / Number(salesAnalytics.totalRevenue || 1)) *
          100
      );

      insights.push({
        type: "info",
        title: "Revenue concentration insight",
        text: `${topRevenueItem.itemName} contributes about ${contribution}% of total recorded revenue.`,
      });
    }

    let highValueCustCount = 0;
    const cidMap = {};
    sales.forEach(s => {
      if (!s.customerId) return;
      if (!cidMap[s.customerId]) cidMap[s.customerId] = 0;
      cidMap[s.customerId] += Number(s.totalPrice || 0);
    });
    customers.forEach(c => {
      if ((cidMap[c.id] || 0) >= 100000) highValueCustCount++;
    });

    if (highValueCustCount > 0) {
      insights.push({
        type: "success",
        title: "High-value customers growing",
        text: `You have ${highValueCustCount} customer(s) who have spent over Rs. 100,000. Consider direct outreach or exclusive offers.`,
      });
    }

    if (lowStockItems.length > 0) {
      lowStockItems.slice(0, 5).forEach((item) => {
        const soldEntry = salesBySku[item.sku];
        const soldUnits = Number(soldEntry?.totalUnits || 0);
        const targetLevel = Math.max(
          Number(item.minStockLevel || 0) * 2,
          soldUnits > 0 ? soldUnits : Number(item.minStockLevel || 0) + 5
        );
        const reorderQty = Math.max(0, targetLevel - Number(item.quantity || 0));

        recommendations.push({
          priority: "High",
          title: `Reorder ${item.itemName}`,
          text: `Current stock is ${item.quantity}. Recommended reorder quantity: ${reorderQty} units to reduce stock-out risk.`,
        });
      });

      const lowStockSuppliers = new Set(lowStockItems.map(i => i.supplierName || i.supplierId).filter(Boolean));
      if (lowStockSuppliers.size > 0) {
        recommendations.push({
          priority: "High",
          title: "Supplier Reorder Needed",
          text: `You have low stock items tied to ${lowStockSuppliers.size} supplier(s). Contact them soon for bulk replenishment.`,
        });
      }
    }

    if (topSeller) {
      recommendations.push({
        priority: "Medium",
        title: `Promote ${topSeller.itemName}`,
        text: `This item is already performing well. Consider keeping strong stock coverage and using it in featured promotions.`,
      });
    }

    if (noSalesItems.length > 0) {
      noSalesItems.slice(0, 3).forEach((item) => {
        recommendations.push({
          priority: "Medium",
          title: `Review ${item.itemName}`,
          text: `This item has inventory but no recorded sales. Review pricing, product visibility, or supplier reorder frequency.`,
        });
      });
    }

    const highMarginItems = items
      .map((item) => ({
        ...item,
        margin: Number(item.sellingPrice || 0) - Number(item.buyingPrice || 0),
      }))
      .filter((item) => item.margin > 0)
      .sort((a, b) => b.margin - a.margin)
      .slice(0, 2);

    highMarginItems.forEach((item) => {
      recommendations.push({
        priority: "Low",
        title: `Push high-margin item: ${item.itemName}`,
        text: `Estimated margin per unit is ${formatCurrency(
          item.margin
        )}. Consider bundling or highlighting this item in promotions.`,
      });
    });

    return {
      insights: insights.slice(0, 6),
      recommendations: recommendations.slice(0, 8),
    };
  }, [items, salesAnalytics]);

  function resetForm() {
    setForm(initialForm);
    setMode("add");
    setEditingId(null);
    setSelectedSupplier(null);
    setSupplierSearch("");
  }

  function startEdit(item) {
    setMode("edit");
    setEditingId(item.id);
    setForm({
      itemName: item.itemName ?? "",
      sku: item.sku ?? "",
      category: item.category ?? "",
      quantity: sanitizeNumber(item.quantity),
      minStockLevel: sanitizeNumber(item.minStockLevel),
      buyingPrice: sanitizeNumber(item.buyingPrice),
      sellingPrice: sanitizeNumber(item.sellingPrice),
      supplier: item.supplier ?? "",
      location: item.location ?? "",
    });
    // Restore linked supplier if any
    if (item.supplierId) {
      const linked = suppliers.find((s) => s.id === item.supplierId);
      setSelectedSupplier(linked || { id: item.supplierId, name: item.supplierName || item.supplier || "" });
    } else {
      setSelectedSupplier(null);
    }
    setSupplierSearch("");
    setMsg("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function validateForm() {
    if (!form.itemName.trim()) return "Item name is required.";
    if (!form.sku.trim()) return "SKU is required.";
    if (!form.category.trim()) return "Category is required.";
    if (sanitizeNumber(form.quantity) < 0) return "Quantity cannot be negative.";
    if (sanitizeNumber(form.minStockLevel) < 0) return "Minimum stock cannot be negative.";
    if (sanitizeNumber(form.buyingPrice) < 0) return "Buying price cannot be negative.";
    if (sanitizeNumber(form.sellingPrice) < 0) return "Selling price cannot be negative.";

    const skuLower = form.sku.trim().toLowerCase();
    const clash = items.find(
      (it) =>
        String(it.sku || "").trim().toLowerCase() === skuLower &&
        it.id !== editingId
    );

    if (clash) return "SKU already exists. Use a unique SKU.";
    return "";
  }

  async function onSubmit(e) {
    e.preventDefault();
    setMsg("");

    const error = validateForm();
    if (error) {
      setMsg(error);
      return;
    }

    setBusy(true);

    try {
      const payload = {
        itemName: form.itemName,
        sku: form.sku,
        category: form.category,
        quantity: sanitizeNumber(form.quantity),
        minStockLevel: sanitizeNumber(form.minStockLevel),
        buyingPrice: sanitizeNumber(form.buyingPrice),
        sellingPrice: sanitizeNumber(form.sellingPrice),
        supplier: selectedSupplier?.name || form.supplier,
        location: form.location,
        // Supplier linking
        supplierId:   selectedSupplier?.id   || null,
        supplierName: selectedSupplier?.name || form.supplier || "",
      };

      if (mode === "add") {
        await createInventoryItem(payload, user);
        setMsg("✅ Inventory item added successfully.");
        // Audit supplier link
        if (selectedSupplier) {
          const { logAction } = await import("../firebase/auditLogger");
          await logAction("INVENTORY_SUPPLIER_LINKED", user.uid, user.email,
            { itemName: form.itemName, supplierId: selectedSupplier.id, supplierName: selectedSupplier.name },
            "inventory", selectedSupplier.id).catch(() => {});
        }
      } else {
        await updateInventoryItem(editingId, payload, user);
        setMsg("✅ Inventory item updated successfully.");
        if (selectedSupplier) {
          const { logAction } = await import("../firebase/auditLogger");
          await logAction("INVENTORY_SUPPLIER_LINKED", user.uid, user.email,
            { itemName: form.itemName, supplierId: selectedSupplier.id, supplierName: selectedSupplier.name },
            "inventory", editingId).catch(() => {});
        }
      }

      resetForm();
    } catch (err) {
      console.error(err);
      setMsg(err?.message || "❌ Failed to save inventory item.");
    } finally {
      setBusy(false);
    }
  }

  function onDelete(item) {
    openConfirm({
      title: "Delete Inventory Item",
      body: `You are about to permanently delete "${item.itemName}" (SKU: ${item.sku}). This action cannot be undone.`,
      variant: "danger",
      requireReason: false,
      onConfirm: async () => {
        setBusy(true);
        setMsg("");
        try {
          await deleteInventoryItem(item.id, user, {
            itemName: item.itemName,
            sku: item.sku,
          });
          setMsg("🗑️ Inventory item deleted.");
          if (editingId === item.id) resetForm();
        } catch (err) {
          console.error(err);
          setMsg("❌ Failed to delete inventory item.");
        } finally {
          setBusy(false);
        }
      },
    });
  }

  function handleUserRoleChange(targetUser, newRole) {
    const oldRole = targetUser.role || "staff";
    openConfirm({
      title: "Change User Role",
      body: `Change role for ${targetUser.email} from "${oldRole}" to "${newRole}"? This will immediately affect their access permissions.`,
      variant: "warning",
      requireReason: false,
      onConfirm: async () => {
        setUserMsg("");
        try {
          await updateDoc(doc(db, "users", targetUser.id), {
            role: newRole,
            updatedAt: serverTimestamp(),
          });
          await logAction(
            "USER_ROLE_UPDATE",
            user.uid,
            user.email,
            {
              targetUserId: targetUser.id,
              targetEmail: targetUser.email,
              oldRole,
              newRole,
            },
            "user",
            targetUser.id
          );

          try {
            const { createNotification } = await import("../firebase/notificationActions");
            await createNotification({
              targetUid: targetUser.id,
              title: "Account Role Updated",
              message: `Your account role has been changed from ${oldRole} to ${newRole}.`,
              type: "warning",
              targetType: "user",
              targetId: targetUser.id
            });
          } catch (notifErr) {
            console.error("Failed to send role update notification:", notifErr);
          }

          setUserMsg(`✅ Role updated for ${targetUser.email}`);
        } catch (err) {
          console.error(err);
          setUserMsg("❌ Failed to update user role.");
        }
      },
    });
  }

  function handleUserStatusChange(targetUser, newStatus) {
    const oldStatus = targetUser.status || "active";
    const isDisabling = newStatus === "disabled";
    openConfirm({
      title: isDisabling ? "Disable User Account" : "Activate User Account",
      body: isDisabling
        ? `You are about to disable ${targetUser.email}. They will no longer be able to log in until reactivated.`
        : `You are about to reactivate ${targetUser.email}. They will regain full access based on their role.`,
      variant: isDisabling ? "danger" : "warning",
      requireReason: false,
      onConfirm: async () => {
        setUserMsg("");
        try {
          await updateDoc(doc(db, "users", targetUser.id), {
            status: newStatus,
            updatedAt: serverTimestamp(),
          });
          await logAction(
            "USER_STATUS_UPDATE",
            user.uid,
            user.email,
            {
              targetUserId: targetUser.id,
              targetEmail: targetUser.email,
              oldStatus,
              newStatus,
            },
            "user",
            targetUser.id
          );

          try {
            const { createNotification } = await import("../firebase/notificationActions");
            await createNotification({
              targetUid: targetUser.id,
              title: "Account Status Updated",
              message: `Your account has been ${newStatus}.`,
              type: newStatus === "disabled" ? "danger" : "info",
              targetType: "user",
              targetId: targetUser.id
            });
          } catch (notifErr) {
            console.error("Failed to send status update notification:", notifErr);
          }

          setUserMsg(`✅ Status updated for ${targetUser.email}`);
        } catch (err) {
          console.error(err);
          setUserMsg("❌ Failed to update user status.");
        }
      },
    });
  }

  function requestDocumentStatusChange(documentItem, newStatus) {
    const isRejection = newStatus === "rejected";
    openConfirm({
      title: isRejection ? "Reject Document" : "Approve Document",
      body: isRejection
        ? `You are about to reject "${documentItem.title || "this document"}". Please provide a reason below.`
        : `You are about to approve "${documentItem.title || "this document"}". The requester will be notified.`,
      variant: isRejection ? "danger" : "warning",
      requireReason: isRejection,
      onConfirm: async (reason) => {
        await _applyDocumentStatus(documentItem, newStatus, reason);
      },
    });
  }

  async function _applyDocumentStatus(documentItem, newStatus, reason = "") {
    setDocBusy(true);
    setDocMsg("");

    try {
      // Build approval history fields (Step 3 — Document Approval History)
      const historyFields =
        newStatus === "approved"
          ? {
              approvedBy: user.uid,
              approvedByEmail: user.email,
              approvedAt: serverTimestamp(),
              // Clear any previous rejection data
              rejectedBy: null,
              rejectedByEmail: null,
              rejectedAt: null,
              rejectionReason: null,
            }
          : {
              rejectedBy: user.uid,
              rejectedByEmail: user.email,
              rejectedAt: serverTimestamp(),
              rejectionReason: reason || "",
              // Clear any previous approval data
              approvedBy: null,
              approvedByEmail: null,
              approvedAt: null,
            };

      await updateDoc(doc(db, "documents", documentItem.id), {
        status: newStatus,
        updatedAt: serverTimestamp(),
        ...historyFields,
      });

      await logAction(
        "DOCUMENT_STATUS_CHANGE",
        user.uid,
        user.email,
        {
          documentId: documentItem.id,
          title: documentItem.title,
          oldStatus: documentItem.status || "pending",
          newStatus,
          ...(newStatus === "rejected" && reason ? { rejectionReason: reason } : {}),
        },
        "document",
        documentItem.id
      );

      // Trigger notification for the document owner
      try {
        const { createNotification } = await import("../firebase/notificationActions");
        await createNotification({
          targetUid: documentItem.ownerUid, // Alert the specific user who owns it
          title: newStatus === "approved" ? "Document Approved" : "Document Rejected",
          message: newStatus === "approved"
            ? `Your document "${documentItem.title || "Untitled"}" has been approved.`
            : `Your document "${documentItem.title || "Untitled"}" has been rejected. Reason: ${reason || "No reason provided."}`,
          type: "approval",
          link: "/dashboard" // Or wherever they view their documents
        });
      } catch (notifErr) {
        console.error("Failed to send document status notification:", notifErr);
      }

      setDocMsg(`✅ Document marked as ${newStatus}.`);
    } catch (err) {
      console.error(err);
      setDocMsg("❌ Failed to update document status.");
    } finally {
      setDocBusy(false);
    }
  }

  return (
    <>
    <ConfirmModal state={confirmModal} onClose={closeConfirm} />
    {showBulkImport && (
      <BulkImportModal
        existingItems={items}
        user={user}
        onClose={() => setShowBulkImport(false)}
        onSuccess={() => setShowBulkImport(false)}
      />
    )}
    <PageShell>
      <div className="grid gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 flex-wrap">
              <Pill>Admin Dashboard</Pill>
              <Pill>Low stock {lowStockCount}</Pill>
              <Pill>Total sales {salesAnalytics.totalSalesCount}</Pill>
            </div>

            <h1 className="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight text-white">
              Business Management Console
            </h1>

            <p className="mt-1 text-sm text-white/70">
              Signed in as <b>{profile?.name || user?.email}</b> • role:{" "}
              <b>{profile?.role || "admin"}</b>
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link to="/sales-history">
              <SecondaryButton type="button">Sales History</SecondaryButton>
            </Link>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card title={`${items.length} items`} desc="Total inventory records" />
          <Card title={`${lowStockCount} low stock`} desc="Items at or below minimum level" />
          <Card title={`${usersList.length} users`} desc="Registered user profiles" />
          <Card
            title={formatCurrency(totalRevenueEstimate)}
            desc="Estimated inventory sales value"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card
            title={`${salesAnalytics.totalSalesCount}`}
            desc="Total sales transactions recorded"
          />
          <Card
            title={`${salesAnalytics.totalUnitsSold}`}
            desc="Total units sold across all items"
          />
          <Card
            title={formatCurrency(salesAnalytics.totalRevenue)}
            desc="Total revenue from recorded sales"
          />
          <Card
            title={formatCurrency(salesAnalytics.totalProfit)}
            desc="Total estimated profit from sales"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card title={`${customers.length} customers`} desc="Registered customer accounts" />
          <Card title={`${suppliers.length} suppliers`} desc="Registered supplier contacts" />
          <Card
            title={`${notifications.filter(n => !n.isRead).length} unread`}
            desc="Active unread notifications"
          />
          <Card
            title={`${docsList.filter(d => d.status === "pending").length} pending`}
            desc="Documents awaiting approval"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="rounded-3xl bg-white/[0.06] ring-1 ring-white/10 p-5 sm:p-6">
            <SectionTitle
              eyebrow="Visual Analytics"
              title="Top Selling Items"
              pill="Bar Chart"
            />

            <p className="mt-2 text-xs leading-5 text-white/55">
              Displays the highest-selling products by unit count.
            </p>

            <div className="mt-4 h-72">
              {salesLoading ? (
                <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-4 text-sm text-white/70">
                  Loading chart...
                </div>
              ) : chartData.salesByItemChart.length === 0 ? (
                <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-4 text-sm text-white/70">
                  No sales data available for chart.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData.salesByItemChart}
                    margin={{ top: 10, right: 10, left: -20, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="name" stroke="#cbd5e1" tick={{ fontSize: 12 }} />
                    <YAxis stroke="#cbd5e1" tick={{ fontSize: 12 }} allowDecimals={false} />
                    <Tooltip content={<CustomBarTooltip />} />
                    <Bar dataKey="units" fill="#38bdf8" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="rounded-3xl bg-white/[0.06] ring-1 ring-white/10 p-5 sm:p-6">
            <SectionTitle
              eyebrow="Visual Analytics"
              title="Revenue Trend"
              pill="Line Chart"
            />

            <p className="mt-2 text-xs leading-5 text-white/55">
              Shows revenue movement across the most recent recorded days.
            </p>

            <div className="mt-4 h-72">
              {salesLoading ? (
                <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-4 text-sm text-white/70">
                  Loading chart...
                </div>
              ) : chartData.revenueTrend.length === 0 ? (
                <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-4 text-sm text-white/70">
                  No revenue trend data available yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData.revenueTrend}
                    margin={{ top: 10, right: 10, left: -10, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="label" stroke="#cbd5e1" tick={{ fontSize: 12 }} />
                    <YAxis stroke="#cbd5e1" tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomLineTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#818cf8"
                      strokeWidth={3}
                      dot={{ r: 4, fill: "#a5b4fc" }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="rounded-3xl bg-white/[0.06] ring-1 ring-white/10 p-5 sm:p-6">
            <SectionTitle
              eyebrow="Visual Analytics"
              title="Low Stock Overview"
              pill="Pie Chart"
            />

            <p className="mt-2 text-xs leading-5 text-white/55">
              Compares low stock items against healthy inventory items.
            </p>

            <div className="mt-4 h-72">
              {loading ? (
                <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-4 text-sm text-white/70">
                  Loading chart...
                </div>
              ) : items.length === 0 ? (
                <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-4 text-sm text-white/70">
                  No inventory data available yet.
                </div>
              ) : lowStockCount === 0 ? (
                <div className="flex h-full items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-4 text-center text-sm text-white/70">
                  No low stock items detected. Inventory is currently in a healthy state.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={lowStockPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      dataKey="value"
                      paddingAngle={3}
                    >
                      {lowStockPieData.map((entry, index) => (
                        <Cell
                          key={`cell-${entry.name}`}
                          fill={PIE_COLORS[index % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="mt-3 flex items-center gap-4 text-xs text-white/60 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-full bg-[#fb7185]" />
                <span>Low Stock</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-full bg-[#818cf8]" />
                <span>Healthy Stock</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="rounded-3xl bg-white/[0.06] ring-1 ring-white/10 p-5 sm:p-6">
            <SectionTitle
              eyebrow="Visual Analytics"
              title="Profit by Item"
              pill="Bar Chart"
            />
            <p className="mt-2 text-xs leading-5 text-white/55">
              Displays the highest-profit products.
            </p>
            <div className="mt-4 h-72">
              {salesLoading ? (
                <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-4 text-sm text-white/70">
                  Loading chart...
                </div>
              ) : chartData.profitByItemChart.length === 0 ? (
                <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-4 text-sm text-white/70">
                  No profit data available for chart.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData.profitByItemChart}
                    margin={{ top: 10, right: 10, left: -10, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="name" stroke="#cbd5e1" tick={{ fontSize: 12 }} />
                    <YAxis stroke="#cbd5e1" tick={{ fontSize: 12 }} allowDecimals={false} tickFormatter={(val) => `Rs. ${val/1000}k`} />
                    <Tooltip content={<CustomBarTooltip />} />
                    <Bar dataKey="profit" fill="#10b981" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="rounded-3xl bg-white/[0.06] ring-1 ring-white/10 p-5 sm:p-6">
            <SectionTitle
              eyebrow="Visual Analytics"
              title="Customer Value Breakdown"
              pill="Pie Chart"
            />
            <p className="mt-2 text-xs leading-5 text-white/55">
              Distribution of customers across value tiers.
            </p>
            <div className="mt-4 h-72">
              {salesLoading ? (
                <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-4 text-sm text-white/70">
                  Loading chart...
                </div>
              ) : customerValuePieData.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-4 text-center text-sm text-white/70">
                  No customer data available yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={customerValuePieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      dataKey="value"
                      paddingAngle={3}
                    >
                      {customerValuePieData.map((entry, index) => (
                        <Cell
                          key={`cell-${entry.name}`}
                          fill={["#fbbf24", "#38bdf8", "#a8a29e"][index % 3]}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="rounded-3xl bg-white/[0.06] ring-1 ring-white/10 p-5 sm:p-6">
            <SectionTitle
              eyebrow="Visual Analytics"
              title="Discount Usage Summary"
              pill="Pie Chart"
            />
            <p className="mt-2 text-xs leading-5 text-white/55">
              Breakdown of discounts applied to sales.
            </p>
            <div className="mt-4 h-72">
              {salesLoading ? (
                <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-4 text-sm text-white/70">
                  Loading chart...
                </div>
              ) : discountUsagePieData.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-4 text-center text-sm text-white/70">
                  No discount usage data yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={discountUsagePieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      dataKey="value"
                      paddingAngle={3}
                    >
                      {discountUsagePieData.map((entry, index) => (
                        <Cell
                          key={`cell-${entry.name}`}
                          fill={["#94a3b8", "#a78bfa", "#f472b6", "#fb923c", "#34d399"][index % 5]}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-3xl bg-white/[0.06] ring-1 ring-white/10 p-5 sm:p-6">
            <SectionTitle
              eyebrow="Sales Insights"
              title="Top Selling Items"
              pill="Top 5"
            />

            <div className="mt-4 space-y-3">
              {salesLoading ? (
                <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-4 text-sm text-white/70">
                  Loading sales insights...
                </div>
              ) : salesAnalytics.topSellingItems.length === 0 ? (
                <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-4 text-sm text-white/70">
                  No sales data available yet.
                </div>
              ) : (
                salesAnalytics.topSellingItems.map((item, index) => (
                  <div
                    key={`${item.sku}-${index}`}
                    className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-sm text-white/60">#{index + 1}</div>
                        <div className="mt-1 font-semibold text-white break-words">
                          {item.itemName}
                        </div>
                        <div className="text-xs text-white/60">SKU: {item.sku}</div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-sm font-semibold text-white">
                          {item.totalUnits} units
                        </div>
                        <div className="text-xs text-white/60">
                          {formatCurrency(item.totalRevenue)}
                        </div>
                        <div className="text-xs text-white/50">
                          {item.transactions} transaction(s)
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-3xl bg-white/[0.06] ring-1 ring-white/10 p-5 sm:p-6">
            <SectionTitle
              eyebrow="Recent Activity"
              title="Latest Sales Transactions"
              pill="Recent 5"
            />

            <div className="mt-4 space-y-3">
              {salesLoading ? (
                <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-4 text-sm text-white/70">
                  Loading recent sales...
                </div>
              ) : salesAnalytics.recentSales.length === 0 ? (
                <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-4 text-sm text-white/70">
                  No recent sales found.
                </div>
              ) : (
                salesAnalytics.recentSales.map((sale) => {
                  const status = sale.status || "completed";
                  const isCancelled = status === "cancelled";
                  const isReturned = status === "returned";
                  const isPartial = status === "partially_returned";
                  return (
                    <div
                      key={sale.id}
                      className={`rounded-2xl bg-white/5 ring-1 ring-white/10 p-4 ${isCancelled ? "opacity-60" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="font-semibold text-white truncate">
                            {getSaleItemSummary(sale) || "Unknown Item"}
                          </div>
                          <div className="text-xs text-white/60">Inv: {sale.invoiceNumber}</div>
                          <div className="mt-1 flex items-center gap-2">
                            {isCancelled ? <span className="inline-block px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 text-[9px] font-bold uppercase tracking-wider">Cancelled</span> :
                             isReturned ? <span className="inline-block px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[9px] font-bold uppercase tracking-wider">Returned</span> :
                             isPartial ? <span className="inline-block px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold uppercase tracking-wider">Partial Ret</span> : null}
                            <div className="text-xs text-white/50 break-all">
                              Sold by {sale.soldByEmail || "-"}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-sm font-semibold text-white">
                            {getSaleQuantity(sale)} unit(s)
                          </div>
                          <div className="text-xs text-white/60">
                            {isCancelled ? <span className="line-through">{formatCurrency(getSaleTotal(sale))}</span> : formatCurrency(sale.finalTotalAfterReturn ?? getSaleTotal(sale))}
                          </div>
                          <div className="mt-1 text-xs text-white/50">
                            {formatDate(sale.soldAt)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-3xl bg-white/[0.06] ring-1 ring-white/10 p-5 sm:p-6">
            <SectionTitle
              eyebrow="AI Insights"
              title="Smart Business Signals"
              pill={`${aiInsights.insights.length} insights`}
            />

            <div className="mt-4 space-y-3">
              {aiInsights.insights.length === 0 ? (
                <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-4 text-sm text-white/70">
                  Not enough sales and inventory data yet to generate insights.
                </div>
              ) : (
                aiInsights.insights.map((insight, index) => (
                  <div
                    key={`${insight.title}-${index}`}
                    className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <Pill
                        className={
                          insight.type === "warning"
                            ? "bg-amber-500/15 text-amber-200 ring-amber-500/20"
                            : insight.type === "success"
                            ? "bg-emerald-500/15 text-emerald-200 ring-emerald-500/20"
                            : "bg-blue-500/15 text-blue-200 ring-blue-500/20"
                        }
                      >
                        {insight.type === "warning"
                          ? "Warning"
                          : insight.type === "success"
                          ? "Opportunity"
                          : "Insight"}
                      </Pill>

                      <div className="font-semibold text-white">{insight.title}</div>
                    </div>

                    <div className="mt-2 text-sm leading-6 text-white/75">{insight.text}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-3xl bg-white/[0.06] ring-1 ring-white/10 p-5 sm:p-6">
            <SectionTitle
              eyebrow="AI Recommendations"
              title="Suggested Next Actions"
              pill={`${aiInsights.recommendations.length} actions`}
            />

            <div className="mt-4 space-y-3">
              {aiInsights.recommendations.length === 0 ? (
                <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-4 text-sm text-white/70">
                  Add more inventory and sales data to get action recommendations.
                </div>
              ) : (
                aiInsights.recommendations.map((rec, index) => (
                  <div
                    key={`${rec.title}-${index}`}
                    className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <Pill
                        className={
                          rec.priority === "High"
                            ? "bg-red-500/15 text-red-200 ring-red-500/20"
                            : rec.priority === "Medium"
                            ? "bg-amber-500/15 text-amber-200 ring-amber-500/20"
                            : "bg-slate-500/20 text-slate-200 ring-slate-400/20"
                        }
                      >
                        {rec.priority} Priority
                      </Pill>

                      <div className="font-semibold text-white">{rec.title}</div>
                    </div>

                    <div className="mt-2 text-sm leading-6 text-white/75">{rec.text}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          <div className="rounded-3xl bg-white/[0.06] ring-1 ring-white/10 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <SectionTitle
                eyebrow="System Alerts"
                title="Notifications Preview"
                pill={notificationsLoading ? "Loading..." : `${[...lowStockPreviewAlerts, ...notifications].length} recent`}
              />
              <Link to="/notifications">
                <SecondaryButton>View All</SecondaryButton>
              </Link>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {notificationsLoading ? (
                <div className="col-span-full rounded-2xl bg-white/5 ring-1 ring-white/10 p-4 text-sm text-white/70">
                  Loading notifications...
                </div>
              ) : [...lowStockPreviewAlerts, ...notifications].length === 0 ? (
                <div className="col-span-full rounded-2xl bg-white/5 ring-1 ring-white/10 p-4 text-sm text-white/70">
                  No notifications available.
                </div>
              ) : (
                [...lowStockPreviewAlerts, ...notifications].slice(0, 3).map((notif) => (
                  <div
                    key={notif.id}
                    className={`rounded-2xl ring-1 p-4 flex flex-col justify-between ${
                      notif.id?.startsWith("low-stock-")
                        ? "bg-amber-500/[0.05] ring-amber-500/20"
                        : notif.isRead
                        ? "bg-white/[0.02] ring-white/10 opacity-70"
                        : "bg-white/5 ring-white/20 shadow-lg"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        {!notif.isRead && <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />}
                        <span className="font-semibold text-white truncate text-sm">{notif.title}</span>
                      </div>
                      <p className="text-xs text-white/70 line-clamp-2">{notif.message}</p>
                    </div>
                    <div className="mt-3 text-xs text-white/50">{formatDate(notif.createdAt)}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2 border-b border-white/10 pb-4 flex-wrap">
          <button
            onClick={() => setActiveTab("inventory")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              activeTab === "inventory"
                ? "bg-white/15 text-white"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            Inventory
          </button>

          <button
            onClick={() => setActiveTab("users")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              activeTab === "users"
                ? "bg-white/15 text-white"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            User Management
          </button>

          <button
            onClick={() => setActiveTab("approvals")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              activeTab === "approvals"
                ? "bg-white/15 text-white"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            Document Approvals
          </button>
        </div>

        {activeTab === "inventory" && (
          <>
            <div className="grid gap-6 lg:grid-cols-12">
              <div className="lg:col-span-7">
                <div className="rounded-3xl bg-white/[0.06] ring-1 ring-white/10 p-5 sm:p-6 h-full flex flex-col">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm text-white/70">
                        {mode === "add" ? "Add new item" : "Edit item"}
                      </div>
                      <div className="mt-1 text-lg font-semibold text-white">
                        {mode === "add" ? "Create inventory item" : "Update inventory item"}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {mode === "edit" ? (
                        <button
                          onClick={resetForm}
                          className="rounded-2xl bg-white/5 ring-1 ring-white/15 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10"
                        >
                          Cancel edit
                        </button>
                      ) : null}
                      <button
                        onClick={() => setShowBulkImport(true)}
                        className="rounded-2xl bg-indigo-500/80 ring-1 ring-indigo-500/50 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition"
                      >
                        📂 Import CSV
                      </button>
                    </div>
                  </div>

                  <form onSubmit={onSubmit} className="mt-5 grid gap-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Item Name">
                        <Input
                          value={form.itemName}
                          onChange={(e) => setForm((p) => ({ ...p, itemName: e.target.value }))}
                          placeholder="Milk Powder 400g"
                          autoComplete="off"
                        />
                      </Field>

                      <Field label="SKU">
                        <Input
                          value={form.sku}
                          onChange={(e) => setForm((p) => ({ ...p, sku: e.target.value }))}
                          placeholder="MILK-001"
                          autoComplete="off"
                        />
                      </Field>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Category">
                        <Input
                          value={form.category}
                          onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                          placeholder="Groceries"
                          autoComplete="off"
                        />
                      </Field>

                      {/* Supplier linked selector */}
                      <Field label="Supplier">
                        {selectedSupplier ? (
                          <div className="rounded-2xl bg-indigo-500/10 ring-1 ring-indigo-500/20 px-3 py-2 flex items-center justify-between gap-2">
                            <div>
                              <div className="text-sm font-semibold text-white">{selectedSupplier.name}</div>
                              {selectedSupplier.phone && <div className="text-xs text-white/50">{selectedSupplier.phone}</div>}
                            </div>
                            <button
                              type="button"
                              onClick={() => { setSelectedSupplier(null); setSupplierSearch(""); setForm((p) => ({ ...p, supplier: "" })); }}
                              className="rounded-lg bg-white/5 ring-1 ring-white/15 px-2 py-0.5 text-xs font-semibold text-white/70 hover:bg-white/10 shrink-0"
                            >Clear</button>
                          </div>
                        ) : (
                          <div className="relative">
                            <Input
                              value={supplierSearch}
                              onChange={(e) => { setSupplierSearch(e.target.value); setForm((p) => ({ ...p, supplier: e.target.value })); }}
                              placeholder="Search or type supplier name…"
                              autoComplete="off"
                            />
                            {supplierSearch.trim() && suppliers.filter((s) => s.name.toLowerCase().includes(supplierSearch.toLowerCase())).length > 0 && (
                              <div className="absolute left-0 right-0 top-full mt-1 z-10 rounded-2xl bg-slate-800 ring-1 ring-white/15 shadow-2xl overflow-hidden">
                                {suppliers.filter((s) => s.name.toLowerCase().includes(supplierSearch.toLowerCase())).slice(0, 5).map((s) => (
                                  <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => { setSelectedSupplier(s); setSupplierSearch(""); setForm((p) => ({ ...p, supplier: s.name })); }}
                                    className="w-full text-left px-4 py-2.5 hover:bg-white/10 border-b border-white/5 last:border-0 text-sm text-white"
                                  >
                                    <div className="font-medium">{s.name}</div>
                                    {s.contactPerson && <div className="text-xs text-white/50">{s.contactPerson} {s.phone && `· ${s.phone}`}</div>}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </Field>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <Field label="Quantity">
                        <Input
                          type="number"
                          value={form.quantity}
                          onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
                        />
                      </Field>

                      <Field label="Min Stock Level">
                        <Input
                          type="number"
                          value={form.minStockLevel}
                          onChange={(e) =>
                            setForm((p) => ({ ...p, minStockLevel: e.target.value }))
                          }
                        />
                      </Field>

                      <Field label="Buying Price">
                        <Input
                          type="number"
                          value={form.buyingPrice}
                          onChange={(e) =>
                            setForm((p) => ({ ...p, buyingPrice: e.target.value }))
                          }
                        />
                      </Field>

                      <Field label="Selling Price">
                        <Input
                          type="number"
                          value={form.sellingPrice}
                          onChange={(e) =>
                            setForm((p) => ({ ...p, sellingPrice: e.target.value }))
                          }
                        />
                      </Field>
                    </div>

                    <Field label="Location">
                      <Input
                        value={form.location}
                        onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                        placeholder="Rack A1"
                        autoComplete="off"
                      />
                    </Field>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <PrimaryButton type="submit" disabled={busy}>
                        {busy ? "Saving..." : mode === "add" ? "Add Item" : "Save Changes"}
                      </PrimaryButton>

                      <SecondaryButton
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          resetForm();
                          setMsg("");
                        }}
                      >
                        Reset
                      </SecondaryButton>
                    </div>

                    {msg ? (
                      <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-3 text-sm text-white/80">
                        {msg}
                      </div>
                    ) : null}
                  </form>
                </div>
              </div>

              <div className="lg:col-span-5 flex flex-col gap-6 h-full">
                <div className="rounded-3xl bg-white/[0.04] ring-1 ring-white/10 p-5 sm:p-6 flex flex-col gap-4 flex-1">
                  <div className="w-full">
                    <div className="text-sm text-white/70">Search Inventory</div>
                    <div className="mt-2">
                      <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by item / sku / category / supplier..."
                      />
                    </div>
                  </div>

                  <div className="mt-auto w-full grid gap-3 sm:grid-cols-2">
                    <Card title={`${items.length} items`} desc="Total inventory records." />
                    <Card title={`${lowStockCount} low`} desc="Needs replenishment." />
                  </div>
                </div>

                <div className="rounded-3xl bg-white/[0.04] ring-1 ring-white/10 p-5 sm:p-6">
                  <div className="grid gap-3">
                    <Pill>Inventory Guidelines</Pill>
                    <Card title="SKU Control" desc="Keep every SKU unique for accurate tracking." />
                    <Card
                      title="Pricing"
                      desc="Buying and selling prices support future business analytics."
                    />
                    <Card
                      title="Low Stock"
                      desc="Items at or below minimum stock should be reordered."
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-12">
              <div className="lg:col-span-12 rounded-3xl bg-white/[0.06] ring-1 ring-white/10 p-4 sm:p-6 min-w-0">
                <SectionTitle
                  eyebrow="Inventory Table"
                  title="Live Inventory Records"
                  pill={`${filteredItems.length} showing`}
                />

                <div className="mt-4 overflow-x-auto rounded-2xl ring-1 ring-white/10">
                  <table className="min-w-[1100px] w-full text-sm">
                    <thead className="bg-white/5 text-white/70">
                      <tr>
                        <th className="text-left font-semibold px-4 py-3">Item</th>
                        <th className="text-left font-semibold px-4 py-3">SKU</th>
                        <th className="text-left font-semibold px-4 py-3">Category</th>
                        <th className="text-left font-semibold px-4 py-3">Supplier</th>
                        <th className="text-left font-semibold px-4 py-3">Location</th>
                        <th className="text-right font-semibold px-4 py-3">Qty</th>
                        <th className="text-right font-semibold px-4 py-3">Min</th>
                        <th className="text-right font-semibold px-4 py-3">Buy</th>
                        <th className="text-right font-semibold px-4 py-3">Sell</th>
                        <th className="text-left font-semibold px-4 py-3">Status</th>
                        <th className="text-right font-semibold px-4 py-3">Actions</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-white/10">
                      {loading ? (
                        <tr>
                          <td className="px-4 py-4 text-white/70" colSpan={11}>
                            Loading...
                          </td>
                        </tr>
                      ) : filteredItems.length === 0 ? (
                        <tr>
                          <td className="px-4 py-4 text-white/70" colSpan={11}>
                            No inventory items found.
                          </td>
                        </tr>
                      ) : (
                        filteredItems.map((it) => {
                          const qty = sanitizeNumber(it.quantity);
                          const min = sanitizeNumber(it.minStockLevel);
                          const low = qty <= min;

                          return (
                            <tr key={it.id} className="text-white/85 align-top">
                              <td className="px-4 py-3">{it.itemName}</td>
                              <td className="px-4 py-3">{it.sku}</td>
                              <td className="px-4 py-3">{it.category}</td>
                              <td className="px-4 py-3">{it.supplier || "-"}</td>
                              <td className="px-4 py-3">{it.location || "-"}</td>
                              <td className="px-4 py-3 text-right">{qty}</td>
                              <td className="px-4 py-3 text-right">{min}</td>
                              <td className="px-4 py-3 text-right">
                                {formatCurrency(it.buyingPrice)}
                              </td>
                              <td className="px-4 py-3 text-right">
                                {formatCurrency(it.sellingPrice)}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={
                                    "inline-flex items-center rounded-full px-2.5 py-1 text-xs ring-1 " +
                                    (low
                                      ? "bg-amber-500/15 text-amber-200 ring-amber-500/20"
                                      : "bg-emerald-500/15 text-emerald-200 ring-emerald-500/20")
                                  }
                                >
                                  {low ? "Low Stock" : "OK"}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => startEdit(it)}
                                    disabled={busy}
                                    className="rounded-xl bg-white/5 ring-1 ring-white/15 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10 disabled:opacity-60"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => onDelete(it)}
                                    disabled={busy}
                                    className="rounded-xl bg-red-500/15 ring-1 ring-red-500/25 px-3 py-2 text-xs font-semibold text-red-100 hover:bg-red-500/20 disabled:opacity-60"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 text-xs text-white/50">
                  Tip: Low stock status is triggered when quantity is less than or equal to
                  minimum stock level.
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === "users" && (
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-5 flex flex-col gap-6">
              <div className="rounded-3xl bg-white/[0.06] ring-1 ring-white/10 p-5 sm:p-6">
                <SectionTitle
                  eyebrow="Security-focused user management"
                  title="Role & Status Control"
                />

                <div className="mt-4 grid gap-3">
                  <Card
                    title="No fake account creation"
                    desc="Users must self-register. Admin only changes role and status."
                  />
                  <Card
                    title="Disable instead of delete"
                    desc="For safety and auditability, accounts should be disabled instead of deleted."
                  />
                  <Card
                    title="Least privilege"
                    desc="Grant admin role only when absolutely necessary."
                  />
                </div>

                {userMsg ? (
                  <div className="mt-4 rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-3 text-sm text-white/80">
                    {userMsg}
                  </div>
                ) : null}
              </div>

              <div className="rounded-3xl bg-white/[0.04] ring-1 ring-white/10 p-5 sm:p-6">
                <div className="text-sm text-white/70">Search Users</div>
                <div className="mt-2">
                  <Input
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search by name / email / role / status..."
                  />
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <Card title={`${usersList.length} users`} desc="Total registered profiles." />
                  <Card
                    title={`${usersList.filter((u) => u.role === "admin").length} admins`}
                    desc="High privilege users."
                  />
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 rounded-3xl bg-white/[0.06] ring-1 ring-white/10 p-4 sm:p-6 min-w-0">
              <SectionTitle
                eyebrow="Registered Users"
                title="Role & Status Management"
                pill={`${filteredUsers.length} showing`}
              />

              <div className="mt-4 overflow-x-auto rounded-2xl ring-1 ring-white/10">
                <table className="min-w-[850px] w-full text-sm">
                  <thead className="bg-white/5 text-white/70">
                    <tr>
                      <th className="text-left font-semibold px-4 py-3">Name</th>
                      <th className="text-left font-semibold px-4 py-3">Email</th>
                      <th className="text-left font-semibold px-4 py-3">Role</th>
                      <th className="text-left font-semibold px-4 py-3">Status</th>
                      <th className="text-right font-semibold px-4 py-3">Actions</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-white/10">
                    {usersLoading ? (
                      <tr>
                        <td className="px-4 py-4 text-white/70" colSpan={5}>
                          Loading users...
                        </td>
                      </tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr>
                        <td className="px-4 py-4 text-white/70" colSpan={5}>
                          No users found.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => {
                        const isSelf = u.id === user.uid;

                        return (
                          <tr key={u.id} className="text-white/85 align-top">
                            <td className="px-4 py-3">{u.name || "-"}</td>
                            <td className="px-4 py-3 break-all">{u.email}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs ring-1 ${
                                  u.role === "admin"
                                    ? "bg-indigo-500/15 text-indigo-200 ring-indigo-500/20"
                                    : "bg-emerald-500/15 text-emerald-200 ring-emerald-500/20"
                                }`}
                              >
                                {u.role || "staff"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs ring-1 ${
                                  (u.status || "active") === "active"
                                    ? "bg-emerald-500/15 text-emerald-200 ring-emerald-500/20"
                                    : "bg-red-500/15 text-red-200 ring-red-500/20"
                                }`}
                              >
                                {u.status || "active"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-2 flex-wrap">
                                <button
                                  disabled={isSelf}
                                  onClick={() =>
                                    handleUserRoleChange(
                                      u,
                                      (u.role || "staff") === "admin" ? "staff" : "admin"
                                    )
                                  }
                                  className="rounded-xl bg-white/5 ring-1 ring-white/15 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10 disabled:opacity-40"
                                >
                                  {(u.role || "staff") === "admin" ? "Make Staff" : "Make Admin"}
                                </button>

                                <button
                                  disabled={isSelf}
                                  onClick={() =>
                                    handleUserStatusChange(
                                      u,
                                      (u.status || "active") === "active"
                                        ? "disabled"
                                        : "active"
                                    )
                                  }
                                  className="rounded-xl bg-amber-500/15 ring-1 ring-amber-500/25 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-500/20 disabled:opacity-40"
                                >
                                  {(u.status || "active") === "active" ? "Disable" : "Activate"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "approvals" && (
          <>
            <div className="grid gap-6 lg:grid-cols-12">
              <div className="lg:col-span-12 flex flex-col gap-6">
                <div className="rounded-3xl bg-white/[0.04] ring-1 ring-white/10 p-5 sm:p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="w-full md:max-w-xs">
                    <div className="text-sm text-white/70">Search Documents</div>
                    <div className="mt-2">
                      <Input
                        value={docSearch}
                        onChange={(e) => setDocSearch(e.target.value)}
                        placeholder="Search by title / owner / status..."
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 flex-wrap">
                    <Card title={`${docsList.length} total`} desc="Uploaded docs." />
                    <Card
                      title={`${docsList.filter((d) => d.status === "pending").length} pending`}
                      desc="Awaiting approval."
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-12">
              <div className="lg:col-span-12 rounded-3xl bg-white/[0.06] ring-1 ring-white/10 p-4 sm:p-6 min-w-0">
                <SectionTitle
                  eyebrow="Document Workflow"
                  title="Approve and Reject Requests"
                  pill={`${filteredDocs.length} showing`}
                />

                {docMsg ? (
                  <div className="mt-4 rounded-xl bg-white/5 ring-1 ring-white/10 px-4 py-3 text-sm text-white/80">
                    {docMsg}
                  </div>
                ) : null}

                <div className="mt-4 overflow-x-auto rounded-2xl ring-1 ring-white/10">
                  <table className="min-w-[850px] w-full text-sm">
                    <thead className="bg-white/5 text-white/70">
                      <tr>
                        <th className="text-left font-semibold px-4 py-3">Title</th>
                        <th className="text-left font-semibold px-4 py-3">Owner</th>
                        <th className="text-left font-semibold px-4 py-3">Status</th>
                        <th className="text-right font-semibold px-4 py-3">Actions</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-white/10">
                      {docsLoading ? (
                        <tr>
                          <td className="px-4 py-4 text-white/70" colSpan={4}>
                            Loading documents...
                          </td>
                        </tr>
                      ) : filteredDocs.length === 0 ? (
                        <tr>
                          <td className="px-4 py-4 text-white/70" colSpan={4}>
                            No documents found.
                          </td>
                        </tr>
                      ) : (
                        filteredDocs.map((d) => (
                          <tr key={d.id} className="text-white/85 align-top">
                            <td className="px-4 py-3 font-medium">
                              <div>{d.title || "-"}</div>
                              {d.description ? (
                                <div className="text-xs text-white/50 mt-1 leading-5">
                                  {d.description}
                                </div>
                              ) : null}
                              {d.status === "approved" && d.approvedByEmail && (
                                <div className="mt-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-200">
                                  <div><strong className="font-semibold text-emerald-300">Approved By:</strong> {d.approvedByEmail}</div>
                                  {d.approvedAt && <div><strong className="font-semibold text-emerald-300">Date:</strong> {formatDate(d.approvedAt)}</div>}
                                </div>
                              )}
                              {d.status === "rejected" && d.rejectedByEmail && (
                                <div className="mt-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-200">
                                  <div><strong className="font-semibold text-red-300">Rejected By:</strong> {d.rejectedByEmail}</div>
                                  {d.rejectedAt && <div><strong className="font-semibold text-red-300">Date:</strong> {formatDate(d.rejectedAt)}</div>}
                                  {d.rejectionReason && <div className="mt-1"><strong className="font-semibold text-red-300">Reason:</strong> {d.rejectionReason}</div>}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3">{d.ownerName || "-"}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs ring-1 ${
                                  d.status === "approved"
                                    ? "bg-emerald-500/15 text-emerald-200 ring-emerald-500/20"
                                    : d.status === "rejected"
                                    ? "bg-red-500/15 text-red-200 ring-red-500/20"
                                    : "bg-amber-500/15 text-amber-200 ring-amber-500/20"
                                }`}
                              >
                                {d.status === "pending"
                                  ? "Pending Review"
                                  : (d.status || "pending").charAt(0).toUpperCase() +
                                    (d.status || "pending").slice(1)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-2 flex-wrap">
                                <button
                                  onClick={() => requestDocumentStatusChange(d, "approved")}
                                  disabled={docBusy || d.status === "approved"}
                                  className="rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/25 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-40"
                                >
                                  Approve
                                </button>

                                <button
                                  onClick={() => requestDocumentStatusChange(d, "rejected")}
                                  disabled={docBusy || d.status === "rejected"}
                                  className="rounded-xl bg-red-500/15 ring-1 ring-red-500/25 px-3 py-2 text-xs font-semibold text-red-100 hover:bg-red-500/20 disabled:opacity-40"
                                >
                                  Reject
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </PageShell>
    </>
  );
}