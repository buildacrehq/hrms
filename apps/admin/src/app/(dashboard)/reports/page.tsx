'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatDate, formatTime } from '@/lib/utils';
import { Download } from 'lucide-react';

export default function ReportsPage() {
  const today = new Date();
  const [date, setDate] = useState(today.toISOString().slice(0, 10));

  const punchQ = useQuery({
    queryKey: ['report', date],
    queryFn: () => api.get('/admin/punches', { params: { date } }).then(r => r.data.data),
  });

  const punches = punchQ.data?.punches ?? [];

  async function exportExcel() {
    const { utils, writeFile } = await import('xlsx');
    const rows = punches.map((p: any) => ({
      Employee: p.employee.name,
      Phone: p.employee.phone,
      Type: p.type,
      'Server Time': formatDate(p.timestampServer) + ' ' + formatTime(p.timestampServer),
      Site: p.site?.name ?? '',
      GPS_Accuracy: p.accuracy ?? '',
      Status: p.approvalStatus,
    }));
    const ws = utils.json_to_sheet(rows);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'Punches');
    writeFile(wb, `punches-${date}.xlsx`);
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500 mt-0.5">Daily punch report</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button onClick={exportExcel} disabled={punches.length === 0}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg">
            <Download size={15} />Export Excel
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          ['Total', punches.length, 'bg-blue-50 text-blue-700'],
          ['Approved', punches.filter((p: any) => p.approvalStatus === 'APPROVED').length, 'bg-green-50 text-green-700'],
          ['Pending', punches.filter((p: any) => p.approvalStatus === 'PENDING').length, 'bg-yellow-50 text-yellow-700'],
          ['Rejected', punches.filter((p: any) => p.approvalStatus === 'REJECTED').length, 'bg-red-50 text-red-700'],
        ].map(([label, count, style]) => (
          <div key={label as string} className={`rounded-xl p-4 ${style}`}>
            <div className="text-2xl font-bold">{count as number}</div>
            <div className="text-sm font-medium mt-0.5">{label as string}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {punchQ.isLoading ? <div className="h-48 flex items-center justify-center text-gray-400">Loading…</div>
          : punches.length === 0 ? <div className="h-48 flex items-center justify-center text-gray-400">No punches on {date}</div>
          : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>{['Employee', 'Type', 'Time', 'Site', 'GPS', 'Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {punches.map((p: any) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{p.employee.name}</div>
                      <div className="text-xs text-gray-400">{p.employee.phone}</div>
                    </td>
                    <td className="px-4 py-3 font-semibold" style={{ color: p.type === 'IN' ? '#16a34a' : '#ea580c' }}>{p.type}</td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{formatTime(p.timestampServer)}</td>
                    <td className="px-4 py-3 text-gray-500">{p.site?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{p.accuracy != null ? `${Math.round(p.accuracy)}m` : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        p.approvalStatus === 'APPROVED' ? 'bg-green-50 text-green-700' :
                        p.approvalStatus === 'REJECTED' ? 'bg-red-50 text-red-700' :
                        'bg-yellow-50 text-yellow-700'}`}>{p.approvalStatus}</span>
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
