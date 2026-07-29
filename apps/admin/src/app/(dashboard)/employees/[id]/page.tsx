'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Pencil, Check, X, KeyRound, CalendarDays,
  UserX, UserCheck, MapPin, Phone, User, Banknote,
  Briefcase, Clock4, AlertTriangle, Monitor,
} from 'lucide-react';
import { api } from '@/lib/api';

type EmpType = 'MONTHLY_REGULAR' | 'DAILY_WAGE' | 'CONTRACT';
const EMP_TYPE_LABEL: Record<EmpType, string> = {
  MONTHLY_REGULAR: 'Monthly Regular',
  DAILY_WAGE: 'Daily Wage',
  CONTRACT: 'Contract',
};

type Employee = {
  id: string; name: string; phone: string; gender: string;
  status: string; employmentType: EmpType; weeklyOff: number;
  monthlySalary: string | null;
  joinedAt: string; exitedAt: string | null;
  defaultSite: { id: string; name: string } | null;
  isTestAccount: boolean;
};
type Site = { id: string; name: string };
type DeviceSession = {
  id: string;
  deviceBrowser: string;
  deviceOs: string;
  ipAddress: string | null;
  lastSeenAt: string;
  createdAt: string;
};

const AVATAR_COLORS = ['#2563eb','#7c3aed','#059669','#d97706','#dc2626','#0891b2','#be185d','#4338ca'];
function avatarColor(name: string) {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ── inline editable field ── */
function Field({ label, icon: Icon, value, onSave, type = 'text', options }: {
  label: string;
  icon: React.ElementType;
  value: string;
  type?: 'text' | 'tel' | 'number' | 'select';
  options?: { value: string; label: string }[];
  onSave: (v: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [val,     setVal]     = useState(value);
  const [saving,  setSaving]  = useState(false);

  async function save() {
    if (!val.trim()) return;
    setSaving(true);
    await onSave(val);
    setSaving(false);
    setEditing(false);
  }

  function cancel() { setVal(value); setEditing(false); }

  return (
    <div className="flex items-start gap-3 py-4 border-b border-slate-100 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
        <Icon size={14} className="text-slate-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</div>
        {editing ? (
          <div className="flex items-center gap-2 flex-wrap">
            {type === 'select' && options ? (
              <select value={val} onChange={e => setVal(e.target.value)} autoFocus
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500">
                {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <input type={type} value={val} onChange={e => setVal(e.target.value)} autoFocus
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 w-56" />
            )}
            <button onClick={save} disabled={saving}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50 transition-colors">
              <Check size={13} />
            </button>
            <button onClick={cancel}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-600 transition-colors">
              <X size={13} />
            </button>
          </div>
        ) : (
          <button onClick={() => { setVal(value); setEditing(true); }}
            className="flex items-center gap-2 group text-left w-full">
            <span className="text-sm font-semibold text-slate-800">
              {type === 'select' && options
                ? (options.find(o => o.value === value)?.label || <span className="text-slate-400 font-normal italic">Not set</span>)
                : (value || <span className="text-slate-400 font-normal italic">Not set</span>)
              }
            </span>
            <Pencil size={12} className="text-slate-300 group-hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100" />
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Set Password Modal ── */
function SetPasswordModal({ emp, onClose }: { emp: Employee; onClose: () => void }) {
  const [pw, setPw] = useState('');
  const [done, setDone] = useState(false);
  const [err, setErr]   = useState('');
  const mut = useMutation({
    mutationFn: () => api.post(`/admin/employees/${emp.id}/set-password`, { password: pw }),
    onSuccess: () => setDone(true),
    onError: (e: any) => setErr(e?.response?.data?.message ?? 'Error'),
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-900">Set Password</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"><X size={16} /></button>
        </div>
        {done ? (
          <div className="px-6 py-8 text-center">
            <div className="text-3xl mb-3">✓</div>
            <p className="font-semibold text-slate-900">Password updated!</p>
            <button onClick={onClose} className="mt-5 w-full bg-blue-600 text-white text-sm font-semibold py-2.5 rounded-xl">Done</button>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            <input type="text" value={pw} onChange={e => setPw(e.target.value)} placeholder="New password (min 6 chars)" autoFocus
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {err && <p className="text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg">{err}</p>}
            <div className="flex gap-3">
              <button onClick={() => mut.mutate()} disabled={pw.length < 6 || mut.isPending}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-semibold py-2.5 rounded-xl">
                {mut.isPending ? 'Saving…' : 'Set Password'}
              </button>
              <button onClick={onClose} className="px-4 text-sm text-slate-500 hover:bg-slate-100 rounded-xl">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Page ── */
export default function EmployeeDetailPage() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();
  const qc      = useQueryClient();

  const [pwModal, setPwModal] = useState(false);

  const empQ  = useQuery<Employee>({
    queryKey: ['emp-detail', id],
    queryFn:  () => api.get(`/admin/employees/${id}`).then(r => r.data.data),
  });
  const siteQ = useQuery<Site[]>({
    queryKey: ['sites'],
    queryFn:  () => api.get('/admin/sites').then(r => r.data.data),
  });
  const devicesQ = useQuery<DeviceSession[]>({
    queryKey: ['emp-devices', id],
    queryFn:  () => api.get(`/admin/employees/${id}/device-sessions`).then(r => r.data.data),
  });

  const updateMut = useMutation({
    mutationFn: (patch: Record<string, unknown>) => api.patch(`/admin/employees/${id}`, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emp-detail', id] });
      qc.invalidateQueries({ queryKey: ['employees'] });
    },
  });

  const deactivateMut = useMutation({
    mutationFn: () => api.post(`/admin/employees/${id}/deactivate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['emp-detail', id] }),
  });
  const activateMut = useMutation({
    mutationFn: () => api.post(`/admin/employees/${id}/activate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['emp-detail', id] }),
  });

  const emp   = empQ.data;
  const sites = siteQ.data ?? [];

  async function patch(field: string, value: unknown) {
    await updateMut.mutateAsync({ [field]: value });
  }

  if (empQ.isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Loading…</div>
    );
  }
  if (!emp) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
        <AlertTriangle size={32} className="opacity-30" />
        <p className="text-sm">Employee not found</p>
        <button onClick={() => router.back()} className="text-blue-600 text-sm hover:underline">Go back</button>
      </div>
    );
  }

  const bg = avatarColor(emp.name);
  const isActive = emp.status === 'ACTIVE';

  return (
    <div className="min-h-full bg-slate-50">
      {pwModal && <SetPasswordModal emp={emp} onClose={() => setPwModal(false)} />}

      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 px-8 py-5">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors shrink-0">
            <ArrowLeft size={16} className="text-slate-600" />
          </button>
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-lg font-bold shrink-0"
              style={{ background: bg }}>
              {emp.name[0]?.toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{emp.name}</h1>
              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                <span className="text-sm text-slate-500">{emp.phone}</span>
                {emp.defaultSite && (
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    <MapPin size={11} />{emp.defaultSite.name}
                  </span>
                )}
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                  {isActive ? '● Active' : '● Deactivated'}
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button onClick={() => router.push(`/employees/${id}/attendance`)}
              className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors">
              <CalendarDays size={14} />Attendance
            </button>
            <button onClick={() => setPwModal(true)}
              className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors">
              <KeyRound size={14} />Set Password
            </button>
            {isActive ? (
              <button onClick={() => { if (confirm(`Deactivate ${emp.name}?`)) deactivateMut.mutate(); }}
                disabled={deactivateMut.isPending}
                className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 transition-colors disabled:opacity-50">
                <UserX size={14} />Deactivate
              </button>
            ) : (
              <button onClick={() => { if (confirm(`Re-activate ${emp.name}?`)) activateMut.mutate(); }}
                disabled={activateMut.isPending}
                className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors disabled:opacity-50">
                <UserCheck size={14} />Re-activate
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="px-8 py-6 max-w-3xl">
        <div className="space-y-5">

          {/* Personal Details */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Personal Details</h2>
            </div>
            <div className="px-6">
              <Field label="Full Name" icon={User} value={emp.name}
                onSave={v => patch('name', v)} />
              <Field label="Phone Number" icon={Phone} value={emp.phone} type="tel"
                onSave={v => patch('phone', v)} />
              <Field label="Gender" icon={User} value={emp.gender}
                type="select"
                options={[
                  { value: 'MALE', label: 'Male' },
                  { value: 'FEMALE', label: 'Female' },
                  { value: 'OTHER', label: 'Other' },
                ]}
                onSave={v => patch('gender', v)} />
            </div>
          </section>

          {/* Employment Details */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Employment Details</h2>
            </div>
            <div className="px-6">
              <Field label="Employment Type" icon={Briefcase} value={emp.employmentType}
                type="select"
                options={(Object.entries(EMP_TYPE_LABEL) as [EmpType, string][]).map(([v, l]) => ({ value: v, label: l }))}
                onSave={v => patch('employmentType', v)} />
              <Field label="Monthly Salary (₹)" icon={Banknote}
                value={emp.monthlySalary ? String(parseFloat(emp.monthlySalary)) : ''}
                type="number"
                onSave={v => patch('monthlySalary', v ? parseFloat(v) : null)} />
              <Field label="Weekly Off Day" icon={Clock4}
                value={String(emp.weeklyOff ?? 0)}
                type="select"
                options={[
                  { value: '0', label: 'Sunday' },
                  { value: '1', label: 'Monday' },
                  { value: '2', label: 'Tuesday' },
                  { value: '3', label: 'Wednesday' },
                  { value: '4', label: 'Thursday' },
                  { value: '5', label: 'Friday' },
                  { value: '6', label: 'Saturday' },
                ]}
                onSave={v => patch('weeklyOff', parseInt(v))} />
              <Field label="Site" icon={MapPin}
                value={emp.defaultSite?.id ?? ''}
                type="select"
                options={[
                  { value: '', label: 'No site assigned' },
                  ...sites.map(s => ({ value: s.id, label: s.name })),
                ]}
                onSave={v => patch('defaultSiteId', v || null)} />

              {/* Test account toggle */}
              <div className="flex items-center gap-3 py-4 border-b border-slate-100 last:border-0">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                  <AlertTriangle size={14} className="text-amber-500" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-slate-800">Test Account</div>
                  <div className="text-xs text-slate-400 mt-0.5">Bypasses 1 punch-in / 1 punch-out per day limit</div>
                </div>
                <button type="button"
                  onClick={() => patch('isTestAccount', !emp.isTestAccount)}
                  className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors"
                  style={{ background: emp.isTestAccount ? '#f59e0b' : '#e2e8f0' }}>
                  <span className="inline-block rounded-full bg-white shadow transition-transform duration-200"
                    style={{ width: 18, height: 18, transform: emp.isTestAccount ? 'translateX(22px)' : 'translateX(3px)' }} />
                </button>
              </div>
            </div>
          </section>

          {/* Timestamps */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Timeline</h2>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                  <Clock4 size={14} className="text-emerald-600" />
                </div>
                <div>
                  <div className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Joined</div>
                  <div className="text-sm font-semibold text-slate-800 mt-0.5">{fmtDate(emp.joinedAt)}</div>
                </div>
              </div>
              {emp.exitedAt && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                    <Clock4 size={14} className="text-red-500" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Exited</div>
                    <div className="text-sm font-semibold text-slate-800 mt-0.5">{fmtDate(emp.exitedAt)}</div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Device Sessions */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
              <Monitor size={14} className="text-slate-500" />
              <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Device Sessions</h2>
              {devicesQ.data && devicesQ.data.length > 1 && (
                <span className="ml-auto text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                  {devicesQ.data.length} devices
                </span>
              )}
            </div>
            <div className="px-6 py-4">
              {devicesQ.isLoading && <p className="text-sm text-slate-400">Loading…</p>}
              {devicesQ.data?.length === 0 && (
                <p className="text-sm text-slate-400 italic">No sessions recorded yet — will appear after next login.</p>
              )}
              {devicesQ.data && devicesQ.data.length > 0 && (
                <div className="space-y-3">
                  {devicesQ.data.map(d => (
                    <div key={d.id} className="flex items-start gap-3 py-3 border-b border-slate-50 last:border-0">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                        <Monitor size={14} className="text-blue-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-slate-800">{d.deviceBrowser || '—'}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{d.deviceOs || '—'}</div>
                        {d.ipAddress && <div className="text-xs font-mono text-slate-400 mt-0.5">{d.ipAddress}</div>}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs text-slate-400">Last seen</div>
                        <div className="text-xs font-semibold text-slate-600 mt-0.5">
                          {new Date(d.lastSeenAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(d.lastSeenAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
