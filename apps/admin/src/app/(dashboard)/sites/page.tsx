'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Plus } from 'lucide-react';

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

  const sites: Site[] = siteQ.data ?? [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Sites</h1>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
          <Plus size={15} />Add Site
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
          <h3 className="font-semibold text-gray-900 mb-4">New Site</h3>
          <div className="grid grid-cols-2 gap-4">
            {[['name', 'Site Name'], ['address', 'Address (optional)']].map(([k, label]) => (
              <div key={k}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                <input value={form[k as keyof typeof form]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={() => create.mutate()} disabled={create.isPending || !form.name}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg">
              {create.isPending ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setShowForm(false)} className="text-sm text-gray-500 px-4 py-2">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {siteQ.isLoading ? <p className="text-gray-400 col-span-3">Loading…</p> : sites.map(s => (
          <div key={s.id} className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{s.name}</h3>
                <p className="text-sm text-gray-500 mt-0.5">{s.address ?? 'No address'}</p>
                <p className="text-xs text-gray-400 mt-2">{s._count.employees} employees</p>
              </div>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${s.status === 'ACTIVE' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{s.status}</span>
            </div>
            {s.status === 'ACTIVE' && (
              <button onClick={() => { if (confirm(`Deactivate ${s.name}?`)) deactivate.mutate(s.id); }}
                className="mt-4 text-xs text-red-500 hover:text-red-700">Deactivate</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
