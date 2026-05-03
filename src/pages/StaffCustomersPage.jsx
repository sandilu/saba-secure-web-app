import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listenCustomers } from "../firebase/customerActions";
import { PageShell, Pill, Input, Card } from "../ui/Layout";

export default function StaffCustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    return listenCustomers(
      (data) => {
        setCustomers(data);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setLoading(false);
      }
    );
  }, []);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return customers;
    return customers.filter((c) =>
      [c.name, c.email, c.phone, c.company].some((f) =>
        (f || "").toLowerCase().includes(s)
      )
    );
  }, [customers, search]);

  return (
    <PageShell
      right={
        <div className="space-y-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 ml-1">Directory Insights</div>
          <div className="rounded-3xl bg-white/[0.04] ring-1 ring-white/10 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-bold uppercase tracking-widest text-white/40">Total Registered</div>
              <div className="h-2 w-2 rounded-full bg-emerald-400"></div>
            </div>
            <div className="text-3xl font-black text-white tabular-nums">{customers.length}</div>
            <div className="text-[11px] text-white/30 font-medium leading-tight italic">Customer accounts currently in database.</div>
          </div>
          
          <div className="rounded-3xl bg-indigo-500/10 ring-1 ring-indigo-500/20 p-5 space-y-3">
            <div className="text-sm font-bold text-indigo-300">Onboarding New Clients</div>
            <p className="text-[11px] text-white/50 leading-relaxed">
              New customers can be quickly registered directly during checkout on the <Link to="/sales" className="text-indigo-400 hover:underline">Sales Page</Link>.
            </p>
          </div>
        </div>
      }
    >
      <div className="space-y-8">
        <div>
          <Pill>Relationship Management</Pill>
          <h1 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight text-white">Customer Directory</h1>
          <p className="mt-2 text-base text-white/50 max-w-xl">
            Quickly find and review customer profiles. Use the search bar to filter by name, phone number or email address.
          </p>
        </div>

        <div className="relative group max-w-2xl">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-white/20 group-focus-within:text-indigo-400 transition-colors">🔍</div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter customers by any detail..."
            className="w-full rounded-2xl bg-white/5 ring-1 ring-white/10 pl-11 pr-4 py-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all shadow-xl"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            <div className="col-span-full py-20 text-center">
              <div className="flex flex-col items-center gap-3">
                <div className="h-6 w-6 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                <span className="text-xs font-bold uppercase tracking-widest text-white/20">Syncing Contacts...</span>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="col-span-full py-20 text-center">
              <div className="flex flex-col items-center gap-2 text-white/20">
                <div className="text-4xl">👥</div>
                <div className="text-sm font-medium italic">No customers found matching your search.</div>
              </div>
            </div>
          ) : (
            filtered.map((c) => (
              <div key={c.id} className="group rounded-3xl bg-white/[0.04] ring-1 ring-white/10 p-6 hover:bg-white/[0.08] hover:ring-white/20 transition-all duration-300 shadow-sm hover:shadow-xl">
                <div className="flex items-start justify-between mb-4">
                  <div className="h-14 w-14 rounded-2xl bg-indigo-500/10 ring-1 ring-indigo-500/20 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform duration-300">👤</div>
                  <div className="text-right">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-white/30">Loyalty Status</div>
                    <div className="text-[11px] font-bold text-emerald-400 mt-0.5">Active Member</div>
                  </div>
                </div>
                
                <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors">{c.name || "Unnamed Customer"}</h3>
                
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-3 text-sm text-white/50">
                    <span className="opacity-40">📞</span>
                    <span className="font-medium group-hover:text-white/80 transition-colors">{c.phone || "No phone listed"}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-white/50">
                    <span className="opacity-40">✉</span>
                    <span className="truncate font-medium group-hover:text-white/80 transition-colors">{c.email || "No email listed"}</span>
                  </div>
                  {(c.company || c.address) && (
                    <div className="flex items-center gap-3 text-sm text-white/50">
                      <span className="opacity-40">📍</span>
                      <span className="truncate font-medium group-hover:text-white/80 transition-colors">{c.company || c.address}</span>
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-6 border-t border-white/5 flex items-center justify-between">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-white/20">Client Since</div>
                  <div className="text-[11px] font-bold text-white/40">{c.createdAt ? new Date(c.createdAt.toDate()).toLocaleDateString() : "Historical"}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </PageShell>
  );
}
