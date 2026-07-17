'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { UserPlus, Search, KeyRound, X, Users } from 'lucide-react';

type Employee = { id: string; name: string; phone: string; gender: string; status: string; defaultSite: { name: string } | null };
type Site = { id: string; name: string };

function Avatar({ name, size = 9 }: { name: string; size?: number }) {
  const colors = ['#2563eb','#7c3aed','#059669','#d97706','#dc2626','#0891b2'];
  const bg = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={`w-${size} h-${size} rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0`}
      style={{ background: bg, width: size * 4, height: size * 4 }}>
      {name[0]?.toUpperCase()}
    </div>
  );
}

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
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <Avatar name={employee.name} size={9} />
            <div>
              <h3 className="font-bold text-slate-900">Set Password</h3>
              <p className="text-xs text-slate-400">{employee.phone}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        {done ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl">✓</span>
            </div>
            <p className="font-semibold text-slate-900">Password set!</p>
            <p className="text-sm text-slate-500 mt-1">Share it with {employee.name} securely.</p>
            <button onClick={onClose}
              className="mt-5 w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors">
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">New Password</label>
              <input
                type="text"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="e.g. Ravi@2026"
                autoFocus
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-slate-400 mt-1.5">Minimum 6 characters</p>
            </div>
            {error && <p className="text-red-500 text-xs mb-3 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => mut.mutate()} disabled={password.length < 6 || mut.isPending}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors">
                {mut.isPending ? 'Saving…' : 'Set Password'}
              </button>
              <button onClick={onClose} className="px-4 py-2.5 text-sm text-slate-500 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors">Cancel</button>
            </div>
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

  const empQ  = useQuery({ queryKey: ['employees'], queryFn: () => api.get('/admin/employees').then(r => r.data.data) });
  const siteQ = useQuery({ queryKey: ['sites'],     queryFn: () => api.get('/admin/sites').then(r => r.data.data) });

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
  const sites: Site[]         = siteQ.data ?? [];
  const filtered = employees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) || e.phone.includes(search)
  );
  const activeCount = employees.filter(e => e.status === 'ACTIVE').length;

  return (
    <div className="min-h-full bg-slate-50">
      {passwordTarget && <SetPasswordModal employee={passwordTarget} onClose={() => setPasswordTarget(null)} />}

      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Employees</h1>
            <p className="text-sm text-slate-500 mt-0.5">{activeCount} active · {employees.length} total</p>
          </div>
          <button onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm shadow-blue-200">
            <UserPlus size={15} />Add Employee
          </button>
        </div>
      </div>

      <div className="px-8 py-6 space-y-5">
        {/* Add form */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-slate-900">New Employee</h3>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {([['name', 'Full Name', 'text', 'e.g. Ravi Kumar'], ['phone', 'Phone Number', 'tel', '10-digit mobile']] as const).map(([k, label, type, placeholder]) => (
                <div key={k}>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</label>
                  <input type={type} value={form[k as 'name' | 'phone']}
                    onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Gender</label>
                <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Site</label>
                <select value={form.defaultSiteId} onChange={e => setForm(f => ({ ...f, defaultSiteId: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select site…</option>
                  {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Initial Password <span className="font-normal text-slate-400">(optional — can set later)</span></label>
                <input type="text" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Leave blank to set later"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            {create.isError && (
              <p className="text-red-500 text-xs mt-3 bg-red-50 px-3 py-2 rounded-lg">
                {String((create.error as any)?.response?.data?.message ?? 'Error creating employee')}
              </p>
            )}
            <div className="flex gap-3 mt-5">
              <button onClick={() => create.mutate()} disabled={create.isPending || !form.name || !form.phone}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors">
                {create.isPending ? 'Saving…' : 'Create Employee'}
              </button>
              <button onClick={() => setShowForm(false)} className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2.5 rounded-xl hover:bg-slate-100 transition-colors">Cancel</button>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative w-72">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name or phone…"
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          {empQ.isLoading ? (
            <div className="flex flex-col items-center justify-center h-56 text-slate-400">
              <p className="text-sm">Loading…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-56 text-slate-400">
              <Users size={36} className="opacity-25 mb-3" />
              <p className="font-medium">{search ? 'No results found' : 'No employees yet'}</p>
              {!search && <p className="text-xs mt-1">Add your first employee above</p>}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Employee', 'Phone', 'Gender', 'Site', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => (
                  <tr key={e.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={e.name} size={9} />
                        <span className="font-semibold text-slate-900">{e.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{e.phone}</td>
                    <td className="px-5 py-4 text-slate-500 capitalize">{e.gender.toLowerCase()}</td>
                    <td className="px-5 py-4">
                      {e.defaultSite
                        ? <span className="text-slate-600">{e.defaultSite.name}</span>
                        : <span className="text-slate-300 italic text-xs">No site</span>}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${e.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${e.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        {e.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setPasswordTarget(e)}
                          className="flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">
                          <KeyRound size={12} />Password
                        </button>
                        {e.status === 'ACTIVE' && (
                          <button onClick={() => { if (confirm(`Deactivate ${e.name}?`)) deactivate.mutate(e.id); }}
                            className="text-xs font-medium text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors">
                            Deactivate
                          </button>
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
    </div>
  );
}
