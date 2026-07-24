'use client';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatTime, localDateStr } from '@/lib/utils';
import {
  Users, MapPin, LogIn, LogOut as LogOutIcon,
  AlertCircle, CheckCircle2, TrendingUp, Clock3, Phone,
} from 'lucide-react';

const AVATAR_COLORS = ['#2563eb','#7c3aed','#059669','#d97706','#dc2626','#0891b2','#be185d','#4338ca'];

function StatCard({ label, value, icon: Icon, from, to, sub }: {
  label: string; value: number | string; icon: React.ElementType;
  from: string; to: string; sub?: string;
}) {
  return (
    <div className="rounded-2xl p-5 text-white relative overflow-hidden shadow-sm"
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}>
      <div className="absolute inset-0 opacity-10"
        style={{ background: 'radial-gradient(circle at top right, white 0%, transparent 60%)' }} />
      <div className="flex items-start justify-between relative">
        <div>
          <p className="text-sm font-medium" style={{ opacity: 0.82 }}>{label}</p>
          <p className="text-4xl font-bold mt-2 tracking-tight">{value}</p>
          {sub && <p className="text-xs mt-1" style={{ opacity: 0.68 }}>{sub}</p>}
        </div>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.18)' }}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const bg = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
  return (
    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0"
      style={{ background: bg }}>
      {name[0]?.toUpperCase() ?? '?'}
    </div>
  );
}

