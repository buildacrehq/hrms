'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

type Punch = {
  id: string;
  type: 'IN' | 'OUT';
  timestampServer: string;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  address: string;
  site: { name: string } | null;
};

type DayGroup = {
  dateStr: string;
  dayLabel: string;
  dateLabel: string;
  punches: Punch[];
  inTime: string | null;
  outTime: string | null;
  hoursWorked: number | null;
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const FULL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function fmtHours(h: number) {
  const hrs  = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

function groupByDay(punches: Punch[]): DayGroup[] {
  const map = new Map<string, Punch[]>();
  for (const p of punches) {
    const d = new Date(p.timestampServer);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }

  const days: DayGroup[] = [];
  for (const [dateStr, ps] of Array.from(map.entries()).sort((a,b) => b[0].localeCompare(a[0]))) {
    const d = new Date(dateStr + 'T00:00:00');
    const inPunch  = ps.find(p => p.type === 'IN');
    const outPunch = ps.filter(p => p.type === 'OUT').sort((a,b) => new Date(b.timestampServer).getTime() - new Date(a.timestampServer).getTime())[0];
    let hoursWorked: number | null = null;
    if (inPunch && outPunch) {
      hoursWorked = (new Date(outPunch.timestampServer).getTime() - new Date(inPunch.timestampServer).getTime()) / 3600000;
    }
    days.push({
      dateStr,
      dayLabel: d.toLocaleDateString('en-IN', { weekday: 'short' }),
      dateLabel: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      punches: ps.sort((a,b) => new Date(a.timestampServer).getTime() - new Date(b.timestampServer).getTime()),
      inTime: inPunch ? fmtTime(inPunch.timestampServer) : null,
      outTime: outPunch ? fmtTime(outPunch.timestampServer) : null,
      hoursWorked,
    });
  }
  return days;
}

const STATUS_DOT: Record<string, string> = {
  APPROVED: '#22c55e', PENDING: '#f59e0b', REJECTED: '#ef4444',
};

type Holiday = { id: string; date: string; name: string };
type LeaveReq = { id: string; fromDate: string; toDate: string; status: string; leaveType: { name: string } };
type RegReq = {
  id: string; date: string; requestType: 'PUNCH_IN' | 'PUNCH_OUT' | 'BOTH';
  punchInTime: string | null; punchOutTime: string | null;
  reason: string; status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason: string | null; createdAt: string;
};

type RegForm = {
  date: string; requestType: 'PUNCH_IN' | 'PUNCH_OUT' | 'BOTH';
  punchInTime: string; punchOutTime: string; reason: string;
};

type DayStatus = 'P' | 'A' | 'HD' | 'W' | 'H' | 'L' | 'PEND' | 'FUT';

const DAY_STATUS_META: Record<DayStatus, { label: string; bg: string; text: string }> = {
  P:    { label: 'Present',   bg: '#dcfce7', text: '#15803d' },
  A:    { label: 'Absent',    bg: '#fee2e2', text: '#b91c1c' },
  HD:   { label: 'Half Day',  bg: '#d1fae5', text: '#065f46' },
  W:    { label: 'Off',       bg: '#f1f5f9', text: '#64748b' },
  H:    { label: 'Holiday',   bg: '#ede9fe', text: '#6d28d9' },
  L:    { label: 'Leave',     bg: '#fef3c7', text: '#92400e' },
  PEND: { label: 'Pending',   bg: '#fef9c3', text: '#b45309' },
  FUT:  { label: '—',         bg: '#f8fafc', text: '#e2e8f0' },
};

function toLocalDateStr(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export default function HistoryPage() {
  const router = useRouter();
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed
  const [punches, setPunches] = useState<Punch[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [leaves,   setLeaves]   = useState<LeaveReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [viewTab, setViewTab] = useState<'list' | 'calendar' | 'corrections'>('list');
  const [regReqs, setRegReqs] = useState<RegReq[]>([]);

  // Regularization modal
  const [regForm,   setRegForm]   = useState<RegForm | null>(null);
  const [regBusy,   setRegBusy]   = useState(false);
  const [regMsg,    setRegMsg]    = useState('');

  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) { router.replace('/login'); return; }
    setLoading(true);
    Promise.all([
      api.get('/punches/me', { params: { month: monthKey } }),
      api.get('/holidays', { params: { year: String(year) } }).catch(() => ({ data: { data: [] } })),
      api.get('/leaves/my-requests').catch(() => ({ data: [] })),
      api.get('/regularizations/my-requests').catch(() => ({ data: [] })),
    ])
      .then(([pRes, hRes, lRes, rRes]) => {
        setPunches(pRes.data.punches ?? []);
        setHolidays(hRes.data.data ?? hRes.data ?? []);
        setLeaves(lRes.data.data ?? lRes.data ?? []);
        setRegReqs([...(rRes.data.data ?? rRes.data ?? [])].sort((a: RegReq, b: RegReq) => b.createdAt.localeCompare(a.createdAt)));
      })
      .catch(() => router.replace('/login'))
      .finally(() => setLoading(false));
  }, [monthKey, router]);

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

  const days = useMemo(() => groupByDay(punches), [punches]);

  const stats = useMemo(() => {
    const presentDays = days.filter(d => d.inTime).length;
    const totalHours  = days.reduce((sum, d) => sum + (d.hoursWorked ?? 0), 0);
    const pendingDays = days.filter(d => d.punches.some(p => p.approvalStatus === 'PENDING')).length;
    return { presentDays, totalHours, pendingDays };
  }, [days]);

  // Calendar computations
  const holidaySet = useMemo(() => {
    const s = new Set<string>();
    holidays.forEach(h => s.add(h.date.slice(0, 10)));
    return s;
  }, [holidays]);

  const leaveDaySet = useMemo(() => {
    const s = new Set<string>();
    leaves.filter(l => l.status === 'APPROVED').forEach(lr => {
      const start = new Date(lr.fromDate); const end = new Date(lr.toDate);
      const d = new Date(start);
      while (d <= end) { s.add(toLocalDateStr(d.toISOString())); d.setDate(d.getDate() + 1); }
    });
    return s;
  }, [leaves]);

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }, []);

  const calDays = useMemo(() => {
    const lastDay = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: lastDay }, (_, i) => {
      const day = i + 1;
      const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const dow = new Date(year, month, day).getDay();

      let status: DayStatus;
      if (dateStr > todayStr)           status = 'FUT';
      else if (holidaySet.has(dateStr)) status = 'H';
      else if (leaveDaySet.has(dateStr)) status = 'L';
      else if (dow === 0)               status = 'W';
      else {
        const dayPunches = punches.filter(p => toLocalDateStr(p.timestampServer) === dateStr);
        if (dayPunches.length === 0) {
          status = 'A';
        } else {
          const approved = dayPunches.filter(p => p.approvalStatus === 'APPROVED');
          const pending  = dayPunches.filter(p => p.approvalStatus === 'PENDING');
          if (approved.length === 0) status = pending.length > 0 ? 'PEND' : 'A';
          else status = (approved.some(p => p.type === 'IN') && approved.some(p => p.type === 'OUT')) ? 'P' : 'HD';
        }
      }

      const dayPunches = punches.filter(p => toLocalDateStr(p.timestampServer) === dateStr);
      const approved   = dayPunches.filter(p => p.approvalStatus === 'APPROVED');
      return {
        day, dateStr, dow, status,
        inTime:  approved.find(p => p.type === 'IN')  ? fmtTime(approved.find(p => p.type === 'IN')!.timestampServer) : null,
        outTime: approved.find(p => p.type === 'OUT') ? fmtTime(approved.find(p => p.type === 'OUT')!.timestampServer) : null,
      };
    });
  }, [year, month, punches, holidaySet, leaveDaySet, todayStr]);

  function toggleExpand(dateStr: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(dateStr)) next.delete(dateStr); else next.add(dateStr);
      return next;
    });
  }

  function openRegForm(dateStr: string, hasPunchIn: boolean, hasPunchOut: boolean) {
    let requestType: 'PUNCH_IN' | 'PUNCH_OUT' | 'BOTH' = 'PUNCH_IN';
    if (!hasPunchIn && !hasPunchOut) requestType = 'BOTH';
    else if (!hasPunchIn)  requestType = 'PUNCH_IN';
    else if (!hasPunchOut) requestType = 'PUNCH_OUT';
    setRegMsg('');
    setRegForm({ date: dateStr, requestType, punchInTime: '', punchOutTime: '', reason: '' });
  }

  async function submitReg() {
    if (!regForm) return;
    if (!regForm.date) return setRegMsg('Please select a date');
    if (!regForm.reason.trim()) return setRegMsg('Reason is required');
    setRegBusy(true); setRegMsg('');
    try {
      const res = await api.post('/regularizations', {
        date: regForm.date,
        requestType: regForm.requestType,
        punchInTime:  regForm.punchInTime  || undefined,
        punchOutTime: regForm.punchOutTime || undefined,
        reason: regForm.reason,
      });
      const newReq: RegReq = res.data.data ?? res.data;
      setRegReqs(prev => [newReq, ...prev]);
      setRegMsg('Request submitted!');
      setTimeout(() => { setRegForm(null); setRegMsg(''); }, 1500);
    } catch (e: any) {
      setRegMsg(e?.response?.data?.message ?? 'Failed to submit');
    } finally {
      setRegBusy(false);
    }
  }

  async function cancelReg(id: string) {
    if (!confirm('Cancel this correction request?')) return;
    try {
      await api.delete(`/regularizations/${id}`);
      setRegReqs(prev => prev.filter(r => r.id !== id));
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Cannot cancel');
    }
  }

  function openNewReg() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const ds = `${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`;
    setRegMsg('');
    setRegForm({ date: ds, requestType: 'BOTH', punchInTime: '', punchOutTime: '', reason: '' });
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto', paddingBottom: 72, background: '#f8fafc' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1d4ed8, #1e40af)', padding: '48px 20px 20px', color: '#fff' }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>My Attendance</div>
        <div style={{ fontSize: 13, opacity: 0.75, marginTop: 2 }}>Your monthly punch history</div>
      </div>

      {/* Month nav */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', padding: '10px 16px', gap: 8 }}>
        <button onClick={prevMonth}
          style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid #e5e7eb', background: '#f9fafb', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          ‹
        </button>
        <div style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 15, color: '#111827' }}>
          {FULL_MONTHS[month]} {year}
        </div>
        <button onClick={nextMonth} disabled={!canGoNext}
          style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid #e5e7eb', background: canGoNext ? '#f9fafb' : '#f3f4f6', fontSize: 16, cursor: canGoNext ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: canGoNext ? 1 : 0.35 }}>
          ›
        </button>
      </div>

      {/* Stats strip */}
      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, padding: '12px 16px' }}>
          {[
            { label: 'Days Present', value: stats.presentDays, color: '#15803d', bg: '#f0fdf4' },
            { label: 'Hours Worked', value: stats.totalHours > 0 ? fmtHours(stats.totalHours) : '—', color: '#1d4ed8', bg: '#eff6ff' },
            { label: 'Pending',      value: stats.pendingDays, color: '#a16207', bg: '#fefce8' },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, borderRadius: 12, padding: '10px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: s.color, opacity: 0.75, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tab toggle */}
      <div style={{ display: 'flex', gap: 4, padding: '0 16px 12px', background: '#f8fafc' }}>
        {([
          ['list',        '📋 List'],
          ['calendar',    '📅 Cal'],
          ['corrections', `✎ Corrections${regReqs.length > 0 ? ` (${regReqs.length})` : ''}`],
        ] as const).map(([key, label]) => (
          <button key={key} onClick={() => setViewTab(key)}
            style={{ flex: 1, padding: '8px 2px', borderRadius: 10, border: '1.5px solid', fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
              background: viewTab === key ? '#1d4ed8' : '#fff',
              color: viewTab === key ? '#fff' : '#6b7280',
              borderColor: viewTab === key ? '#1d4ed8' : '#e5e7eb',
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* Calendar View */}
      {viewTab === 'calendar' && !loading && (
        <div style={{ padding: '0 16px 16px' }}>
          {/* DOW header */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 4 }}>
            {['Su','Mo','Tu','We','Th','Fr','Sa'].map((d, i) => (
              <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: i === 0 ? '#ef4444' : '#9ca3af', padding: '4px 0' }}>{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          {(() => {
            const firstDOW = new Date(year, month, 1).getDay();
            const cells: (typeof calDays[0] | null)[] = [
              ...Array<null>(firstDOW).fill(null),
              ...calDays,
            ];
            while (cells.length % 7 !== 0) cells.push(null);

            return Array.from({ length: cells.length / 7 }, (_, wk) => (
              <div key={wk} style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 2 }}>
                {cells.slice(wk * 7, wk * 7 + 7).map((d, ci) => {
                  if (!d) return <div key={ci} style={{ minHeight: 54, background: '#f8fafc', borderRadius: 8 }} />;
                  const meta    = DAY_STATUS_META[d.status];
                  const isToday = d.dateStr === todayStr;
                  return (
                    <div key={d.dateStr}
                      style={{ minHeight: 54, borderRadius: 8, padding: '4px 2px', display: 'flex', flexDirection: 'column', alignItems: 'center',
                        background: d.status === 'FUT' ? '#f8fafc' : meta.bg, opacity: d.status === 'FUT' ? 0.4 : 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: isToday ? '#1d4ed8' : 'transparent',
                        color: isToday ? '#fff' : d.dow === 0 ? '#ef4444' : '#111827' }}>
                        {d.day}
                      </div>
                      {d.status !== 'FUT' && (
                        <div style={{ fontSize: 9, fontWeight: 700, color: meta.text, marginTop: 1, textAlign: 'center', lineHeight: 1.1 }}>
                          {meta.label}
                        </div>
                      )}
                      {d.inTime && (
                        <div style={{ fontSize: 8, color: '#15803d', marginTop: 1, fontWeight: 600 }}>
                          {d.inTime.replace(' AM','a').replace(' PM','p')}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ));
          })()}

          {/* Legend */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
            {(['P','A','HD','L','H','W'] as DayStatus[]).map(s => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: DAY_STATUS_META[s].bg, border: `1px solid ${DAY_STATUS_META[s].text}40` }} />
                <span style={{ fontSize: 10, color: '#6b7280' }}>{DAY_STATUS_META[s].label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Corrections tab */}
      {viewTab === 'corrections' && (
        <div style={{ padding: '0 16px 16px' }}>
          <button onClick={openNewReg}
            style={{ width: '100%', marginBottom: 14, padding: '12px 0', borderRadius: 12, border: '1.5px dashed #1d4ed8', background: '#eff6ff', color: '#1d4ed8', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            + Request New Correction
          </button>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
              <div style={{ width: 28, height: 28, border: '3px solid #bfdbfe', borderTop: '3px solid #1d4ed8', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : regReqs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 20px', color: '#9ca3af' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>✎</div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>No correction requests</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Tap above to request an attendance correction</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {regReqs.map(r => {
                const statusStyle = {
                  PENDING:  { bg: '#fef9c3', color: '#92400e', label: '⏳ Pending'  },
                  APPROVED: { bg: '#dcfce7', color: '#15803d', label: '✅ Approved' },
                  REJECTED: { bg: '#fee2e2', color: '#b91c1c', label: '❌ Rejected' },
                }[r.status];
                const typeLabel = r.requestType === 'PUNCH_IN' ? 'Punch In' : r.requestType === 'PUNCH_OUT' ? 'Punch Out' : 'Both Punches';
                const dateLabel = new Date(r.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
                return (
                  <div key={r.id} style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{dateLabel}</div>
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{typeLabel}</div>
                      </div>
                      <span style={{ background: statusStyle.bg, color: statusStyle.color, fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20, flexShrink: 0 }}>
                        {statusStyle.label}
                      </span>
                    </div>
                    {(r.punchInTime || r.punchOutTime) && (
                      <div style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
                        {r.punchInTime  && <span style={{ fontSize: 12, color: '#15803d', background: '#f0fdf4', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>IN {r.punchInTime}</span>}
                        {r.punchOutTime && <span style={{ fontSize: 12, color: '#b45309', background: '#fffbeb', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>OUT {r.punchOutTime}</span>}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: '#6b7280', fontStyle: 'italic' }}>"{r.reason}"</div>
                    {r.rejectionReason && (
                      <div style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>Rejected: {r.rejectionReason}</div>
                    )}
                    {r.status === 'PENDING' && (
                      <button onClick={() => cancelReg(r.id)}
                        style={{ marginTop: 10, background: 'none', border: '1px solid #e5e7eb', color: '#6b7280', fontSize: 12, padding: '5px 12px', borderRadius: 8, cursor: 'pointer' }}>
                        Cancel
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Day list */}
      {viewTab === 'list' && <div style={{ padding: '0 16px 16px' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, padding: '60px 0' }}>
            <div style={{ width: 32, height: 32, border: '3px solid #bfdbfe', borderTop: '3px solid #1d4ed8', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : days.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>No punches in {MONTHS[month]} {year}</div>
            <div style={{ fontSize: 13 }}>Your attendance will appear here</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {days.map(day => {
              const isExpanded = expanded.has(day.dateStr);
              const hasOut = !!day.outTime;
              const statusColor = day.punches.some(p => p.approvalStatus === 'PENDING')
                ? '#f59e0b'
                : day.punches.every(p => p.approvalStatus === 'APPROVED')
                ? '#22c55e'
                : '#ef4444';

              return (
                <div key={day.dateStr} style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  {/* Day row */}
                  <button onClick={() => toggleExpand(day.dateStr)}
                    style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '12px 14px', gap: 12, textAlign: 'left' }}>

                    {/* Date badge */}
                    <div style={{ width: 44, textAlign: 'center', flexShrink: 0 }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#111827', lineHeight: 1 }}>
                        {day.dateStr.slice(8)}
                      </div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>
                        {day.dayLabel}
                      </div>
                    </div>

                    {/* Divider */}
                    <div style={{ width: 1, height: 36, background: '#f0f0f0', flexShrink: 0 }} />

                    {/* Times */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {day.inTime && (
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#15803d', background: '#f0fdf4', padding: '2px 8px', borderRadius: 20 }}>
                            IN {day.inTime}
                          </span>
                        )}
                        {day.outTime && (
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#b45309', background: '#fffbeb', padding: '2px 8px', borderRadius: 20 }}>
                            OUT {day.outTime}
                          </span>
                        )}
                        {!day.inTime && (
                          <span style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>No punch recorded</span>
                        )}
                      </div>
                      {day.hoursWorked !== null && (
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3 }}>
                          {fmtHours(day.hoursWorked)} worked
                          {!hasOut && day.inTime && <span style={{ color: '#f59e0b', marginLeft: 4 }}>· No punch-out</span>}
                        </div>
                      )}
                      {day.inTime && !day.outTime && (
                        <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 3 }}>No punch-out recorded</div>
                      )}
                    </div>

                    {/* Status dot + expand */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor }} />
                      <span style={{ fontSize: 16, color: '#9ca3af', transition: 'transform 0.2s', display: 'inline-block', transform: isExpanded ? 'rotate(180deg)' : 'none' }}>
                        ›
                      </span>
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid #f3f4f6', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {day.punches.map(p => (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_DOT[p.approvalStatus], flexShrink: 0 }} />
                          <span style={{ fontWeight: 600, fontSize: 12, color: p.type === 'IN' ? '#15803d' : '#b45309', minWidth: 28 }}>{p.type}</span>
                          <span style={{ fontSize: 12, color: '#374151', flex: 1 }}>{fmtTime(p.timestampServer)}</span>
                          <span style={{ fontSize: 11, color:
                            p.approvalStatus === 'APPROVED' ? '#15803d' :
                            p.approvalStatus === 'PENDING'  ? '#a16207' : '#dc2626',
                            background:
                            p.approvalStatus === 'APPROVED' ? '#f0fdf4' :
                            p.approvalStatus === 'PENDING'  ? '#fefce8' : '#fef2f2',
                            padding: '2px 7px', borderRadius: 10 }}>
                            {p.approvalStatus}
                          </span>
                        </div>
                      ))}
                      {day.punches[0]?.site && (
                        <div style={{ fontSize: 11, color: '#9ca3af', paddingTop: 4, paddingLeft: 16 }}>
                          📍 {day.punches[0].site.name}
                        </div>
                      )}
                      {/* Request correction */}
                      {(!day.inTime || !day.outTime) && new Date(day.dateStr) < now && (
                        <button
                          onClick={() => openRegForm(day.dateStr, !!day.inTime, !!day.outTime)}
                          style={{ alignSelf: 'flex-start', marginTop: 4, fontSize: 12, fontWeight: 600, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '5px 12px', borderRadius: 8, cursor: 'pointer' }}>
                          ✎ Request Correction
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Regularization modal */}
      {regForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100, padding: '0 0 72px' }}>
          <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, padding: '24px 20px', maxHeight: '80dvh', overflowY: 'auto' }}>
            <div style={{ fontWeight: 700, fontSize: 17, color: '#111827', marginBottom: 12 }}>Request Attendance Correction</div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Date</label>
              <input type="date" value={regForm.date} max={new Date().toISOString().slice(0,10)}
                onChange={e => setRegForm(f => f ? { ...f, date: e.target.value } : f)}
                style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '9px 12px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            </div>

            {/* Request type */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Correction Type</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['PUNCH_IN', 'PUNCH_OUT', 'BOTH'] as const).map(t => (
                  <button key={t} onClick={() => setRegForm(f => f ? { ...f, requestType: t } : f)}
                    style={{ flex: 1, padding: '8px 4px', borderRadius: 10, border: `1.5px solid ${regForm.requestType === t ? '#1d4ed8' : '#e5e7eb'}`, background: regForm.requestType === t ? '#eff6ff' : '#fff', fontSize: 11, fontWeight: 600, color: regForm.requestType === t ? '#1d4ed8' : '#6b7280', cursor: 'pointer' }}>
                    {t === 'PUNCH_IN' ? 'Punch In' : t === 'PUNCH_OUT' ? 'Punch Out' : 'Both'}
                  </button>
                ))}
              </div>
            </div>

            {/* Times */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              {(regForm.requestType === 'PUNCH_IN' || regForm.requestType === 'BOTH') && (
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Punch-In Time</label>
                  <input type="time" value={regForm.punchInTime} onChange={e => setRegForm(f => f ? { ...f, punchInTime: e.target.value } : f)}
                    style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '9px 10px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              )}
              {(regForm.requestType === 'PUNCH_OUT' || regForm.requestType === 'BOTH') && (
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Punch-Out Time</label>
                  <input type="time" value={regForm.punchOutTime} onChange={e => setRegForm(f => f ? { ...f, punchOutTime: e.target.value } : f)}
                    style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '9px 10px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              )}
            </div>

            {/* Reason */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Reason</label>
              <textarea value={regForm.reason} onChange={e => setRegForm(f => f ? { ...f, reason: e.target.value } : f)}
                placeholder="Briefly explain why you missed punching…"
                rows={2}
                style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '9px 12px', fontSize: 14, outline: 'none', boxSizing: 'border-box', resize: 'none' }} />
            </div>

            {regMsg && (
              <div style={{ marginBottom: 12, fontSize: 13, color: regMsg.includes('submitted') ? '#15803d' : '#dc2626', fontWeight: 500 }}>{regMsg}</div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setRegForm(null)}
                style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1.5px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={submitReg} disabled={regBusy || !regForm.reason.trim()}
                style={{ flex: 2, padding: '12px', borderRadius: 12, border: 'none', background: '#1d4ed8', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: regBusy || !regForm.reason.trim() ? 0.6 : 1 }}>
                {regBusy ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      <BottomNav active="history" />
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
