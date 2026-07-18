'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Plus, Trash2, X, CalendarDays, CalendarCheck } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export default function HolidaysPage() {
  const qc = useQueryClient();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: '', name: '' });

  const holQ = useQuery({
    queryKey: ['holidays', year],
    queryFn: () => api.get('/admin/holidays', { params: { year } }).then(r => r.data.data),
  });

  const create = useMutation({
    mutationFn: () => api.post('/admin/holidays', form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['holidays'] }); setShowForm(false); setForm({ date: '', name: '' }); },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/holidays/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['holidays'] }),
  });

  const holidays = holQ.data ?? [];

  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  function getDayOfWeek(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'short' });
  }
  function getMonth(dateStr: string) {
    return MONTH_NAMES[new Date(dateStr).getMonth()];
  }
  function getDay(dateStr: string) {
    return new Date(dateStr).getDate();
  }

  const upcoming = holidays.filter((h: any) => new Date(h.date) >= new Date());
  const past     = holidays.filter((h: any) => new Date(h.date) < new Date());

  return (
    <div className="min-h-full bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Holidays</h1>
              <p className="text-sm text-slate-500 mt-0.5">{holidays.length} holiday{holidays.length !== 1 ? 's' : ''}</p>
            </div>
            {/* Year navigation */}
            <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
              <button onClick={() => setYear(y => y - 1)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 hover:bg-white hover:shadow-sm transition-all text-sm font-bold">‹</button>
              <span className="px-3 text-sm font-bold text-slate-800 min-w-14 text-center">{year}</span>
              <button onClick={() => setYear(y => y + 1)} disabled={year >= thisYear + 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 hover:bg-white hover:shadow-sm transition-all text-sm font-bold disabled:opacity-30">›</button>
            </div>
          </div>
          <button onClick={() => { setShowForm(v => !v); setForm({ date: `${year}-01-01`, name: '' }); }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm shadow-blue-200">
            <Plus size={15} />Add Holiday
          </button>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* Form */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-slate-900">New Holiday</h3>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Date</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Holiday Name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Independence Day"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
            </div>
            {create.isError && (
              <p className="text-red-500 text-xs mt-3 bg-red-50 px-3 py-2 rounded-lg">
                {String((create.error as any)?.response?.data?.message ?? 'Error')}
              </p>
            )}
            <div className="flex gap-3 mt-5">
              <button onClick={() => create.mutate()} disabled={create.isPending || !form.date || !form.name}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors">
                {create.isPending ? 'Saving…' : 'Add Holiday'}
              </button>
              <button onClick={() => setShowForm(false)} className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2.5 rounded-xl hover:bg-slate-100 transition-colors">Cancel</button>
            </div>
          </div>
        )}

        {holQ.isLoading ? (
          <div className="flex items-center justify-center h-56 text-slate-400 text-sm">Loading…</div>
        ) : holidays.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-56 text-slate-400">
            <CalendarDays size={36} className="opacity-25 mb-3" />
            <p className="font-medium">No holidays for {year}</p>
            <p className="text-xs mt-1">Add holidays using the button above</p>
          </div>
        ) : (
          <>
            {/* Upcoming */}
            {upcoming.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Upcoming · {upcoming.length}</h2>
                <div className="space-y-2">
                  {upcoming.map((h: any) => (
                    <HolidayRow key={h.id} h={h} onDelete={() => { if (confirm(`Remove "${h.name}"?`)) remove.mutate(h.id); }} upcoming />
                  ))}
                </div>
              </section>
            )}

            {/* Past */}
            {past.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Past · {past.length}</h2>
                <div className="space-y-2 opacity-60">
                  {past.map((h: any) => (
                    <HolidayRow key={h.id} h={h} onDelete={() => { if (confirm(`Remove "${h.name}"?`)) remove.mutate(h.id); }} upcoming={false} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function HolidayRow({ h, onDelete, upcoming }: { h: any; onDelete: () => void; upcoming: boolean }) {
  const date    = new Date(h.date);
  const day     = date.getDate();
  const month   = date.toLocaleDateString('en-IN', { month: 'short' });
  const weekday = date.toLocaleDateString('en-IN', { weekday: 'short' });

  return (
    <div className="bg-white rounded-2xl border border-slate-200 px-5 py-4 flex items-center gap-5 hover:shadow-sm transition-shadow group">
      {/* Date badge */}
      <div className={`w-14 rounded-xl text-center py-2 shrink-0 ${upcoming ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
        <div className="text-xs font-medium opacity-75">{month}</div>
        <div className="text-2xl font-bold leading-tight">{day}</div>
        <div className="text-xs opacity-75">{weekday}</div>
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-slate-900">{h.name}</p>
        <p className="text-xs text-slate-400 mt-0.5">
          {h.siteId ? 'Site-specific holiday' : 'Company-wide holiday'}
          {upcoming && <span className="ml-2 text-blue-500 font-medium">Upcoming</span>}
        </p>
      </div>

      <div className="flex items-center gap-2">
        {upcoming && (
          <div className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
            <CalendarCheck size={12} />
            {getDaysUntil(h.date)}
          </div>
        )}
        <button onClick={onDelete}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function getDaysUntil(dateStr: string) {
  const diff = Math.ceil((new Date(dateStr).getTime() - new Date().setHours(0,0,0,0)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return `In ${diff} days`;
}
