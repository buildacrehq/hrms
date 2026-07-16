'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Plus, Trash2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export default function HolidaysPage() {
  const qc = useQueryClient();
  const year = new Date().getFullYear();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: '', name: '' });

  const holQ = useQuery({
    queryKey: ['holidays', year],
    queryFn: () => api.get('/admin/holidays', { params: { year } }).then(r => r.data.data),
  });

  const create = useMutation({
    mutationFn: () => api.post('/admin/holidays', form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['holidays'] }); setShowForm(false); setForm({ date: '', name: '' }); },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/holidays/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['holidays'] }),
  });

  const holidays = holQ.data ?? [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Holidays</h1>
          <p className="text-sm text-gray-500 mt-0.5">{year} calendar</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
          <Plus size={15} />Add Holiday
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
          <h3 className="font-semibold text-gray-900 mb-4">New Holiday</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Holiday Name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Independence Day" />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={() => create.mutate()} disabled={create.isPending || !form.date || !form.name}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg">
              {create.isPending ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setShowForm(false)} className="text-sm text-gray-500 px-4 py-2">Cancel</button>
          </div>
          {create.isError && <p className="text-red-600 text-sm mt-2">{String((create.error as any)?.response?.data?.message ?? 'Error')}</p>}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {holQ.isLoading ? <div className="h-48 flex items-center justify-center text-gray-400">Loading…</div>
          : holidays.length === 0 ? <div className="h-48 flex items-center justify-center text-gray-400">No holidays for {year}</div>
          : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>{['Date', 'Holiday', 'Scope', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {holidays.map((h: any) => (
                  <tr key={h.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{formatDate(h.date)}</td>
                    <td className="px-4 py-3 text-gray-700">{h.name}</td>
                    <td className="px-4 py-3 text-gray-500">{h.siteId ? 'Site-specific' : 'Company-wide'}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => { if (confirm(`Remove ${h.name}?`)) remove.mutate(h.id); }}
                        className="p-1.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
    </div>
  );
}
