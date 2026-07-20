'use client';
import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, ChevronLeft, ChevronRight, Calendar, List,
  Clock, AlertCircle, MapPin,
  Umbrella, RefreshCw, Check, X,
} from 'lucide-react';
import { api } from '@/lib/api';

/* ── types ────────────────────────────────────────────────────── */
type Employee = {
  id: string; name: string; phone: string; gender: string;
  status: string; defaultSite: { id: string; name: string } | null;
};
type Punch = {
  id: string; type: 'IN' | 'OUT';
  timestampServer: string;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  address: string;
  site: { name: string };
};
type Holiday    = { id: string; date: string; name: string };
type LeaveReq   = {
  id: string; fromDate: string; toDate: string; status: string;
  reason: string | null;
  leaveType: { name: string };
};
type RegReq = {
  id: string; date: string; requestType: 'PUNCH_IN' | 'PUNCH_OUT' | 'BOTH';
  punchInTime: string | null; punchOutTime: string | null;
  reason: string; status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason: string | null;
};
type DayStatus  = 'P' | 'A' | 'W' | 'H' | 'L' | 'LP' | 'HD' | 'PEND' | 'FUT';
type DayData    = {
  day: number; dateStr: string; dow: number; status: DayStatus;
  punchIn: Punch | undefined; punchOut: Punch | undefined;
  pendIn:  Punch | undefined; pendOut:  Punch | undefined;
  pending: Punch[];
};

const STATUS_META: Record<DayStatus, { label: string; bg: string; text: string }> = {
  P:    { label: 'Present',   bg: '#dcfce7', text: '#15803d' },
  A:    { label: 'Absent',    bg: '#fee2e2', text: '#b91c1c' },
  W:    { label: 'Week Off',  bg: '#f1f5f9', text: '#64748b' },
  H:    { label: 'Holiday',   bg: '#ede9fe', text: '#6d28d9' },
  L:    { label: 'On Leave',  bg: '#fef3c7', text: '#92400e' },
  LP:   { label: 'Leave (P)', bg: '#fef9c3', text: '#a16207' },
  HD:   { label: 'Half Day',  bg: '#d1fae5', text: '#065f46' },
  PEND: { label: 'Pending',   bg: '#fef3c7', text: '#b45309' },
  FUT:  { label: '—',         bg: '#f8fafc', text: '#cbd5e1' },
};

