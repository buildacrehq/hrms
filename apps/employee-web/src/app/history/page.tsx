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

export default function HistoryPage() {
  const router = useRouter();
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed
  const [punches, setPunches] = useState<Punch[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) { router.replace('/login'); return; }
    setLoading(true);
    api.get('/punches/me', { params: { month: monthKey } })
      .then(r => setPunches(r.data.punches ?? []))
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

  function toggleExpand(dateStr: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(dateStr)) next.delete(dateStr); else next.add(dateStr);
      return next;
    });
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

      {/* Day list */}
      <div style={{ padding: '0 16px 16px' }}>
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
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

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
