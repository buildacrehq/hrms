'use client';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ChevronLeft, ChevronRight, Search, Users } from 'lucide-react';
import Link from 'next/link';

type Punch = {
  id: string; type: 'IN' | 'OUT'; timestampServer: string;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  employee: { id: string; name: string; phone: string };
};

type Employee = {
  id: string; name: string; phone: string;
  defaultSite: { id: string; name: string } | null;
};

const AVATAR_COLORS = ['#2563eb','#7c3aed','#059669','#d97706','#dc2626','#0891b2','#be185d','#4338ca'];
function avatarBg(name: string) {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

// Tiny status box matching the individual attendance page style
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

export default function AttendancePage() {
  const todayIso = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(todayIso);
  const [search, setSearch] = useState('');

  function shiftDate(days: number) {
    const d = new Date(date); d.setDate(d.getDate() + days);
    setDate(d.toISOString().slice(0, 10));
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

  const activeEmployees: Employee[] = empQ.data?.employees?.filter((e: any) => e.status === 'ACTIVE') ?? [];
  const punches: Punch[] = punchQ.data?.punches ?? [];

  /* ── leave set ── */
  const leaveEmpIds = useMemo(() => {
    const s = new Set<string>();
    (leaveQ.data ?? []).forEach((lr: any) => {
      if (date >= lr.fromDate.slice(0, 10) && date <= lr.toDate.slice(0, 10)) s.add(lr.employee.id);
    });
    return s;
  }, [leaveQ.data, date]);

  /* ── holiday check ── */
  const isHoliday = useMemo(() => {
    return (holidayQ.data ?? []).some((h: any) => h.date.slice(0, 10) === date);
  }, [holidayQ.data, date]);

  const isWeeklyOff = new Date(date + 'T00:00:00').getDay() === 0; // Sunday

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
  function getStatus(empId: string): DayStatus {
    if (isHoliday)                   return 'H';
    if (leaveEmpIds.has(empId))      return 'L';
    if (isWeeklyOff)                 return 'W';
    const slot = punchMap.get(empId);
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
      const s = getStatus(e.id);
      if (s === 'P')    { present++;  punchedIn++; punchedOut++; }
      if (s === 'HD')   { halfDay++;  punchedIn++; }
      if (s === 'A')    absent++;
      if (s === 'L')    onLeave++;
      if (s === 'PEND') { pending++;  punchedIn++; }
    });
    return { present, absent, halfDay, onLeave, punchedIn, punchedOut, pending };
  }, [activeEmployees, punchMap, leaveEmpIds, isHoliday, isWeeklyOff]);  // eslint-disable-line react-hooks/exhaustive-deps

  /* ── filtered list ── */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activeEmployees;
    return activeEmployees.filter(e =>
      e.name.toLowerCase().includes(q) || e.phone.includes(q)
    );
  }, [activeEmployees, search]);

  const displayDate = new Date(date + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const isLoading = empQ.isLoading || punchQ.isLoading;

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
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              max={todayIso}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button onClick={() => shiftDate(1)} disabled={isToday}
              className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors disabled:opacity-30">
              <ChevronRight size={16} />
            </button>
            {!isToday && (
              <button onClick={() => setDate(todayIso)}
                className="text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-xl transition-colors">
                Today
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="px-8 py-6 space-y-5">
        {/* ── Summary stats strip ── */}
        <div className="grid grid-cols-4 lg:grid-cols-8 gap-3">
          {[
            { label: 'Total Staff',  value: activeEmployees.length, clr: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
            { label: 'Present',      value: stats.present,          clr: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
            { label: 'Absent',       value: stats.absent,           clr: '#b91c1c', bg: '#fee2e2', border: '#fecaca' },
            { label: 'Half Day',     value: stats.halfDay,          clr: '#0f766e', bg: '#ccfbf1', border: '#99f6e4' },
            { label: 'Pending',      value: stats.pending,          clr: '#92400e', bg: '#fef9c3', border: '#fde68a' },
            { label: 'On Leave',     value: stats.onLeave,          clr: '#6d28d9', bg: '#ede9fe', border: '#ddd6fe' },
            { label: 'Punched In',   value: stats.punchedIn,        clr: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
            { label: 'Punched Out',  value: stats.punchedOut,       clr: '#c2410c', bg: '#fff7ed', border: '#fed7aa' },
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
        {(isHoliday || isWeeklyOff) && (
          <div className="bg-violet-50 border border-violet-200 rounded-2xl px-5 py-3 text-sm font-semibold text-violet-800">
            {isHoliday ? '🎉 This day is a holiday' : '📅 Sunday — weekly off'}
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
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm divide-y divide-slate-100">
            {filtered.map(emp => {
              const slot   = punchMap.get(emp.id) ?? {};
              const status = getStatus(emp.id);

              const inTime  = slot.approvedIn  ? fmtTime(slot.approvedIn.timestampServer)  : null;
              const outTime = slot.approvedOut ? fmtTime(slot.approvedOut.timestampServer) : null;
              const pendIn  = slot.pendingIn   ? fmtTime(slot.pendingIn.timestampServer)   : null;
              const pendOut = slot.pendingOut  ? fmtTime(slot.pendingOut.timestampServer)  : null;

              // P box
              let pVariant: 'green' | 'green-outline' | 'amber' | 'ghost' = 'ghost';
              let pContent = '—';
              if (status === 'P') {
                pVariant = 'green'; pContent = `${inTime} - ${outTime ?? 'NA'}`;
              } else if (status === 'HD' && inTime) {
                pVariant = 'green-outline'; pContent = `${inTime} - NA`;
              } else if (status === 'PEND' && pendIn) {
                pVariant = 'amber'; pContent = `${pendIn} - ${pendOut ?? 'NA'}`;
              }

              // Last box (L / H / W)
              let lastCode = 'L'; let lastContent = 'Leave'; let lastVariant: 'amber' | 'violet' | 'slate' | 'ghost' = 'ghost';
              if (status === 'L') { lastVariant = 'amber';  lastContent = 'Leave'; }
              if (status === 'H') { lastVariant = 'violet'; lastCode = 'H'; lastContent = 'Holiday'; }
              if (status === 'W') { lastVariant = 'slate';  lastCode = 'W'; lastContent = 'Week Off'; }

              return (
                <Link key={emp.id} href={`/employees/${emp.id}/attendance`}
                  className="flex items-center gap-5 px-5 py-4 hover:bg-slate-50/70 transition-colors">
                  {/* Avatar + name */}
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

                  {/* 2×3 status box grid */}
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    <SBox code="P"  content={pContent}    variant={pVariant} />
                    <SBox code="HD" content="Half Day"    variant={status === 'HD' ? 'teal'  : 'ghost'} />
                    <SBox code="A"  content="Absent"      variant={status === 'A'  ? 'red'   : 'ghost'} />
                    <SBox code="F"  content="Fine"        variant="ghost" />
                    <SBox code="OT" content="Overtime"    variant="ghost" />
                    <SBox code={lastCode} content={lastContent} variant={lastVariant} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