function PunchTypeBadge({ type }: { type: 'IN' | 'OUT' }) {
  return (
    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
      {type}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    APPROVED: 'bg-emerald-100 text-emerald-700',
    REJECTED: 'bg-red-100 text-red-600',
    PENDING:  'bg-yellow-100 text-yellow-700',
  };
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status] ?? 'bg-gray-100 text-gray-500'}`}>{status}</span>;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

export default function DashboardPage() {
  const today    = localDateStr();
  const dayName  = new Date().toLocaleDateString('en-IN', { weekday: 'long' });
  const fullDate = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  const empQ     = useQuery({ queryKey: ['employees'],            queryFn: () => api.get('/admin/employees').then(r => r.data.data) });
  const siteQ    = useQuery({ queryKey: ['sites'],                queryFn: () => api.get('/admin/sites').then(r => r.data.data) });
  const punchQ   = useQuery({ queryKey: ['punches-today', today], queryFn: () => api.get('/admin/punches', { params: { date: today } }).then(r => r.data.data), refetchInterval: 30_000 });
  const pendingQ = useQuery({ queryKey: ['pending'],              queryFn: () => api.get('/admin/punches/pending').then(r => r.data.data), refetchInterval: 10_000 });
  const leaveQ   = useQuery({
    queryKey: ['leaves-today', today.slice(0, 7)],
    queryFn: () => api.get('/admin/leaves/requests', {
      params: { status: 'APPROVED', year: today.slice(0, 4), month: String(parseInt(today.slice(5, 7), 10)) }
    }).then(r => r.data.data ?? r.data),
    refetchInterval: 60_000,
  });

  const employees = empQ.data?.employees  ?? [];
  const sites     = siteQ.data            ?? [];
  const punches   = punchQ.data?.punches  ?? [];
  const pending   = pendingQ.data?.punches ?? [];

  const activeEmployees = employees.filter((e: any) => e.status === 'ACTIVE');
  const activeSites     = sites.filter((s: any) => s.status === 'ACTIVE').length;
  const todayIn         = punches.filter((p: any) => p.type === 'IN').length;
  const todayOut        = punches.filter((p: any) => p.type === 'OUT').length;
  const pendingCount    = pending.length;
  const approvedToday   = punches.filter((p: any) => p.approvalStatus === 'APPROVED').length;
  const rejectedToday   = punches.filter((p: any) => p.approvalStatus === 'REJECTED').length;

  const attendanceRate  = activeEmployees.length > 0 ? Math.round((todayIn / activeEmployees.length) * 100) : 0;
  const circumference   = 2 * Math.PI * 50;

  // Absent today = active employees with no IN punch AND not on approved leave
  const punchedInIds = useMemo(() =>
    new Set(punches.filter((p: any) => p.type === 'IN').map((p: any) => p.employee.id)),
    [punches]
  );
  const onLeaveIds: Set<string> = useMemo(() => {
    const s = new Set<string>();
    (leaveQ.data ?? []).forEach((lr: any) => {
      if (today >= lr.fromDate.slice(0, 10) && today <= lr.toDate.slice(0, 10)) s.add(lr.employee.id);
    });
    return s;
  }, [leaveQ.data, today]);
  const absentToday = useMemo(() =>
    activeEmployees.filter((e: any) => !punchedInIds.has(e.id) && !onLeaveIds.has(e.id)),
    [activeEmployees, punchedInIds, onLeaveIds]
  );

  const recent = [...punches]
    .sort((a: any, b: any) => new Date(b.timestampServer).getTime() - new Date(a.timestampServer).getTime())
    .slice(0, 5);

  return (
    <div className="min-h-full bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Good {getGreeting()}</h1>
            <p className="text-sm text-slate-500 mt-0.5">{dayName}, {fullDate}</p>
          </div>
          {pendingCount > 0 && (
            <a href="/punches"
              className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium px-4 py-2 rounded-xl hover:bg-amber-100 transition-colors">
              <AlertCircle size={15} />
              {pendingCount} punch{pendingCount !== 1 ? 'es' : ''} need approval
            </a>
          )}
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Active Employees" value={activeEmployees.length}
            from="#2563eb" to="#1d4ed8" icon={Users}
            sub={`${activeSites} active site${activeSites !== 1 ? 's' : ''}`} />
          <StatCard label="Punched In Today" value={todayIn}
            from="#10b981" to="#059669" icon={LogIn}
            sub={attendanceRate ? `${attendanceRate}% attendance` : 'no data'} />
          <StatCard label="Absent Today" value={absentToday.length}
            from={absentToday.length > 0 ? '#ef4444' : '#64748b'}
            to={absentToday.length > 0 ? '#dc2626' : '#475569'}
            icon={Users}
            sub={absentToday.length > 0 ? 'not punched in yet' : 'everyone in'} />
          <StatCard label="Pending Approvals" value={pendingCount}
            from={pendingCount > 0 ? '#f59e0b' : '#64748b'}
            to={pendingCount > 0 ? '#d97706' : '#475569'}
            icon={AlertCircle}
            sub={pendingCount > 0 ? 'need your attention' : 'all clear'} />
        </div>

        {/* Middle row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Attendance ring */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col items-center justify-center gap-4">
            <p className="text-sm font-semibold text-slate-700 self-start">Today's Attendance</p>
            <div className="relative w-36 h-36">
              <svg className="w-full h-full" style={{ transform: 'rotate(-90deg)' }} viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" fill="none" stroke="#e2e8f0" strokeWidth="12" />
                <circle cx="60" cy="60" r="50" fill="none" stroke="#2563eb" strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={`${circumference}`}
                  strokeDashoffset={`${circumference * (1 - attendanceRate / 100)}`}
                  style={{ transition: 'stroke-dashoffset 0.7s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-slate-900">{attendanceRate}%</span>
                <span className="text-xs text-slate-400 mt-0.5">present</span>
              </div>
            </div>
            <div className="flex w-full">
              <div className="flex-1 text-center">
                <div className="text-2xl font-bold text-emerald-600">{todayIn}</div>
                <div className="text-xs text-slate-500 mt-0.5">Present</div>
              </div>
              <div className="w-px bg-slate-200" />
              <div className="flex-1 text-center">
                <div className="text-2xl font-bold text-red-500">{absentToday.length}</div>
                <div className="text-xs text-slate-500 mt-0.5">Absent</div>
              </div>
            </div>
          </div>

          {/* Punch status breakdown */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <p className="text-sm font-semibold text-slate-700 mb-5">Punch Status — Today</p>
            <div className="space-y-4">
              {[
                { label: 'Approved', count: approvedToday, total: punches.length, color: '#10b981', bg: '#d1fae5' },
                { label: 'Pending',  count: pendingCount,  total: punches.length, color: '#f59e0b', bg: '#fef3c7' },
                { label: 'Rejected', count: rejectedToday, total: punches.length, color: '#ef4444', bg: '#fee2e2' },
              ].map(({ label, count, total, color, bg }) => (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                      <span className="text-sm text-slate-600">{label}</span>
                    </div>
                    <span className="text-sm font-semibold text-slate-900">{count}</span>
                  </div>
                  <div className="h-2.5 rounded-full overflow-hidden" style={{ background: bg }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: total > 0 ? `${(count / total) * 100}%` : '0%', background: color }} />
                  </div>
                </div>
              ))}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-400">Total punches today</span>
                <span className="font-bold text-slate-800">{punches.length}</span>
              </div>
            </div>
          </div>

          {/* Quick stats */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <p className="text-sm font-semibold text-slate-700 mb-5">Quick Overview</p>
            <div className="space-y-3">
              {[
                { icon: Users,        label: 'Total Employees', value: employees.length,       iconBg: '#eff6ff', iconColor: '#2563eb' },
                { icon: MapPin,       label: 'Active Sites',    value: activeSites,            iconBg: '#f5f3ff', iconColor: '#7c3aed' },
                { icon: CheckCircle2, label: 'Approved Today',  value: approvedToday,          iconBg: '#f0fdf4', iconColor: '#16a34a' },
                { icon: TrendingUp,   label: 'IN Today',        value: todayIn,                iconBg: '#eff6ff', iconColor: '#2563eb' },
                { icon: Clock3,       label: 'OUT Today',       value: todayOut,               iconBg: '#fff7ed', iconColor: '#ea580c' },
              ].map(({ icon: Icon, label, value, iconBg, iconColor }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: iconBg, color: iconColor }}>
                    <Icon size={14} />
                  </div>
                  <span className="text-sm text-slate-600 flex-1">{label}</span>
                  <span className="text-sm font-bold text-slate-900">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom row — 3 columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Pending Approvals */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-900 text-sm">Pending Approvals</h2>
                <p className="text-xs text-slate-400 mt-0.5">Awaiting review</p>
              </div>
              {pendingCount > 0 && (
                <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full">{pendingCount}</span>
              )}
            </div>
            {pending.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <CheckCircle2 size={28} className="opacity-30 mb-2" />
                <p className="text-sm">All caught up!</p>
              </div>
            ) : (
              <>
                {pending.slice(0, 4).map((p: any) => (
                  <div key={p.id} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
                    <Avatar name={p.employee.name} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{p.employee.name}</p>
                      <p className="text-xs text-slate-400">{formatTime(p.timestampServer)}</p>
                    </div>
                    <PunchTypeBadge type={p.type} />
                  </div>
                ))}
                <div className="px-5 py-3 border-t border-slate-100">
                  <a href="/punches"
                    className="block text-center text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl transition-colors">
                    {pendingCount > 4 ? `View all ${pendingCount} →` : 'Go to Approvals →'}
                  </a>
                </div>
              </>
            )}
          </div>

          {/* Absent Today */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-900 text-sm">Absent Today</h2>
                <p className="text-xs text-slate-400 mt-0.5">Haven't punched in</p>
              </div>
              {absentToday.length > 0 && (
                <span className="text-xs font-semibold bg-red-100 text-red-600 px-2.5 py-1 rounded-full">{absentToday.length}</span>
              )}
            </div>
            {empQ.isLoading || punchQ.isLoading ? (
              <div className="flex items-center justify-center py-10 text-slate-400 text-sm">Loading…</div>
            ) : absentToday.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <CheckCircle2 size={28} className="opacity-30 mb-2" />
                <p className="text-sm">Everyone is in!</p>
              </div>
            ) : (
              <>
                {absentToday.slice(0, 4).map((e: any) => (
                  <div key={e.id} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
                    <Avatar name={e.name} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{e.name}</p>
                      <p className="text-xs text-slate-400 truncate">{e.defaultSite?.name ?? 'No site'}</p>
                    </div>
                    <a href={`tel:${e.phone}`}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors shrink-0"
                      title={e.phone}>
                      <Phone size={12} />
                    </a>
                  </div>
                ))}
                {absentToday.length > 4 && (
                  <div className="px-5 py-3 border-t border-slate-100">
                    <a href="/reports"
                      className="block text-center text-sm font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 py-2 rounded-xl transition-colors">
                      +{absentToday.length - 4} more absent → Full Report
                    </a>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900 text-sm">Recent Activity</h2>
              <p className="text-xs text-slate-400 mt-0.5">Latest punches today</p>
            </div>
            {punchQ.isLoading ? (
              <div className="flex items-center justify-center py-10 text-slate-400 text-sm">Loading…</div>
            ) : recent.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <Clock3 size={28} className="opacity-30 mb-2" />
                <p className="text-sm">No punches today yet</p>
              </div>
            ) : recent.map((p: any) => (
              <div key={p.id} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
                <Avatar name={p.employee.name} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{p.employee.name}</p>
                  <p className="text-xs text-slate-400">{p.site?.name ?? '—'} · {formatTime(p.timestampServer)}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <PunchTypeBadge type={p.type} />
                  <StatusPill status={p.approvalStatus} />
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
