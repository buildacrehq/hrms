'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Plus, MapPin, Users, X, Building2 } from 'lucide-react';

type Site = { id: string; name: string; address: string | null; status: string; _count: { employees: number } };

export default function SitesPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', address: '' });

  const siteQ = useQuery({ queryKey: ['sites'], queryFn: () => api.get('/admin/sites').then(r => r.data.data) });

  const create = useMutation({
    mutationFn: () => api.post('/admin/sites', form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sites'] }); setShowForm(false); setForm({ name: '', address: '' }); },
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => api.post(`/admin/sites/${id}/deactivate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sites'] }),
  });

  const sites: Site[]   = siteQ.data ?? [];
  const activeCount     = sites.filter(s => s.status === 'ACTIVE').length;

  const SITE_COLORS = ['#2563eb','#7c3aed','#059669','#d97706','#dc2626','#0891b2','#be185d','#4338ca'];

  return (
    <div className="min-h-full bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Sites</h1>
            <p className="text-sm text-slate-500 mt-0.5">{activeCount} active · {sites.length} total</p>
          </div>
          <button onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm shadow-blue-200">
            <Plus size={15} />Add Site
          </button>
        </div>
      </div>

      <div className="px-8 py-6 space-y-5">
        {/* Form */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-slate-900">New Site</h3>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Site Name <span className="text-red-400">*</span></label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Main Office"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Address <span className="font-normal text-slate-400">(optional)</span></label>
                <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  placeholder="Full address"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => create.mutate()} disabled={create.isPending || !form.name}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors">
                {create.isPending ? 'Saving…' : 'Create Site'}
              </button>
              <button onClick={() => setShowForm(false)} className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2.5 rounded-xl hover:bg-slate-100 transition-colors">Cancel</button>
            </div>
          </div>
        )}

        {/* Grid */}
        {siteQ.isLoading ? (
          <div className="flex items-center justify-center h-56 text-slate-400 text-sm">Loading…</div>
        ) : sites.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-56 text-slate-400">
            <Building2 size={36} className="opacity-25 mb-3" />
            <p className="font-medium">No sites yet</p>
            <p className="text-xs mt-1">Add your first work site above</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sites.map((s, i) => {
              const color = SITE_COLORS[i % SITE_COLORS.length];
              return (
                <div key={s.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow group">
                  {/* Top accent */}
                  <div className="h-1 w-12 rounded-full mb-4" style={{ background: color }} />

                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}18`, color }}>
                      <Building2 size={18} />
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${s.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {s.status}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-base">{s.name}</h3>

                  {s.address && (
                    <p className="flex items-start gap-1.5 text-xs text-slate-400 mt-1.5">
                      <MapPin size={11} className="mt-0.5 shrink-0" />{s.address}
                    </p>
                  )}

                  <div className="flex items-center gap-1.5 mt-3 text-xs text-slate-500">
                    <Users size={12} />
                    <span>{s._count.employees} employee{s._count.employees !== 1 ? 's' : ''}</span>
                  </div>

                  {s.status === 'ACTIVE' && (
                    <button
                      onClick={() => { if (confirm(`Deactivate "${s.name}"?`)) deactivate.mutate(s.id); }}
                      className="mt-4 text-xs font-medium text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    >
                      Deactivate
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
