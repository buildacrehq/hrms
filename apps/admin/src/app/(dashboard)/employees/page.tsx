'use client';
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { UserPlus, Search, KeyRound, X, Users, Pencil, UserCheck, UserX, Clock, ChevronRight, LogIn, LogOut as LogOutIcon, CheckCircle2, AlertCircle, XCircle, CalendarDays } from 'lucide-react';
import { formatDate, formatTime } from '@/lib/utils';

type Employee = {
  id: string; name: string; phone: string; gender: string;
  status: string; defaultSite: { id: string; name: string } | null;
};
type Site = { id: string; name: string };

const AVATAR_COLORS = ['#2563eb','#7c3aed','#059669','#d97706','#dc2626','#0891b2','#be185d','#4338ca'];

/* ─── Punch History Drawer ─── */
function HistoryDrawer({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const punchQ = useQuery({
    queryKey: ['emp-punches', employee.id],
    queryFn: () => api.get('/admin/punches', { params: { employeeId: employee.id } }).then(r => r.data.data),
  });

  const punches: any[] = punchQ.data?.punches ?? [];

  // Group punches by date, sort descending
  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    punches.forEach(p => {
      const day = new Date(p.timestampServer).toISOString().slice(0, 10);
      if (!map[day]) map[day] = [];
      map[day].push(p);
    });
    return Object.entries(map)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, rows]) => {
        const sorted = rows.sort((a, b) => new Date(a.timestampServer).getTime() - new Date(b.timestampServer).getTime());
        const inPunch  = sorted.find(p => p.type === 'IN');
        const outPunch = sorted.find(p => p.type === 'OUT');
        let hoursWorked: string | null = null;
        if (inPunch && outPunch) {
          const mins = Math.round((new Date(outPunch.timestampServer).getTime() - new Date(inPunch.timestampServer).getTime()) / 60000);
          hoursWorked = `${Math.floor(mins / 60)}h ${mins % 60}m`;
        }
        return { date, punches: sorted, inPunch, outPunch, hoursWorked };
      });
  }, [punches]);

  const totalPresent = grouped.length;
  const thisMonth    = grouped.filter(g => g.date.slice(0, 7) === new Date().toISOString().slice(0, 7)).length;

  const bg   = AVATAR_COLORS[employee.name.charCodeAt(0) % AVATAR_COLORS.length];

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md z-50 bg-white shadow-2xl flex flex-col"
        style={{ animation: 'slideIn 0.22s ease-out' }}>
        <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>

        {/* Drawer header */}
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-lg font-bold shrink-0"
                style={{ background: bg }}>
                {employee.name[0]?.toUpperCase()}
              </div>
              <div>
                <h2 className="font-bold text-slate-900 text-base">{employee.name}</h2>
                <p className="text-sm text-slate-400">{employee.phone}</p>
                {employee.defaultSite && <p className="text-xs text-slate-400 mt-0.5">{employee.defaultSite.name}</p>}
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors mt-0.5">
              <X size={16} />
            </button>
          </div>

          {/* Mini stats */}
          <div className="flex gap-3 mt-4">
            {[
              { label: 'Total Days', value: totalPresent, color: '#2563eb', bg: '#eff6ff' },
              { label: 'This Month', value: thisMonth,    color: '#059669', bg: '#f0fdf4' },
              { label: 'Total Punches', value: punches.length, color: '#7c3aed', bg: '#f5f3ff' },
            ].map(({ label, value, color, bg: cardBg }) => (
              <div key={label} className="flex-1 rounded-xl px-3 py-2.5 text-center" style={{ background: cardBg }}>
                <div className="text-xl font-bold" style={{ color }}>{value}</div>
                <div className="text-xs mt-0.5" style={{ color, opacity: 0.7 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Punch list */}
        <div className="flex-1 overflow-y-auto">
          {punchQ.isLoading ? (
            <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Loading history…</div>
          ) : grouped.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400">
              <Clock size={32} className="opacity-25 mb-2" />
              <p className="text-sm">No punches recorded yet</p>
            </div>
          ) : grouped.map(({ date, punches: dayPunches, inPunch, outPunch, hoursWorked }) => {
            const d = new Date(date);
            const dayLabel   = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
            const isToday    = date === new Date().toISOString().slice(0, 10);
            const isYesterday = date === new Date(Date.now() - 86400000).toISOString().slice(0, 10);
            const label = isToday ? 'Today' : isYesterday ? 'Yesterday' : dayLabel;

            return (
              <div key={date} className="border-b border-slate-100 last:border-0">
                {/* Date header */}
                <div className="flex items-center justify-between px-6 py-3 bg-slate-50">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-700">{label}</span>
                    {isToday && <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">Today</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    {inPunch && outPunch && (
                      <span className="text-xs font-semibold text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-full">
                        ⏱ {hoursWorked}
                      </span>
                    )}
                    {inPunch && !outPunch && (
                      <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full font-medium">No OUT</span>
                    )}
                  </div>
                </div>

                {/* Punch rows */}
                {dayPunches.map(p => (
                  <div key={p.id} className="flex items-center gap-4 px-6 py-3 hover:bg-slate-50 transition-colors">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${p.type === 'IN' ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                      {p.type === 'IN'
                        ? <LogIn size={14} className="text-emerald-600" />
                        : <LogOutIcon size={14} className="text-amber-600" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${p.type === 'IN' ? 'text-emerald-700' : 'text-amber-700'}`}>{p.type}</span>
                        <span className="text-sm font-semibold text-slate-800">{formatTime(p.timestampServer)}</span>
                      </div>
                      {p.site && <p className="text-xs text-slate-400 mt-0.5">{p.site.name}</p>}
                    </div>
                    <div>
                      {p.approvalStatus === 'APPROVED' && <CheckCircle2 size={15} className="text-emerald-500" />}
                      {p.approvalStatus === 'PENDING'  && <AlertCircle  size={15} className="text-amber-400" />}
                      {p.approvalStatus === 'REJECTED' && <XCircle      size={15} className="text-red-400" />}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const bg = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
  return (
    <div className="rounded-xl flex items-center justify-center text-white font-bold shrink-0"
      style={{ background: bg, width: size, height: size, fontSize: size * 0.38 }}>
      {name[0]?.toUpperCase()}
    </div>
  );
}

/* ─── Set Password Modal ─── */
function SetPasswordModal({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const mut = useMutation({
    mutationFn: () => api.post(`/admin/employees/${employee.id}/set-password`, { password }),
    onSuccess: () => setDone(true),
    onError: (e: any) => setError(e?.response?.data?.message ?? 'Error'),
  });
  return (
    <Modal onClose={onClose}>
      <ModalHeader title="Set Password" sub={`${employee.name} · ${employee.phone}`} onClose={onClose}>
        <Avatar name={employee.name} />
      </ModalHeader>
      {done ? (
        <div className="text-center py-6 px-6">
          <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3 text-2xl">✓</div>
          <p className="font-semibold text-slate-900">Password set!</p>
          <p className="text-sm text-slate-500 mt-1">Share it with {employee.name} securely.</p>
          <button onClick={onClose} className="mt-5 w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors">Done</button>
        </div>
      ) : (
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">New Password <span className="font-normal text-slate-400">(min 6 chars)</span></label>
            <input type="text" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="e.g. Ravi@2026" autoFocus
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
          {error && <p className="text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div className="flex gap-3">
            <button onClick={() => mut.mutate()} disabled={password.length < 6 || mut.isPending}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors">
              {mut.isPending ? 'Saving…' : 'Set Password'}
            </button>
            <button onClick={onClose} className="px-4 py-2.5 text-sm text-slate-500 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors">Cancel</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ─── Edit Employee Modal ─── */
function EditModal({ employee, sites, onClose }: { employee: Employee; sites: Site[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: employee.name,
    phone: employee.phone,
    gender: employee.gender,
    defaultSiteId: employee.defaultSite?.id ?? '',
  });
  const [error, setError] = useState('');

  const mut = useMutation({
    mutationFn: () => api.patch(`/admin/employees/${employee.id}`, {
      name: form.name,
      phone: form.phone,
      gender: form.gender,
      defaultSiteId: form.defaultSiteId || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); onClose(); },
    onError: (e: any) => setError(e?.response?.data?.message ?? 'Error updating employee'),
  });

  return (
    <Modal onClose={onClose}>
      <ModalHeader title="Edit Employee" sub="Update details below" onClose={onClose}>
        <Avatar name={employee.name} />
      </ModalHeader>
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Full Name</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Phone</label>
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} type="tel"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Gender</label>
            <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Site</label>
            <select value={form.defaultSiteId} onChange={e => setForm(f => ({ ...f, defaultSiteId: e.target.value }))}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">No site assigned</option>
              {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        {error && <p className="text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <div className="flex gap-3 pt-1">
          <button onClick={() => mut.mutate()} disabled={mut.isPending || !form.name || !form.phone}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors">
            {mut.isPending ? 'Saving…' : 'Save Changes'}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 text-sm text-slate-500 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors">Cancel</button>
        </div>
      </div>
    </Modal>
  );
}

/* ─── Shared Modal Shell ─── */
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function ModalHeader({ title, sub, onClose, children }: { title: string; sub: string; onClose: () => void; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
      <div className="flex items-center gap-3">
        {children}
        <div>
          <h3 className="font-bold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
        </div>
      </div>
      <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
        <X size={16} />
      </button>
    </div>
  );
}

/* ─── Page ─── */
export default function EmployeesPage() {
  const qc     = useQueryClient();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', gender: 'MALE', defaultSiteId: '', password: '' });
  const [passwordTarget, setPasswordTarget] = useState<Employee | null>(null);
  const [editTarget,     setEditTarget]     = useState<Employee | null>(null);
  const [historyTarget,  setHistoryTarget]  = useState<Employee | null>(null);

  const empQ  = useQuery({
    queryKey: ['employees', showAll],
    queryFn: () => api.get('/admin/employees', { params: showAll ? { status: undefined } : {} })
      .then(r => r.data.data),
  });
  const siteQ = useQuery({ queryKey: ['sites'], queryFn: () => api.get('/admin/sites').then(r => r.data.data) });

  const create = useMutation({
    mutationFn: () => api.post('/admin/employees', { ...form, password: form.password || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); setShowForm(false); setForm({ name: '', phone: '', gender: 'MALE', defaultSiteId: '', password: '' }); },
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => api.post(`/admin/employees/${id}/deactivate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  });

  const activate = useMutation({
    mutationFn: (id: string) => api.post(`/admin/employees/${id}/activate`),
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
      {editTarget     && <EditModal employee={editTarget} sites={sites} onClose={() => setEditTarget(null)} />}
      {historyTarget  && <HistoryDrawer employee={historyTarget} onClose={() => setHistoryTarget(null)} />}

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
              <button onClick={() => setShowForm(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {([['name','Full Name','text','e.g. Ravi Kumar'],['phone','Phone Number','tel','10-digit mobile']] as const).map(([k,label,type,ph]) => (
                <div key={k}>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</label>
                  <input type={type} value={form[k as 'name'|'phone']} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                    placeholder={ph}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Gender</label>
                <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option>
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
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Initial Password <span className="font-normal text-slate-400">(optional)</span></label>
                <input type="text" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Leave blank to set later"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            {create.isError && (
              <p className="text-red-500 text-xs mt-3 bg-red-50 px-3 py-2 rounded-lg">
                {String((create.error as any)?.response?.data?.message ?? 'Error')}
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

        {/* Toolbar */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-72">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or phone…"
              className="w-full pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
          <button
            onClick={() => setShowAll(v => !v)}
            className="flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl border transition-colors"
            style={{
              background: showAll ? '#f1f5f9' : '#fff',
              borderColor: showAll ? '#cbd5e1' : '#e2e8f0',
              color: showAll ? '#334155' : '#64748b',
            }}
          >
            <Users size={14} />
            {showAll ? 'Showing all' : 'Active only'}
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          {empQ.isLoading ? (
            <div className="flex items-center justify-center h-56 text-slate-400 text-sm">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-56 text-slate-400">
              <Users size={36} className="opacity-25 mb-3" />
              <p className="font-medium text-sm">{search ? 'No results found' : 'No employees yet'}</p>
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
                      <button onClick={() => setHistoryTarget(e)} className="flex items-center gap-3 group text-left w-full">
                        <Avatar name={e.name} size={34} />
                        <div>
                          <span className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">{e.name}</span>
                          <div className="flex items-center gap-1 text-xs text-slate-400 group-hover:text-blue-400 transition-colors mt-0.5">
                            <Clock size={10} /><span>View history</span>
                          </div>
                        </div>
                      </button>
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
                        {e.status === 'ACTIVE' ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={() => setHistoryTarget(e)}
                          className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors">
                          <Clock size={11} />History
                        </button>
                        <button onClick={() => router.push(`/employees/${e.id}/attendance`)}
                          className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors">
                          <CalendarDays size={11} />Attendance
                        </button>
                        <button onClick={() => setEditTarget(e)}
                          className="flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors">
                          <Pencil size={11} />Edit
                        </button>
                        <button onClick={() => setPasswordTarget(e)}
                          className="flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">
                          <KeyRound size={11} />Password
                        </button>
                        {e.status === 'ACTIVE' ? (
                          <button onClick={() => { if (confirm(`Deactivate ${e.name}?`)) deactivate.mutate(e.id); }}
                            className="flex items-center gap-1.5 text-xs font-medium text-red-500 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors">
                            <UserX size={11} />Deactivate
                          </button>
                        ) : (
                          <button onClick={() => { if (confirm(`Re-activate ${e.name}?`)) activate.mutate(e.id); }}
                            className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors">
                            <UserCheck size={11} />Activate
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
