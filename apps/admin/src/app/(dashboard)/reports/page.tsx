'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatDate, formatTime } from '@/lib/utils';
import { Download, FileSpreadsheet, ChevronLeft, ChevronRight } from 'lucide-react';

export default function ReportsPage() {
  const today = new Date();
  const [date, setDate] = useState(today.toISOString().slice(0, 10));

  const punchQ = useQuery({
    queryKey: ['report', date],
    queryFn: () => api.get('/admin/punches', { params: { date } }).then(r => r.data.data),
  });

  const punches  = punchQ.data?.punches ?? [];
  const approved = punches.filter((p: any) => p.approvalStatus === 'APPROVED').length;
  const pending  = punches.filter((p: any) => p.approvalStatus === 'PENDING').length;
  const rejected = punches.filter((p: any) => p.approvalStatus === 'REJECTED').length;
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
      Employee:     p.employee.name,
      Phone:        p.employee.phone,
      Type:         p.type,
      Time:         formatDate(p.timestampServer) + ' ' + formatTime(p.timestampServer),
      Site:         p.site?.name ?? '',
      GPS_Accuracy: p.accuracy ?? '',
      Status:       p.approvalStatus,
    }));
    const ws = utils.json_to_sheet(rows);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'Punches');
    writeFile(wb, `attendance-${date}.xlsx`);
  }

  const displayDate = new Date(date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const isToday     = date === today.toISOString().slice(0, 10);

  return (
    <div className="min-h-full bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Attendance Report</h1>
            <p className="text-sm text-slate-500 mt-0.5">Daily punch summary with export</p>
          </div>
          <button onClick={exportExcel} disabled={punches.length === 0}
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-40"
            style={{ background: '#16a34a', color: '#fff' }}>
            <Download size={15} />Export Excel
          </button>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* Date nav */}
        <div className="bg-white rounded-2xl border border-slate-200 px-5 py-4 flex items-center gap-4 shadow-sm">
          <button onClick={() => shiftDate(-1)}
            className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors">
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
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: 'Total',    count: punches.length, bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
            { label: 'IN',       count: inCount,        bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
            { label: 'OUT',      count: outCount,       bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
            { label: 'Approved', count: approved,       bg: '#f0fdf4', text: '#166534', border: '#86efac' },
            { label: 'Pending',  count: pending,        bg: '#fefce8', text: '#a16207', border: '#fde68a' },
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
            <div className="flex items-center justify-center h-56 text-slate-400 text-sm">Loading…</div>
          ) : punches.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-56 text-slate-400">
              <FileSpreadsheet size={36} className="opacity-25 mb-3" />
              <p className="font-medium">No punches on this date</p>
              <p className="text-xs mt-1">Try selecting a different day</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['Employee', 'Type', 'Time', 'Site', 'GPS Accuracy', 'Status'].map(h => (
                      <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {punches.map((p: any) => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                            {p.employee.name[0]?.toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">{p.employee.name}</div>
                            <div className="text-xs text-slate-400">{p.employee.phone}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${p.type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {p.type}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-700 text-xs whitespace-nowrap font-medium">{formatTime(p.timestampServer)}</td>
                      <td className="px-5 py-4 text-slate-500 text-sm">{p.site?.name ?? '—'}</td>
                      <td className="px-5 py-4 text-slate-500 text-xs">
                        {p.accuracy != null ? `±${Math.round(p.accuracy)}m` : '—'}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          p.approvalStatus === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                          p.approvalStatus === 'REJECTED' ? 'bg-red-100 text-red-600' :
                          'bg-yellow-100 text-yellow-700'}`}>
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
    </div>
  );
}
