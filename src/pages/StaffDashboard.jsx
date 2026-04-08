// src/pages/StaffDashboard.jsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import {
  PageShell,
  Card,
  Pill,
  PrimaryButton,
  Input,
  Field,
} from "../ui/Layout";
import { collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import { logAction } from "../firebase/auditLogger";
import { listenInventoryItems } from "../firebase/inventoryActions";
import { logout } from "../firebase/authActions";

export default function StaffDashboard() {
  const { user, profile } = useAuth();

  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  // --- Document State ---
  const [activeTab, setActiveTab] = useState("inventory"); // "inventory" | "documents"
  const [docs, setDocs] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [docErr, setDocErr] = useState("");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [docMsg, setDocMsg] = useState("");

  const [docForm, setDocForm] = useState({ title: "", description: "" });

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

  // Fetch only documents meant for this user
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
        status: "pending", // Default to pending
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // ---- AUDIT LOG ----
      logAction("DOCUMENT_REQUEST", user.uid, user.email, {
        title: docForm.title.trim()
      });

      setDocMsg("✅ Document request submitted.");
      setDocForm({ title: "", description: "" });
    } catch (e) {
      console.error(e);
      setDocErr("Failed to submit document. Ensure rules match.");
    } finally {
      setUploadBusy(false);
    }
  };

  const lowStock = useMemo(() => {
    return items.filter((i) => Number(i.qty) <= Number(i.minQty));
  }, [items]);

  return (
    <PageShell>
      <div className="grid gap-6">
        <div className="grid gap-4 lg:grid-cols-12">
          {/* Left */}
          <div className="lg:col-span-7">
            <div className="glass rounded-3xl p-6 md:p-8 shadow-soft">
              <Pill>Staff Dashboard</Pill>

              <h1 className="mt-3 text-2xl md:text-3xl font-semibold tracking-tight">
                Welcome, {profile?.name || user?.email}
              </h1>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-2xl bg-white/5 ring-1 ring-white/10 px-3 py-2 text-sm text-white/80">
                  Role: <b className="text-white">{profile?.role || "staff"}</b>
                </span>
                <span className="rounded-2xl bg-white/5 ring-1 ring-white/10 px-3 py-2 text-sm text-white/80">
                  Status:{" "}
                  <b className="text-white">{profile?.status || "active"}</b>
                </span>
                <span className="rounded-2xl bg-white/5 ring-1 ring-white/10 px-3 py-2 text-sm text-white/80">
                  Low stock:{" "}
                  <b className="text-white">{lowStock.length}</b>
                </span>
              </div>

              <div className="mt-5 max-w-xs">
                <PrimaryButton onClick={logout}>Logout</PrimaryButton>
              </div>

              {err ? (
                <div className="mt-4 rounded-2xl bg-red-500/10 ring-1 ring-red-500/30 px-4 py-3 text-sm text-red-200">
                  {err}
                </div>
              ) : null}
            </div>
          </div>

          {/* Right */}
          <div className="lg:col-span-5">
            <div className="glass rounded-3xl p-6 md:p-8 shadow-soft">
              <div className="text-sm text-slate-300">Quick actions</div>
              <div className="mt-4 grid gap-3">
                <Card
                  title="Inventory"
                  desc="View items from Firestore (live)."
                />
                <Card
                  title="Documents"
                  desc="Request access (next module)."
                />
                <Card
                  title="Profile"
                  desc="Account status & permissions."
                />
              </div>
            </div>
          </div>
        </div>

        {/* TABS */}
        <div className="flex gap-2 border-b border-white/10 pb-4">
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
            onClick={() => setActiveTab("documents")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              activeTab === "documents"
                ? "bg-white/15 text-white"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            My Documents
          </button>
        </div>

        {activeTab === "inventory" && (
          <div className="glass rounded-3xl p-6 md:p-8 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm text-slate-300">Inventory</div>
              <h2 className="mt-1 text-lg font-semibold">Items</h2>
            </div>
            <div className="text-sm text-slate-300">
              {loading ? "Loading..." : `${items.length} items`}
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="text-slate-300">
                <tr className="border-b border-white/10">
                  <th className="py-3 pr-4">Name</th>
                  <th className="py-3 pr-4">SKU</th>
                  <th className="py-3 pr-4">Location</th>
                  <th className="py-3 pr-4">Qty</th>
                  <th className="py-3 pr-4">Min</th>
                  <th className="py-3 pr-4">Status</th>
                </tr>
              </thead>
              <tbody className="text-white/85">
                {!loading && items.length === 0 ? (
                  <tr>
                    <td className="py-6 text-slate-300" colSpan={6}>
                      No items found in inventoryItems collection.
                    </td>
                  </tr>
                ) : null}

                {items.map((item) => {
                  const qty = Number(item.qty ?? 0);
                  const min = Number(item.minQty ?? 0);
                  const isLow = qty <= min;

                  return (
                    <tr
                      key={item.id}
                      className="border-b border-white/5 hover:bg-white/5 transition"
                    >
                      <td className="py-3 pr-4 font-medium">
                        {item.name || "-"}
                      </td>
                      <td className="py-3 pr-4 text-slate-200">
                        {item.sku || "-"}
                      </td>
                      <td className="py-3 pr-4 text-slate-200">
                        {item.location || "-"}
                      </td>
                      <td className="py-3 pr-4">{qty}</td>
                      <td className="py-3 pr-4">{min}</td>
                      <td className="py-3 pr-4">
                        {isLow ? (
                          <span className="inline-flex items-center rounded-full bg-amber-500/15 ring-1 ring-amber-500/25 px-3 py-1 text-xs text-amber-200">
                            Low
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/25 px-3 py-1 text-xs text-emerald-200">
                            OK
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 text-xs text-white/55">
            Tip: Only admins can manage the inventory live.
          </div>
        </div>
        )}

        {activeTab === "documents" && (
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Upload Form */}
            <div className="lg:col-span-5">
              <div className="glass rounded-3xl p-6 md:p-8 shadow-soft h-full flex flex-col">
                <div className="text-sm text-slate-300">Upload a new document</div>
                <h2 className="mt-1 text-lg font-semibold">Document Request</h2>
                
                <form onSubmit={handleUpload} className="mt-5 grid gap-4 flex-1">
                  <Field label="Document Title">
                    <Input
                      value={docForm.title}
                      onChange={(e) => setDocForm((p) => ({ ...p, title: e.target.value }))}
                      placeholder="e.g. Q3 Restock Request"
                    />
                  </Field>
                  <Field label="Description">
                     <Input
                      value={docForm.description}
                      onChange={(e) => setDocForm((p) => ({ ...p, description: e.target.value }))}
                      placeholder="Brief context..."
                    />
                  </Field>
                  <div className="mt-auto pt-4 grid gap-3">
                    <PrimaryButton disabled={uploadBusy}>
                      {uploadBusy ? "Submitting..." : "Submit Request"}
                    </PrimaryButton>
                    
                    {docErr && <div className="rounded-xl px-3 py-2 text-xs bg-red-500/10 text-red-200 mt-2">{docErr}</div>}
                    {docMsg && <div className="rounded-xl px-3 py-2 text-xs bg-emerald-500/10 text-emerald-200 mt-2">{docMsg}</div>}
                  </div>
                </form>
              </div>
            </div>

            {/* Document List */}
            <div className="lg:col-span-7">
               <div className="glass rounded-3xl p-6 md:p-8 shadow-soft min-w-0 h-full">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm text-slate-300">Submitted</div>
                      <h2 className="mt-1 text-lg font-semibold">My Documents</h2>
                    </div>
                  </div>

                  <div className="mt-5 overflow-x-auto rounded-2xl ring-1 ring-white/10">
                    <table className="w-full min-w-[500px] text-sm text-left">
                      <thead className="bg-white/5 text-slate-300 border-b border-white/10">
                        <tr>
                          <th className="py-3 px-4">Title</th>
                          <th className="py-3 px-4">Description</th>
                          <th className="py-3 px-4">Status</th>
                        </tr>
                      </thead>
                      <tbody className="text-white/85 divide-y divide-white/5">
                        {loadingDocs ? (
                           <tr>
                            <td className="py-4 px-4 text-slate-300" colSpan={3}>Loading...</td>
                          </tr>
                        ) : docs.length === 0 ? (
                           <tr>
                            <td className="py-4 px-4 text-slate-300" colSpan={3}>No documents submitted yet.</td>
                          </tr>
                        ) : docs.map(d => (
                          <tr key={d.id} className="hover:bg-white/5 transition">
                            <td className="py-3 px-4 font-medium">{d.title}</td>
                            <td className="py-3 px-4 text-slate-300 text-xs">{d.description || "-"}</td>
                            <td className="py-3 px-4">
                              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs ring-1 ${d.status === 'approved' ? 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/20' : d.status === 'rejected' ? 'bg-red-500/15 text-red-200 ring-red-500/20' : 'bg-amber-500/15 text-amber-200 ring-amber-500/20'}`}>
                                {d.status === 'pending' ? 'Pending Review' : d.status.charAt(0).toUpperCase() + d.status.slice(1)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
               </div>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}