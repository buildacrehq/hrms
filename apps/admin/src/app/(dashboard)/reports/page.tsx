'use client';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatDate, formatTime } from '@/lib/utils';
import { Download, FileSpreadsheet, ChevronLeft, ChevronRight, CalendarDays, BarChart2 } from 'lucide-react';

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

type CellState = 'P' | 'A' | 'W' | 'U' | 'H' | '-';

interface CellCfg { label: string; bg: string; text: string; title: string }
const CELL: Record<CellState, CellCfg> = {
  P: { label: 'P', bg: '#dcfce7', text: '#15803d', title: 'Present'      },
  U: { label: 'U', bg: '#fef9c3', text: '#92400e', title: 'Unverified'   },
  A: { label: 'A', bg: '#fee2e2', text: '#b91c1c', title: 'Absent'       },
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

  const employees  = empQ.data?.employees?.filter((e: any) => e.status === 'ACTIVE') ?? [];
  const punches    = punchQ.data?.punches ?? [];
  const weeklyOff  = settingsQ.data?.default_weekly_off ?? 'SUNDAY';
  const holidays: Set<string> = useMemo(() => {
    const s = new Set<string>();
    (holidayQ.data ?? []).forEach((h: any) => s.add(h.date.slice(0, 10)));
    return s;
  }, [holidayQ.data]);

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
    if (weekDayName === weeklyOff.toUpperCase() || weeklyOff.toUpperCase() === weekDayName) return 'W';
    return punchMap[empId]?.[dateStr] ?? 'A';
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
    let present = 0, absent = 0, unverified = 0;
    days.forEach(d => {
      const c = getCell(empId, d);
      if (c === 'P') present++;
      else if (c === 'A') absent++;
      else if (c === 'U') unverified++;
    });
    return { present, absent, unverified };
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
    const header = ['Employee', ...days.map(d => String(d)), 'Present', 'Absent', '%'];
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
        total > 0 ? `${Math.round((stats.present / total) * 100)}%` : '—',
      ];
    });
    const ws = utils.aoa_to_sheet([header, ...rows]);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'Attendance');
    writeFile(wb, `attendance-${year}-${String(month + 1).padStart(2, '0')}.xlsx`);
  }

  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

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
   PAGE
───────────────────────────────────────────── */
export default function ReportsPage() {
  const [tab, setTab] = useState<'daily' | 'monthly'>('daily');

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
            { id: 'daily',   label: 'Daily',   icon: CalendarDays },
            { id: 'monthly', label: 'Monthly', icon: BarChart2 },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
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
      </div>
    </div>
  );
}
