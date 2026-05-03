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
import MeasuredChartFrame from "../components/MeasuredChartFrame";
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
import { listenAnomalyAlerts } from "../firebase/anomalyActions";
import { listenSuppliers } from "../firebase/supplierActions";
import { listenCustomers } from "../firebase/customerActions";
import BulkImportModal from "../components/BulkImportModal";
import AiSummaryPanel from "../components/AiSummaryPanel";
import ReauthModal from "../components/ReauthModal";
import { generateBusinessSummary } from "../utils/aiSummaryRules";
const cx = (...classes) => classes.filter(Boolean).join(" ");

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

function MetricCard({ label, value, sub, icon, color = "indigo", alert = false }) {
  const colors = {
    indigo: "from-indigo-500/20 to-indigo-500/5 text-indigo-400 ring-indigo-500/20",
    amber: "from-amber-500/20 to-amber-500/5 text-amber-400 ring-amber-500/20",
    emerald: "from-emerald-500/20 to-emerald-500/5 text-emerald-400 ring-emerald-500/20",
    purple: "from-purple-500/20 to-purple-500/5 text-purple-400 ring-purple-500/20",
    blue: "from-blue-500/20 to-blue-500/5 text-blue-400 ring-blue-500/20",
    red: "from-red-500/20 to-red-500/5 text-red-400 ring-red-500/20",
  };

  const selectedColor = colors[color] || colors.indigo;

  return (
    <div className={cx(
      "relative overflow-hidden rounded-3xl bg-white/[0.03] p-6 sm:p-8 ring-1 transition-all duration-500 group hover:bg-white/[0.05]",
      selectedColor,
      alert && "shadow-[0_0_30px_rgba(245,158,11,0.1)]"
    )}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50 mb-2">{label}</div>
          <div className="text-3xl font-black tracking-tight text-white mb-1 group-hover:scale-105 transition-transform origin-left duration-500">
            {value}
          </div>
          {sub && <div className="text-[10px] font-bold opacity-40 uppercase tracking-widest">{sub}</div>}
        </div>
        {icon && (
          <div className="h-10 w-10 rounded-2xl bg-white/5 ring-1 ring-white/10 flex items-center justify-center text-xl shadow-inner group-hover:rotate-12 transition-transform duration-500">
            {icon}
          </div>
        )}
      </div>
      
      {/* Dynamic ambient glow */}
      <div className="absolute -bottom-10 -right-10 h-32 w-32 bg-current opacity-[0.03] blur-[40px] pointer-events-none" />
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

  const [reauthModal, setReauthModal] = useState(null);
  function openReauth(opts) { setReauthModal(opts); }
  function closeReauth() { setReauthModal(null); }

  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [lowStockPreviewAlerts, setLowStockPreviewAlerts] = useState([]);
  const [showBulkImport, setShowBulkImport] = useState(false);
  // Preview slice (3 items) for Suspicious Activity preview panel
  const [anomalyAlerts, setAnomalyAlerts] = useState([]);
  // Full list for AI summary computation
  const [allAnomalyAlerts, setAllAnomalyAlerts] = useState([]);

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

  // Load anomaly alerts — full list for AI summary, slice for preview panel
  useEffect(() => {
    const unsub = listenAnomalyAlerts((data) => {
      setAllAnomalyAlerts(data); // full set for AI summary
      // preview panel shows latest 3 non-resolved
      const activeOnly = data.filter((a) => {
        const status = String(a.status || "active").toLowerCase();
        return status !== "resolved";
      });
      setAnomalyAlerts(activeOnly.slice(0, 3));
    });
    return () => unsub();
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

  // ─── AI Business Summary (rule-based) ────────────────────────────────────────
  const aiSummary = useMemo(() => {
    return generateBusinessSummary({
      sales,
      inventory: items,
      customers,
      suppliers,
      notifications,
      anomalies: allAnomalyAlerts,
    });
  }, [sales, items, customers, suppliers, notifications, allAnomalyAlerts]);

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
        openReauth({
          title: "Verify Deletion",
          body: `Deleting "${item.itemName}" is a permanent action. Please enter your password to confirm.`,
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
          }
        });
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
        openReauth({
          title: "Verify Role Change",
          body: `You are changing ${targetUser.email}'s role to ${newRole}. This is a sensitive security action.`,
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
                  reauthenticated: true,
                  protectedAction: true
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
          }
        });
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
        openReauth({
          title: isDisabling ? "Verify Account Disable" : "Verify Account Activation",
          body: `Updating status for ${targetUser.email} requires administrator verification.`,
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
                  reauthenticated: true,
                  protectedAction: true
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
          }
        });
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
    <ReauthModal state={reauthModal} onClose={closeReauth} />
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
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div className="animate-in slide-in-from-left duration-700">
            <Pill className="mb-3">Administrative Terminal</Pill>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white leading-none">
              Strategic Control
            </h1>

            <p className="mt-4 text-sm text-white/50 font-medium flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Secure Session: <span className="text-white">{profile?.name || user?.email}</span> 
              <span className="mx-2 text-white/10">|</span>
              Clearence: <span className="text-white uppercase tracking-widest text-[10px] bg-white/5 px-2 py-0.5 rounded-md">{profile?.role || "admin"}</span>
            </p>
          </div>

          <div className="flex flex-wrap gap-3 animate-in slide-in-from-right duration-700">
            <Link to="/sales-history">
              <SecondaryButton className="!py-3 !px-6">Sales Archive</SecondaryButton>
            </Link>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-4">
          <MetricCard 
            label="Inventory Assets" 
            value={items.length} 
            sub="Total stock records" 
            icon="📦"
            color="indigo"
          />
          <MetricCard 
            label="Resource Alerts" 
            value={lowStockCount} 
            sub="Replenishment required" 
            icon="🚨"
            color="amber"
            alert={lowStockCount > 0}
          />
          <MetricCard 
            label="Access Directory" 
            value={usersList.length} 
            sub="Verified user profiles" 
            icon="👥"
            color="blue"
          />
          <MetricCard 
            label="Asset Valuation" 
            value={formatCurrency(totalRevenueEstimate)} 
            sub="Estimated market value" 
            icon="💎"
            color="purple"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-4">
          <MetricCard 
            label="Transaction Volume" 
            value={salesAnalytics.totalSalesCount} 
            sub="Total sales processed" 
            icon="⚡"
            color="emerald"
          />
          <MetricCard 
            label="Unit Velocity" 
            value={salesAnalytics.totalUnitsSold} 
            sub="Global units distributed" 
            icon="📈"
            color="blue"
          />
          <MetricCard 
            label="Gross Revenue" 
            value={formatCurrency(salesAnalytics.totalRevenue)} 
            sub="Verified sales income" 
            icon="💰"
            color="indigo"
          />
          <MetricCard 
            label="Strategic Profit" 
            value={formatCurrency(salesAnalytics.totalProfit)} 
            sub="Net operational margin" 
            icon="⚖️"
            color="emerald"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-10">
          <MetricCard 
            label="Loyalty Base" 
            value={customers.length} 
            sub="Registered customer accounts" 
            icon="🏅"
            color="purple"
          />
          <MetricCard 
            label="Supply Chain" 
            value={suppliers.length} 
            sub="Verified supplier contacts" 
            icon="🚚"
            color="blue"
          />
          <MetricCard 
            label="Active Alerts" 
            value={notifications.filter(n => !n.isRead).length} 
            sub="Unread system notifications" 
            icon="🔔"
            color="amber"
            alert={notifications.filter(n => !n.isRead).length > 0}
          />
          <MetricCard 
            label="Task Backlog" 
            value={docsList.filter(d => d.status === "pending").length} 
            sub="Documents awaiting approval" 
            icon="📝"
            color="indigo"
            alert={docsList.filter(d => d.status === "pending").length > 0}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-2 mb-10">
          <div className="rounded-[2.5rem] bg-white/[0.03] backdrop-blur-xl ring-1 ring-white/10 p-8 sm:p-10 border border-white/5 shadow-2xl">
            <SectionTitle
              eyebrow="Market Intelligence"
              title="Revenue Trajectory"
              pill="Real-time Trend"
            />

            <p className="mt-4 text-[13px] leading-relaxed text-white/40 font-medium">
              Daily revenue fluctuation analysis across the recent operational window.
            </p>

            <div className="mt-8 h-80">
              {salesLoading ? (
                <div className="flex h-full items-center justify-center rounded-3xl bg-white/5 ring-1 ring-white/10 px-4 py-4 text-sm text-white/30 italic">
                  Synchronizing analytical data...
                </div>
              ) : chartData.revenueTrend.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-3xl bg-white/5 ring-1 ring-white/10 px-4 py-4 text-sm text-white/30 italic">
                  No revenue trend detected in the current window.
                </div>
              ) : (
                <MeasuredChartFrame height={320}>
                  {({ width, height }) => (
                    <LineChart
                      width={width}
                      height={height}
                      data={chartData.revenueTrend}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                      <XAxis 
                        dataKey="label" 
                        stroke="#ffffff20" 
                        tick={{ fontSize: 10, fontWeight: 700, fill: "#ffffff40" }} 
                        axisLine={false}
                        tickLine={false}
                        dy={10}
                      />
                      <YAxis 
                        stroke="#ffffff20" 
                        tick={{ fontSize: 10, fontWeight: 700, fill: "#ffffff40" }} 
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(val) => `Rs. ${val/1000}k`}
                      />
                      <Tooltip content={<CustomLineTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        stroke="#818cf8"
                        strokeWidth={4}
                        dot={{ r: 5, fill: "#818cf8", strokeWidth: 2, stroke: "#0f172a" }}
                        activeDot={{ r: 8, strokeWidth: 0 }}
                      />
                    </LineChart>
                  )}
                </MeasuredChartFrame>
              )}
            </div>
          </div>

          <div className="rounded-[2.5rem] bg-white/[0.03] backdrop-blur-xl ring-1 ring-white/10 p-8 sm:p-10 border border-white/5 shadow-2xl">
            <SectionTitle
              eyebrow="Inventory Health"
              title="Stock Distribution"
              pill="Inventory Ratio"
            />

            <p className="mt-4 text-[13px] leading-relaxed text-white/40 font-medium">
              Critical ratio analysis of healthy assets versus replenishment risks.
            </p>

            <div className="mt-8 h-80 relative">
              {loading ? (
                <div className="flex h-full items-center justify-center rounded-3xl bg-white/5 ring-1 ring-white/10 px-4 py-4 text-sm text-white/30 italic">
                  Analyzing stock levels...
                </div>
              ) : items.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-3xl bg-white/5 ring-1 ring-white/10 px-4 py-4 text-sm text-white/30 italic">
                  Insufficient inventory data for distribution mapping.
                </div>
              ) : (
                <>
                  <MeasuredChartFrame height={320}>
                    {({ width, height }) => {
                      const outer = Math.max(80, Math.min(width, height) / 3);
                      const inner = Math.max(50, outer - 30);
                      return (
                        <PieChart width={width} height={height}>
                          <Pie
                            data={lowStockPieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={inner}
                            outerRadius={outer}
                            dataKey="value"
                            paddingAngle={8}
                            stroke="none"
                          >
                            {lowStockPieData.map((entry, index) => (
                              <Cell
                                key={`cell-${entry.name}`}
                                fill={index === 0 ? "#fb7185" : "#818cf8"}
                                className="hover:opacity-80 transition-opacity"
                              />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomPieTooltip />} />
                        </PieChart>
                      );
                    }}
                  </MeasuredChartFrame>
                  
                  {/* Center info */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <div className="text-2xl font-black text-white">{lowStockCount}</div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-white/30">Low Risk</div>
                  </div>
                </>
              )}
            </div>

            <div className="mt-6 flex justify-center gap-8 text-[10px] font-black uppercase tracking-widest text-white/40">
              <div className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-[#fb7185] shadow-[0_0_10px_rgba(251,113,133,0.5)]" />
                <span>Replenish</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-[#818cf8] shadow-[0_0_10px_rgba(129,140,248,0.5)]" />
                <span>Healthy</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-3 mb-10">
          <div className="rounded-[2.5rem] bg-white/[0.03] ring-1 ring-white/10 p-8 border border-white/5 shadow-xl">
            <SectionTitle
              eyebrow="Margin Analysis"
              title="Profit Contribution"
              pill="Top Performers"
            />
            <div className="mt-8 h-72">
              {salesLoading ? (
                <div className="flex h-full items-center justify-center text-sm text-white/30 italic">Calculating margins...</div>
              ) : chartData.profitByItemChart.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-white/30 italic text-center">No profit metrics available.</div>
              ) : (
                <MeasuredChartFrame height={288}>
                  {({ width, height }) => (
                    <BarChart
                      width={width}
                      height={height}
                      data={chartData.profitByItemChart}
                      margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                      <XAxis dataKey="name" stroke="#ffffff20" tick={{ fontSize: 9, fontWeight: 700, fill: "#ffffff30" }} axisLine={false} tickLine={false} dy={5} />
                      <YAxis stroke="#ffffff20" tick={{ fontSize: 9, fontWeight: 700, fill: "#ffffff30" }} axisLine={false} tickLine={false} tickFormatter={(val) => `${val/1000}k`} />
                      <Tooltip content={<CustomBarTooltip />} />
                      <Bar dataKey="profit" fill="#10b981" radius={[10, 10, 0, 0]} barSize={30} />
                    </BarChart>
                  )}
                </MeasuredChartFrame>
              )}
            </div>
          </div>

          <div className="rounded-[2.5rem] bg-white/[0.03] ring-1 ring-white/10 p-8 border border-white/5 shadow-xl">
            <SectionTitle
              eyebrow="Client Intelligence"
              title="Portfolio Value"
              pill="Value Tiers"
            />
            <div className="mt-8 h-72 relative">
              {salesLoading ? (
                <div className="flex h-full items-center justify-center text-sm text-white/30 italic">Mapping portfolio...</div>
              ) : customerValuePieData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-white/30 italic text-center">No client value data detected.</div>
              ) : (
                <MeasuredChartFrame height={288}>
                  {({ width, height }) => {
                    const outer = Math.max(60, Math.min(width, height) / 3);
                    const inner = Math.max(40, outer - 20);
                    return (
                      <PieChart width={width} height={height}>
                        <Pie
                          data={customerValuePieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={inner}
                          outerRadius={outer}
                          dataKey="value"
                          paddingAngle={5}
                          stroke="none"
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
                    );
                  }}
                </MeasuredChartFrame>
              )}
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-4 text-[9px] font-black uppercase tracking-widest text-white/30">
              {["Premium", "High Value", "Regular"].map((tier, i) => (
                <div key={tier} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ["#fbbf24", "#38bdf8", "#a8a29e"][i] }} />
                  {tier}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2.5rem] bg-white/[0.03] ring-1 ring-white/10 p-8 border border-white/5 shadow-xl">
            <SectionTitle
              eyebrow="Yield Optimization"
              title="Offer Adoption"
              pill="Discount Mix"
            />
            <div className="mt-8 h-72">
              {salesLoading ? (
                <div className="flex h-full items-center justify-center text-sm text-white/30 italic">Computing adoption rates...</div>
              ) : discountUsagePieData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-white/30 italic text-center">No discount telemetry found.</div>
              ) : (
                <MeasuredChartFrame height={288}>
                  {({ width, height }) => {
                    const outer = Math.max(60, Math.min(width, height) / 3);
                    const inner = Math.max(40, outer - 20);
                    return (
                      <PieChart width={width} height={height}>
                        <Pie
                          data={discountUsagePieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={inner}
                          outerRadius={outer}
                          dataKey="value"
                          paddingAngle={5}
                          stroke="none"
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
                    );
                  }}
                </MeasuredChartFrame>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-2 mb-10">
          <div className="rounded-[2.5rem] bg-white/[0.03] ring-1 ring-white/10 p-8 sm:p-10 border border-white/5 shadow-2xl">
            <SectionTitle
              eyebrow="Market Velocity"
              title="Top Performing Assets"
              pill="High Demand"
            />

            <div className="mt-8 space-y-4">
              {salesLoading ? (
                <div className="flex h-40 items-center justify-center rounded-3xl bg-white/5 text-sm text-white/30 italic">
                  Mapping sales performance...
                </div>
              ) : salesAnalytics.topSellingItems.length === 0 ? (
                <div className="flex h-40 items-center justify-center rounded-3xl bg-white/5 text-sm text-white/30 italic">
                  No sales telemetry available.
                </div>
              ) : (
                salesAnalytics.topSellingItems.map((item, index) => (
                  <div
                    key={`${item.sku}-${index}`}
                    className="group rounded-3xl bg-white/[0.02] ring-1 ring-white/5 p-5 hover:bg-white/[0.05] hover:ring-white/10 transition-all duration-300"
                  >
                    <div className="flex items-center justify-between gap-6">
                      <div className="flex items-center gap-5 min-w-0">
                        <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 ring-1 ring-indigo-500/20 flex items-center justify-center text-indigo-400 font-black text-xs shrink-0 group-hover:scale-110 transition-transform">
                          {String(index + 1).padStart(2, '0')}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-black text-white truncate group-hover:text-indigo-300 transition-colors">
                            {item.itemName}
                          </div>
                          <div className="text-[10px] font-black uppercase tracking-widest text-white/30 mt-1">SKU: {item.sku}</div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-sm font-black text-white">
                          {item.totalUnits} <span className="text-[10px] text-white/30 uppercase tracking-widest ml-1">Units</span>
                        </div>
                        <div className="text-[11px] font-bold text-emerald-400 mt-1">
                          {formatCurrency(item.totalRevenue)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[2.5rem] bg-white/[0.03] ring-1 ring-white/10 p-8 sm:p-10 border border-white/5 shadow-2xl">
            <SectionTitle
              eyebrow="Operational Log"
              title="Recent Transactions"
              pill="Live Stream"
            />

            <div className="mt-8 space-y-4">
              {salesLoading ? (
                <div className="flex h-40 items-center justify-center rounded-3xl bg-white/5 text-sm text-white/30 italic">
                  Synchronizing transaction log...
                </div>
              ) : salesAnalytics.recentSales.length === 0 ? (
                <div className="flex h-40 items-center justify-center rounded-3xl bg-white/5 text-sm text-white/30 italic">
                  No recent operational activity detected.
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
                      className={cx(
                        "group rounded-3xl bg-white/[0.02] ring-1 ring-white/5 p-5 transition-all duration-300",
                        isCancelled ? "opacity-40 grayscale" : "hover:bg-white/[0.05] hover:ring-white/10"
                      )}
                    >
                      <div className="flex items-center justify-between gap-6">
                        <div className="min-w-0">
                          <div className="text-sm font-black text-white truncate">
                            {getSaleItemSummary(sale) || "Unidentified Asset"}
                          </div>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-[9px] font-black uppercase tracking-widest text-white/30">INV-{sale.invoiceNumber}</span>
                            {isCancelled && <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 text-[8px] font-black uppercase tracking-[0.2em] ring-1 ring-red-500/20">Cancelled</span>}
                            {isReturned && <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 text-[8px] font-black uppercase tracking-[0.2em] ring-1 ring-purple-500/20">Returned</span>}
                            {isPartial && <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[8px] font-black uppercase tracking-[0.2em] ring-1 ring-amber-500/20">Partial</span>}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-sm font-black text-white">
                            {isCancelled ? <span className="line-through text-white/20">{formatCurrency(getSaleTotal(sale))}</span> : formatCurrency(sale.finalTotalAfterReturn ?? getSaleTotal(sale))}
                          </div>
                          <div className="text-[9px] font-black uppercase tracking-widest text-white/20 mt-1.5">
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

        <div className="grid gap-6 xl:grid-cols-2 mb-10">
          <div className="rounded-[2.5rem] bg-white/[0.03] ring-1 ring-white/10 p-8 sm:p-10 border border-white/5 shadow-2xl">
            <SectionTitle
              eyebrow="Intelligence Synthesis"
              title="Business Signals"
              pill={`${aiInsights.insights.length} active`}
            />

            <div className="mt-8 space-y-4">
              {aiInsights.insights.length === 0 ? (
                <div className="flex h-32 items-center justify-center rounded-3xl bg-white/5 text-xs text-white/30 italic text-center px-10">
                  Awaiting sufficient data volume for signal synthesis.
                </div>
              ) : (
                aiInsights.insights.map((insight, index) => (
                  <div
                    key={`${insight.title}-${index}`}
                    className="rounded-3xl bg-white/[0.02] ring-1 ring-white/5 p-6 hover:bg-white/[0.04] transition-all"
                  >
                    <div className="flex items-center gap-4 mb-4">
                      <div className={cx(
                        "h-2 w-2 rounded-full",
                        insight.type === "warning" ? "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]" :
                        insight.type === "success" ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]" :
                        "bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.5)]"
                      )} />
                      <div className="text-[11px] font-black uppercase tracking-[0.2em] text-white/70">{insight.title}</div>
                    </div>
                    <div className="text-sm leading-relaxed text-white/50 font-medium">{insight.text}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[2.5rem] bg-white/[0.03] ring-1 ring-white/10 p-8 sm:p-10 border border-white/5 shadow-2xl">
            <SectionTitle
              eyebrow="Executive Directives"
              title="Strategic Recommendations"
              pill={`${aiInsights.recommendations.length} primary`}
            />

            <div className="mt-8 space-y-4">
              {aiInsights.recommendations.length === 0 ? (
                <div className="flex h-32 items-center justify-center rounded-3xl bg-white/5 text-xs text-white/30 italic text-center px-10">
                  Add operational telemetry to unlock strategic recommendations.
                </div>
              ) : (
                aiInsights.recommendations.map((rec, index) => (
                  <div
                    key={`${rec.title}-${index}`}
                    className="rounded-3xl bg-white/[0.02] ring-1 ring-white/5 p-6 hover:bg-white/[0.04] transition-all"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-[11px] font-black uppercase tracking-[0.2em] text-white/70">{rec.title}</div>
                      <span className={cx(
                        "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                        rec.priority === "High" ? "bg-red-500/10 text-red-400" :
                        rec.priority === "Medium" ? "bg-amber-500/10 text-amber-400" :
                        "bg-slate-500/10 text-slate-400"
                      )}>
                        {rec.priority} Priority
                      </span>
                    </div>
                    <div className="text-sm leading-relaxed text-white/50 font-medium">{rec.text}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-2 mb-10">
          <div className="rounded-[2.5rem] bg-white/[0.03] ring-1 ring-white/10 p-8 sm:p-10 border border-white/5 shadow-2xl">
            <div className="flex items-center justify-between gap-6 mb-8 flex-wrap">
              <SectionTitle
                eyebrow="System Intelligence"
                title="Active Notifications"
                pill={notificationsLoading ? "Synchronizing..." : `${[...lowStockPreviewAlerts, ...notifications].length} Live`}
              />
              <Link to="/notifications">
                <SecondaryButton className="!py-2 !px-4 !text-[9px]">Archive</SecondaryButton>
              </Link>
            </div>

            <div className="grid gap-4">
              {notificationsLoading ? (
                <div className="rounded-3xl bg-white/5 p-6 text-sm text-white/30 italic text-center">
                  Fetching system telemetry...
                </div>
              ) : [...lowStockPreviewAlerts, ...notifications].length === 0 ? (
                <div className="rounded-3xl bg-white/5 p-6 text-sm text-white/30 italic text-center">
                  No active system alerts detected.
                </div>
              ) : (
                [...lowStockPreviewAlerts, ...notifications].slice(0, 3).map((notif) => (
                  <div
                    key={notif.id}
                    className={cx(
                      "group rounded-3xl ring-1 p-5 transition-all duration-300",
                      notif.id?.startsWith("low-stock-")
                        ? "bg-amber-500/[0.03] ring-amber-500/20 hover:bg-amber-500/[0.06]"
                        : notif.isRead
                        ? "bg-white/[0.01] ring-white/5 opacity-50"
                        : "bg-white/[0.04] ring-white/10 hover:bg-white/[0.06] shadow-lg"
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <div className="pt-1">
                        {!notif.isRead && <div className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)] animate-pulse" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-black text-white truncate group-hover:text-white transition-colors">{notif.title}</div>
                        <p className="mt-1 text-[13px] text-white/40 font-medium line-clamp-2 leading-relaxed">{notif.message}</p>
                        <div className="mt-4 text-[9px] font-black uppercase tracking-widest text-white/20">{formatDate(notif.createdAt)}</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[2.5rem] bg-gradient-to-br from-red-500/[0.05] via-slate-900 to-transparent ring-1 ring-red-500/20 p-8 sm:p-10 border border-white/5 shadow-2xl">
            <div className="flex items-center justify-between gap-6 mb-8 flex-wrap">
              <SectionTitle
                eyebrow="Sentinel Protocol"
                title="Security Anomalies"
                pill={`${anomalyAlerts.length} Detected`}
              />
              <Link to="/notifications">
                <SecondaryButton className="!py-2 !px-4 !text-[9px]">Audit Log</SecondaryButton>
              </Link>
            </div>

            <div className="grid gap-4">
              {anomalyAlerts.length === 0 ? (
                <div className="rounded-3xl bg-emerald-500/5 ring-1 ring-emerald-500/10 p-10 text-center">
                  <div className="text-2xl mb-4">🛡️</div>
                  <div className="text-sm font-black text-emerald-400 uppercase tracking-widest">Protocol Nominal</div>
                  <p className="mt-2 text-xs text-white/30 font-medium leading-relaxed">No suspicious patterns detected in recent operations.</p>
                </div>
              ) : (
                anomalyAlerts.slice(0, 3).map((alert) => {
                  const isHigh = alert.severity === "high";
                  return (
                    <div 
                      key={alert.id} 
                      className={cx(
                        "group rounded-3xl ring-1 p-5 transition-all duration-300",
                        isHigh ? "bg-red-500/[0.05] ring-red-500/20 hover:bg-red-500/[0.08]" : "bg-white/[0.04] ring-white/10 hover:bg-white/[0.06]"
                      )}
                    >
                      <div className="flex items-start gap-4">
                        <div className={cx(
                          "h-10 w-10 rounded-2xl flex items-center justify-center text-lg shadow-inner shrink-0",
                          isHigh ? "bg-red-500/10 text-red-400 ring-1 ring-red-500/20" : "bg-white/5 text-white/30 ring-1 ring-white/10"
                        )}>
                          🚨
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <div className="flex items-center gap-3 mb-2">
                            <span className={cx(
                              "text-[8px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-md ring-1",
                              isHigh ? "bg-red-500/10 text-red-400 ring-red-500/20" : "bg-white/10 text-white/40 ring-white/10"
                            )}>
                              {alert.severity || "Standard"}
                            </span>
                          </div>
                          <div className="text-sm font-black text-white group-hover:text-white transition-colors">{alert.title}</div>
                          <p className="mt-2 text-[13px] text-white/40 font-medium line-clamp-2 leading-relaxed">{alert.message}</p>
                          <div className="mt-4 text-[9px] font-black uppercase tracking-widest text-white/20">{formatDate(alert.createdAt)}</div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ── Level 2 Step 4: AI Business Summary ─────────────────────────── */}
        <AiSummaryPanel summary={aiSummary} />

        <div className="flex gap-4 border-b border-white/5 pb-6 flex-wrap mb-10">
          <button
            onClick={() => setActiveTab("inventory")}
            className={cx(
              "px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-300",
              activeTab === "inventory"
                ? "bg-white text-slate-950 shadow-xl"
                : "text-white/40 hover:text-white hover:bg-white/5"
            )}
          >
            Inventory Management
          </button>

          <button
            onClick={() => setActiveTab("users")}
            className={cx(
              "px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-300",
              activeTab === "users"
                ? "bg-white text-slate-950 shadow-xl"
                : "text-white/40 hover:text-white hover:bg-white/5"
            )}
          >
            User Directory
          </button>

          <button
            onClick={() => setActiveTab("approvals")}
            className={cx(
              "px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-300",
              activeTab === "approvals"
                ? "bg-white text-slate-950 shadow-xl"
                : "text-white/40 hover:text-white hover:bg-white/5"
            )}
          >
            Security Clearances
          </button>
        </div>

        {activeTab === "inventory" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="grid gap-10 lg:grid-cols-12 mb-10">
              <div className="lg:col-span-8">
                <div className="rounded-[2.5rem] bg-white/[0.03] backdrop-blur-xl ring-1 ring-white/10 p-8 sm:p-10 border border-white/5 shadow-2xl h-full">
                  <div className="flex items-center justify-between gap-6 mb-10 flex-wrap">
                    <div>
                      <Pill className="mb-3">{mode === "add" ? "Creation Engine" : "Modification Mode"}</Pill>
                      <h3 className="text-2xl font-black text-white tracking-tight">
                        {mode === "add" ? "Create Inventory Asset" : "Update Asset Registry"}
                      </h3>
                    </div>

                    <div className="flex gap-3">
                      {mode === "edit" && (
                        <button
                          onClick={resetForm}
                          className="px-6 py-3 rounded-2xl bg-white/5 ring-1 ring-white/10 text-[10px] font-black uppercase tracking-widest text-white/50 hover:bg-white/10 transition-all"
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        onClick={() => setShowBulkImport(true)}
                        className="px-6 py-3 rounded-2xl bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 shadow-lg shadow-indigo-500/20 transition-all"
                      >
                        📂 CSV Import
                      </button>
                    </div>
                  </div>

                  <form onSubmit={onSubmit} className="grid gap-8">
                    <div className="grid gap-6 sm:grid-cols-2">
                      <Field label="Asset Identity">
                        <Input
                          value={form.itemName}
                          onChange={(e) => setForm((p) => ({ ...p, itemName: e.target.value }))}
                          placeholder="Operational nomenclature..."
                          autoComplete="off"
                        />
                      </Field>

                      <Field label="Serial Reference (SKU)">
                        <Input
                          value={form.sku}
                          onChange={(e) => setForm((p) => ({ ...p, sku: e.target.value }))}
                          placeholder="Unique identifier..."
                          autoComplete="off"
                        />
                      </Field>
                    </div>

                    <div className="grid gap-6 sm:grid-cols-2">
                      <Field label="Resource Category">
                        <Input
                          value={form.category}
                          onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                          placeholder="Classification..."
                          autoComplete="off"
                        />
                      </Field>

                      <Field label="Supply Chain Partner">
                        {selectedSupplier ? (
                          <div className="rounded-2xl bg-indigo-500/5 ring-1 ring-indigo-500/20 px-4 py-3 flex items-center justify-between gap-4 group">
                            <div>
                              <div className="text-sm font-black text-white">{selectedSupplier.name}</div>
                              {selectedSupplier.phone && <div className="text-[10px] font-bold text-white/30 mt-1 uppercase tracking-widest">{selectedSupplier.phone}</div>}
                            </div>
                            <button
                              type="button"
                              onClick={() => { setSelectedSupplier(null); setSupplierSearch(""); setForm((p) => ({ ...p, supplier: "" })); }}
                              className="px-3 py-1 rounded-xl bg-white/5 ring-1 ring-white/10 text-[9px] font-black uppercase tracking-widest text-white/40 hover:bg-red-500/10 hover:text-red-400 hover:ring-red-500/20 transition-all"
                            >Release</button>
                          </div>
                        ) : (
                          <div className="relative">
                            <Input
                              value={supplierSearch}
                              onChange={(e) => { setSupplierSearch(e.target.value); setForm((p) => ({ ...p, supplier: e.target.value })); }}
                              placeholder="Search partner directory..."
                              autoComplete="off"
                            />
                            {supplierSearch.trim() && suppliers.filter((s) => s.name.toLowerCase().includes(supplierSearch.toLowerCase())).length > 0 && (
                              <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-[1.5rem] bg-slate-900 ring-1 ring-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden border border-white/5">
                                {suppliers.filter((s) => s.name.toLowerCase().includes(supplierSearch.toLowerCase())).slice(0, 5).map((s) => (
                                  <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => { setSelectedSupplier(s); setSupplierSearch(""); setForm((p) => ({ ...p, supplier: s.name })); }}
                                    className="w-full text-left px-6 py-4 hover:bg-white/[0.05] border-b border-white/5 last:border-0 transition-colors"
                                  >
                                    <div className="text-sm font-black text-white">{s.name}</div>
                                    {s.contactPerson && <div className="text-[10px] font-bold text-white/30 mt-1 uppercase tracking-widest">{s.contactPerson} {s.phone && `· ${s.phone}`}</div>}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </Field>
                    </div>

                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                      <Field label="Inventory Level">
                        <Input
                          type="number"
                          value={form.quantity}
                          onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
                        />
                      </Field>

                      <Field label="Critical Minimum">
                        <Input
                          type="number"
                          value={form.minStockLevel}
                          onChange={(e) => setForm((p) => ({ ...p, minStockLevel: e.target.value }))}
                        />
                      </Field>

                      <Field label="Acquisition Cost">
                        <Input
                          type="number"
                          value={form.buyingPrice}
                          onChange={(e) => setForm((p) => ({ ...p, buyingPrice: e.target.value }))}
                        />
                      </Field>

                      <Field label="Market Value">
                        <Input
                          type="number"
                          value={form.sellingPrice}
                          onChange={(e) => setForm((p) => ({ ...p, sellingPrice: e.target.value }))}
                        />
                      </Field>
                    </div>

                    <Field label="Registry Location">
                      <Input
                        value={form.location}
                        onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                        placeholder="Storage sector..."
                        autoComplete="off"
                      />
                    </Field>

                    <div className="grid gap-4 sm:grid-cols-2 pt-6">
                      <PrimaryButton type="submit" disabled={busy}>
                        {busy ? "Processing..." : mode === "add" ? "Deploy Asset" : "Commit Changes"}
                      </PrimaryButton>

                      <SecondaryButton
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          resetForm();
                          setMsg("");
                        }}
                      >
                        Clear Terminal
                      </SecondaryButton>
                    </div>

                    {msg && (
                      <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 px-6 py-4 text-xs font-bold text-white/50 italic animate-in fade-in zoom-in-95 duration-300">
                        {msg}
                      </div>
                    )}
                  </form>
                </div>
              </div>

              <div className="lg:col-span-4 flex flex-col gap-6">
                <div className="rounded-[2.5rem] bg-white/[0.03] backdrop-blur-xl ring-1 ring-white/10 p-8 sm:p-10 border border-white/5 shadow-2xl flex flex-col gap-8 flex-1">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.2em] text-white/40 mb-4">Search Registry</div>
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Identify specific assets..."
                      className="!bg-white/5"
                    />
                  </div>

                  <div className="grid gap-4 flex-1">
                    <MetricCard 
                      label="Active Records" 
                      value={items.length} 
                      sub="Registry count" 
                      color="indigo"
                    />
                    <MetricCard 
                      label="Critical Alerts" 
                      value={lowStockCount} 
                      sub="Depleted stock" 
                      color="amber"
                      alert={lowStockCount > 0}
                    />
                  </div>
                </div>

                <div className="rounded-[2.5rem] bg-white/[0.03] ring-1 ring-white/10 p-8 sm:p-10 border border-white/5 shadow-xl">
                  <div className="space-y-6">
                    <div className="text-[11px] font-black uppercase tracking-[0.2em] text-white/40">Operational Guidelines</div>
                    <div className="grid gap-4">
                      <div className="text-xs font-medium text-white/40 leading-relaxed pl-4 border-l-2 border-indigo-500/20">
                        Maintain unique SKU references for absolute tracking.
                      </div>
                      <div className="text-xs font-medium text-white/40 leading-relaxed pl-4 border-l-2 border-indigo-500/20">
                        Acquisition and market values drive margin synthesis.
                      </div>
                      <div className="text-xs font-medium text-white/40 leading-relaxed pl-4 border-l-2 border-indigo-500/20">
                        Critical minimums trigger automated replenishment signals.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[2.5rem] bg-white/[0.03] ring-1 ring-white/10 p-8 sm:p-10 border border-white/5 shadow-2xl min-w-0">
              <div className="flex items-center justify-between gap-6 mb-8 flex-wrap">
                <SectionTitle
                  eyebrow="Asset Ledger"
                  title="Live Inventory Registry"
                  pill={`${filteredItems.length} Records`}
                />
              </div>

              <div className="overflow-x-auto -mx-2 px-2">
                <table className="w-full text-left border-separate border-spacing-y-2">
                  <thead>
                    <tr className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20">
                      <th className="px-6 py-4">Asset nomenclature</th>
                      <th className="px-4 py-4 text-center">SKU</th>
                      <th className="px-4 py-4 text-center">Classification</th>
                      <th className="px-4 py-4 text-center">Source</th>
                      <th className="px-4 py-4 text-center">Level</th>
                      <th className="px-4 py-4 text-center">Acquisition</th>
                      <th className="px-4 py-4 text-center">Valuation</th>
                      <th className="px-4 py-4 text-center">Status</th>
                      <th className="px-6 py-4 text-right">Directives</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-transparent">
                    {loading ? (
                      <tr>
                        <td className="px-6 py-10 text-[13px] font-medium text-white/20 italic text-center" colSpan={9}>
                          Synchronizing asset data...
                        </td>
                      </tr>
                    ) : filteredItems.length === 0 ? (
                      <tr>
                        <td className="px-6 py-10 text-[13px] font-medium text-white/20 italic text-center" colSpan={9}>
                          No operational assets detected in current registry.
                        </td>
                      </tr>
                    ) : (
                      filteredItems.map((it) => {
                        const qty = sanitizeNumber(it.quantity);
                        const min = sanitizeNumber(it.minStockLevel);
                        const low = qty <= min;

                        return (
                          <tr key={it.id} className="group hover:bg-white/[0.02] transition-colors">
                            <td className="px-6 py-4 bg-white/[0.02] rounded-l-2xl group-hover:bg-white/[0.04] transition-colors">
                              <div className="text-[13px] font-black text-white">{it.itemName}</div>
                              <div className="text-[10px] font-black text-white/20 uppercase tracking-widest mt-1">{it.location || "Not assigned"}</div>
                            </td>
                            <td className="px-4 py-4 text-center bg-white/[0.02] group-hover:bg-white/[0.04] transition-colors">
                              <span className="text-[11px] font-black text-white/40 uppercase tracking-widest bg-white/5 px-2 py-1 rounded-md">{it.sku}</span>
                            </td>
                            <td className="px-4 py-4 text-center bg-white/[0.02] group-hover:bg-white/[0.04] transition-colors">
                              <span className="text-[11px] font-black text-white/40 uppercase tracking-widest">{it.category}</span>
                            </td>
                            <td className="px-4 py-4 text-center bg-white/[0.02] group-hover:bg-white/[0.04] transition-colors">
                              <div className="text-[11px] font-black text-white/40 truncate max-w-[120px] mx-auto">{it.supplier || "—"}</div>
                            </td>
                            <td className="px-4 py-4 text-center bg-white/[0.02] group-hover:bg-white/[0.04] transition-colors">
                              <div className={cx(
                                "text-[13px] font-black",
                                low ? "text-amber-400" : "text-white"
                              )}>
                                {qty}
                                <span className="text-[9px] text-white/20 ml-1 uppercase tracking-widest">/ {min}</span>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center bg-white/[0.02] group-hover:bg-white/[0.04] transition-colors">
                              <div className="text-[11px] font-black text-white/40">{formatCurrency(it.buyingPrice)}</div>
                            </td>
                            <td className="px-4 py-4 text-center bg-white/[0.02] group-hover:bg-white/[0.04] transition-colors">
                              <div className="text-[11px] font-black text-emerald-400/70">{formatCurrency(it.sellingPrice)}</div>
                            </td>
                            <td className="px-4 py-4 text-center bg-white/[0.02] group-hover:bg-white/[0.04] transition-colors">
                              <span className={cx(
                                "text-[8px] font-black uppercase tracking-[0.2em] px-2 py-1 rounded-md ring-1",
                                low ? "bg-amber-500/10 text-amber-400 ring-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]" : "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20"
                              )}>
                                {low ? "Depleted" : "Healthy"}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right bg-white/[0.02] rounded-r-2xl group-hover:bg-white/[0.04] transition-colors">
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => startEdit(it)}
                                  className="h-8 w-8 rounded-lg bg-white/5 ring-1 ring-white/10 flex items-center justify-center text-xs text-white/40 hover:bg-white/10 hover:text-white transition-all"
                                  title="Edit"
                                >
                                  ✎
                                </button>
                                <button
                                  onClick={() => onDelete(it)}
                                  className="h-8 w-8 rounded-lg bg-white/5 ring-1 ring-white/10 flex items-center justify-center text-xs text-white/40 hover:bg-red-500/20 hover:text-red-400 hover:ring-red-500/30 transition-all"
                                  title="Delete"
                                >
                                  ✕
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

        {activeTab === "users" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="grid gap-10 lg:grid-cols-12 mb-10">
              <div className="lg:col-span-4 flex flex-col gap-6">
                <div className="rounded-[2.5rem] bg-white/[0.03] backdrop-blur-xl ring-1 ring-white/10 p-8 sm:p-10 border border-white/5 shadow-2xl">
                  <SectionTitle
                    eyebrow="Governance"
                    title="Access Control"
                  />

                  <div className="mt-8 space-y-4">
                    <div className="text-xs font-medium text-white/40 leading-relaxed pl-4 border-l-2 border-indigo-500/20">
                      Users must self-register. System architects only govern roles.
                    </div>
                    <div className="text-xs font-medium text-white/40 leading-relaxed pl-4 border-l-2 border-indigo-500/20">
                      Deactivate accounts instead of purging to preserve audit trails.
                    </div>
                    <div className="text-xs font-medium text-white/40 leading-relaxed pl-4 border-l-2 border-indigo-500/20">
                      Grant administrative clearance only on a least-privilege basis.
                    </div>
                  </div>

                  {userMsg && (
                    <div className="mt-8 rounded-2xl bg-white/5 ring-1 ring-white/10 px-6 py-4 text-xs font-bold text-white/50 italic animate-pulse">
                      {userMsg}
                    </div>
                  )}
                </div>

                <div className="rounded-[2.5rem] bg-white/[0.03] ring-1 ring-white/10 p-8 sm:p-10 border border-white/5 shadow-xl flex flex-col gap-8">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.2em] text-white/40 mb-4">Identity Search</div>
                    <Input
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Search credentials..."
                    />
                  </div>

                  <div className="grid gap-4">
                    <MetricCard label="Total Identities" value={usersList.length} color="indigo" />
                    <MetricCard label="Elevated Clearances" value={usersList.filter((u) => u.role === "admin").length} color="amber" />
                  </div>
                </div>
              </div>

              <div className="lg:col-span-8 rounded-[2.5rem] bg-white/[0.03] ring-1 ring-white/10 p-8 sm:p-10 border border-white/5 shadow-2xl min-w-0">
                <SectionTitle
                  eyebrow="Personnel Directory"
                  title="Credential Oversight"
                  pill={`${filteredUsers.length} Active`}
                />

                <div className="overflow-x-auto mt-8 -mx-2 px-2">
                  <table className="w-full text-left border-separate border-spacing-y-2">
                    <thead>
                      <tr className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20">
                        <th className="px-6 py-4">Identity</th>
                        <th className="px-4 py-4 text-center">Clearance</th>
                        <th className="px-4 py-4 text-center">Operational Status</th>
                        <th className="px-6 py-4 text-right">Directives</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-transparent">
                      {usersLoading ? (
                        <tr>
                          <td className="px-6 py-10 text-[13px] font-medium text-white/20 italic text-center" colSpan={4}>
                            Scanning personnel database...
                          </td>
                        </tr>
                      ) : filteredUsers.length === 0 ? (
                        <tr>
                          <td className="px-6 py-10 text-[13px] font-medium text-white/20 italic text-center" colSpan={4}>
                            No matching identities detected.
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((u) => {
                          const isSelf = u.id === user.uid;
                          const isActive = (u.status || "active") === "active";
                          const isAdmin = u.role === "admin";

                          return (
                            <tr key={u.id} className="group hover:bg-white/[0.02] transition-colors">
                              <td className="px-6 py-4 bg-white/[0.02] rounded-l-2xl group-hover:bg-white/[0.04] transition-colors">
                                <div className="text-[13px] font-black text-white">{u.name || "Unnamed Personnel"}</div>
                                <div className="text-[10px] font-black text-white/20 mt-1 lowercase tracking-wider">{u.email}</div>
                              </td>
                              <td className="px-4 py-4 text-center bg-white/[0.02] group-hover:bg-white/[0.04] transition-colors">
                                <span className={cx(
                                  "text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-md ring-1",
                                  isAdmin ? "bg-indigo-500/10 text-indigo-400 ring-indigo-500/20" : "bg-white/5 text-white/40 ring-white/10"
                                )}>
                                  {u.role || "staff"}
                                </span>
                              </td>
                              <td className="px-4 py-4 text-center bg-white/[0.02] group-hover:bg-white/[0.04] transition-colors">
                                <span className={cx(
                                  "text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-md ring-1",
                                  isActive ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20" : "bg-red-500/10 text-red-400 ring-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]"
                                )}>
                                  {u.status || "active"}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right bg-white/[0.02] rounded-r-2xl group-hover:bg-white/[0.04] transition-colors">
                                <div className="flex justify-end gap-2">
                                  <button
                                    disabled={isSelf}
                                    onClick={() => handleUserRoleChange(u, isAdmin ? "staff" : "admin")}
                                    className="px-4 py-2 rounded-xl bg-white/5 ring-1 ring-white/10 text-[9px] font-black uppercase tracking-widest text-white/40 hover:bg-white/10 hover:text-white transition-all disabled:opacity-20"
                                  >
                                    {isAdmin ? "Downgrade" : "Elevate"}
                                  </button>
                                  <button
                                    disabled={isSelf}
                                    onClick={() => handleUserStatusChange(u, isActive ? "disabled" : "active")}
                                    className={cx(
                                      "px-4 py-2 rounded-xl ring-1 text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-20",
                                      isActive ? "bg-amber-500/5 text-amber-400 ring-amber-500/20 hover:bg-amber-500/10" : "bg-emerald-500/5 text-emerald-400 ring-emerald-500/20 hover:bg-emerald-500/10"
                                    )}
                                  >
                                    {isActive ? "Suspend" : "Restore"}
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
          </div>
        )}

        {activeTab === "approvals" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="grid gap-10 lg:grid-cols-12 mb-10">
              <div className="lg:col-span-12">
                <div className="rounded-[2.5rem] bg-white/[0.03] backdrop-blur-xl ring-1 ring-white/10 p-8 sm:p-10 border border-white/5 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-10">
                  <div className="flex-1 w-full">
                    <div className="text-[11px] font-black uppercase tracking-[0.2em] text-white/40 mb-4">Document Verification</div>
                    <div className="max-w-md">
                      <Input
                        value={docSearch}
                        onChange={(e) => setDocSearch(e.target.value)}
                        placeholder="Search classification registry..."
                      />
                    </div>
                  </div>

                  <div className="flex gap-6 flex-wrap">
                    <MetricCard label="Total Submissions" value={docsList.length} color="indigo" />
                    <MetricCard label="Pending Review" value={docsList.filter((d) => d.status === "pending").length} color="amber" alert={docsList.filter((d) => d.status === "pending").length > 0} />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[2.5rem] bg-white/[0.03] ring-1 ring-white/10 p-8 sm:p-10 border border-white/5 shadow-2xl min-w-0">
              <SectionTitle
                eyebrow="Verification Queue"
                title="Security Clearance Workflow"
                pill={`${filteredDocs.length} Entries`}
              />

              {docMsg && (
                <div className="mt-8 rounded-2xl bg-white/5 ring-1 ring-white/10 px-6 py-4 text-xs font-bold text-white/50 italic animate-pulse">
                  {docMsg}
                </div>
              )}

              <div className="overflow-x-auto mt-8 -mx-2 px-2">
                <table className="w-full text-left border-separate border-spacing-y-2">
                  <thead>
                    <tr className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20">
                      <th className="px-6 py-4">Submission Classification</th>
                      <th className="px-4 py-4 text-center">Owner Identity</th>
                      <th className="px-4 py-4 text-center">Protocol Status</th>
                      <th className="px-6 py-4 text-right">Oversight</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-transparent">
                    {docsLoading ? (
                      <tr>
                        <td className="px-6 py-10 text-[13px] font-medium text-white/20 italic text-center" colSpan={4}>
                          Scanning verification queue...
                        </td>
                      </tr>
                    ) : filteredDocs.length === 0 ? (
                      <tr>
                        <td className="px-6 py-10 text-[13px] font-medium text-white/20 italic text-center" colSpan={4}>
                          No entries awaiting verification.
                        </td>
                      </tr>
                    ) : (
                      filteredDocs.map((d) => {
                        const isPending = d.status === "pending";
                        const isApproved = d.status === "approved";
                        const isRejected = d.status === "rejected";

                        return (
                          <tr key={d.id} className="group hover:bg-white/[0.02] transition-colors">
                            <td className="px-6 py-6 bg-white/[0.02] rounded-l-2xl group-hover:bg-white/[0.04] transition-colors">
                              <div className="text-[13px] font-black text-white">{d.title || "Untitled Submission"}</div>
                              {d.description && <div className="text-[11px] font-medium text-white/30 mt-2 leading-relaxed max-w-md">{d.description}</div>}
                              
                              {(isApproved || isRejected) && (
                                <div className={cx(
                                  "mt-4 p-4 rounded-2xl ring-1 text-[10px] font-black uppercase tracking-widest",
                                  isApproved ? "bg-emerald-500/[0.03] ring-emerald-500/10 text-emerald-400/60" : "bg-red-500/[0.03] ring-red-500/10 text-red-400/60"
                                )}>
                                  <div className="flex items-center justify-between gap-4">
                                    <span>{isApproved ? "Cleared by" : "Rejected by"}: {isApproved ? d.approvedByEmail : d.rejectedByEmail}</span>
                                    <span>{formatDate(isApproved ? d.approvedAt : d.rejectedAt)}</span>
                                  </div>
                                  {isRejected && d.rejectionReason && <div className="mt-2 pt-2 border-t border-red-500/10 text-red-400/40 italic">Rsn: {d.rejectionReason}</div>}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-6 text-center bg-white/[0.02] group-hover:bg-white/[0.04] transition-colors">
                              <div className="text-[11px] font-black text-white/40 uppercase tracking-widest">{d.ownerName || "Personnel"}</div>
                            </td>
                            <td className="px-4 py-6 text-center bg-white/[0.02] group-hover:bg-white/[0.04] transition-colors">
                              <span className={cx(
                                "text-[8px] font-black uppercase tracking-[0.2em] px-2 py-1 rounded-md ring-1",
                                isPending ? "bg-amber-500/10 text-amber-400 ring-amber-500/20" :
                                isApproved ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20" :
                                "bg-red-500/10 text-red-400 ring-red-500/20"
                              )}>
                                {d.status || "Unknown"}
                              </span>
                            </td>
                            <td className="px-6 py-6 text-right bg-white/[0.02] rounded-r-2xl group-hover:bg-white/[0.04] transition-colors">
                              {isPending ? (
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => requestDocumentStatusChange(d, "approved")}
                                    disabled={docBusy}
                                    className="px-4 py-2 rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20 text-[9px] font-black uppercase tracking-widest text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all shadow-lg shadow-emerald-500/10 disabled:opacity-20"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => requestDocumentStatusChange(d, "rejected")}
                                    disabled={docBusy}
                                    className="px-4 py-2 rounded-xl bg-red-500/10 ring-1 ring-red-500/20 text-[9px] font-black uppercase tracking-widest text-red-400 hover:bg-red-500 hover:text-white transition-all disabled:opacity-20"
                                  >
                                    Reject
                                  </button>
                                </div>
                              ) : (
                                <div className="text-[9px] font-black uppercase tracking-widest text-white/10 italic">Archived</div>
                              )}
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
      </div>
    </PageShell>
    </>
  );
}