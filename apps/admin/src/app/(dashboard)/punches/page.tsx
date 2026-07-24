'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatDateTime, localDateStr } from '@/lib/utils';
import { Check, X, CheckCheck, Clock, MapPin, Camera, RefreshCw, Download, ZoomIn } from 'lucide-react';

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
  const cfg: Record<string, { bg: string; text: string; dot: string }> = {
    PENDING:  { bg: '#fef9c3', text: '#a16207', dot: '#eab308' },
    APPROVED: { bg: '#dcfce7', text: '#15803d', dot: '#22c55e' },
    REJECTED: { bg: '#fee2e2', text: '#b91c1c', dot: '#ef4444' },
  };
  const c = cfg[status] ?? { bg: '#f1f5f9', text: '#475569', dot: '#94a3b8' };
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: c.bg, color: c.text }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
      {status}
    </span>
  );
}

type PhotoModal = { punchId: string; employee: string; time: string; type: 'IN' | 'OUT'; status: string };

function PhotoViewer({ modal, onClose, onApprove, onReject }: {
  modal: PhotoModal;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const urlQ = useQuery({
    queryKey: ['photo-url', modal.punchId],
    queryFn: () => api.get(`/admin/punches/${modal.punchId}/photo-url`).then(r => r.data.data.signedUrl as string),
    staleTime: 50_000,
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxWidth: 480, width: '100%', maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-600">
              {modal.employee[0]?.toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-slate-900 text-sm">{modal.employee}</p>
              <p className="text-xs text-slate-400">{modal.time}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${modal.type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{modal.type}</span>
            <button onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Photo */}
        <div className="flex-1 flex items-center justify-center bg-slate-950 overflow-hidden" style={{ minHeight: 260 }}>
          {urlQ.isLoading ? (
            <div className="flex flex-col items-center gap-3 text-slate-400">
              <div className="w-8 h-8 border-2 border-slate-600 border-t-blue-400 rounded-full animate-spin" />
              <p className="text-xs">Loading photo…</p>
            </div>
          ) : urlQ.isError ? (
            <div className="text-slate-400 text-sm text-center px-6">
              <Camera size={32} className="opacity-30 mx-auto mb-2" />
              <p>Could not load photo</p>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={urlQ.data}
              alt="Punch photo"
              className="w-full h-full object-contain"
              style={{ maxHeight: 400 }}
            />
          )}
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-slate-100 flex items-center gap-3">
          {modal.status === 'PENDING' && (
            <>
              <button onClick={() => { onApprove(modal.punchId); onClose(); }}
                className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors">
                <Check size={15} />Approve
              </button>
              <button onClick={() => { onReject(modal.punchId); onClose(); }}
                className="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors">
                <X size={15} />Reject
              </button>
            </>
          )}
          {urlQ.data && (
            <a href={urlQ.data} download target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-xl transition-colors">
              <Download size={14} />Save
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function TypeBadge({ type }: { type: 'IN' | 'OUT' }) {
  return (
    <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full ${type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
      {type}
    </span>
  );
}

export default function PunchesPageWrapper() {
  return <Suspense><PunchesPage /></Suspense>;
}

function PunchesPage() {
  const qc           = useQueryClient();
  const searchParams = useSearchParams();
  const urlDate      = searchParams.get('date') ?? '';

  const [tab, setTab]               = useState<'pending' | 'all'>(urlDate ? 'all' : 'pending');
  const [cursor, setCursor]         = useState<string | undefined>();
  const [photoModal, setPhotoModal] = useState<PhotoModal | null>(null);
  const [allDate, setAllDate]       = useState(urlDate);

  useEffect(() => {
    if (urlDate) { setTab('all'); setAllDate(urlDate); }
  }, [urlDate]);

  const pendingQ = useQuery({
    queryKey: ['punches', 'pending'],
    queryFn: () => api.get('/admin/punches/pending').then(r => r.data.data),
    enabled: tab === 'pending',
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });

  const allQ = useQuery({
    queryKey: ['punches', 'all', cursor, allDate],
    queryFn: () => api.get('/admin/punches', { params: { cursor, ...(allDate ? { date: allDate } : {}) } }).then(r => r.data.data),
    enabled: tab === 'all',
  });

  const approve    = useMutation({ mutationFn: (id: string) => api.post(`/admin/punches/${id}/approve`),        onSuccess: () => qc.invalidateQueries({ queryKey: ['punches'] }) });
  const reject     = useMutation({ mutationFn: (id: string) => api.post(`/admin/punches/${id}/reject`),         onSuccess: () => qc.invalidateQueries({ queryKey: ['punches'] }) });
  const approveAll = useMutation({
    mutationFn: () => {
      const date = allDate || localDateStr();
      return api.post('/admin/punches/approve-all-normal', { date });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['punches'] }),
  });

  function openPhoto(p: Punch) {
    setPhotoModal({ punchId: p.id, employee: p.employee.name, time: formatDateTime(p.timestampServer), type: p.type, status: p.approvalStatus });
  }

  const punches: Punch[] = tab === 'pending' ? (pendingQ.data?.punches ?? []) : (allQ.data?.punches ?? []);
  const loading          = tab === 'pending' ? pendingQ.isLoading : allQ.isLoading;
  const pendingCount     = pendingQ.data?.punches?.length ?? 0;

  return (
    <div className="min-h-full bg-slate-50">
      {photoModal && (
        <PhotoViewer
          modal={photoModal}
          onClose={() => setPhotoModal(null)}
          onApprove={id => approve.mutate(id)}
          onReject={id => reject.mutate(id)}
        />
      )}
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Punch Approvals</h1>
            <p className="text-sm text-slate-500 mt-0.5">Review and approve employee attendance punches</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
            <button
              onClick={() => tab === 'pending' ? pendingQ.refetch() : allQ.refetch()}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors"
              title="Refresh"
            >
              <RefreshCw size={14} className={pendingQ.isFetching || allQ.isFetching ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => approveAll.mutate()}
              disabled={approveAll.isPending}
              className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
              style={{ background: '#16a34a', color: '#fff', opacity: approveAll.isPending ? 0.6 : 1 }}
            >
              <CheckCheck size={15} />
              Approve All Normal
            </button>
          </div>
        </div>
      </div>

      <div className="px-8 py-6">
        {/* Tabs + All-tab date filter */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
            {(['pending', 'all'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className="px-5 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: tab === t ? '#fff' : 'transparent',
                  color: tab === t ? '#0f172a' : '#64748b',
                  boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                {t === 'pending'
                  ? `Pending${pendingQ.data ? ` (${pendingCount})` : ''}`
                  : 'All Punches'}
              </button>
            ))}
          </div>
          {tab === 'all' && (
            <div className="flex items-center gap-2">
              <input type="date" value={allDate} onChange={e => { setAllDate(e.target.value); setCursor(undefined); }}
                max={localDateStr()}
                className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
              {allDate && (
                <button onClick={() => { setAllDate(''); setCursor(undefined); }}
                  className="text-xs text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition-colors">
                  Clear
                </button>
              )}
            </div>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-56 text-slate-400 text-sm">Loading…</div>
          ) : punches.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-56 text-slate-400">
              {tab === 'pending'
                ? <><CheckCheck size={36} className="opacity-25 mb-3" /><p className="font-medium">No pending punches</p><p className="text-xs mt-1">All approvals are up to date</p></>
                : <><Clock size={36} className="opacity-25 mb-3" /><p className="font-medium">No punches yet</p></>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['Employee', 'Type', 'Date & Time', 'Location', 'Accuracy', 'Photo', 'Status', ''].map(h => (
                      <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {punches.map((p, i) => (
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
                      <td className="px-5 py-4"><TypeBadge type={p.type} /></td>
                      <td className="px-5 py-4 text-slate-700 whitespace-nowrap text-xs">{formatDateTime(p.timestampServer)}</td>
                      <td className="px-5 py-4 max-w-45">
                        {p.address ? (
                          <span className="flex items-start gap-1 text-slate-500">
                            <MapPin size={11} className="mt-0.5 shrink-0 text-slate-400" />
                            <span className="text-xs leading-tight line-clamp-2">{p.address}</span>
                          </span>
                        ) : p.site ? (
                          <span className="flex items-center gap-1 text-slate-400 text-xs italic">
                            <MapPin size={11} />{p.site.name}
                          </span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-500 whitespace-nowrap">
                        {p.accuracy != null ? `±${Math.round(p.accuracy)}m` : '—'}
                      </td>
                      <td className="px-5 py-4">
                        {p.photoKey ? (
                          <button onClick={() => openPhoto(p)}
                            className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-colors">
                            <ZoomIn size={12} />View
                          </button>
                        ) : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="px-5 py-4"><StatusBadge status={p.approvalStatus} /></td>
                      <td className="px-5 py-4">
                        {p.approvalStatus === 'PENDING' && (
                          <div className="flex gap-2">
                            <button onClick={() => approve.mutate(p.id)}
                              className="flex items-center gap-1 text-xs font-medium bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg transition-colors"
                              title="Approve">
                              <Check size={13} />OK
                            </button>
                            <button onClick={() => reject.mutate(p.id)}
                              className="flex items-center gap-1 text-xs font-medium bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg transition-colors"
                              title="Reject">
                              <X size={13} />Reject
                            </button>
                          </div>
                        )}
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
