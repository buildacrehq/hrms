'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Users, MapPin, Clock, CheckCircle, AlertCircle, TrendingUp } from 'lucide-react';
import { formatTime } from '@/lib/utils';

export default function DashboardPage() {
  const today = new Date().toISOString().slice(0, 10);

  const empQ    = useQuery({ queryKey: ['employees'], queryFn: () => api.get('/admin/employees').then(r => r.data.data) });
  const siteQ   = useQuery({ queryKey: ['sites'],     queryFn: () => api.get('/admin/sites').then(r => r.data.data) });
  const punchQ  = useQuery({ queryKey: ['punches-today', today], queryFn: () => api.get('/admin/punches', { params: { date: today } }).then(r => r.data.data) });
  const pendingQ = useQuery({ queryKey: ['pending'],  queryFn: () => api.get('/admin/punches/pending').then(r => r.data.data) });

  const employees   = empQ.data?.employees ?? [];
  const sites       = siteQ.data ?? [];
  const punches     = punchQ.data?.punches ?? [];
  const pending     = pendingQ.data?.punches ?? [];

  const activeEmployees = employees.filter((e: any) => e.status === 'ACTIVE').length;
  const activeSites     = sites.filter((s: any) => s.status === 'ACTIVE').length;
  const todayIn         = punches.filter((p: any) => p.type === 'IN').length;
  const todayOut        = punches.filter((p: any) => p.type === 'OUT').length;
  const pendingCount    = pending.length;

  const stats = [
    { label: 'Active Employees', value: activeEmployees, icon: Users,        color: '#2563eb', bg: '#eff6ff' },
    { label: 'Active Sites',     value: activeSites,     icon: MapPin,       color: '#7c3aed', bg: '#f5f3ff' },
    { label: "Today's IN",       value: todayIn,         icon: TrendingUp,   color: '#16a34a', bg: '#f0fdf4' },
    { label: "Today's OUT",      value: todayOut,        icon: Clock,        color: '#ea580c', bg: '#fff7ed' },
    { label: 'Pending Approvals',value: pendingCount,    icon: AlertCircle,  color: '#ca8a04', bg: '#fefce8' },
    { label: 'Approved Today',   value: punches.filter((p: any) => p.approvalStatus === 'APPROVED').length, icon: CheckCircle, color: '#0891b2', bg: '#ecfeff' },
  ];

  const recent = [...punches].sort((a: any, b: any) => new Date(b.timestampServer).getTime() - new Date(a.timestampServer).getTime()).slice(0, 8);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
            <div style={{ background: bg, color }} className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0">
              <Icon size={20} />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending approvals */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 text-sm">Pending Approvals</h2>
            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">{pendingCount}</span>
          </div>
          <div className="divide-y divide-gray-50">
            {pending.length === 0
              ? <p className="text-sm text-gray-400 text-center py-8">No pending approvals</p>
              : pending.slice(0, 5).map((p: any) => (
                <div key={p.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{p.employee.name}</p>
                    <p className="text-xs text-gray-400">{p.employee.phone} · {formatTime(p.timestampServer)}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${p.type === 'IN' ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>{p.type}</span>
                </div>
              ))}
          </div>
          {pendingCount > 5 && (
            <div className="px-5 py-3 border-t border-gray-100">
              <a href="/punches" className="text-xs text-blue-600 hover:underline">View all {pendingCount} pending →</a>
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 text-sm">Recent Punches Today</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {punchQ.isLoading
              ? <p className="text-sm text-gray-400 text-center py-8">Loading…</p>
              : recent.length === 0
              ? <p className="text-sm text-gray-400 text-center py-8">No punches today</p>
              : recent.map((p: any) => (
                <div key={p.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{p.employee.name}</p>
                    <p className="text-xs text-gray-400">{p.site?.name ?? '—'} · {formatTime(p.timestampServer)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold ${p.type === 'IN' ? 'text-green-600' : 'text-orange-500'}`}>{p.type}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      p.approvalStatus === 'APPROVED' ? 'bg-green-50 text-green-600' :
                      p.approvalStatus === 'REJECTED' ? 'bg-red-50 text-red-600' :
                      'bg-yellow-50 text-yellow-600'}`}>{p.approvalStatus}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
