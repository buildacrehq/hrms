'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { Check, X, CheckCheck, Clock, MapPin, Camera, RefreshCw } from 'lucide-react';

type Punch = {
  id: string;
  type: 'IN' | 'OUT';
  timestampServer: string;
  timestampDevice: string;
  approvalStatus: string;
  accuracy: number | null;
  address: string;
  photoKey: string | null;
  employee: { name: string; phone: string };
  site: { name: string } | null;
};

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    APPROVED: 'bg-green-50 text-green-700 border-green-200',
    REJECTED: 'bg-red-50 text-red-700 border-red-200',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${styles[status] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
      {status}
    </span>
  );
}

export default function PunchesPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'pending' | 'all'>('pending');
  const [cursor, setCursor] = useState<string | undefined>();

  const pendingQ = useQuery({
    queryKey: ['punches', 'pending'],
    queryFn: () => api.get('/admin/punches/pending').then(r => r.data.data),
    enabled: tab === 'pending',
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });

  const allQ = useQuery({
    queryKey: ['punches', 'all', cursor],
    queryFn: () => api.get('/admin/punches', { params: { cursor } }).then(r => r.data.data),
    enabled: tab === 'all',
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });

  const approve = useMutation({
    mutationFn: (id: string) => api.post(`/admin/punches/${id}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['punches'] }),
  });

  const reject = useMutation({
    mutationFn: (id: string) => api.post(`/admin/punches/${id}/reject`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['punches'] }),
  });

  const approveAll = useMutation({
    mutationFn: () => api.post('/admin/punches/approve-all-normal'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['punches'] }),
  });

  const viewPhoto = async (id: string) => {
    const res = await api.get(`/admin/punches/${id}/photo-url`);
    window.open(res.data.data.signedUrl, '_blank');
  };

  const punches: Punch[] = tab === 'pending'
    ? (pendingQ.data?.punches ?? [])
    : (allQ.data?.punches ?? []);

  const loading = tab === 'pending' ? pendingQ.isLoading : allQ.isLoading;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Punch Approvals</h1>
          <p className="text-sm text-gray-500 mt-0.5">Review and approve employee attendance punches</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Live
          </span>
          <button
            onClick={() => tab === 'pending' ? pendingQ.refetch() : allQ.refetch()}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors"
            title="Refresh now"
          >
            <RefreshCw size={14} className={pendingQ.isFetching || allQ.isFetching ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => approveAll.mutate()}
            disabled={approveAll.isPending}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <CheckCheck size={15} />
            Approve All Normal
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 rounded-lg p-1 w-fit">
        {(['pending', 'all'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${tab === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t === 'pending' ? `Pending${pendingQ.data ? ` (${pendingQ.data.punches?.length ?? 0})` : ''}` : 'All'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-400">Loading…</div>
        ) : punches.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <Clock size={32} className="mb-2 opacity-40" />
            <p>No punches found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Employee', 'Type', 'Time', 'Location', 'GPS Accuracy', 'Photo', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {punches.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{p.employee.name}</div>
                    <div className="text-gray-400 text-xs">{p.employee.phone}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-semibold ${p.type === 'IN' ? 'text-green-600' : 'text-orange-500'}`}>{p.type}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{formatDateTime(p.timestampServer)}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-[200px]">
                    {p.address ? (
                      <span className="flex items-start gap-1">
                        <MapPin size={12} className="mt-0.5 shrink-0" />
                        <span className="text-xs leading-tight">{p.address}</span>
                      </span>
                    ) : p.site ? (
                      <span className="flex items-center gap-1 text-gray-400 text-xs italic">
                        <MapPin size={12} />{p.site.name}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {p.accuracy != null ? `±${Math.round(p.accuracy)}m` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {p.photoKey ? (
                      <button onClick={() => viewPhoto(p.id)} className="flex items-center gap-1 text-blue-600 hover:underline text-xs">
                        <Camera size={12} />View
                      </button>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={p.approvalStatus} /></td>
                  <td className="px-4 py-3">
                    {p.approvalStatus === 'PENDING' && (
                      <div className="flex gap-2">
                        <button onClick={() => approve.mutate(p.id)}
                          className="p-1.5 rounded-lg bg-green-50 hover:bg-green-100 text-green-600 transition-colors"
                          title="Approve">
                          <Check size={14} />
                        </button>
                        <button onClick={() => reject.mutate(p.id)}
                          className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
                          title="Reject">
                          <X size={14} />
                        </button>
                      </div>
                    )}
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
