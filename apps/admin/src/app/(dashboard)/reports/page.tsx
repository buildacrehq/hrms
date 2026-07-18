'use client';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatDate, formatTime } from '@/lib/utils';
import { Download, FileSpreadsheet, ChevronLeft, ChevronRight, CalendarDays, BarChart2, UserX, Phone, Clock } from 'lucide-react';

/* ─────────────────────────────────────────────
   DAILY REPORT
───────────────────────────────────────────── */
function DailyReport() {
  const today = new Date();
  const [date, setDate] = useState(today.toISOString().slice(0, 10));

  const punchQ = useQuery({
    queryKey: ['report-daily', date],
    queryFn: () => api.get('/admin/punches', { params: { date } }).then(r => r.data.data),
  });

  const punches  = punchQ.data?.punches ?? [];
  const approved = punches.filter((p: any) => p.approvalStatus === 'APPROVED').length;
  const pending  = punches.filter((p: any) => p.approvalStatus === 'PENDING').length;
  const inCount  = punches.filter((p: any) => p.type === 'IN').length;
  const outCount = punches.filter((p: any) => p.type === 'OUT').length;

  function shiftDate(days: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().slice(0, 10));
  }

  async function exportExcel() {
    const { utils, writeFile } = await import('xlsx');
    const rows = punches.map((p: any) => ({
      Employee: p.employee.name, Phone: p.employee.phone,
      Type: p.type,
      Time: formatDate(p.timestampServer) + ' ' + formatTime(p.timestampServer),
      Site: p.site?.name ?? '', GPS_Accuracy: p.accuracy ?? '', Status: p.approvalStatus,
    }));
    const ws = utils.json_to_sheet(rows);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'Punches');
    writeFile(wb, `attendance-${date}.xlsx`);
  }

  const displayDate = new Date(date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const isToday     = date === today.toISOString().slice(0, 10);

  return (
    <div className="space-y-5">
      {/* Date nav */}
      <div className="bg-white rounded-2xl border border-slate-200 px-5 py-4 flex items-center gap-4 shadow-sm">
        <button onClick={() => shiftDate(-1)} className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors">
          <ChevronLeft size={16} />
        </button>
        <div className="flex-1 text-center">
          <p className="font-semibold text-slate-900">{displayDate}</p>
          {isToday && <span className="text-xs text-blue-600 font-medium">Today</span>}
        </div>
        <button onClick={() => shiftDate(1)} disabled={isToday}
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors disabled:opacity-30">
          <ChevronRight size={16} />
        </button>
        <div className="w-px h-6 bg-slate-200" />
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          max={today.toISOString().slice(0, 10)}
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button onClick={exportExcel} disabled={punches.length === 0}
          className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl disabled:opacity-40 transition-colors"
          style={{ background: '#16a34a', color: '#fff' }}>
          <Download size={14} />Export
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Punches', count: punches.length, bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
          { label: 'IN',            count: inCount,        bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
          { label: 'OUT',           count: outCount,       bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
          { label: 'Pending',       count: pending,        bg: '#fefce8', text: '#a16207', border: '#fde68a' },
        ].map(({ label, count, bg, text, border }) => (
          <div key={label} className="rounded-2xl p-4 text-center" style={{ background: bg, border: `1px solid ${border}` }}>
            <div className="text-3xl font-bold" style={{ color: text }}>{count}</div>
            <div className="text-xs font-semibold mt-1" style={{ color: text, opacity: 0.75 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        {punchQ.isLoading ? (
          <div className="flex items-center justify-center h-48 text-slate-400 text-sm">Loading…</div>
        ) : punches.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            <FileSpreadsheet size={32} className="opacity-25 mb-2" />
            <p className="font-medium text-sm">No punches on this date</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Employee', 'Type', 'Time', 'Site', 'GPS', 'Status'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {punches.map((p: any) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                          {p.employee.name[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 text-sm">{p.employee.name}</div>
                          <div className="text-xs text-slate-400">{p.employee.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${p.type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{p.type}</span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-700 text-xs font-medium whitespace-nowrap">{formatTime(p.timestampServer)}</td>
                    <td className="px-5 py-3.5 text-slate-500 text-sm">{p.site?.name ?? '—'}</td>
                    <td className="px-5 py-3.5 text-slate-500 text-xs">{p.accuracy != null ? `±${Math.round(p.accuracy)}m` : '—'}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        p.approvalStatus === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                        p.approvalStatus === 'REJECTED' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-700'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          p.approvalStatus === 'APPROVED' ? 'bg-emerald-500' :
                          p.approvalStatus === 'REJECTED' ? 'bg-red-400' : 'bg-yellow-400'}`} />
                        {p.approvalStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MONTHLY REPORT — Attendance Matrix
───────────────────────────────────────────── */
const WEEK_DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

type CellState = 'P' | 'A' | 'W' | 'U' | 'H' | 'L' | '-';

interface CellCfg { label: string; bg: string; text: string; title: string }
const CELL: Record<CellState, CellCfg> = {
  P: { label: 'P', bg: '#dcfce7', text: '#15803d', title: 'Present'      },
  U: { label: 'U', bg: '#fef9c3', text: '#92400e', title: 'Unverified'   },
  A: { label: 'A', bg: '#fee2e2', text: '#b91c1c', title: 'Absent'       },
  L: { label: 'L', bg: '#e0f2fe', text: '#0369a1', title: 'On Leave'     },
  W: { label: 'W', bg: '#f1f5f9', text: '#94a3b8', title: 'Weekly Off'   },
  H: { label: 'H', bg: '#ede9fe', text: '#6d28d9', title: 'Holiday'      },
  '-': { label: '–', bg: '#f8fafc', text: '#cbd5e1', title: 'Future/NA'  },
};

function MonthlyReport() {
  const now   = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed

  const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay   = new Date(year, month + 1, 0).getDate();
  const endDate   = `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`;

  const empQ = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.get('/admin/employees').then(r => r.data.data),
  });
  const punchQ = useQuery({
    queryKey: ['report-monthly', startDate],
    queryFn: () => api.get('/admin/punches', { params: { startDate, endDate, punchType: 'IN' } }).then(r => r.data.data),
  });
  const settingsQ = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get('/admin/settings').then(r => r.data.data as Record<string, string>),
  });
  const holidayQ = useQuery({
    queryKey: ['holidays', year],
    queryFn: () => api.get('/admin/holidays', { params: { year } }).then(r => r.data.data),
  });
  const leaveQ = useQuery({
    queryKey: ['report-leaves', year, month],
    queryFn: () => api.get('/admin/leaves/requests', { params: { status: 'APPROVED', year: String(year), month: String(month + 1) } }).then(r => r.data.data ?? r.data),
  });

  const employees  = empQ.data?.employees?.filter((e: any) => e.status === 'ACTIVE') ?? [];
  const punches    = punchQ.data?.punches ?? [];
  const weeklyOff  = settingsQ.data?.default_weekly_off ?? 'SUNDAY';
  const holidays: Set<string> = useMemo(() => {
    const s = new Set<string>();
    (holidayQ.data ?? []).forEach((h: any) => s.add(h.date.slice(0, 10)));
    return s;
  }, [holidayQ.data]);

  // Build per-employee set of approved leave dates
  const leaveMap: Map<string, Set<string>> = useMemo(() => {
    const m = new Map<string, Set<string>>();
    (leaveQ.data ?? []).forEach((lr: any) => {
      const from = new Date(lr.fromDate);
      const to   = new Date(lr.toDate);
      const cur  = new Date(from);
      while (cur <= to) {
        const d = cur.toISOString().slice(0, 10);
        if (!m.has(lr.employee.id)) m.set(lr.employee.id, new Set());
        m.get(lr.employee.id)!.add(d);
        cur.setDate(cur.getDate() + 1);
      }
    });
    return m;
  }, [leaveQ.data]);

  const days = useMemo(() => Array.from({ length: lastDay }, (_, i) => i + 1), [lastDay]);
  const today = now.toISOString().slice(0, 10);

  const punchMap: Record<string, Record<string, 'P' | 'U'>> = useMemo(() => {
    const m: Record<string, Record<string, 'P' | 'U'>> = {};
    punches.forEach((p: any) => {
      const day   = new Date(p.timestampServer).toISOString().slice(0, 10);
      const empId = p.employee.id;
      if (!m[empId]) m[empId] = {};
      if (!m[empId][day] || p.approvalStatus === 'APPROVED') {
        m[empId][day] = p.approvalStatus === 'APPROVED' ? 'P' : 'U';
      }
    });
    return m;
  }, [punches]);

  function getCell(empId: string, day: number): CellState {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (dateStr > today) return '-';
    const dow = new Date(dateStr).getDay();
    const weekDayName = WEEK_DAYS[dow].toUpperCase();
    if (holidays.has(dateStr)) return 'H';
    if (weekDayName === weeklyOff.toUpperCase()) return 'W';
    if (punchMap[empId]?.[dateStr]) return punchMap[empId][dateStr];
    if (leaveMap.get(empId)?.has(dateStr)) return 'L';
    return 'A';
  }

  function getDayMeta(day: number) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const d = new Date(dateStr);
    const dow = d.getDay();
    const dayName = WEEK_DAYS[dow];
    const isWeekend = dow === 0 || dow === 6;
    const isHol = holidays.has(dateStr);
    return { dayName, isWeekend, isHol };
  }

  function getEmpStats(empId: string) {
    let present = 0, absent = 0, leave = 0;
    days.forEach(d => {
      const c = getCell(empId, d);
      if (c === 'P' || c === 'U') present++;
      else if (c === 'A') absent++;
      else if (c === 'L') leave++;
    });
    return { present, absent, leave };
  }

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    const next = new Date(year, month + 1);
    if (next > now) return;
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  const canGoNext = new Date(year, month + 1) <= now;

  async function exportExcel() {
    const { utils, writeFile } = await import('xlsx');
    const header = ['Employee', ...days.map(d => String(d)), 'Present', 'Absent', 'Leave', '%'];
    const rows = employees.map((e: any) => {
      const stats = getEmpStats(e.id);
      const total = stats.present + stats.absent;
      return [
        e.name,
        ...days.map(d => {
          const c = getCell(e.id, d);
          return c === '-' ? '' : c;
        }),
        stats.present,
        stats.absent,
        stats.leave,
        total > 0 ? `${Math.round((stats.present / total) * 100)}%` : '—',
      ];
    });
    const ws = utils.aoa_to_sheet([header, ...rows]);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'Attendance');
    writeFile(wb, `attendance-${year}-${String(month + 1).padStart(2, '0')}.xlsx`);
  }

  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const isLoading = empQ.isLoading || punchQ.isLoading || leaveQ.isLoading;

  return (
    <div className="space-y-5">
      {/* Month nav */}
      <div className="bg-white rounded-2xl border border-slate-200 px-5 py-4 flex items-center gap-4 shadow-sm">
        <button onClick={prevMonth} className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors">
          <ChevronLeft size={16} />
        </button>
        <div className="flex-1 text-center">
          <p className="font-bold text-slate-900 text-base">{MONTH_NAMES[month]} {year}</p>
          <p className="text-xs text-slate-400">{employees.length} active employees · {lastDay} days</p>
        </div>
        <button onClick={nextMonth} disabled={!canGoNext}
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors disabled:opacity-30">
          <ChevronRight size={16} />
        </button>
        <div className="w-px h-6 bg-slate-200" />
        <button onClick={exportExcel} disabled={employees.length === 0}
          className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl disabled:opacity-40 transition-colors"
          style={{ background: '#16a34a', color: '#fff' }}>
          <Download size={14} />Export Excel
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap">
        {Object.entries(CELL).filter(([k]) => k !== '-').map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5">
            <span className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold" style={{ background: v.bg, color: v.text }}>{v.label}</span>
            <span className="text-xs text-slate-500">{v.title}</span>
          </div>
        ))}
      </div>

      {/* Matrix */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 flex items-center justify-center h-56 text-slate-400 text-sm">Loading attendance data…</div>
      ) : employees.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 flex flex-col items-center justify-center h-56 text-slate-400">
          <p className="font-medium text-sm">No active employees</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="text-xs border-collapse" style={{ minWidth: days.length * 36 + 280 }}>
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="sticky left-0 z-10 bg-slate-900 px-4 py-3 text-left font-semibold text-sm min-w-44 whitespace-nowrap">Employee</th>
                  {days.map(d => {
                    const { dayName, isWeekend, isHol } = getDayMeta(d);
                    return (
                      <th key={d} className="w-9 py-2 text-center font-medium" style={{ color: isWeekend || isHol ? '#94a3b8' : '#cbd5e1' }}>
                        <div>{d}</div>
                        <div className="text-slate-500 font-normal" style={{ fontSize: 9 }}>{dayName}</div>
                      </th>
                    );
                  })}
                  <th className="px-3 py-3 text-center font-semibold text-slate-300 whitespace-nowrap">Present</th>
                  <th className="px-3 py-3 text-center font-semibold text-slate-300 whitespace-nowrap">Absent</th>
                  <th className="px-3 py-3 text-center font-semibold text-slate-300 whitespace-nowrap">Leave</th>
                  <th className="px-3 py-3 text-center font-semibold text-slate-300 whitespace-nowrap">%</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e: any, ri: number) => {
                  const stats = getEmpStats(e.id);
                  const total = stats.present + stats.absent;
                  const pct   = total > 0 ? Math.round((stats.present / total) * 100) : null;
                  return (
                    <tr key={e.id} className={ri % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="sticky left-0 z-10 px-4 py-2.5 font-semibold text-slate-800 text-sm whitespace-nowrap border-r border-slate-100"
                        style={{ background: ri % 2 === 0 ? '#fff' : '#f8fafc' }}>
                        <div>{e.name}</div>
                        <div className="text-xs font-normal text-slate-400">{e.defaultSite?.name ?? ''}</div>
                      </td>
                      {days.map(d => {
                        const cell = getCell(e.id, d);
                        const cfg  = CELL[cell];
                        return (
                          <td key={d} className="text-center p-0.5">
                            <div className="w-8 h-7 rounded flex items-center justify-center mx-auto font-bold text-xs"
                              style={{ background: cfg.bg, color: cfg.text }}
                              title={cfg.title}>
                              {cfg.label}
                            </div>
                          </td>
                        );
                      })}
                      <td className="px-3 py-2.5 text-center font-bold text-emerald-700">{stats.present}</td>
                      <td className="px-3 py-2.5 text-center font-bold text-red-500">{stats.absent}</td>
                      <td className="px-3 py-2.5 text-center font-bold text-sky-600">{stats.leave || '—'}</td>
                      <td className="px-3 py-2.5 text-center font-bold" style={{ color: pct !== null ? (pct >= 90 ? '#15803d' : pct >= 75 ? '#a16207' : '#b91c1c') : '#94a3b8' }}>
                        {pct !== null ? `${pct}%` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   ABSENT REPORT
───────────────────────────────────────────── */
const AVATAR_COLORS = ['#2563eb','#7c3aed','#059669','#d97706','#dc2626','#0891b2','#be185d','#4338ca'];

function AbsentTable({ employees, dimmed = false }: { employees: any[]; dimmed?: boolean }) {
  return (
    <table className={`w-full text-sm ${dimmed ? 'opacity-70' : ''}`}>
      <thead>
        <tr className="bg-slate-50 border-b border-slate-200">
          {['#', 'Employee', 'Phone', 'Site', 'Contact'].map(h => (
            <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {employees.map((e, i) => {
          const bg = AVATAR_COLORS[e.name.charCodeAt(0) % AVATAR_COLORS.length];
          return (
            <tr key={e.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
              <td className="px-5 py-4 text-slate-400 font-medium text-xs">{i + 1}</td>
              <td className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ background: bg }}>
                    {e.name[0]?.toUpperCase()}
                  </div>
                  <span className="font-semibold text-slate-900">{e.name}</span>
                </div>
              </td>
              <td className="px-5 py-4 text-slate-600">{e.phone}</td>
              <td className="px-5 py-4 text-slate-500">{e.defaultSite?.name ?? <span className="text-slate-300 italic text-xs">No site</span>}</td>
              <td className="px-5 py-4">
                <a href={`tel:${e.phone}`}
                  className="flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors w-fit">
                  <Phone size={11} />Call
                </a>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function AbsentReport() {
  const today = new Date();
  const [date, setDate] = useState(today.toISOString().slice(0, 10));

  function shiftDate(days: number) {
    const d = new Date(date); d.setDate(d.getDate() + days); setDate(d.toISOString().slice(0, 10));
  }

  const empQ = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.get('/admin/employees').then(r => r.data.data),
  });
  const punchQ = useQuery({
    queryKey: ['report-absent-punches', date],
    queryFn: () => api.get('/admin/punches', { params: { date, punchType: 'IN' } }).then(r => r.data.data),
  });
  const leaveQ = useQuery({
    queryKey: ['report-absent-leaves', date.slice(0, 7)],
    queryFn: () => api.get('/admin/leaves/requests', {
      params: { status: 'APPROVED', year: date.slice(0, 4), month: String(parseInt(date.slice(5, 7), 10)) }
    }).then(r => r.data.data ?? r.data),
  });

  const activeEmployees: any[] = empQ.data?.employees?.filter((e: any) => e.status === 'ACTIVE') ?? [];
  const punchedInIds = useMemo(() =>
    new Set((punchQ.data?.punches ?? []).map((p: any) => p.employee.id)),
    [punchQ.data]
  );

  // Build set of employee IDs on approved leave for the selected date
  const onLeaveIds: Set<string> = useMemo(() => {
    const s = new Set<string>();
    (leaveQ.data ?? []).forEach((lr: any) => {
      const from = lr.fromDate.slice(0, 10);
      const to   = lr.toDate.slice(0, 10);
      if (date >= from && date <= to) s.add(lr.employee.id);
    });
    return s;
  }, [leaveQ.data, date]);

  const absent     = useMemo(() => activeEmployees.filter(e => !punchedInIds.has(e.id)), [activeEmployees, punchedInIds]);
  const onLeave    = useMemo(() => absent.filter(e => onLeaveIds.has(e.id)),  [absent, onLeaveIds]);
  const trulyAbsent = useMemo(() => absent.filter(e => !onLeaveIds.has(e.id)), [absent, onLeaveIds]);

  const isToday     = date === today.toISOString().slice(0, 10);
  const displayDate = new Date(date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  async function exportExcel() {
    const { utils, writeFile } = await import('xlsx');
    const rows = absent.map(e => ({
      Name: e.name, Phone: e.phone,
      Site: e.defaultSite?.name ?? '',
      Status: onLeaveIds.has(e.id) ? 'On Leave' : 'Absent',
    }));
    const ws = utils.json_to_sheet(rows);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'Absentees');
    writeFile(wb, `absent-${date}.xlsx`);
  }

  const isLoading = empQ.isLoading || punchQ.isLoading || leaveQ.isLoading;

  return (
    <div className="space-y-5">
      {/* Date nav */}
      <div className="bg-white rounded-2xl border border-slate-200 px-5 py-4 flex items-center gap-4 shadow-sm">
        <button onClick={() => shiftDate(-1)} className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors">
          <ChevronLeft size={16} />
        </button>
        <div className="flex-1 text-center">
          <p className="font-semibold text-slate-900">{displayDate}</p>
          {isToday && <span className="text-xs text-blue-600 font-medium">Today</span>}
        </div>
        <button onClick={() => shiftDate(1)} disabled={isToday}
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors disabled:opacity-30">
          <ChevronRight size={16} />
        </button>
        <div className="w-px h-6 bg-slate-200" />
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          max={today.toISOString().slice(0, 10)}
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button onClick={exportExcel} disabled={absent.length === 0}
          className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl disabled:opacity-40 transition-colors"
          style={{ background: '#16a34a', color: '#fff' }}>
          <Download size={14} />Export
        </button>
      </div>

      {/* Summary */}
      {!isLoading && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Active',    count: activeEmployees.length,                bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
            { label: 'Present',   count: activeEmployees.length - absent.length, bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
            { label: 'On Leave',  count: onLeave.length,                        bg: '#e0f2fe', text: '#0369a1', border: '#bae6fd' },
            { label: 'Absent',    count: trulyAbsent.length,                    bg: '#fee2e2', text: '#b91c1c', border: '#fecaca' },
          ].map(({ label, count, bg, text, border }) => (
            <div key={label} className="rounded-2xl p-4 text-center" style={{ background: bg, border: `1px solid ${border}` }}>
              <div className="text-3xl font-bold" style={{ color: text }}>{count}</div>
              <div className="text-xs font-semibold mt-1" style={{ color: text, opacity: 0.75 }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Absent + On Leave lists */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 flex items-center justify-center h-48 text-slate-400 text-sm">Loading…</div>
      ) : absent.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 flex flex-col items-center justify-center h-48 text-slate-400">
          <FileSpreadsheet size={32} className="opacity-25 mb-2" />
          <p className="font-medium text-sm">
            {activeEmployees.length === 0 ? 'No employees found' : '🎉 Everyone present on this day!'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Truly Absent */}
          {trulyAbsent.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="px-5 py-3 bg-red-50 border-b border-red-100 flex items-center gap-2">
                <UserX size={14} className="text-red-500" />
                <span className="text-sm font-semibold text-red-700">{trulyAbsent.length} absent</span>
                <span className="text-xs text-red-400 ml-auto">No punch &amp; no approved leave</span>
              </div>
              <AbsentTable employees={trulyAbsent} />
            </div>
          )}

          {/* On Leave */}
          {onLeave.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="px-5 py-3 bg-sky-50 border-b border-sky-100 flex items-center gap-2">
                <span className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold bg-sky-100 text-sky-700">L</span>
                <span className="text-sm font-semibold text-sky-700">{onLeave.length} on approved leave</span>
              </div>
              <AbsentTable employees={onLeave} dimmed />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   OT REPORT
───────────────────────────────────────────── */
function OTReport() {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed

  const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay   = new Date(year, month + 1, 0).getDate();
  const endDate   = `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`;

  const empQ = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.get('/admin/employees').then(r => r.data.data),
  });
  const punchQ = useQuery({
    queryKey: ['ot-punches', startDate],
    queryFn: () => api.get('/admin/punches', {
      params: { startDate, endDate, status: 'APPROVED' },
    }).then(r => r.data.data),
  });
  const settingsQ = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get('/admin/settings').then(r => r.data.data as Record<string, string>),
  });

  const employees = empQ.data?.employees?.filter((e: any) => e.status === 'ACTIVE') ?? [];
  const allPunches: any[] = punchQ.data?.punches ?? [];
  const shiftEnd = settingsQ.data?.shift_end ?? '19:00';
  const [shiftHour, shiftMin] = shiftEnd.split(':').map(Number);

  // Build per-employee per-day IN/OUT map
  const otRows = useMemo(() => {
    const rows: { emp: any; date: string; inTime: Date; outTime: Date; workedH: number; otH: number }[] = [];

    // Group approved punches by employee → date → type
    const map = new Map<string, Map<string, { IN?: Date; OUT?: Date }>>();
    allPunches.forEach((p: any) => {
      const d = new Date(p.timestampServer);
      const dateKey = d.toISOString().slice(0, 10);
      if (!map.has(p.employee.id)) map.set(p.employee.id, new Map());
      const dayMap = map.get(p.employee.id)!;
      if (!dayMap.has(dateKey)) dayMap.set(dateKey, {});
      const slot = dayMap.get(dateKey)!;
      if (p.type === 'IN' && (!slot.IN || d < slot.IN)) slot.IN = d;
      if (p.type === 'OUT' && (!slot.OUT || d > slot.OUT)) slot.OUT = d;
    });

    map.forEach((dayMap, empId) => {
      const emp = employees.find((e: any) => e.id === empId);
      if (!emp) return;
      dayMap.forEach((slot, date) => {
        if (!slot.IN || !slot.OUT) return;
        const workedH = (slot.OUT.getTime() - slot.IN.getTime()) / 3600000;
        // Calculate OT: time beyond shift end
        const shiftEndOnDay = new Date(slot.OUT);
        shiftEndOnDay.setHours(shiftHour, shiftMin, 0, 0);
        const otMs = slot.OUT.getTime() - shiftEndOnDay.getTime();
        const otH = otMs > 0 ? otMs / 3600000 : 0;
        if (otH >= 0.5) { // only count OT ≥ 30 min
          rows.push({ emp, date, inTime: slot.IN, outTime: slot.OUT, workedH, otH });
        }
      });
    });

    return rows.sort((a, b) => a.date.localeCompare(b.date) || a.emp.name.localeCompare(b.emp.name));
  }, [allPunches, employees, shiftHour, shiftMin]);

  // Per-employee OT totals
  const empTotals = useMemo(() => {
    const m = new Map<string, { emp: any; totalOT: number; days: number }>();
    otRows.forEach(r => {
      if (!m.has(r.emp.id)) m.set(r.emp.id, { emp: r.emp, totalOT: 0, days: 0 });
      const t = m.get(r.emp.id)!;
      t.totalOT += r.otH; t.days++;
    });
    return Array.from(m.values()).sort((a, b) => b.totalOT - a.totalOT);
  }, [otRows]);

  function fmtH(h: number) {
    const hrs = Math.floor(h);
    const mins = Math.round((h - hrs) * 60);
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
  }
  function fmtT(d: Date) {
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1);
  }
  function nextMonth() {
    const next = new Date(year, month + 1);
    if (next > now) return;
    if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1);
  }
  const canGoNext = new Date(year, month + 1) <= now;

  async function exportExcel() {
    const { utils, writeFile } = await import('xlsx');
    const rows = otRows.map(r => ({
      Employee: r.emp.name, Date: r.date,
      'In Time': fmtT(r.inTime), 'Out Time': fmtT(r.outTime),
      'Worked (h)': +r.workedH.toFixed(2),
      'OT (h)': +r.otH.toFixed(2),
    }));
    const ws = utils.json_to_sheet(rows);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'OT');
    writeFile(wb, `ot-${year}-${String(month + 1).padStart(2, '0')}.xlsx`);
  }

  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const totalOT = otRows.reduce((s, r) => s + r.otH, 0);
  const isLoading = empQ.isLoading || punchQ.isLoading;

  return (
    <div className="space-y-5">
      {/* Month nav */}
      <div className="bg-white rounded-2xl border border-slate-200 px-5 py-4 flex items-center gap-4 shadow-sm">
        <button onClick={prevMonth} className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors">
          <ChevronLeft size={16} />
        </button>
        <div className="flex-1 text-center">
          <p className="font-bold text-slate-900 text-base">{MONTH_NAMES[month]} {year}</p>
          <p className="text-xs text-slate-400">Shift end: {shiftEnd} · Min OT threshold: 30 min</p>
        </div>
        <button onClick={nextMonth} disabled={!canGoNext}
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors disabled:opacity-30">
          <ChevronRight size={16} />
        </button>
        <div className="w-px h-6 bg-slate-200" />
        <button onClick={exportExcel} disabled={otRows.length === 0}
          className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl disabled:opacity-40 transition-colors"
          style={{ background: '#16a34a', color: '#fff' }}>
          <Download size={14} />Export Excel
        </button>
      </div>

      {/* Summary */}
      {!isLoading && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'OT Days',       value: otRows.length,           bg: '#fef9c3', text: '#a16207', border: '#fde68a' },
            { label: 'Total OT Hours', value: fmtH(totalOT),         bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
            { label: 'Employees OT',   value: empTotals.length,      bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
          ].map(({ label, value, bg, text, border }) => (
            <div key={label} className="rounded-2xl p-4 text-center" style={{ background: bg, border: `1px solid ${border}` }}>
              <div className="text-3xl font-bold" style={{ color: text }}>{value}</div>
              <div className="text-xs font-semibold mt-1" style={{ color: text, opacity: 0.75 }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 flex items-center justify-center h-48 text-slate-400 text-sm">Loading…</div>
      ) : otRows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 flex flex-col items-center justify-center h-48 text-slate-400">
          <Clock size={32} className="opacity-25 mb-2" />
          <p className="font-medium text-sm">No overtime recorded in {MONTH_NAMES[month]} {year}</p>
          <p className="text-xs mt-1 text-slate-300">Shift end: {shiftEnd} — only approved punches counted</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Per-employee summary */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
            <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 text-sm font-semibold text-amber-800 flex items-center gap-2">
              <Clock size={14} />Employee OT Summary
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Employee', 'OT Days', 'Total OT'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {empTotals.map(({ emp, totalOT: tot, days }) => (
                  <tr key={emp.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="font-semibold text-slate-800">{emp.name}</div>
                      <div className="text-xs text-slate-400">{emp.defaultSite?.name}</div>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{days} day{days !== 1 ? 's' : ''}</td>
                    <td className="px-5 py-3 font-bold text-amber-700">{fmtH(tot)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Detailed log */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 text-sm font-semibold text-slate-600">
              Daily OT Log
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['Date', 'Employee', 'In', 'Out', 'Worked', 'OT'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {otRows.map((r, i) => (
                    <tr key={i} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs font-medium">
                        {new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{r.emp.name}</td>
                      <td className="px-4 py-3 text-emerald-700 font-medium text-xs">{fmtT(r.inTime)}</td>
                      <td className="px-4 py-3 text-amber-700 font-medium text-xs">{fmtT(r.outTime)}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{fmtH(r.workedH)}</td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg text-xs">{fmtH(r.otH)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   PAGE
───────────────────────────────────────────── */
export default function ReportsPage() {
  const [tab, setTab] = useState<'daily' | 'monthly' | 'absent' | 'ot'>('daily');

  return (
    <div className="min-h-full bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-5">
        <h1 className="text-xl font-bold text-slate-900">Reports</h1>
        <p className="text-sm text-slate-500 mt-0.5">Attendance reports and exports</p>
      </div>

      <div className="px-8 py-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-slate-100 rounded-xl p-1 w-fit">
          {([
            { id: 'daily',   label: 'Daily',    icon: CalendarDays },
            { id: 'monthly', label: 'Monthly',  icon: BarChart2 },
            { id: 'absent',  label: 'Absent',   icon: UserX },
            { id: 'ot',      label: 'Overtime', icon: Clock },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id as any)}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: tab === id ? '#fff' : 'transparent',
                color: tab === id ? '#0f172a' : '#64748b',
                boxShadow: tab === id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}>
              <Icon size={14} />{label}
            </button>
          ))}
        </div>

        {tab === 'daily'   && <DailyReport />}
        {tab === 'monthly' && <MonthlyReport />}
        {tab === 'absent'  && <AbsentReport />}
        {tab === 'ot'      && <OTReport />}
      </div>
    </div>
  );
}