const AVATAR_COLORS = ['#2563eb','#7c3aed','#059669','#d97706','#dc2626','#0891b2','#be185d','#4338ca'];
function avatarColor(name: string) {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}
function toLocalDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function isoDate(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

/* ═══════════════════════════════════════════════════════════════ */
export default function EmployeeAttendancePage() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();

  const today = useMemo(() => {
    const d = new Date();
    return isoDate(d.getFullYear(), d.getMonth(), d.getDate());
  }, []);

  const [year,  setYear]  = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [tab,   setTab]   = useState<'daily' | 'calendar' | 'leaves' | 'regs'>('daily');

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    const now = new Date();
    if (year === now.getFullYear() && month === now.getMonth()) return;
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  const monthLabel = new Date(year, month).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const startDate  = isoDate(year, month, 1);
  const lastDay    = new Date(year, month + 1, 0).getDate();
  const endDate    = isoDate(year, month, lastDay);

  /* ── queries ── */
  const empQ = useQuery<Employee>({
    queryKey: ['emp', id],
    queryFn:  () => api.get(`/admin/employees/${id}`).then(r => r.data),
  });
  const punchQ = useQuery<{ punches: Punch[] }>({
    queryKey: ['emp-att-punches', id, startDate],
    queryFn:  () => api.get('/admin/punches', { params: { employeeId: id, startDate, endDate } }).then(r => r.data.data),
  });
  const holidayQ = useQuery<Holiday[]>({
    queryKey: ['holidays', year],
    queryFn:  () => api.get('/holidays', { params: { year: String(year) } }).then(r => r.data.data ?? r.data),
  });
  const leaveQ = useQuery<LeaveReq[]>({
    queryKey: ['emp-leaves-att', id, year],
    queryFn:  () => api.get('/admin/leaves/requests', { params: { employeeId: id } })
      .then(r => r.data.data ?? r.data).catch(() => []),
    retry: false,
  });
  const regQ = useQuery<RegReq[]>({
    queryKey: ['emp-regs', id],
    queryFn:  () => api.get('/admin/regularizations', { params: { employeeId: id } })
      .then(r => r.data.data ?? r.data).catch(() => []),
    retry: false,
  });
  const qc = useQueryClient();
  const approveRegMut = useMutation({
    mutationFn: (regId: string) => api.post(`/admin/regularizations/${regId}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['emp-regs', id] }),
  });
  const rejectRegMut = useMutation({
    mutationFn: ({ regId, reason }: { regId: string; reason: string }) =>
      api.post(`/admin/regularizations/${regId}/reject`, { reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['emp-regs', id] }),
  });

  const employee = empQ.data;
  const punches  = punchQ.data?.punches ?? [];

  const holidaySet = useMemo(() => {
    const s = new Set<string>();
    (holidayQ.data ?? []).forEach(h => s.add(h.date.slice(0, 10)));
    return s;
  }, [holidayQ.data]);

  const holidayNames = useMemo(() => {
    const m: Record<string, string> = {};
    (holidayQ.data ?? []).forEach(h => { m[h.date.slice(0, 10)] = h.name; });
    return m;
  }, [holidayQ.data]);

  const { leaveDays, leavePendingDays, leaveNames } = useMemo(() => {
    const ld = new Set<string>(); const lp = new Set<string>();
    const ln: Record<string, string> = {};
    (leaveQ.data ?? []).forEach(lr => {
      const start = new Date(lr.fromDate); const end = new Date(lr.toDate);
      const cursor = new Date(start);
      while (cursor <= end) {
        const ds = toLocalDate(cursor.toISOString());
        if (lr.status === 'APPROVED') { ld.add(ds); ln[ds] = lr.leaveType.name; }
        else if (lr.status === 'PENDING') lp.add(ds);
        cursor.setDate(cursor.getDate() + 1);
      }
    });
    return { leaveDays: ld, leavePendingDays: lp, leaveNames: ln };
  }, [leaveQ.data]);

  /* ── per-day computation ── */
  const days: DayData[] = useMemo(() => {
    return Array.from({ length: lastDay }, (_, i) => {
      const day     = i + 1;
      const dateStr = isoDate(year, month, day);
      const dow     = new Date(year, month, day).getDay();

      let status: DayStatus;
      if (dateStr > today)             status = 'FUT';
      else if (holidaySet.has(dateStr)) status = 'H';
      else if (leaveDays.has(dateStr))  status = 'L';
      else if (leavePendingDays.has(dateStr)) status = 'LP';
      else if (dow === 0)              status = 'W';
      else {
        const dayPunches = punches.filter(p => toLocalDate(p.timestampServer) === dateStr);
        if (dayPunches.length === 0) {
          status = 'A';
        } else {
          const approved = dayPunches.filter(p => p.approvalStatus === 'APPROVED');
          const pending  = dayPunches.filter(p => p.approvalStatus === 'PENDING');
          if (approved.length === 0) status = pending.length > 0 ? 'PEND' : 'A';
          else {
            const hasIn  = approved.some(p => p.type === 'IN');
            const hasOut = approved.some(p => p.type === 'OUT');
            status = (hasIn && hasOut) ? 'P' : 'HD';
          }
        }
      }

      const dayPunches = punches.filter(p => toLocalDate(p.timestampServer) === dateStr);
      const approved   = dayPunches.filter(p => p.approvalStatus === 'APPROVED');
      const pending    = dayPunches.filter(p => p.approvalStatus === 'PENDING');
      return {
        day, dateStr, dow, status,
        punchIn:  approved.find(p => p.type === 'IN'),
        punchOut: approved.find(p => p.type === 'OUT'),
        pendIn:   pending.find(p => p.type === 'IN'),
        pendOut:  pending.find(p => p.type === 'OUT'),
        pending,
      };
    });
  }, [year, month, lastDay, punches, holidaySet, leaveDays, leavePendingDays, today]);

  const stats = useMemo(() => {
    let present = 0, absent = 0, weekOff = 0, holidays = 0, leaves = 0,
        punchedIn = 0, punchedOut = 0, pendingCount = 0, halfDay = 0;
    days.forEach(d => {
      if (d.status === 'FUT') return;
      if (d.status === 'P')    { present++;    punchedIn++; punchedOut++; }
      if (d.status === 'HD')   { halfDay++;    if (d.punchIn) punchedIn++; if (d.punchOut) punchedOut++; }
      if (d.status === 'A')    absent++;
      if (d.status === 'W')    weekOff++;
      if (d.status === 'H')    holidays++;
      if (d.status === 'L' || d.status === 'LP') leaves++;
      if (d.status === 'PEND') { pendingCount++; if (d.pendIn) punchedIn++; if (d.pendOut) punchedOut++; }
    });
    return { present, absent, weekOff, holidays, leaves, punchedIn, punchedOut, pendingCount, halfDay };
  }, [days]);

  const isLoading = empQ.isLoading || punchQ.isLoading;

  /* ─────────────────────────────────────────────────────────────── */
  return (
    <div className="p-6 max-w-6xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-start gap-4 mb-6 flex-wrap">
        <button onClick={() => router.back()}
          className="mt-1 w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors shrink-0">
          <ArrowLeft size={16} className="text-slate-600" />
        </button>

        <div className="flex items-center gap-3 flex-1 min-w-0">
          {employee && (
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold text-base shrink-0"
              style={{ background: avatarColor(employee.name) }}>
              {employee.name[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold text-slate-900">{employee?.name ?? '…'}</h1>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              <span className="text-sm text-slate-500">{employee?.phone}</span>
              {employee?.defaultSite && (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <MapPin size={11} />{employee.defaultSite.name}
                </span>
              )}
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                employee?.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {employee?.status === 'ACTIVE' ? 'Active' : 'Deactivated'}
              </span>
            </div>
          </div>
        </div>

        {/* Month nav */}
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={prevMonth}
            className="w-9 h-9 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 flex items-center justify-center shadow-sm">
            <ChevronLeft size={16} className="text-slate-600" />
          </button>
          <span className="text-sm font-bold text-slate-700 w-36 text-center">{monthLabel}</span>
          <button onClick={nextMonth}
            disabled={year === new Date().getFullYear() && month === new Date().getMonth()}
            className="w-9 h-9 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 flex items-center justify-center shadow-sm disabled:opacity-40">
            <ChevronRight size={16} className="text-slate-600" />
          </button>
        </div>
      </div>

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-4 md:grid-cols-8 gap-3 mb-5">
        {[
          { label: 'Present',   value: stats.present,      clr: 'text-emerald-700', bg: 'bg-emerald-50'  },
          { label: 'Absent',    value: stats.absent,       clr: 'text-red-600',     bg: 'bg-red-50'      },
          { label: 'Half Day',  value: stats.halfDay,      clr: 'text-teal-700',    bg: 'bg-teal-50'     },
          { label: 'On Leave',  value: stats.leaves,       clr: 'text-amber-700',   bg: 'bg-amber-50'    },
          { label: 'Holidays',  value: stats.holidays,     clr: 'text-violet-700',  bg: 'bg-violet-50'   },
          { label: 'Week Off',  value: stats.weekOff,      clr: 'text-slate-600',   bg: 'bg-slate-100'   },
          { label: 'Punch In',  value: stats.punchedIn,    clr: 'text-blue-700',    bg: 'bg-blue-50'     },
          { label: 'Punch Out', value: stats.punchedOut,   clr: 'text-indigo-700',  bg: 'bg-indigo-50'   },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl p-3 text-center`}>
            <div className={`text-2xl font-extrabold ${s.clr}`}>{s.value}</div>
            <div className="text-xs text-slate-500 mt-0.5 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Pending alert */}
      {stats.pendingCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 flex items-center gap-3 mb-5">
          <AlertCircle size={16} className="text-amber-600 shrink-0" />
          <span className="text-sm text-amber-800 font-medium">
            {stats.pendingCount} day{stats.pendingCount > 1 ? 's' : ''} with pending punch approvals
          </span>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 w-fit mb-5 flex-wrap">
        {([
          { key: 'daily',    icon: List,       label: 'Daily View'  },
          { key: 'calendar', icon: Calendar,   label: 'Calendar'    },
          { key: 'leaves',   icon: Umbrella,   label: 'Leaves'      },
          { key: 'regs',     icon: RefreshCw,  label: 'Corrections' },
        ] as const).map(({ key, icon: Icon, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 flex items-center justify-center h-48 text-slate-400 text-sm">Loading…</div>
      ) : tab === 'daily' ? (
        <DailyView days={days} holidayNames={holidayNames} leaveNames={leaveNames} />
      ) : tab === 'calendar' ? (
        <CalendarView days={days} year={year} month={month} holidayNames={holidayNames} leaveNames={leaveNames} />
      ) : tab === 'leaves' ? (
        <LeavesTab leaves={leaveQ.data ?? []} />
      ) : (
        <RegsTab regs={regQ.data ?? []} approveReg={approveRegMut.mutate} rejectReg={rejectRegMut.mutate} />
      )}
    </div>
  );
}

/* ── Daily View ──────────────────────────────────────────────── */
function SBox({
  code, content, variant,
}: {
  code: string;
  content: string;
  variant: 'green' | 'green-outline' | 'amber' | 'red' | 'teal' | 'violet' | 'slate' | 'ghost';
}) {
  const styles: Record<string, { bg: string; border: string; codeClr: string; contentClr: string }> = {
    'green':        { bg: '#16a34a', border: '#16a34a', codeClr: '#fff',     contentClr: '#fff'     },
    'green-outline':{ bg: '#fff',    border: '#86efac', codeClr: '#15803d',  contentClr: '#15803d'  },
    'amber':        { bg: '#fef9c3', border: '#fde68a', codeClr: '#92400e',  contentClr: '#78350f'  },
    'red':          { bg: '#fee2e2', border: '#fca5a5', codeClr: '#b91c1c',  contentClr: '#991b1b'  },
    'teal':         { bg: '#ccfbf1', border: '#5eead4', codeClr: '#0f766e',  contentClr: '#0f766e'  },
    'violet':       { bg: '#ede9fe', border: '#c4b5fd', codeClr: '#6d28d9',  contentClr: '#5b21b6'  },
    'slate':        { bg: '#f1f5f9', border: '#cbd5e1', codeClr: '#475569',  contentClr: '#64748b'  },
    'ghost':        { bg: '#f8fafc', border: '#e2e8f0', codeClr: '#94a3b8',  contentClr: '#94a3b8'  },
  };
  const s = styles[variant];
  return (
    <div className="flex items-center rounded-lg overflow-hidden text-xs font-semibold"
      style={{ border: `1.5px solid ${s.border}`, background: s.bg, minHeight: 32 }}>
      <span className="px-2 py-1.5 shrink-0" style={{ color: s.codeClr }}>{code}</span>
      <span className="w-px self-stretch" style={{ background: s.border }} />
      <span className="px-2 py-1.5 flex-1 truncate" style={{ color: s.contentClr }}>{content}</span>
    </div>
  );
}

function DailyView({
  days, holidayNames, leaveNames,
}: {
  days: DayData[];
  holidayNames: Record<string, string>;
  leaveNames: Record<string, string>;
}) {
  const DOW_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const visible   = [...days].filter(d => d.status !== 'FUT').reverse();

  if (visible.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 flex items-center justify-center h-32 text-slate-400 text-sm">
        No attendance data for this month yet
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm divide-y divide-slate-100">
      {visible.map(d => {
        const inTime  = d.punchIn  ? fmtTime(d.punchIn.timestampServer)  : null;
        const outTime = d.punchOut ? fmtTime(d.punchOut.timestampServer) : null;
        const pendInTime  = d.pendIn  ? fmtTime(d.pendIn.timestampServer)  : null;
        const pendOutTime = d.pendOut ? fmtTime(d.pendOut.timestampServer) : null;

        const hours = (d.punchIn && d.punchOut)
          ? (() => {
              const diff = (new Date(d.punchOut.timestampServer).getTime() - new Date(d.punchIn.timestampServer).getTime()) / 3_600_000;
              return diff > 0 ? `${Math.floor(diff)}h ${Math.round((diff % 1) * 60)}m` : null;
            })()
          : null;

        const displayDate = new Date(d.dateStr + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

        // P box: green if full present, green-outline if punch-in only or pending, ghost otherwise
        let pVariant: 'green' | 'green-outline' | 'amber' | 'ghost' = 'ghost';
        let pContent = '—';
        if (d.status === 'P') {
          pVariant = 'green'; pContent = `${inTime} - ${outTime ?? 'NA'}`;
        } else if (d.status === 'HD' && inTime) {
          pVariant = 'green-outline'; pContent = `${inTime} - NA`;
        } else if (d.status === 'PEND' && pendInTime) {
          pVariant = 'amber'; pContent = `${pendInTime} - ${pendOutTime ?? 'NA'}`;
        } else if (inTime) {
          pVariant = 'green-outline'; pContent = `${inTime} - NA`;
        }

        // Row 2 last box — whichever special status applies
        let lastCode = 'L'; let lastContent = 'Leave'; let lastVariant: 'amber' | 'violet' | 'slate' | 'ghost' = 'ghost';
        if (d.status === 'L')  { lastVariant = 'amber';  lastContent = leaveNames[d.dateStr] || 'Leave'; }
        if (d.status === 'LP') { lastVariant = 'amber';  lastContent = 'Leave (Pending)'; }
        if (d.status === 'H')  { lastVariant = 'violet'; lastCode = 'H'; lastContent = holidayNames[d.dateStr] || 'Holiday'; }
        if (d.status === 'W')  { lastVariant = 'slate';  lastCode = 'W'; lastContent = 'Week Off'; }

        return (
          <div key={d.dateStr} className="px-5 py-4 hover:bg-slate-50/50 transition-colors">
            <div className="flex items-start gap-5">
              {/* Date column */}
              <div className="shrink-0 w-24 pt-0.5">
                <div className="text-sm font-bold text-slate-800">{displayDate} | {DOW_SHORT[d.dow]}</div>
                <div className="text-xs text-slate-400 mt-1">{hours ? `${hours} Hrs` : '—'}</div>
              </div>

              {/* 2×3 status box grid */}
              <div className="flex-1 grid grid-cols-3 gap-2">
                {/* Row 1 */}
                <SBox code="P"  content={pContent}   variant={pVariant} />
                <SBox code="HD" content="Half Day"   variant={d.status === 'HD' ? 'teal' : 'ghost'} />
                <SBox code="A"  content="Absent"     variant={d.status === 'A'  ? 'red'  : 'ghost'} />
                {/* Row 2 */}
                <SBox code="F"  content="Fine"       variant="ghost" />
                <SBox code="OT" content="Overtime"   variant="ghost" />
                <SBox code={lastCode} content={lastContent} variant={lastVariant} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Calendar View ───────────────────────────────────────────── */
function CalendarView({
  days, year, month, holidayNames, leaveNames,
}: {
  days: DayData[];
  year: number; month: number;
  holidayNames: Record<string, string>;
  leaveNames: Record<string, string>;
}) {
  const firstDOW    = new Date(year, month, 1).getDay();
  const DOW_HEADERS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const todayStr    = new Date().toISOString().slice(0, 10);

  const cells: (DayData | null)[] = [
    ...Array<null>(firstDOW).fill(null),
    ...days,
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* DOW header row */}
      <div className="grid grid-cols-7 border-b border-slate-200">
        {DOW_HEADERS.map(d => (
          <div key={d} className={`text-center text-xs font-bold py-3 uppercase tracking-wide ${d === 'Sun' ? 'text-rose-400' : 'text-slate-500'}`}>
            {d}
          </div>
        ))}
      </div>

      {Array.from({ length: cells.length / 7 }, (_, wk) => (
        <div key={wk} className="grid grid-cols-7 border-b border-slate-100 last:border-0">
          {cells.slice(wk * 7, wk * 7 + 7).map((d, ci) => {
            if (!d) return <div key={ci} className="p-2 min-h-19 bg-slate-50/60 border-l border-slate-100 first:border-l-0" />;

            const meta    = STATUS_META[d.status];
            const note    = holidayNames[d.dateStr] || leaveNames[d.dateStr];
            const isToday = d.dateStr === todayStr;

            return (
              <div key={d.dateStr}
                className={`p-2 min-h-19 border-l border-slate-100 first:border-l-0 ${d.status === 'FUT' ? 'opacity-35' : ''}`}
                style={{ background: d.status !== 'FUT' && d.status !== 'W' ? meta.bg + '60' : undefined }}>

                <div className={`text-sm font-bold mb-1 w-7 h-7 rounded-full flex items-center justify-center
                  ${isToday ? 'bg-blue-600 text-white' : d.dow === 0 ? 'text-rose-500' : 'text-slate-700'}`}>
                  {d.day}
                </div>

                {d.status !== 'FUT' && (
                  <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold leading-tight"
                    style={{ background: meta.bg, color: meta.text }}>
                    {meta.label}
                  </span>
                )}

                {d.punchIn && (
                  <div className="text-[10px] text-emerald-700 mt-0.5 font-medium">
                    ▶ {fmtTime(d.punchIn.timestampServer)}
                  </div>
                )}
                {d.punchOut && (
                  <div className="text-[10px] text-rose-600 font-medium">
                    ■ {fmtTime(d.punchOut.timestampServer)}
                  </div>
                )}
                {note && (
                  <div className="text-[9px] text-slate-400 mt-0.5 truncate">{note}</div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ── Leaves Tab ──────────────────────────────────────────────── */
const LEAVE_STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  PENDING:  { bg: '#fef9c3', text: '#92400e' },
  APPROVED: { bg: '#dcfce7', text: '#15803d' },
  REJECTED: { bg: '#fee2e2', text: '#b91c1c' },
  CANCELLED:{ bg: '#f1f5f9', text: '#64748b' },
};

function LeavesTab({ leaves }: { leaves: LeaveReq[] }) {
  if (leaves.length === 0) return (
    <div className="bg-white rounded-2xl border border-slate-200 flex flex-col items-center justify-center h-48 text-slate-400">
      <Umbrella size={32} className="opacity-20 mb-3" />
      <p className="font-medium text-sm">No leave requests</p>
    </div>
  );

  function diffDays(a: string, b: string) {
    return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000) + 1;
  }
  function fmtD(iso: string) {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  return (
    <div className="space-y-3">
      {[...leaves].sort((a, b) => b.fromDate.localeCompare(a.fromDate)).map(lr => {
        const sc = LEAVE_STATUS_COLOR[lr.status] ?? { bg: '#f1f5f9', text: '#64748b' };
        const days = diffDays(lr.fromDate, lr.toDate);
        return (
          <div key={lr.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-900">{lr.leaveType.name}</span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-sm text-slate-600">
                  <span>{fmtD(lr.fromDate)}</span>
                  {lr.fromDate !== lr.toDate && <><span className="text-slate-300">→</span><span>{fmtD(lr.toDate)}</span></>}
                  <span className="text-slate-400">· {days} day{days !== 1 ? 's' : ''}</span>
                </div>
                {lr.reason && <p className="text-sm text-slate-500 mt-1 italic">"{lr.reason}"</p>}
              </div>
              <span className="shrink-0 text-xs font-bold px-2.5 py-1 rounded-full"
                style={{ background: sc.bg, color: sc.text }}>
                {lr.status}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Regularizations Tab ─────────────────────────────────────── */
const REG_LABEL: Record<string, string> = {
  PUNCH_IN: 'Missing Punch-In', PUNCH_OUT: 'Missing Punch-Out', BOTH: 'Missing Both',
};

function RegsTab({ regs, approveReg, rejectReg }: {
  regs: RegReq[];
  approveReg: (id: string) => void;
  rejectReg: (args: { regId: string; reason: string }) => void;
}) {
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  if (regs.length === 0) return (
    <div className="bg-white rounded-2xl border border-slate-200 flex flex-col items-center justify-center h-48 text-slate-400">
      <RefreshCw size={32} className="opacity-20 mb-3" />
      <p className="font-medium text-sm">No correction requests</p>
    </div>
  );

  const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
    PENDING:  { bg: '#fef9c3', text: '#92400e' },
    APPROVED: { bg: '#dcfce7', text: '#15803d' },
    REJECTED: { bg: '#fee2e2', text: '#b91c1c' },
  };

  return (
    <>
      <div className="space-y-3">
        {[...regs].sort((a, b) => b.date.localeCompare(a.date)).map(reg => {
          const sc = STATUS_COLOR[reg.status];
          const displayDate = new Date(reg.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
          return (
            <div key={reg.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg">{displayDate}</span>
                    <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">{REG_LABEL[reg.requestType]}</span>
                    {reg.punchInTime  && <span className="text-xs text-slate-500"><Clock size={10} className="inline mr-1" />IN {reg.punchInTime}</span>}
                    {reg.punchOutTime && <span className="text-xs text-slate-500"><Clock size={10} className="inline mr-1" />OUT {reg.punchOutTime}</span>}
                  </div>
                  <p className="text-sm text-slate-600 italic">"{reg.reason}"</p>
                  {reg.rejectionReason && <p className="text-sm text-red-500 mt-1">Rejected: {reg.rejectionReason}</p>}
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: sc.bg, color: sc.text }}>
                    {reg.status}
                  </span>
                  {reg.status === 'PENDING' && (
                    <div className="flex items-center gap-2">
                      <button onClick={() => approveReg(reg.id)}
                        className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors">
                        <Check size={11} />Approve
                      </button>
                      <button onClick={() => { setRejectTarget(reg.id); setRejectReason(''); }}
                        className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition-colors">
                        <X size={11} />Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {rejectTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-bold text-slate-900 text-lg mb-4">Reject Correction Request</h3>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              placeholder="Reason for rejection…" rows={3}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none" />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setRejectTarget(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50">Cancel</button>
              <button onClick={() => { rejectReg({ regId: rejectTarget, reason: rejectReason }); setRejectTarget(null); }}
                disabled={!rejectReason.trim()}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-50">
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
