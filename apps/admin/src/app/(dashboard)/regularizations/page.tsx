'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Check, X, Clock, User } from 'lucide-react';
import { api } from '@/lib/api';

type RegType = 'PUNCH_IN' | 'PUNCH_OUT' | 'BOTH';
type Status  = 'PENDING' | 'APPROVED' | 'REJECTED';

interface Reg {
  id: string;
  date: string;
  requestType: RegType;
  punchInTime:  string | null;
  punchOutTime: string | null;
  reason: string;
  status: Status;
  rejectionReason: string | null;
  createdAt: string;
  employee: { id: string; name: string; phone: string; defaultSite: { name: string } | null };
}

const REG_LABEL: Record<RegType, string> = {
  PUNCH_IN:  'Missing Punch-In',
  PUNCH_OUT: 'Missing Punch-Out',
  BOTH:      'Missing Both',
};
const STATUS_COLOR: Record<Status, { bg: string; text: string }> = {
  PENDING:  { bg: '#fef9c3', text: '#92400e' },
  APPROVED: { bg: '#dcfce7', text: '#15803d' },
  REJECTED: { bg: '#fee2e2', text: '#b91c1c' },
};

export default function RegularizationsPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<'ALL' | Status>('PENDING');
  const [rejectTarget, setRejectTarget] = useState<Reg | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const regQ = useQuery<Reg[]>({
    queryKey: ['regularizations', statusFilter],
    queryFn: () => api.get('/admin/regularizations', {
      params: statusFilter !== 'ALL' ? { status: statusFilter } : {},
    }).then(r => r.data.data ?? r.data),
    refetchInterval: 30000,
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => api.post(`/admin/regularizations/${id}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['regularizations'] }),
  });
  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/admin/regularizations/${id}/reject`, { reason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['regularizations'] }); setRejectTarget(null); setRejectReason(''); },
  });

  const regs    = regQ.data ?? [];
  const pending = regs.filter(r => r.status === 'PENDING').length;

  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-900/20">
              <RefreshCw size={16} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Regularizations</h1>
            {pending > 0 && (
              <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">{pending}</span>
            )}
          </div>
          <p className="text-slate-500 text-sm ml-12">Employee punch correction requests</p>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 w-fit mb-6">
        {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${
              statusFilter === s ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            {s === 'PENDING'  && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
            {s === 'APPROVED' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
            {s === 'REJECTED' && <span className="w-1.5 h-1.5 rounded-full bg-red-400" />}
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* List */}
      {regQ.isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 flex items-center justify-center h-48 text-slate-400 text-sm">Loading…</div>
      ) : regs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 flex flex-col items-center justify-center h-48 text-slate-400">
          <RefreshCw size={32} className="opacity-20 mb-3" />
          <p className="font-medium">No {statusFilter !== 'ALL' ? statusFilter.toLowerCase() : ''} requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {regs.map(reg => {
            const sc = STATUS_COLOR[reg.status];
            return (
              <div key={reg.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  {/* Left: employee + details */}
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold shrink-0">
                      {reg.employee.name[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900">{reg.employee.name}</span>
                        <span className="text-xs text-slate-400">{reg.employee.phone}</span>
                        {reg.employee.defaultSite && (
                          <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{reg.employee.defaultSite.name}</span>
                        )}
                      </div>

                      {/* Date + type */}
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        <span className="text-sm font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg">
                          {fmtDate(reg.date)}
                        </span>
                        <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                          {REG_LABEL[reg.requestType]}
                        </span>
                        {reg.punchInTime && (
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Clock size={11} />IN {reg.punchInTime}
                          </span>
                        )}
                        {reg.punchOutTime && (
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Clock size={11} />OUT {reg.punchOutTime}
                          </span>
                        )}
                      </div>

                      {/* Reason */}
                      <p className="text-sm text-slate-600 mt-1.5 italic">"{reg.reason}"</p>
                      {reg.rejectionReason && (
                        <p className="text-sm text-red-500 mt-1">Rejected: {reg.rejectionReason}</p>
                      )}
                    </div>
                  </div>

                  {/* Right: status + actions */}
                  <div className="flex flex-col items-end gap-3 shrink-0">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: sc.bg, color: sc.text }}>
                      {reg.status}
                    </span>
                    {reg.status === 'PENDING' && (
                      <div className="flex items-center gap-2">
                        <button onClick={() => approveMut.mutate(reg.id)} disabled={approveMut.isPending}
                          className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50">
                          <Check size={12} />Approve
                        </button>
                        <button onClick={() => { setRejectTarget(reg); setRejectReason(''); }}
                          className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition-colors">
                          <X size={12} />Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reject modal */}
      {rejectTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-bold text-slate-900 text-lg mb-1">Reject Request</h3>
            <p className="text-sm text-slate-500 mb-4">{rejectTarget.employee.name} · {fmtDate(rejectTarget.date)}</p>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              placeholder="Reason for rejection…" rows={3}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none" />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setRejectTarget(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50">Cancel</button>
              <button onClick={() => rejectMut.mutate({ id: rejectTarget.id, reason: rejectReason })}
                disabled={rejectMut.isPending || !rejectReason.trim()}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-50">
                {rejectMut.isPending ? 'Rejecting…' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
