import React, { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { db } from "../firebase/firebaseConfig"; // ✅ change path if your db export is elsewhere
import { useAuth } from "../auth/AuthContext";
import {
  PageShell,
  Field,
  Input,
  PrimaryButton,
  SecondaryButton,
  Pill,
  Card,
} from "../ui/Layout";
import { logAction } from "../firebase/auditLogger";

const initialForm = {
  name: "",
  sku: "",
  qty: 0,
  minQty: 0,
  location: "",
};

const initialUserForm = {
  name: "",
  email: "",
  role: "staff", // "staff" or "admin"
};

function sanitizeNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function AdminDashboard() {
  const { user, profile, logout } = useAuth();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [mode, setMode] = useState("add"); // "add" | "edit"
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState(initialForm);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const [search, setSearch] = useState("");

  // ---- USER MANAGEMENT STATE ----
  const [activeTab, setActiveTab] = useState("inventory"); // "inventory" | "users"
  
  const [usersList, setUsersList] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  
  const [userMode, setUserMode] = useState("add"); // "add" | "edit"
  const [editingUserId, setEditingUserId] = useState(null);
  const [userForm, setUserForm] = useState(initialUserForm);
  const [userMsg, setUserMsg] = useState("");
  const [userBusy, setUserBusy] = useState(false);
  const [userSearch, setUserSearch] = useState("");

  // ---- DOCUMENT APPROVAL STATE ----
  const [docsList, setDocsList] = useState([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [docMsg, setDocMsg] = useState("");
  const [docBusy, setDocBusy] = useState(false);
  const [docSearch, setDocSearch] = useState("");

  // ---- LIVE LOAD ----
  useEffect(() => {
    const q = query(collection(db, "inventoryItems"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setItems(data);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setMsg("Failed to load inventoryItems. Check Firestore rules / console.");
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // ---- LIVE LOAD USERS ----
  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setUsersList(data);
        setUsersLoading(false);
      },
      (err) => {
        console.error(err);
        setUserMsg("Failed to load users. Check Firestore rules.");
        setUsersLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // ---- LIVE LOAD DOCUMENTS ----
  useEffect(() => {
    const q = query(collection(db, "documents"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setDocsList(data);
        setDocsLoading(false);
      },
      (err) => {
        console.error(err);
        setDocMsg("Failed to load documents. Check Firestore rules.");
        setDocsLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return items;
    return items.filter((it) => {
      const name = String(it.name || "").toLowerCase();
      const sku = String(it.sku || "").toLowerCase();
      const loc = String(it.location || "").toLowerCase();
      return name.includes(s) || sku.includes(s) || loc.includes(s);
    });
  }, [items, search]);

  const lowStockCount = useMemo(() => {
    return items.filter((it) => Number(it.qty || 0) < Number(it.minQty || 0)).length;
  }, [items]);

  // ---- FORM HELPERS ----
  function resetForm() {
    setForm(initialForm);
    setMode("add");
    setEditingId(null);
  }

  function startEdit(item) {
    setMode("edit");
    setEditingId(item.id);
    setForm({
      name: item.name ?? "",
      sku: item.sku ?? "",
      qty: sanitizeNumber(item.qty),
      minQty: sanitizeNumber(item.minQty),
      location: item.location ?? "",
    });
    setMsg("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function validate() {
    if (!form.name.trim()) return "Name is required.";
    if (!form.sku.trim()) return "SKU is required.";
    if (sanitizeNumber(form.qty) < 0) return "Qty cannot be negative.";
    if (sanitizeNumber(form.minQty) < 0) return "Min Qty cannot be negative.";

    // client-side SKU uniqueness (nice-to-have; rules will be stronger later)
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

    const error = validate();
    if (error) {
      setMsg(error);
      return;
    }

    setBusy(true);
    try {
      const payload = {
        name: form.name.trim(),
        sku: form.sku.trim(),
        qty: sanitizeNumber(form.qty),
        minQty: sanitizeNumber(form.minQty),
        location: form.location.trim(),
        updatedAt: serverTimestamp(),
      };

      if (mode === "add") {
        await addDoc(collection(db, "inventoryItems"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        logAction("INVENTORY_CREATE", user.uid, user.email, { sku: payload.sku, name: payload.name });
        setMsg("✅ Item added.");
        resetForm();
      } else {
        await updateDoc(doc(db, "inventoryItems", editingId), payload);
        logAction("INVENTORY_UPDATE", user.uid, user.email, { sku: payload.sku, name: payload.name, id: editingId });
        setMsg("✅ Item updated.");
        resetForm();
      }
    } catch (err) {
      console.error(err);
      setMsg("❌ Save failed. Check Firestore rules (write permissions).");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(item) {
    const ok = window.confirm(`Delete item "${item.name}" (SKU: ${item.sku}) ?`);
    if (!ok) return;

    setBusy(true);
    setMsg("");
    try {
      await deleteDoc(doc(db, "inventoryItems", item.id));
      logAction("INVENTORY_DELETE", user.uid, user.email, { sku: item.sku, name: item.name, id: item.id });
      setMsg("🗑️ Item deleted.");
      if (editingId === item.id) resetForm();
    } catch (err) {
      console.error(err);
      setMsg("❌ Delete failed. Check Firestore rules (write permissions).");
    } finally {
      setBusy(false);
    }
  }

  // ---- USER FORM HELPERS ----
  function resetUserForm() {
    setUserForm(initialUserForm);
    setUserMode("add");
    setEditingUserId(null);
  }

  function startUserEdit(u) {
    setUserMode("edit");
    setEditingUserId(u.id);
    setUserForm({
      name: u.name ?? "",
      email: u.email ?? "",
      role: u.role ?? "staff",
    });
    setUserMsg("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function validateUser() {
    if (!userForm.name.trim()) return "Name is required.";
    if (!userForm.email.trim() || !userForm.email.includes("@")) return "Valid email is required.";
    if (!userForm.role) return "Role is required.";

    const emailLower = userForm.email.trim().toLowerCase();
    const clash = usersList.find(
      (u) =>
        String(u.email || "").trim().toLowerCase() === emailLower &&
        u.id !== editingUserId
    );
    if (clash) return "Email already exists.";
    return "";
  }

  async function onUserSubmit(e) {
    e.preventDefault();
    setUserMsg("");

    const error = validateUser();
    if (error) {
      setUserMsg(error);
      return;
    }

    setUserBusy(true);
    try {
      const payload = {
        name: userForm.name.trim(),
        email: userForm.email.trim().toLowerCase(),
        role: userForm.role,
        updatedAt: serverTimestamp(),
      };

      if (userMode === "add") {
        await addDoc(collection(db, "users"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        logAction("USER_CREATE", user.uid, user.email, { targetEmail: payload.email, role: payload.role });
        setUserMsg("✅ User added.");
        resetUserForm();
      } else {
        await updateDoc(doc(db, "users", editingUserId), payload);
        logAction("USER_UPDATE", user.uid, user.email, { targetEmail: payload.email, role: payload.role, id: editingUserId });
        setUserMsg("✅ User updated.");
        resetUserForm();
      }
    } catch (err) {
      console.error(err);
      setUserMsg("❌ Save failed. Check Firestore rules.");
    } finally {
      setUserBusy(false);
    }
  }

  async function onUserDelete(u) {
    // Prevent deleting yourself
    if (user?.email === u.email) {
       window.alert("You cannot delete your own account.");
       return;
    }

    const ok = window.confirm(`Delete user "${u.name}" (${u.email})?`);
    if (!ok) return;

    setUserBusy(true);
    setUserMsg("");
    try {
      await deleteDoc(doc(db, "users", u.id));
      logAction("USER_DELETE", user.uid, user.email, { targetEmail: u.email, id: u.id });
      setUserMsg("🗑️ User deleted.");
      if (editingUserId === u.id) resetUserForm();
    } catch (err) {
      console.error(err);
      setUserMsg("❌ Delete failed. Check Firestore rules.");
    } finally {
      setUserBusy(false);
    }
  }

  // ---- DOCUMENT APPROVAL HELPERS ----
  async function updateDocStatus(docId, newStatus) {
    setDocBusy(true);
    setDocMsg("");
    try {
      await updateDoc(doc(db, "documents", docId), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      logAction("DOCUMENT_STATUS_CHANGE", user.uid, user.email, { documentId: docId, newStatus });
      setDocMsg(`✅ Document marked as ${newStatus}.`);
    } catch (err) {
      console.error(err);
      setDocMsg("❌ Failed to update document status.");
    } finally {
      setDocBusy(false);
    }
  }

  const filteredUsers = useMemo(() => {
    const s = userSearch.trim().toLowerCase();
    if (!s) return usersList;
    return usersList.filter((u) => {
      const name = String(u.name || "").toLowerCase();
      const email = String(u.email || "").toLowerCase();
      return name.includes(s) || email.includes(s);
    });
  }, [usersList, userSearch]);

  const filteredDocs = useMemo(() => {
    const s = docSearch.trim().toLowerCase();
    if (!s) return docsList;
    return docsList.filter((d) => {
      const title = String(d.title || "").toLowerCase();
      const uploader = String(d.ownerName || "").toLowerCase();
      return title.includes(s) || uploader.includes(s);
    });
  }, [docsList, docSearch]);

  return (
    <PageShell>
      <div className="grid gap-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2">
              <Pill>Admin Dashboard</Pill>
              <Pill>Low stock {lowStockCount}</Pill>
            </div>
            <h1 className="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight text-white">
              Dashboard Management
            </h1>
            <p className="mt-1 text-sm text-white/70">
              Signed in as <b>{profile?.name || user?.email}</b> • role:{" "}
              <b>{profile?.role || "admin"}</b>
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={logout}
              className="rounded-2xl bg-white/5 ring-1 ring-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              Logout
            </button>
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
            onClick={() => setActiveTab("users")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              activeTab === "users"
                ? "bg-white/15 text-white"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            Staff & Admins
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
            {/* Form + Search + Guidelines Section */}
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Form */}
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
                {mode === "edit" ? (
                  <button
                    onClick={resetForm}
                    className="rounded-2xl bg-white/5 ring-1 ring-white/15 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10"
                  >
                    Cancel edit
                  </button>
                ) : null}
              </div>

              <form onSubmit={onSubmit} className="mt-5 grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Name">
                    <Input
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="A4 Paper Pack"
                      autoComplete="off"
                    />
                  </Field>

                  <Field label="SKU">
                    <Input
                      value={form.sku}
                      onChange={(e) => setForm((p) => ({ ...p, sku: e.target.value }))}
                      placeholder="SKU-001"
                      autoComplete="off"
                    />
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Qty">
                    <Input
                      type="number"
                      value={form.qty}
                      onChange={(e) => setForm((p) => ({ ...p, qty: e.target.value }))}
                    />
                  </Field>

                  <Field label="Min Qty">
                    <Input
                      type="number"
                      value={form.minQty}
                      onChange={(e) => setForm((p) => ({ ...p, minQty: e.target.value }))}
                    />
                  </Field>

                  <Field label="Location">
                    <Input
                      value={form.location}
                      onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                      placeholder="Store Room"
                      autoComplete="off"
                    />
                  </Field>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <PrimaryButton disabled={busy}>
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

          {/* Search and Guidelines (Right Column) */}
          <div className="lg:col-span-5 flex flex-col gap-6 h-full">
            <div className="rounded-3xl bg-white/[0.04] ring-1 ring-white/10 p-5 sm:p-6 flex flex-col items-start gap-4 flex-1">
              <div className="w-full">
                <div className="text-sm text-white/70">Search</div>
                <div className="mt-2">
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name / sku / location..."
                  />
                </div>
              </div>

              <div className="mt-auto w-full grid gap-3 sm:grid-cols-2">
                <Card title={`${items.length} items`} desc="Total inventory documents." />
                <Card title={`${lowStockCount} low`} desc="Qty lower than Min Qty." />
              </div>
            </div>

            <div className="rounded-3xl bg-white/[0.04] ring-1 ring-white/10 p-5 sm:p-6">
              <div className="grid gap-3">
                <div><Pill>Admin Dashboard Guidelines</Pill></div>
                <Card title="Users" desc="Next: manage staff/admin accounts safely (recommended: Custom Claims)." />
                <Card title="Inventory" desc="You can add/edit/delete items here (Firestore live)." />
                <Card title="Documents" desc="Next module: request/approve documents + access logs." />
              </div>
            </div>
          </div>
        </div>

        {/* Table View */}
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-12 rounded-3xl bg-white/[0.06] ring-1 ring-white/10 p-4 sm:p-6 min-w-0">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm text-white/70">Inventory items</div>
                <div className="mt-1 text-lg font-semibold text-white">
                  Live table (Firestore)
                </div>
              </div>
              <Pill>{filtered.length} showing</Pill>
            </div>

            <div className="mt-4 overflow-x-auto rounded-2xl ring-1 ring-white/10">
              <table className="min-w-[850px] w-full text-sm">
              <thead className="bg-white/5 text-white/70">
                <tr>
                  <th className="text-left font-semibold px-4 py-3">Name</th>
                  <th className="text-left font-semibold px-4 py-3">SKU</th>
                  <th className="text-left font-semibold px-4 py-3">Location</th>
                  <th className="text-right font-semibold px-4 py-3">Qty</th>
                  <th className="text-right font-semibold px-4 py-3">Min</th>
                  <th className="text-left font-semibold px-4 py-3">Status</th>
                  <th className="text-right font-semibold px-4 py-3">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/10">
                {loading ? (
                  <tr>
                    <td className="px-4 py-4 text-white/70" colSpan={7}>
                      Loading...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-white/70" colSpan={7}>
                      No items found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((it) => {
                    const qty = sanitizeNumber(it.qty);
                    const min = sanitizeNumber(it.minQty);
                    const low = qty < min;

                    return (
                      <tr key={it.id} className="text-white/85">
                        <td className="px-4 py-3">{it.name}</td>
                        <td className="px-4 py-3">{it.sku}</td>
                        <td className="px-4 py-3">{it.location}</td>
                        <td className="px-4 py-3 text-right">{qty}</td>
                        <td className="px-4 py-3 text-right">{min}</td>
                        <td className="px-4 py-3">
                          <span
                            className={
                              "inline-flex items-center rounded-full px-2.5 py-1 text-xs ring-1 " +
                              (low
                                ? "bg-amber-500/15 text-amber-200 ring-amber-500/20"
                                : "bg-emerald-500/15 text-emerald-200 ring-emerald-500/20")
                            }
                          >
                            {low ? "Low" : "OK"}
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
            Tip: SKU unique තියාගන්න. Low stock = Qty &lt; Min Qty.
          </div>
        </div>
      </div>
      </>
      )}

      {activeTab === "users" && (
        <>
          {/* User Form + Guidelines */}
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <div className="rounded-3xl bg-white/[0.06] ring-1 ring-white/10 p-5 sm:p-6 h-full flex flex-col">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm text-white/70">
                      {userMode === "add" ? "Add new user" : "Edit user"}
                    </div>
                    <div className="mt-1 text-lg font-semibold text-white">
                      {userMode === "add" ? "Create account" : "Update account"}
                    </div>
                  </div>
                  {userMode === "edit" && (
                    <button
                      onClick={resetUserForm}
                      className="rounded-2xl bg-white/5 ring-1 ring-white/15 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10"
                    >
                      Cancel edit
                    </button>
                  )}
                </div>

                <form onSubmit={onUserSubmit} className="mt-5 grid gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Name">
                      <Input
                        value={userForm.name}
                        onChange={(e) => setUserForm((p) => ({ ...p, name: e.target.value }))}
                        placeholder="John Doe"
                        autoComplete="off"
                      />
                    </Field>

                    <Field label="Email">
                      <Input
                        type="email"
                        value={userForm.email}
                        onChange={(e) => setUserForm((p) => ({ ...p, email: e.target.value }))}
                        placeholder="john@example.com"
                        autoComplete="off"
                      />
                    </Field>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Role">
                      <select
                        value={userForm.role}
                        onChange={(e) => setUserForm((p) => ({ ...p, role: e.target.value }))}
                        className="w-full rounded-2xl bg-white/5 ring-1 ring-white/15 px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500/50 appearance-none"
                      >
                        <option value="staff" className="bg-slate-800">Staff</option>
                        <option value="admin" className="bg-slate-800">Admin</option>
                      </select>
                    </Field>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 mt-2">
                    <PrimaryButton disabled={userBusy}>
                      {userBusy ? "Saving..." : userMode === "add" ? "Add User" : "Save Changes"}
                    </PrimaryButton>

                    <SecondaryButton
                      type="button"
                      disabled={userBusy}
                      onClick={() => {
                        resetUserForm();
                        setUserMsg("");
                      }}
                    >
                      Reset
                    </SecondaryButton>
                  </div>

                  {userMsg && (
                    <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-3 text-sm text-white/80">
                      {userMsg}
                    </div>
                  )}
                </form>
              </div>
            </div>

            <div className="lg:col-span-5 flex flex-col gap-6 h-full">
               <div className="rounded-3xl bg-white/[0.04] ring-1 ring-white/10 p-5 sm:p-6 flex flex-col items-start gap-4 flex-1">
                 <div className="w-full">
                   <div className="text-sm text-white/70">Search Users</div>
                   <div className="mt-2">
                     <Input
                       value={userSearch}
                       onChange={(e) => setUserSearch(e.target.value)}
                       placeholder="Search by name / email..."
                     />
                   </div>
                 </div>

                 <div className="mt-auto w-full grid gap-3 sm:grid-cols-2">
                   <Card title={`${usersList.length} users`} desc="Total accounts registered." />
                   <Card title={`${usersList.filter(u => u.role === 'admin').length} admins`} desc="Users with max privileges." />
                 </div>
               </div>
            </div>
          </div>

          {/* User Table */}
          <div className="grid gap-6 lg:grid-cols-12 mt-6">
            <div className="lg:col-span-12 rounded-3xl bg-white/[0.06] ring-1 ring-white/10 p-4 sm:p-6 min-w-0">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm text-white/70">Registered Users</div>
                  <div className="mt-1 text-lg font-semibold text-white">
                    User Accounts
                  </div>
                </div>
                <Pill>{filteredUsers.length} showing</Pill>
              </div>

              <div className="mt-4 overflow-x-auto rounded-2xl ring-1 ring-white/10">
                <table className="min-w-[800px] w-full text-sm">
                  <thead className="bg-white/5 text-white/70">
                    <tr>
                      <th className="text-left font-semibold px-4 py-3">Name</th>
                      <th className="text-left font-semibold px-4 py-3">Email</th>
                      <th className="text-left font-semibold px-4 py-3">Role</th>
                      <th className="text-right font-semibold px-4 py-3">Actions</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-white/10">
                    {usersLoading ? (
                      <tr>
                        <td className="px-4 py-4 text-white/70" colSpan={4}>Loading...</td>
                      </tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr>
                        <td className="px-4 py-4 text-white/70" colSpan={4}>No users found.</td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => (
                        <tr key={u.id} className="text-white/85">
                          <td className="px-4 py-3">{u.name}</td>
                          <td className="px-4 py-3">{u.email}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs ring-1 ${u.role === 'admin' ? 'bg-indigo-500/15 text-indigo-200 ring-indigo-500/20' : 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/20'}`}>
                              {u.role || "staff"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => startUserEdit(u)}
                                disabled={userBusy}
                                className="rounded-xl bg-white/5 ring-1 ring-white/15 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10 disabled:opacity-60"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => onUserDelete(u)}
                                disabled={userBusy}
                                className="rounded-xl bg-red-500/15 ring-1 ring-red-500/25 px-3 py-2 text-xs font-semibold text-red-100 hover:bg-red-500/20 disabled:opacity-60"
                              >
                                Delete
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
                       placeholder="Search by title or author..."
                     />
                   </div>
                 </div>

                 <div className="flex gap-3">
                   <Card title={`${docsList.length} total`} desc="Uploaded docs." />
                   <Card title={`${docsList.filter(d => d.status === 'pending').length} pending`} desc="Awaiting approval." />
                 </div>
               </div>
            </div>
          </div>

          {/* Document Table */}
          <div className="grid gap-6 lg:grid-cols-12 mt-6">
            <div className="lg:col-span-12 rounded-3xl bg-white/[0.06] ring-1 ring-white/10 p-4 sm:p-6 min-w-0">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm text-white/70">Document Workflows</div>
                  <div className="mt-1 text-lg font-semibold text-white">
                    Approve & Reject Documents
                  </div>
                </div>
                <Pill>{filteredDocs.length} showing</Pill>
              </div>

              {docMsg && (
                <div className="mt-4 rounded-xl bg-white/5 ring-1 ring-white/10 px-4 py-3 text-sm text-white/80">
                  {docMsg}
                </div>
              )}

              <div className="mt-4 overflow-x-auto rounded-2xl ring-1 ring-white/10">
                <table className="min-w-[800px] w-full text-sm">
                  <thead className="bg-white/5 text-white/70">
                    <tr>
                      <th className="text-left font-semibold px-4 py-3">Title</th>
                      <th className="text-left font-semibold px-4 py-3">Uploader</th>
                      <th className="text-left font-semibold px-4 py-3">Status</th>
                      <th className="text-right font-semibold px-4 py-3">Actions</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-white/10">
                    {docsLoading ? (
                      <tr>
                        <td className="px-4 py-4 text-white/70" colSpan={4}>Loading Documents...</td>
                      </tr>
                    ) : filteredDocs.length === 0 ? (
                      <tr>
                        <td className="px-4 py-4 text-white/70" colSpan={4}>No documents found.</td>
                      </tr>
                    ) : (
                      filteredDocs.map((d) => (
                        <tr key={d.id} className="text-white/85">
                          <td className="px-4 py-3 font-medium">
                            <div>{d.title}</div>
                            {d.description && <div className="text-xs text-white/50 mt-1">{d.description}</div>}
                          </td>
                          <td className="px-4 py-3">{d.ownerName}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs ring-1 ${d.status === 'approved' ? 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/20' : d.status === 'rejected' ? 'bg-red-500/15 text-red-200 ring-red-500/20' : 'bg-amber-500/15 text-amber-200 ring-amber-500/20'}`}>
                              {d.status === 'pending' ? 'Pending Review' : d.status.charAt(0).toUpperCase() + d.status.slice(1)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => updateDocStatus(d.id, "approved")}
                                disabled={docBusy || d.status === 'approved'}
                                className="rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/25 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-40"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => updateDocStatus(d.id, "rejected")}
                                disabled={docBusy || d.status === 'rejected'}
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
  );
}