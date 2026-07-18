'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

type LeaveType = {
  id: string; name: string; daysEntitled: number; paid: boolean;
  approvalMode: 'AUTO' | 'MANUAL'; maxConsecutiveDays: number | null;
  accrual: string;
};
type LeaveBalance = {
  id: string; leaveTypeId: string; credited: number; used: number; available: number;
  leaveType: { id: string; name: string; paid: boolean };
};
type LeaveRequest = {
  id: string; fromDate: string; toDate: string; reason: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED'; rejectionReason: string | null;
  createdAt: string;
  leaveType: { id: string; name: string; paid: boolean };
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function diffDays(from: string, to: string) {
  const a = new Date(from), b = new Date(to);
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
}

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  PENDING:  { bg: '#fef9c3', color: '#92400e', label: '⏳ Pending' },
  APPROVED: { bg: '#dcfce7', color: '#15803d', label: '✅ Approved' },
  REJECTED: { bg: '#fee2e2', color: '#b91c1c', label: '❌ Rejected' },
};

export default function LeavesPage() {
  const router = useRouter();
  const [tab, setTab]               = useState<'list' | 'apply'>('list');
  const [types, setTypes]           = useState<LeaveType[]>([]);
  const [requests, setRequests]     = useState<LeaveRequest[]>([]);
  const [balances, setBalances]     = useState<LeaveBalance[]>([]);
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState('');

  const [form, setForm] = useState({
    leaveTypeId: '',
    fromDate: '',
    toDate: '',
    reason: '',
  });

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) { router.replace('/login'); return; }
    Promise.all([
      api.get('/leaves/types').then(r => setTypes(r.data.data ?? r.data)),
      api.get('/leaves/my-requests').then(r => setRequests(r.data.data ?? r.data)),
      api.get('/leaves/my-balances').then(r => setBalances(r.data.data ?? r.data)).catch(() => {}),
    ]).catch(() => router.replace('/login'))
      .finally(() => setLoading(false));
  }, [router]);

  async function submitLeave() {
    setError(''); setSuccess('');
    if (!form.leaveTypeId) return setError('Select a leave type');
    if (!form.fromDate || !form.toDate) return setError('Select dates');
    if (form.fromDate > form.toDate) return setError('End date must be after start date');

    const type = types.find(t => t.id === form.leaveTypeId);
    if (type?.maxConsecutiveDays) {
      const days = diffDays(form.fromDate, form.toDate);
      if (days > type.maxConsecutiveDays) {
        return setError(`Max ${type.maxConsecutiveDays} consecutive days for ${type.name}`);
      }
    }

    setSubmitting(true);
    try {
      const res = await api.post('/leaves/my-requests', form);
      const req = res.data.data ?? res.data;
      setRequests(prev => [req, ...prev]);
      setSuccess(req.status === 'APPROVED' ? 'Leave auto-approved! ✅' : 'Leave request submitted! Waiting for approval.');
      setForm({ leaveTypeId: '', fromDate: '', toDate: '', reason: '' });
      setTab('list');
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelRequest(id: string) {
    if (!confirm('Cancel this leave request?')) return;
    try {
      await api.delete(`/leaves/my-requests/${id}`);
      setRequests(prev => prev.filter(r => r.id !== id));
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Cannot cancel');
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
        <div style={{ width: 36, height: 36, border: '3px solid #bfdbfe', borderTop: '3px solid #1d4ed8', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto', paddingBottom: 72, background: '#f8fafc' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1d4ed8, #1e40af)', padding: '48px 20px 20px', color: '#fff' }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>My Leaves</div>
        <div style={{ fontSize: 13, opacity: 0.75, marginTop: 2 }}>Apply and track your leave requests</div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: '#fff', borderBottom: '1px solid #e5e7eb' }}>
        {(['list', 'apply'] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); setError(''); setSuccess(''); }}
            style={{
              flex: 1, padding: '12px 0', border: 'none', background: 'none',
              fontWeight: 600, fontSize: 14, cursor: 'pointer',
              color: tab === t ? '#1d4ed8' : '#6b7280',
              borderBottom: tab === t ? '2px solid #1d4ed8' : '2px solid transparent',
              transition: 'all 0.15s',
            }}>
            {t === 'list' ? `My Requests${requests.length > 0 ? ` (${requests.length})` : ''}` : '+ Apply'}
          </button>
        ))}
      </div>

      {/* Success banner */}
      {success && (
        <div style={{ margin: '12px 16px 0', background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 12, padding: '12px 16px', color: '#15803d', fontSize: 14, fontWeight: 500 }}>
          {success}
        </div>
      )}

      {/* ── LIST TAB ── */}
      {tab === 'list' && (
        <div style={{ padding: '16px' }}>
          {/* Balance chips */}
          {balances.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Leave Balance {new Date().getFullYear()}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {balances.map(b => {
                  const color = b.available === 0 ? '#dc2626' : b.available < 2 ? '#d97706' : '#1d4ed8';
                  const bg    = b.available === 0 ? '#fef2f2' : b.available < 2 ? '#fffbeb' : '#eff6ff';
                  const border = b.available === 0 ? '#fecaca' : b.available < 2 ? '#fde68a' : '#bfdbfe';
                  return (
                    <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 7, background: bg, border: `1.5px solid ${border}`, borderRadius: 12, padding: '8px 14px' }}>
                      <div style={{ fontWeight: 800, fontSize: 18, color, lineHeight: 1 }}>{b.available}</div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#1f2937' }}>{b.leaveType.name}</div>
                        <div style={{ fontSize: 10, color: '#9ca3af' }}>{b.used} used · {b.credited} credited</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {requests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🌴</div>
              <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>No leave requests yet</div>
              <div style={{ fontSize: 13 }}>Tap "+ Apply" to submit your first request</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {requests.map(req => {
                const days  = diffDays(req.fromDate, req.toDate);
                const style = STATUS_STYLE[req.status];
                return (
                  <div key={req.id} style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{req.leaveType.name}</div>
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                          {fmtDate(req.fromDate)}{days > 1 && ` – ${fmtDate(req.toDate)}`} · {days} day{days !== 1 ? 's' : ''}
                        </div>
                        {req.reason && (
                          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, fontStyle: 'italic' }}>"{req.reason}"</div>
                        )}
                        {req.rejectionReason && (
                          <div style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>Reason: {req.rejectionReason}</div>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                        <span style={{ background: style.bg, color: style.color, fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20 }}>
                          {style.label}
                        </span>
                        <span style={{ fontSize: 11, color: req.leaveType.paid ? '#15803d' : '#6b7280', background: req.leaveType.paid ? '#f0fdf4' : '#f3f4f6', padding: '2px 7px', borderRadius: 20 }}>
                          {req.leaveType.paid ? 'Paid' : 'Unpaid'}
                        </span>
                      </div>
                    </div>
                    {req.status === 'PENDING' && (
                      <button onClick={() => cancelRequest(req.id)}
                        style={{ marginTop: 10, background: 'none', border: '1px solid #e5e7eb', color: '#6b7280', fontSize: 12, padding: '5px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 500 }}>
                        Cancel Request
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── APPLY TAB ── */}
      {tab === 'apply' && (
        <div style={{ padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            {/* Leave Type */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Leave Type
              </label>
              {types.length === 0 ? (
                <p style={{ color: '#9ca3af', fontSize: 13 }}>No leave types configured. Contact HR.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {types.map(t => {
                    const bal = balances.find(b => b.leaveTypeId === t.id);
                    return (
                    <label key={t.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                      borderRadius: 10, border: `1.5px solid ${form.leaveTypeId === t.id ? '#1d4ed8' : '#e5e7eb'}`,
                      background: form.leaveTypeId === t.id ? '#eff6ff' : '#fff', cursor: 'pointer',
                    }}>
                      <input type="radio" name="leaveType" value={t.id} checked={form.leaveTypeId === t.id}
                        onChange={e => setForm(f => ({ ...f, leaveTypeId: e.target.value }))}
                        style={{ accentColor: '#1d4ed8' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{t.name}</div>
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>
                          {t.daysEntitled} days/{t.accrual.toLowerCase()} · {t.paid ? 'Paid' : 'Unpaid'}
                          {t.approvalMode === 'AUTO' && ' · Auto-approved'}
                          {t.maxConsecutiveDays && ` · Max ${t.maxConsecutiveDays} days`}
                        </div>
                      </div>
                      {bal !== undefined && (
                        <div style={{
                          textAlign: 'center',
                          background: bal.available === 0 ? '#fef2f2' : '#f0fdf4',
                          border: `1px solid ${bal.available === 0 ? '#fecaca' : '#bbf7d0'}`,
                          borderRadius: 8, padding: '4px 8px', minWidth: 36,
                        }}>
                          <div style={{ fontWeight: 800, fontSize: 16, color: bal.available === 0 ? '#dc2626' : '#15803d', lineHeight: 1 }}>{bal.available}</div>
                          <div style={{ fontSize: 9, color: '#9ca3af', fontWeight: 600 }}>left</div>
                        </div>
                      )}
                    </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Dates */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>From</label>
                <input type="date" min={today}
                  value={form.fromDate} onChange={e => setForm(f => ({ ...f, fromDate: e.target.value, toDate: f.toDate < e.target.value ? e.target.value : f.toDate }))}
                  style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '10px 12px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>To</label>
                <input type="date" min={form.fromDate || today}
                  value={form.toDate} onChange={e => setForm(f => ({ ...f, toDate: e.target.value }))}
                  style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '10px 12px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>

            {/* Duration preview */}
            {form.fromDate && form.toDate && form.fromDate <= form.toDate && (
              <div style={{ background: '#eff6ff', borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#1e40af', fontWeight: 500 }}>Duration</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#1d4ed8' }}>
                  {diffDays(form.fromDate, form.toDate)} day{diffDays(form.fromDate, form.toDate) !== 1 ? 's' : ''}
                </span>
              </div>
            )}

            {/* Reason */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Reason <span style={{ fontWeight: 400, textTransform: 'none', color: '#9ca3af' }}>(optional)</span>
              </label>
              <textarea rows={3} placeholder="Why are you taking leave?"
                value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '10px 12px', fontSize: 14, resize: 'none', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
            </div>

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 16 }}>
                {error}
              </div>
            )}

            <button onClick={submitLeave} disabled={submitting || types.length === 0}
              style={{
                width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
                background: 'linear-gradient(135deg, #1d4ed8, #1e40af)',
                color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer',
                opacity: submitting ? 0.7 : 1, transition: 'opacity 0.15s',
              }}>
              {submitting ? 'Submitting…' : 'Submit Leave Request'}
            </button>
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      <BottomNav active="leaves" />
    </div>
  );
}

function BottomNav({ active }: { active: 'home' | 'leaves' | 'history' | 'profile' }) {
  const items = [
    { key: 'home',    href: '/home',    icon: '🏠', label: 'Attendance' },
    { key: 'history', href: '/history', icon: '📋', label: 'History' },
    { key: 'leaves',  href: '/leaves',  icon: '🌴', label: 'Leaves' },
    { key: 'profile', href: '/profile', icon: '👤', label: 'Profile' },
  ];
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 480, background: '#fff',
      borderTop: '1px solid #e5e7eb', display: 'flex', zIndex: 50,
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {items.map(item => (
        <a key={item.key} href={item.href} style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '8px 0 6px', textDecoration: 'none',
          color: active === item.key ? '#1d4ed8' : '#9ca3af',
          borderTop: active === item.key ? '2px solid #1d4ed8' : '2px solid transparent',
        }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>{item.icon}</span>
          <span style={{ fontSize: 10, fontWeight: 600, marginTop: 2 }}>{item.label}</span>
        </a>
      ))}
    </nav>
  );
}
