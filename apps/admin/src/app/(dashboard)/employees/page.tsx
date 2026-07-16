'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { UserPlus, Search, KeyRound, X } from 'lucide-react';

type Employee = { id: string; name: string; phone: string; gender: string; status: string; defaultSite: { name: string } | null };
type Site = { id: string; name: string };

function SetPasswordModal({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const mut = useMutation({
    mutationFn: () => api.post(`/admin/employees/${employee.id}/set-password`, { password }),
    onSuccess: () => setDone(true),
    onError: (e: any) => setError(e?.response?.data?.message ?? 'Error setting password'),
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-900">Set Password</h3>
            <p className="text-sm text-gray-500">{employee.name} · {employee.phone}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        {done ? (
          <div className="text-center py-4">
            <p className="text-green-600 font-medium">Password set successfully!</p>
            <p className="text-sm text-gray-500 mt-1">Share it with {employee.name} securely.</p>
            <button onClick={onClose} className="mt-4 bg-blue-600 text-white text-sm px-4 py-2 rounded-lg">Done</button>
          </div>
        ) : (
          <>
            <label className="block text-xs font-medium text-gray-600 mb-1">New Password (min 6 characters)</label>
            <input
              type="text"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="e.g. Ravi@2026"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
              autoFocus
            />
            {error && <p className="text-red-600 text-xs mb-3">{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => mut.mutate()}
                disabled={password.length < 6 || mut.isPending}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg"
              >
                {mut.isPending ? 'Saving…' : 'Set Password'}
              </button>
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
            </div>
            <p className="text-xs text-gray-400 mt-3">Employee uses this password with their phone number to log in.</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function EmployeesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', gender: 'MALE', defaultSiteId: '', password: '' });
  const [passwordTarget, setPasswordTarget] = useState<Employee | null>(null);

  const empQ = useQuery({ queryKey: ['employees'], queryFn: () => api.get('/admin/employees').then(r => r.data.data) });
  const siteQ = useQuery({ queryKey: ['sites'], queryFn: () => api.get('/admin/sites').then(r => r.data.data) });

  const create = useMutation({
    mutationFn: () => api.post('/admin/employees', { ...form, password: form.password || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      setShowForm(false);
      setForm({ name: '', phone: '', gender: 'MALE', defaultSiteId: '', password: '' });
    },
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => api.post(`/admin/employees/${id}/deactivate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  });

  const employees: Employee[] = empQ.data?.employees ?? [];
  const sites: Site[] = siteQ.data ?? [];
  const filtered = employees.filter(e => e.name.toLowerCase().includes(search.toLowerCase()) || e.phone.includes(search));

  return (
    <div className="p-6">
      {passwordTarget && <SetPasswordModal employee={passwordTarget} onClose={() => setPasswordTarget(null)} />}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Employees</h1>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
          <UserPlus size={15} />Add Employee
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4 w-72">
        <Search size={15} className="absolute left-3 top-2.5 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or phone…"
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
          <h3 className="font-semibold text-gray-900 mb-4">New Employee</h3>
          <div className="grid grid-cols-2 gap-4">
            {[['name', 'Full Name', 'text'], ['phone', 'Phone (10 digits)', 'tel']].map(([k, label, type]) => (
              <div key={k}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                <input type={type} value={form[k as keyof typeof form]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Gender</label>
              <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Site</label>
              <select value={form.defaultSiteId} onChange={e => setForm(f => ({ ...f, defaultSiteId: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select site</option>
                {sites.map((s: Site) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Initial Password (optional)</label>
              <input type="text" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Set password now or later"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={() => create.mutate()} disabled={create.isPending || !form.name || !form.phone}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg">
              {create.isPending ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setShowForm(false)} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2">Cancel</button>
          </div>
          {create.isError && <p className="text-red-600 text-sm mt-2">{String((create.error as any)?.response?.data?.message ?? 'Error')}</p>}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {empQ.isLoading ? <div className="h-48 flex items-center justify-center text-gray-400">Loading…</div> : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>{['Name', 'Phone', 'Gender', 'Site', 'Status', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(e => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{e.name}</td>
                  <td className="px-4 py-3 text-gray-600">{e.phone}</td>
                  <td className="px-4 py-3 text-gray-500 capitalize">{e.gender.toLowerCase()}</td>
                  <td className="px-4 py-3 text-gray-500">{e.defaultSite?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${e.status === 'ACTIVE' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{e.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button onClick={() => setPasswordTarget(e)}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
                        <KeyRound size={12} />Password
                      </button>
                      {e.status === 'ACTIVE' && (
                        <button onClick={() => { if (confirm(`Deactivate ${e.name}?`)) deactivate.mutate(e.id); }}
                          className="text-xs text-red-500 hover:text-red-700">Deactivate</button>
                      )}
                    </div>
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
