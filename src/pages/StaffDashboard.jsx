import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  PageShell,
  Card,
  Pill,
  PrimaryButton,
  SecondaryButton,
  Input,
  Field,
  TextArea,
  Pill as UIPill
} from "../ui/Layout";
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/firebaseServices";
import { logAction } from "../firebase/auditLogger";
import { listenInventoryItems } from "../firebase/inventoryActions";
import { getSales } from "../firebase/salesActions";
import { getSaleTotal } from "../utils/saleHelpers";
import { getDateRangeBoundaries, isDateInRange } from "../utils/dateHelpers";

export default function StaffDashboard() {
  const navigate = useNavigate();
  const { user, profile, logout } = useAuth();

  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState("documents");

  const [docs, setDocs] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [docErr, setDocErr] = useState("");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [docMsg, setDocMsg] = useState("");

  const [docForm, setDocForm] = useState({
    title: "",
    description: "",
  });

  const [sales, setSales] = useState([]);
  const [salesLoading, setSalesLoading] = useState(true);

  useEffect(() => {
    setErr("");
    setLoading(true);

    const unsub = listenInventoryItems(
      (data) => {
        setItems(data);
        setLoading(false);
      },
      (e) => {
        setErr(e?.message || "Failed to load inventory.");
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;

    setDocErr("");
    setLoadingDocs(true);

    const q = query(
      collection(db, "documents"),
      where("ownerUid", "==", user.uid)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));

        setDocs(data);
        setLoadingDocs(false);
      },
      (e) => {
        console.error(e);
        setDocErr(e?.message || "Failed to load documents.");
        setLoadingDocs(false);
      }
    );

    return () => unsub();
  }, [user]);

  useEffect(() => {
    setSalesLoading(true);
    getSales()
      .then(setSales)
      .catch(console.error)
      .finally(() => setSalesLoading(false));
  }, []);

  const lowStock = useMemo(() => {
    return items.filter(
      (i) => Number(i.quantity || 0) <= Number(i.minStockLevel || 0)
    );
  }, [items]);

  const staffStats = useMemo(() => {
    const { start, end } = getDateRangeBoundaries("today");
    
    // Today's Global (Operational)
    const todaySales = sales.filter(s => s.status !== "cancelled" && isDateInRange(s.soldAt, start, end));
    const todayCount = todaySales.length;
    const todayRev = todaySales.reduce((sum, s) => sum + (getSaleTotal(s) - Number(s.refundAmount || 0)), 0);

    // My Total (Lifetime)
    const mySales = sales.filter(s => s.status !== "cancelled" && (s.soldBy === user?.uid || s.soldByEmail === user?.email));
    const myCount = mySales.length;
    const myRev = mySales.reduce((sum, s) => sum + (getSaleTotal(s) - Number(s.refundAmount || 0)), 0);

    return { todayCount, todayRev, myCount, myRev };
  }, [sales, user]);

  const totalInventoryItems = items.length;

  async function handleLogout() {
    try {
      await logout();
      navigate("/login");
    } catch (e) {
      console.error("Logout failed:", e);
    }
  }

  const handleUpload = async (e) => {
    e.preventDefault();
    setDocMsg("");
    setDocErr("");

    if (!docForm.title.trim() || !docForm.description.trim()) {
      setDocErr("Title and description are required.");
      return;
    }

    setUploadBusy(true);

    try {
      await addDoc(collection(db, "documents"), {
        title: docForm.title.trim(),
        description: docForm.description.trim(),
        ownerUid: user.uid,
        ownerName: profile?.name || user.email,
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await logAction(
        "DOCUMENT_REQUEST",
        user.uid,
        user.email,
        {
          title: docForm.title.trim(),
        },
        "document",
        ""
      );

      setDocMsg("✅ Document request submitted successfully.");
      setDocForm({ title: "", description: "" });
    } catch (e) {
      console.error(e);
      setDocErr("Failed to submit document request.");
    } finally {
      setUploadBusy(false);
    }
  };  return (
    <PageShell>
      <div className="grid gap-4">
        <div className="grid gap-4">
          <div className="rounded-2xl bg-white/[0.06] ring-1 ring-white/10 p-5 md:p-6">
            <Pill>Staff Dashboard</Pill>

            <h1 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Hi, {profile?.name?.split(" ")[0] || "there"}!
            </h1>
            <p className="mt-1 text-white/60 text-sm leading-relaxed max-w-md">
              Welcome back. Here is your operational status for today.
            </p>

            <div className="mt-4 flex flex-wrap gap-2.5">
              <div className="flex items-center gap-2 rounded-xl bg-white/5 ring-1 ring-white/10 px-3 py-1.5 text-[13px] text-white/80">
                <span className="h-2 w-2 rounded-full bg-indigo-400"></span>
                Role: <span className="font-semibold text-white capitalize">{profile?.role || "Staff"}</span>
              </div>

              <div className="flex items-center gap-2 rounded-xl bg-white/5 ring-1 ring-white/10 px-3 py-1.5 text-[13px] text-white/80">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Status: <span className="font-semibold text-white capitalize">{profile?.status || "Active"}</span>
              </div>
            </div>

            {err && (
              <div className="mt-4 rounded-xl bg-red-500/10 ring-1 ring-red-500/30 px-4 py-2 text-xs text-red-200">
                {err}
              </div>
            )}
          </div>

          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
            <DashboardCard 
              label="Today's Sales" 
              value={salesLoading ? "..." : String(staffStats.todayCount)} 
              sub="Transactions"
              color="indigo"
            />
            <DashboardCard 
              label="Today's Revenue" 
              value={salesLoading ? "..." : fc(staffStats.todayRev)} 
              sub="Gross processed"
              color="emerald"
            />
            <DashboardCard 
              label="My Total Sales" 
              value={salesLoading ? "..." : String(staffStats.myCount)} 
              sub="Lifetime record"
              color="blue"
            />
            <DashboardCard 
              label="My Revenue" 
              value={salesLoading ? "..." : fc(staffStats.myRev)} 
              sub="Contribution"
              color="purple"
            />
            <DashboardCard 
              label="Low Stock Items" 
              value={String(lowStock.length)} 
              sub="Needs attention"
              color="amber"
              alert={lowStock.length > 0}
            />
          </div>

          <div className="rounded-2xl bg-white/[0.06] ring-1 ring-white/10 p-4">
            <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">Quick Operations</div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
              <QuickAction to="/sales" icon="🛒" label="New Sale" />
              <QuickAction to="/staff/my-sales" icon="📄" label="My Invoices" />
              <QuickAction to="/staff/inventory" icon="📦" label="Inventory" />
              <QuickAction to="/staff/customers" icon="👥" label="Customers" />
              <QuickAction to="/notifications" icon="🔔" label="Notifications" />
            </div>
          </div>
        </div>

        <div className="flex gap-2 border-b border-white/10 pb-3 mt-2">
          <div className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/15 text-white tracking-wide">
            My Document Requests
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="rounded-[2.5rem] bg-white/[0.03] ring-1 ring-white/10 p-6 md:p-8 border border-white/5 shadow-2xl h-fit">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Request a document</div>
              <h2 className="mt-1 text-xl font-black text-white tracking-tight">
                Submit Request
              </h2>

              <form onSubmit={handleUpload} className="mt-6 grid gap-5">
                <Field label="Document Title">
                  <Input
                    value={docForm.title}
                    onChange={(e) =>
                      setDocForm((p) => ({ ...p, title: e.target.value }))
                    }
                    placeholder="Enter document title..."
                  />
                </Field>

                <Field label="Description">
                  <TextArea
                    value={docForm.description}
                    onChange={(e) =>
                      setDocForm((p) => ({ ...p, description: e.target.value }))
                    }
                    placeholder="Provide brief context or reason..."
                    className="min-h-[100px]"
                  />
                </Field>

                <div className="pt-3 grid gap-2">
                  <button
                    type="submit"
                    disabled={uploadBusy}
                    className="w-full rounded-2xl bg-indigo-500 text-white font-black text-[11px] uppercase tracking-[0.2em] px-6 py-4 hover:bg-indigo-400 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none transition-all duration-300 shadow-[0_0_20px_rgba(99,102,241,0.3)] ring-1 ring-indigo-500/50"
                  >
                    {uploadBusy ? "Submitting Request..." : "Submit Request"}
                  </button>

                  {docErr && (
                    <div className="rounded-xl px-4 py-3 text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 mt-2 text-center uppercase tracking-wide">
                      {docErr}
                    </div>
                  )}

                  {docMsg && (
                    <div className="rounded-xl px-4 py-3 text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mt-2 text-center uppercase tracking-wide">
                      {docMsg}
                    </div>
                  )}
                </div>
              </form>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="rounded-2xl bg-white/[0.06] ring-1 ring-white/10 p-5 md:p-6 min-w-0 h-full">
              <div className="text-xs text-slate-400">Submitted Documents</div>
              <h2 className="mt-1 text-base font-semibold text-white">
                History
              </h2>

              <div className="mt-4 overflow-x-auto rounded-xl ring-1 ring-white/10">
                <table className="w-full min-w-[500px] text-[13px] text-left">
                  <thead className="bg-white/5 text-slate-400 border-b border-white/10 uppercase tracking-widest text-[9px]">
                    <tr>
                      <th className="py-3 px-4">Title</th>
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>

                  <tbody className="text-white/80 divide-y divide-white/5">
                    {loadingDocs ? (
                      <tr>
                        <td className="py-6 px-4 text-white/30 text-center" colSpan={3}>
                          Loading history...
                        </td>
                      </tr>
                    ) : docs.length === 0 ? (
                      <tr>
                        <td className="py-6 px-4 text-white/30 text-center" colSpan={3}>
                          No requests submitted.
                        </td>
                      </tr>
                    ) : (
                      docs.map((d) => (
                        <tr key={d.id} className="hover:bg-white/5 transition group">
                          <td className="py-3 px-4 font-medium group-hover:text-white">{d.title}</td>
                          <td className="py-3 px-4 text-white/40 text-xs truncate max-w-[150px]">
                            {d.description || "-"}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ring-1 ${
                                d.status === "approved"
                                  ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/20"
                                  : d.status === "rejected"
                                  ? "bg-red-500/15 text-red-300 ring-red-500/20"
                                  : "bg-amber-500/15 text-amber-300 ring-amber-500/20"
                              }`}
                            >
                              {d.status === "pending" ? "Pending" : d.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function DashboardCard({ label, value, sub, color, alert }) {
  const colors = {
    indigo: "bg-indigo-500/5 ring-indigo-500/20 text-indigo-400",
    emerald: "bg-emerald-500/5 ring-emerald-500/20 text-emerald-400",
    blue: "bg-blue-500/5 ring-blue-500/20 text-blue-400",
    purple: "bg-purple-500/5 ring-purple-500/20 text-purple-400",
    amber: alert ? "bg-amber-500/10 ring-amber-500/30 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.05)]" : "bg-white/5 ring-white/10 text-white/30",
  };

  return (
    <div className={`rounded-2xl p-4 ring-1 transition hover:bg-white/[0.1] hover:shadow-lg ${colors[color] || colors.indigo}`}>
      <div className="text-[9px] font-bold uppercase tracking-[0.1em] opacity-60">{label}</div>
      <div className="mt-1.5 text-xl font-bold text-white truncate">{value}</div>
      <div className="mt-0.5 text-[10px] opacity-50 font-medium tracking-tight">{sub}</div>
    </div>
  );
}

function QuickAction({ to, icon, label }) {
  return (
    <Link to={to}>
      <button className="w-full flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/5 ring-1 ring-white/10 hover:bg-white/10 hover:ring-white/20 transition-all duration-300 group shadow-md">
        <div className="h-11 w-11 rounded-xl bg-white/5 flex items-center justify-center text-2xl group-hover:scale-110 group-hover:bg-white/10 transition-all duration-300 transform group-active:scale-95">
          {icon}
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/50 group-hover:text-white transition">{label}</span>
      </button>
    </Link>
  );
}

const fc = (v) => `Rs. ${Number(v || 0).toLocaleString()}`;