'use client';
import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ChevronLeft, ChevronRight, Search, Users, Plus, X } from 'lucide-react';
import { localDateStr } from '@/lib/utils';
import Link from 'next/link';

type Punch = {
  id: string; type: 'IN' | 'OUT'; timestampServer: string;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  employee: { id: string; name: string; phone: string };
};

type EmpType = 'MONTHLY_REGULAR' | 'DAILY_WAGE' | 'CONTRACT';
type Employee = {
  id: string; name: string; phone: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  weeklyOff: number;
  employmentType: EmpType;
  defaultSite: { id: string; name: string } | null;
};

type LeaveType = {
  id: string; name: string; scope: string; paid: boolean; accrual: string;
};

const EMP_TYPE_LABEL: Record<EmpType, string> = {
  MONTHLY_REGULAR: 'Monthly Regular',
  DAILY_WAGE:      'Daily Wage',
  CONTRACT:        'Contract',
};

const AVATAR_COLORS = ['#2563eb','#7c3aed','#059669','#d97706','#dc2626','#0891b2','#be185d','#4338ca'];
function avatarBg(name: string) {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

// Tiny status box
function SBox({ code, content, variant }: {
  code: string; content: string;
  variant: 'green' | 'green-outline' | 'amber' | 'red' | 'teal' | 'violet' | 'slate' | 'ghost';
}) {
  const styles = {
    'green':        { bg: '#16a34a', border: '#16a34a', codeClr: '#fff',    contentClr: '#fff'    },
    'green-outline':{ bg: '#fff',    border: '#86efac', codeClr: '#15803d', contentClr: '#15803d' },
    'amber':        { bg: '#fef9c3', border: '#fde68a', codeClr: '#92400e', contentClr: '#78350f' },
    'red':          { bg: '#fee2e2', border: '#fca5a5', codeClr: '#b91c1c', contentClr: '#991b1b' },
    'teal':         { bg: '#ccfbf1', border: '#5eead4', codeClr: '#0f766e', contentClr: '#0f766e' },
    'violet':       { bg: '#ede9fe', border: '#c4b5fd', codeClr: '#6d28d9', contentClr: '#5b21b6' },
    'slate':        { bg: '#f1f5f9', border: '#cbd5e1', codeClr: '#475569', contentClr: '#64748b' },
    'ghost':        { bg: '#f8fafc', border: '#e2e8f0', codeClr: '#94a3b8', contentClr: '#94a3b8' },
  } as const;
  const s = styles[variant];
  return (
    <div className="flex items-center rounded-lg overflow-hidden text-xs font-semibold"
      style={{ border: `1.5px solid ${s.border}`, background: s.bg, minHeight: 30 }}>
      <span className="px-1.5 py-1 shrink-0 whitespace-nowrap" style={{ color: s.codeClr }}>{code}</span>
      <span className="w-px self-stretch" style={{ background: s.border }} />
      <span className="px-1.5 py-1 flex-1 truncate" style={{ color: s.contentClr }}>{content}</span>
    </div>
  );
}

// ─── Mark as Leave Modal ──────────────────────────────────────────────────────

function MarkLeaveModal({
  emp, date, leaveTypes, onClose, onSaved,
}: {
  emp: Employee; date: string;
  leaveTypes: LeaveType[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const eligibleTypes = leaveTypes.filter(lt => {
    if (lt.scope === 'FEMALE_ONLY' && emp.gender !== 'FEMALE') return false;
    if (lt.scope === 'MALE_ONLY'   && emp.gender !== 'MALE')   return false;
    return true;
  });

  const [leaveTypeId, setLeaveTypeId] = useState(eligibleTypes[0]?.id ?? '');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    if (!leaveTypeId) return setErr('Select a leave type');
    setSaving(true); setErr('');
    try {
      await api.post('/admin/leaves/requests', {
        employeeId: emp.id,
        leaveTypeId,
        fromDate: date,
        toDate: date,
        reason: reason || 'Marked by admin',
      });
      onSaved();
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? 'Failed to mark leave');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-800">Mark as Leave</h3>
            <p className="text-xs text-slate-500 mt-0.5">{emp.name} · {new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Leave Type</label>
            <select value={leaveTypeId} onChange={e => setLeaveTypeId(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
              {eligibleTypes.map(lt => (
                <option key={lt.id} value={lt.id}>{lt.name}{!lt.paid ? ' (Unpaid)' : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Reason (optional)</label>
            <input value={reason} onChange={e => setReason(e.target.value)}
              placeholder="e.g. Sick, Personal"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {err && <p className="text-red-500 text-xs">{err}</p>}
          <div className="flex gap-3 pt-1">
            <button onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button onClick={save} disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 transition-colors">
              {saving ? 'Marking…' : 'Mark Leave'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Comp Off Credit Modal ─────────────────────────────────────────────────────

function CompOffModal({
  emp, date, compOffTypeId, onClose, onSaved,
}: {
  emp: Employee; date: string; compOffTypeId: string;
  onClose: () => void; onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function credit() {
    setSaving(true); setErr('');
    try {
      await api.post('/admin/leaves/balances/adjust', {
        employeeId: emp.id,
        leaveTypeId: compOffTypeId,
        credit: 1,
      });
      onSaved();
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? 'Failed to credit Comp Off');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">Credit Comp Off</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-600">
            Credit <strong>1 Comp Off day</strong> to <strong>{emp.name}</strong> for working on{' '}
            {new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short' })}?
          </p>
          <p className="text-xs text-slate-400">They can use it as a future day off.</p>
          {err && <p className="text-red-500 text-xs">{err}</p>}
          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button onClick={credit} disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 transition-colors">
              {saving ? 'Crediting…' : '+ 1 Comp Off'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type PunchFilter = 'all' | 'in' | 'not-in';

export default function AttendancePage() {
  const todayIso = localDateStr();
  const [date, setDate] = useState(todayIso);
  const [search, setSearch] = useState('');
  const [punchFilter, setPunchFilter] = useState<PunchFilter>('all');
  const [markLeaveEmp, setMarkLeaveEmp]   = useState<Employee | null>(null);
  const [compOffEmp,   setCompOffEmp]     = useState<Employee | null>(null);
  const qc = useQueryClient();

  function shiftDate(days: number) {
    const d = new Date(date); d.setDate(d.getDate() + days);
    setDate(localDateStr(d));
    setPunchFilter('all');
  }
  const isToday = date === todayIso;

  /* ── queries ── */
  const empQ = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.get('/admin/employees').then(r => r.data.data),
  });
  const punchQ = useQuery({
    queryKey: ['att-punches', date],
    queryFn: () => api.get('/admin/punches', { params: { date } }).then(r => r.data.data),
    refetchInterval: isToday ? 20_000 : false,
  });
  const leaveQ = useQuery({
    queryKey: ['att-leaves', date.slice(0, 7)],
    queryFn: () => api.get('/admin/leaves/requests', {
      params: { status: 'APPROVED', year: date.slice(0, 4), month: String(parseInt(date.slice(5, 7), 10)) },
    }).then(r => r.data.data ?? r.data),
  });
  const holidayQ = useQuery({
    queryKey: ['holidays', date.slice(0, 4)],
    queryFn: () => api.get('/holidays', { params: { year: date.slice(0, 4) } }).then(r => r.data.data ?? r.data),
  });
  const leaveTypesQ = useQuery<LeaveType[]>({
    queryKey: ['leave-types-active'],
    queryFn: () => api.get('/admin/leaves/types').then(r => r.data.data ?? r.data),
    staleTime: 60_000,
  });

  const activeEmployees: Employee[] = empQ.data?.employees?.filter((e: any) => e.status === 'ACTIVE') ?? [];
  const punches: Punch[] = punchQ.data?.punches ?? [];
  const leaveTypes: LeaveType[] = leaveTypesQ.data ?? [];
  const compOffTypeId = leaveTypes.find(lt => lt.accrual === 'MANUAL' && lt.id === 'lt-compoff')?.id
    ?? leaveTypes.find(lt => lt.accrual === 'MANUAL')?.id ?? '';

  /* ── leave map: empId → {leaveTypeId, leaveTypeName} ── */
  const leaveMap = useMemo(() => {
    const m = new Map<string, { leaveTypeId: string; leaveTypeName: string }>();
    (leaveQ.data ?? []).forEach((lr: any) => {
      if (date >= lr.fromDate.slice(0, 10) && date <= lr.toDate.slice(0, 10)) {
        m.set(lr.employee.id, {
          leaveTypeId: lr.leaveType?.id ?? '',
          leaveTypeName: lr.leaveType?.name ?? 'Leave',
        });
      }
    });
    return m;
  }, [leaveQ.data, date]);

  /* ── holiday check ── */
  const isHoliday = useMemo(() => {
    return (holidayQ.data ?? []).some((h: any) => h.date.slice(0, 10) === date);
  }, [holidayQ.data, date]);

  const dayOfWeek = new Date(date + 'T00:00:00').getDay();

  /* ── per-employee punch map ── */
  type EmpPunches = { approvedIn?: Punch; approvedOut?: Punch; pendingIn?: Punch; pendingOut?: Punch };
  const punchMap = useMemo(() => {
    const m = new Map<string, EmpPunches>();
    punches.forEach(p => {
      if (!m.has(p.employee.id)) m.set(p.employee.id, {});
      const slot = m.get(p.employee.id)!;
      if (p.approvalStatus === 'APPROVED') {
        if (p.type === 'IN'  && !slot.approvedIn)  slot.approvedIn  = p;
        if (p.type === 'OUT' && !slot.approvedOut) slot.approvedOut = p;
      } else if (p.approvalStatus === 'PENDING') {
        if (p.type === 'IN'  && !slot.pendingIn)  slot.pendingIn  = p;
        if (p.type === 'OUT' && !slot.pendingOut) slot.pendingOut = p;
      }
    });
    return m;
  }, [punches]);

  /* ── per-employee day status ── */
  type DayStatus = 'P' | 'HD' | 'A' | 'L' | 'H' | 'W' | 'PEND';
  function getStatus(emp: Employee): DayStatus {
    if (isHoliday)                      return 'H';
    if (leaveMap.has(emp.id))           return 'L';
    if (dayOfWeek === emp.weeklyOff)    return 'W';
    const slot = punchMap.get(emp.id);
    if (!slot) return 'A';
    if (slot.approvedIn && slot.approvedOut) return 'P';
    if (slot.approvedIn) return 'HD';
    if (slot.pendingIn || slot.pendingOut)  return 'PEND';
    return 'A';
  }

  /* ── stats ── */
  const stats = useMemo(() => {
    let present = 0, absent = 0, halfDay = 0, onLeave = 0, punchedIn = 0, punchedOut = 0, pending = 0;
    activeEmployees.forEach(e => {
      const s = getStatus(e);
      if (s === 'P')    { present++;  punchedIn++; punchedOut++; }
      if (s === 'HD')   { halfDay++;  punchedIn++; }
      if (s === 'A')    absent++;
      if (s === 'L')    onLeave++;
      if (s === 'PEND') { pending++;  punchedIn++; }
    });
    return { present, absent, halfDay, onLeave, punchedIn, punchedOut, pending };
  }, [activeEmployees, punchMap, leaveMap, isHoliday, dayOfWeek]);  // eslint-disable-line react-hooks/exhaustive-deps

  /* ── filtered list ── */
  const filtered = useMemo(() => {
    let list = activeEmployees;
    if (punchFilter === 'in') {
      list = list.filter(e => {
        const s = getStatus(e);
        return s === 'P' || s === 'HD' || s === 'PEND';
      });
    } else if (punchFilter === 'not-in') {
      list = list.filter(e => {
        const s = getStatus(e);
        return s === 'A';
      });
    }
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(e => e.name.toLowerCase().includes(q) || e.phone.includes(q));
  }, [activeEmployees, search, punchFilter, punchMap, leaveMap, isHoliday, dayOfWeek]);  // eslint-disable-line react-hooks/exhaustive-deps

  const displayDate = new Date(date + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const isLoading = empQ.isLoading || punchQ.isLoading;

  function onActionDone() {
    setMarkLeaveEmp(null);
    setCompOffEmp(null);
    qc.invalidateQueries({ queryKey: ['att-leaves'] });
    qc.invalidateQueries({ queryKey: ['leave-balances'] });
  }

  return (
    <div className="min-h-full bg-slate-50">
      {/* ── Header ── */}
      <div className="bg-white border-b border-slate-200 px-8 py-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Attendance Summary</h1>
            <p className="text-sm text-slate-500 mt-0.5">{displayDate}</p>
          </div>

          {/* Date nav */}
          <div className="flex items-center gap-2">
            <button onClick={() => shiftDate(-1)}
              className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors">
              <ChevronLeft size={16} />
            </button>
            <input type="date" value={date} onChange={e => { setDate(e.target.value); setPunchFilter('all'); }}
              max={todayIso}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button onClick={() => shiftDate(1)} disabled={isToday}
              className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors disabled:opacity-30">
              <ChevronRight size={16} />
            </button>
            {!isToday && (
              <button onClick={() => { setDate(todayIso); setPunchFilter('all'); }}
                className="text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-xl transition-colors">
                Today
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="px-8 py-6 space-y-5">
        {/* ── Punch-in / Not-punched filter cards ── */}
        <div className="grid grid-cols-3 gap-4">
          {/* All */}
          <button
            onClick={() => setPunchFilter('all')}
            className={`rounded-2xl p-4 text-center transition-all border-2 ${punchFilter === 'all' ? 'border-blue-500 shadow-md' : 'border-transparent hover:border-slate-300'}`}
            style={{ background: '#eff6ff' }}>
            <div className="text-3xl font-extrabold text-blue-700">{activeEmployees.length}</div>
            <div className="text-xs font-bold mt-1 uppercase tracking-wide text-blue-500">Total Staff</div>
          </button>
          {/* Punched In */}
          <button
            onClick={() => setPunchFilter(punchFilter === 'in' ? 'all' : 'in')}
            className={`rounded-2xl p-4 text-center transition-all border-2 ${punchFilter === 'in' ? 'border-emerald-500 shadow-md' : 'border-transparent hover:border-slate-300'}`}
            style={{ background: '#f0fdf4' }}>
            <div className="text-3xl font-extrabold text-emerald-700">{stats.punchedIn}</div>
            <div className="text-xs font-bold mt-1 uppercase tracking-wide text-emerald-500">Punched In</div>
          </button>
          {/* Not Punched In */}
          <button
            onClick={() => setPunchFilter(punchFilter === 'not-in' ? 'all' : 'not-in')}
            className={`rounded-2xl p-4 text-center transition-all border-2 ${punchFilter === 'not-in' ? 'border-red-500 shadow-md' : 'border-transparent hover:border-slate-300'}`}
            style={{ background: '#fee2e2' }}>
            <div className="text-3xl font-extrabold text-red-700">{stats.absent}</div>
            <div className="text-xs font-bold mt-1 uppercase tracking-wide text-red-500">Not Punched In</div>
          </button>
        </div>

        {/* ── Secondary stats strip ── */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Present',     value: stats.present,  clr: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
            { label: 'Half Day',    value: stats.halfDay,  clr: '#0f766e', bg: '#ccfbf1', border: '#99f6e4' },
            { label: 'Pending',     value: stats.pending,  clr: '#92400e', bg: '#fef9c3', border: '#fde68a' },
            { label: 'On Leave',    value: stats.onLeave,  clr: '#6d28d9', bg: '#ede9fe', border: '#ddd6fe' },
          ].map(s => (
            <div key={s.label} className="rounded-2xl p-3 text-center"
              style={{ background: s.bg, border: `1px solid ${s.border}` }}>
              <div className="text-2xl font-extrabold" style={{ color: s.clr }}>{s.value}</div>
              <div className="text-[10px] font-semibold mt-0.5 uppercase tracking-wide" style={{ color: s.clr, opacity: 0.7 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Pending alert */}
        {stats.pending > 0 && (
          <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-sm font-semibold text-amber-800">
                {stats.pending} employee{stats.pending !== 1 ? 's' : ''} with pending approval
              </span>
            </div>
            <Link href="/punches" className="text-xs font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-xl transition-colors">
              Review →
            </Link>
          </div>
        )}

        {/* Holiday / Week Off banner */}
        {isHoliday && (
          <div className="bg-violet-50 border border-violet-200 rounded-2xl px-5 py-3 text-sm font-semibold text-violet-800">
            🎉 This day is a holiday
          </div>
        )}

        {/* Search */}
        <div className="relative max-w-sm">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or phone…"
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          />
        </div>

        {/* Active filter label */}
        {punchFilter !== 'all' && (
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold px-3 py-1.5 rounded-full ${punchFilter === 'in' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
              {punchFilter === 'in' ? `Showing ${filtered.length} Punched In` : `Showing ${filtered.length} Not Punched In`}
            </span>
            <button onClick={() => setPunchFilter('all')} className="text-xs text-slate-400 hover:text-slate-600">
              Clear filter ×
            </button>
          </div>
        )}

        {/* ── Employee list ── */}
        {isLoading ? (
          <div className="bg-white rounded-2xl border border-slate-200 flex items-center justify-center h-48 text-slate-400 text-sm">
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 flex flex-col items-center justify-center h-48 text-slate-400">
            <Users size={32} className="opacity-20 mb-3" />
            <p className="text-sm font-medium">No employees found</p>
          </div>
        ) : (
          <EmpGroupedList
            employees={filtered}
            punchMap={punchMap}
            leaveMap={leaveMap}
            leaveTypes={leaveTypes}
            getStatus={getStatus}
            isHoliday={isHoliday}
            date={date}
            onMarkLeave={setMarkLeaveEmp}
            onCompOff={setCompOffEmp}
          />
        )}
      </div>

      {markLeaveEmp && (
        <MarkLeaveModal
          emp={markLeaveEmp}
          date={date}
          leaveTypes={leaveTypes}
          onClose={() => setMarkLeaveEmp(null)}
          onSaved={onActionDone}
        />
      )}

      {compOffEmp && compOffTypeId && (
        <CompOffModal
          emp={compOffEmp}
          date={date}
          compOffTypeId={compOffTypeId}
          onClose={() => setCompOffEmp(null)}
          onSaved={onActionDone}
        />
      )}
    </div>
  );
}

/* ── Grouped employee list ───────────────────────────────────── */
type EmpPunchMap = Map<string, { approvedIn?: any; approvedOut?: any; pendingIn?: any; pendingOut?: any }>;
type LeaveInfoMap = Map<string, { leaveTypeId: string; leaveTypeName: string }>;
type DayStatus = 'P' | 'HD' | 'A' | 'L' | 'H' | 'W' | 'PEND';

function EmpGroupedList({
  employees, punchMap, leaveMap, leaveTypes, getStatus, isHoliday, date, onMarkLeave, onCompOff,
}: {
  employees: Employee[];
  punchMap: EmpPunchMap;
  leaveMap: LeaveInfoMap;
  leaveTypes: LeaveType[];
  getStatus: (emp: Employee) => DayStatus;
  isHoliday: boolean;
  date: string;
  onMarkLeave: (emp: Employee) => void;
  onCompOff: (emp: Employee) => void;
}) {
  const groups = useMemo(() => {
    const order: EmpType[] = ['MONTHLY_REGULAR', 'DAILY_WAGE', 'CONTRACT'];
    const map = new Map<EmpType, Employee[]>();
    order.forEach(t => map.set(t, []));
    employees.forEach(e => {
      const t = (e.employmentType ?? 'MONTHLY_REGULAR') as EmpType;
      map.get(t)?.push(e);
    });
    return order.filter(t => (map.get(t)?.length ?? 0) > 0).map(t => ({ type: t, emps: map.get(t)! }));
  }, [employees]);

  return (
    <div className="space-y-4">
      {groups.map(({ type, emps }) => (
        <div key={type} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100 bg-slate-50">
            <span className="text-sm font-bold text-slate-700">{EMP_TYPE_LABEL[type]}</span>
            <span className="text-xs font-semibold bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">{emps.length}</span>
          </div>
          <div className="divide-y divide-slate-100">
            {emps.map(emp => (
              <EmpRow
                key={emp.id}
                emp={emp}
                slot={punchMap.get(emp.id) ?? {}}
                leaveInfo={leaveMap.get(emp.id)}
                status={getStatus(emp)}
                isHoliday={isHoliday}
                onMarkLeave={() => onMarkLeave(emp)}
                onCompOff={() => onCompOff(emp)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function EmpRow({
  emp, slot, leaveInfo, status, isHoliday, onMarkLeave, onCompOff,
}: {
  emp: Employee;
  slot: any;
  leaveInfo: { leaveTypeId: string; leaveTypeName: string } | undefined;
  status: DayStatus;
  isHoliday: boolean;
  onMarkLeave: () => void;
  onCompOff: () => void;
}) {
  const inTime  = slot.approvedIn  ? fmtTime(slot.approvedIn.timestampServer)  : null;
  const outTime = slot.approvedOut ? fmtTime(slot.approvedOut.timestampServer) : null;
  const pendIn  = slot.pendingIn   ? fmtTime(slot.pendingIn.timestampServer)   : null;
  const pendOut = slot.pendingOut  ? fmtTime(slot.pendingOut.timestampServer)  : null;

  let pVariant: 'green' | 'green-outline' | 'amber' | 'ghost' = 'ghost';
  let pContent = '—';
  if (status === 'P')                      { pVariant = 'green';        pContent = `${inTime} - ${outTime ?? 'NA'}`; }
  else if (status === 'HD' && inTime)      { pVariant = 'green-outline'; pContent = `${inTime} - NA`; }
  else if (status === 'PEND' && pendIn)    { pVariant = 'amber';         pContent = `${pendIn} - ${pendOut ?? 'NA'}`; }

  // Leave / Holiday / Weekly Off last box
  const leaveTypeName = leaveInfo?.leaveTypeName ?? 'Leave';
  const leaveCode = leaveInfo
    ? leaveTypeName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 3)
    : 'L';
  let lastCode = leaveCode; let lastContent = leaveTypeName; let lastVariant: 'amber' | 'violet' | 'slate' | 'ghost' = 'ghost';
  if (status === 'L') { lastVariant = 'amber'; }
  if (status === 'H') { lastVariant = 'violet'; lastCode = 'H'; lastContent = 'Holiday'; }
  if (status === 'W') { lastVariant = 'slate';  lastCode = 'W'; lastContent = `${DAY_NAMES[emp.weeklyOff]} Off`; }

  // Can mark leave: only on Absent days (not holiday/weekly-off)
  const canMarkLeave = status === 'A';
  // Can credit Comp Off: employee worked on a holiday or their weekly off
  const canCreditCompOff = (status === 'P' || status === 'HD') && (isHoliday || false);
  // Also if today is the employee's weekly off and they punched in
  const isEmpWeeklyOff = status === 'W';
  const workedOnWeeklyOff = isEmpWeeklyOff && (slot.approvedIn || slot.pendingIn);

  return (
    <div className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/70 transition-colors">
      <Link href={`/employees/${emp.id}/attendance`} className="flex items-center gap-5 flex-1 min-w-0">
        <div className="flex items-center gap-3 w-44 shrink-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0"
            style={{ background: avatarBg(emp.name) }}>
            {emp.name[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900 truncate">{emp.name}</div>
            <div className="text-xs text-slate-400 truncate">{emp.defaultSite?.name ?? emp.phone}</div>
          </div>
        </div>
        <div className="flex-1 grid grid-cols-3 gap-2">
          <SBox code="P"  content={pContent}    variant={pVariant} />
          <SBox code="HD" content="Half Day"    variant={status === 'HD' ? 'teal'  : 'ghost'} />
          <SBox code="A"  content="Absent"      variant={status === 'A'  ? 'red'   : 'ghost'} />
          <SBox code="F"  content="Fine"        variant="ghost" />
          <SBox code="OT" content="Overtime"    variant="ghost" />
          <SBox code={lastCode} content={lastContent} variant={lastVariant} />
        </div>
      </Link>

      {/* Action buttons — don't navigate */}
      <div className="flex items-center gap-1.5 shrink-0">
        {canMarkLeave && (
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); onMarkLeave(); }}
            title="Mark as Leave"
            className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-100 transition-colors whitespace-nowrap">
            <Plus size={11} />Leave
          </button>
        )}
        {(canCreditCompOff || workedOnWeeklyOff) && (
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); onCompOff(); }}
            title="Credit Comp Off"
            className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-100 transition-colors whitespace-nowrap">
            <Plus size={11} />Comp
          </button>
        )}
      </div>
    </div>
  );
}
