'use client';
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Umbrella, Plus, ChevronLeft, ChevronRight, Check, X, Clock,
  Phone, Calendar, Edit2, AlertCircle, RefreshCw, CheckCircle2,
  XCircle, Users, BadgeCheck, Layers, Wallet,
} from 'lucide-react';
import { api } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface LeaveType {
  id: string;
  name: string;
  daysEntitled: number;
  scope: 'ALL' | 'MALE_ONLY' | 'FEMALE_ONLY' | 'CUSTOM';
  paid: boolean;
  carryForward: boolean;
  eligibilityMinMonths: number;
  approvalMode: 'AUTO' | 'MANUAL';
  maxConsecutiveDays: number | null;
  accrual: 'MONTHLY' | 'ANNUAL';
  isActive: boolean;
  _count: { requests: number };
}

interface LeaveRequest {
  id: string;
  fromDate: string;
  toDate: string;
  reason: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason: string | null;
  approvedAt: string | null;
  createdAt: string;
  employee: { id: string; name: string; phone: string };
  leaveType: { id: string; name: string; paid: boolean };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function diffDays(from: string, to: string) {
  const a = new Date(from), b = new Date(to);
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtShort(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const SCOPE_LABEL: Record<string, string> = {
  ALL: 'All employees', MALE_ONLY: 'Male only',
  FEMALE_ONLY: 'Female only', CUSTOM: 'Custom',
};

// ─── Shared Modal ─────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-800 text-lg">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ─── Leave Type Form Modal ────────────────────────────────────────────────────

function LeaveTypeModal({
  initial, onClose, onSaved,
}: {
  initial?: LeaveType | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    daysEntitled: initial?.daysEntitled ?? 1,
    scope: initial?.scope ?? 'ALL',
    paid: initial?.paid ?? true,
    carryForward: initial?.carryForward ?? false,
    eligibilityMinMonths: initial?.eligibilityMinMonths ?? 0,
    approvalMode: initial?.approvalMode ?? 'MANUAL',
    maxConsecutiveDays: initial?.maxConsecutiveDays ?? '',
    accrual: initial?.accrual ?? 'ANNUAL',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    if (!form.name.trim()) return setError('Name is required');
    setSaving(true); setError('');
    try {
      const payload = { ...form, maxConsecutiveDays: form.maxConsecutiveDays || null };
      if (initial) {
        await api.patch(`/admin/leaves/types/${initial.id}`, payload);
      } else {
        await api.post('/admin/leaves/types', payload);
      }
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={initial ? 'Edit Leave Type' : 'New Leave Type'} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Name</label>
          <input className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Casual Leave" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Days Entitled</label>
            <input type="number" min="0.5" step="0.5"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.daysEntitled} onChange={e => setForm(f => ({ ...f, daysEntitled: parseFloat(e.target.value) }))} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Accrual</label>
            <select className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.accrual} onChange={e => setForm(f => ({ ...f, accrual: e.target.value as any }))}>
              <option value="ANNUAL">Annual</option>
              <option value="MONTHLY">Monthly</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Scope</label>
            <select className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.scope} onChange={e => setForm(f => ({ ...f, scope: e.target.value as any }))}>
              <option value="ALL">All employees</option>
              <option value="MALE_ONLY">Male only</option>
              <option value="FEMALE_ONLY">Female only</option>
              <option value="CUSTOM">Custom</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Approval</label>
            <select className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.approvalMode} onChange={e => setForm(f => ({ ...f, approvalMode: e.target.value as any }))}>
              <option value="MANUAL">Manual</option>
              <option value="AUTO">Auto-approve</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Min. Eligibility (months)</label>
            <input type="number" min="0"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.eligibilityMinMonths} onChange={e => setForm(f => ({ ...f, eligibilityMinMonths: parseInt(e.target.value) }))} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Max Consecutive Days</label>
            <input type="number" min="1" placeholder="No limit"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.maxConsecutiveDays} onChange={e => setForm(f => ({ ...f, maxConsecutiveDays: e.target.value }))} />
          </div>
        </div>

        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.paid} onChange={e => setForm(f => ({ ...f, paid: e.target.checked }))}
              className="w-4 h-4 rounded accent-blue-600" />
            <span className="text-sm text-slate-700">Paid leave</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.carryForward} onChange={e => setForm(f => ({ ...f, carryForward: e.target.checked }))}
              className="w-4 h-4 rounded accent-blue-600" />
            <span className="text-sm text-slate-700">Carry forward</span>
          </label>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button onClick={save} disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {saving ? 'Saving…' : initial ? 'Save Changes' : 'Create Type'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Grant Leave Modal (admin creates on behalf of employee) ─────────────────

function GrantLeaveModal({
  leaveTypes, onClose, onSaved,
}: {
  leaveTypes: LeaveType[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    employeeSearch: '',
    employeeId: '',
    leaveTypeId: leaveTypes[0]?.id ?? '',
    fromDate: '',
    toDate: '',
    reason: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { data: employees } = useQuery({
    queryKey: ['employees-search', form.employeeSearch],
    queryFn: async () => {
      if (!form.employeeSearch || form.employeeSearch.length < 2) return [];
      const r = await api.get('/admin/employees', { params: { search: form.employeeSearch, status: 'ACTIVE' } });
      return r.data.data?.employees ?? r.data.employees ?? [];
    },
  });

  async function save() {
    if (!form.employeeId) return setError('Select an employee');
    if (!form.leaveTypeId) return setError('Select a leave type');
    if (!form.fromDate || !form.toDate) return setError('Select date range');
    setSaving(true); setError('');
    try {
      await api.post('/admin/leaves/requests', form);
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Grant Leave" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Employee</label>
          <input className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Search by name…"
            value={form.employeeSearch}
            onChange={e => setForm(f => ({ ...f, employeeSearch: e.target.value, employeeId: '' }))} />
          {employees && employees.length > 0 && !form.employeeId && (
            <div className="border border-slate-200 rounded-xl mt-1 overflow-hidden shadow-sm">
              {employees.slice(0, 6).map((e: any) => (
                <button key={e.id} onClick={() => setForm(f => ({ ...f, employeeId: e.id, employeeSearch: e.name }))}
                  className="w-full text-left px-3 py-2.5 text-sm hover:bg-blue-50 flex items-center justify-between border-b last:border-0 border-slate-100">
                  <span className="font-medium text-slate-800">{e.name}</span>
                  <span className="text-slate-400 text-xs">{e.phone}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Leave Type</label>
          <select className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.leaveTypeId} onChange={e => setForm(f => ({ ...f, leaveTypeId: e.target.value }))}>
            {leaveTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">From</label>
            <input type="date"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.fromDate} onChange={e => setForm(f => ({ ...f, fromDate: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">To</label>
            <input type="date"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.toDate} onChange={e => setForm(f => ({ ...f, toDate: e.target.value }))} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Reason (optional)</label>
          <textarea rows={2}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button onClick={save} disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors">
            {saving ? 'Granting…' : 'Grant Leave'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Reject Modal ─────────────────────────────────────────────────────────────

function RejectModal({
  request, onClose, onRejected,
}: {
  request: LeaveRequest;
  onClose: () => void;
  onRejected: () => void;
}) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  async function reject() {
    if (!reason.trim()) return;
    setSaving(true);
    try {
      await api.post(`/admin/leaves/requests/${request.id}/reject`, { reason });
      onRejected();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Reject Leave Request" onClose={onClose}>
      <div className="space-y-4">
        <div className="bg-slate-50 rounded-xl p-4">
          <p className="font-semibold text-slate-800">{request.employee.name}</p>
          <p className="text-sm text-slate-500 mt-0.5">
            {request.leaveType.name} · {fmtShort(request.fromDate)} – {fmtShort(request.toDate)}
            {' '}({diffDays(request.fromDate, request.toDate)} day{diffDays(request.fromDate, request.toDate) !== 1 ? 's' : ''})
          </p>
          {request.reason && <p className="text-sm text-slate-600 mt-2 italic">"{request.reason}"</p>}
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Reason for rejection</label>
          <textarea rows={3} autoFocus
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
            placeholder="Explain why this leave is being rejected…"
            value={reason} onChange={e => setReason(e.target.value)} />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button onClick={reject} disabled={saving || !reason.trim()}
            className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors">
            {saving ? 'Rejecting…' : 'Reject'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Leave Requests Tab ───────────────────────────────────────────────────────

function RequestsTab({ leaveTypes }: { leaveTypes: LeaveType[] }) {
  const qc = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [rejectTarget, setRejectTarget] = useState<LeaveRequest | null>(null);
  const [showGrant, setShowGrant] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);

  const params: Record<string, any> = { year: String(year), month: String(month) };
  if (statusFilter !== 'ALL') params.status = statusFilter;

  const { data: requests = [], isLoading, refetch } = useQuery<LeaveRequest[]>({
    queryKey: ['leave-requests', year, month, statusFilter],
    queryFn: async () => {
      const r = await api.get('/admin/leaves/requests', { params });
      return r.data.data ?? r.data;
    },
  });

  async function approve(req: LeaveRequest) {
    setApproving(req.id);
    try {
      await api.post(`/admin/leaves/requests/${req.id}/approve`);
      qc.invalidateQueries({ queryKey: ['leave-requests'] });
    } finally {
      setApproving(null);
    }
  }

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  const pending = requests.filter(r => r.status === 'PENDING').length;

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        {/* Month nav */}
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-1">
          <button onClick={prevMonth} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <ChevronLeft size={16} />
          </button>
          <span className="px-3 text-sm font-semibold text-slate-700 min-w-[110px] text-center">
            {MONTHS[month - 1]} {year}
          </span>
          <button onClick={nextMonth} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
          {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === s
                  ? s === 'PENDING' ? 'bg-amber-500 text-white shadow-sm'
                  : s === 'APPROVED' ? 'bg-emerald-500 text-white shadow-sm'
                  : s === 'REJECTED' ? 'bg-red-500 text-white shadow-sm'
                  : 'bg-white text-slate-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}>
              {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
              {s === 'PENDING' && pending > 0 && (
                <span className="ml-1.5 bg-amber-700/30 text-amber-100 rounded-full px-1.5 py-0.5 text-[10px]">{pending}</span>
              )}
            </button>
          ))}
        </div>

        <button onClick={() => setShowGrant(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm shadow-emerald-900/20">
          <Plus size={15} />Grant Leave
        </button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <RefreshCw size={20} className="animate-spin text-slate-400" />
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Umbrella size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No leave requests for {MONTHS[month - 1]} {year}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wide">
                <th className="text-left px-5 py-3">Employee</th>
                <th className="text-left px-4 py-3">Leave Type</th>
                <th className="text-left px-4 py-3">Duration</th>
                <th className="text-left px-4 py-3">Reason</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map(req => {
                const days = diffDays(req.fromDate, req.toDate);
                return (
                  <tr key={req.id} className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-800">{req.employee.name}</div>
                      <a href={`tel:${req.employee.phone}`}
                        className="text-xs text-slate-400 hover:text-blue-600 flex items-center gap-1 mt-0.5 w-fit">
                        <Phone size={10} />{req.employee.phone}
                      </a>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${req.leaveType.paid ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                        <span className="text-slate-700">{req.leaveType.name}</span>
                      </span>
                      <div className="text-[11px] text-slate-400 mt-0.5">{req.leaveType.paid ? 'Paid' : 'Unpaid'}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-slate-800">{days} day{days !== 1 ? 's' : ''}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                        <Calendar size={10} />
                        {fmtShort(req.fromDate)}
                        {days > 1 && <> – {fmtShort(req.toDate)}</>}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 max-w-[200px]">
                      {req.reason
                        ? <span className="text-slate-600 text-xs line-clamp-2">{req.reason}</span>
                        : <span className="text-slate-300 text-xs italic">No reason given</span>}
                      {req.rejectionReason && (
                        <div className="text-xs text-red-500 mt-1 flex items-start gap-1">
                          <AlertCircle size={10} className="mt-0.5 shrink-0" />
                          {req.rejectionReason}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={req.status} />
                      {req.approvedAt && (
                        <div className="text-[10px] text-slate-400 mt-1">{fmtDate(req.approvedAt)}</div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {req.status === 'PENDING' && (
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={() => approve(req)}
                            disabled={approving === req.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-semibold hover:bg-emerald-100 disabled:opacity-50 transition-colors">
                            {approving === req.id ? <RefreshCw size={11} className="animate-spin" /> : <Check size={11} />}
                            Approve
                          </button>
                          <button onClick={() => setRejectTarget(req)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100 transition-colors">
                            <X size={11} />Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {rejectTarget && (
        <RejectModal
          request={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onRejected={() => {
            setRejectTarget(null);
            qc.invalidateQueries({ queryKey: ['leave-requests'] });
          }}
        />
      )}

      {showGrant && (
        <GrantLeaveModal
          leaveTypes={leaveTypes}
          onClose={() => setShowGrant(false)}
          onSaved={() => {
            setShowGrant(false);
            qc.invalidateQueries({ queryKey: ['leave-requests'] });
          }}
        />
      )}
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: 'PENDING' | 'APPROVED' | 'REJECTED' }) {
  if (status === 'PENDING')  return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-[11px] font-semibold border border-amber-100"><Clock size={10} />Pending</span>;
  if (status === 'APPROVED') return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[11px] font-semibold border border-emerald-100"><CheckCircle2 size={10} />Approved</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-600 rounded-full text-[11px] font-semibold border border-red-100"><XCircle size={10} />Rejected</span>;
}

// ─── Leave Types Tab ──────────────────────────────────────────────────────────

function TypesTab() {
  const qc = useQueryClient();
  const [editTarget, setEditTarget] = useState<LeaveType | null | undefined>(undefined);
  const [showCreate, setShowCreate] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  const { data: types = [], isLoading } = useQuery<LeaveType[]>({
    queryKey: ['leave-types', showInactive],
    queryFn: async () => {
      const r = await api.get('/admin/leaves/types', { params: { includeInactive: showInactive ? 'true' : 'false' } });
      return r.data.data ?? r.data;
    },
  });

  async function toggleActive(type: LeaveType) {
    await api.patch(`/admin/leaves/types/${type.id}`, { isActive: !type.isActive });
    qc.invalidateQueries({ queryKey: ['leave-types'] });
  }

  const SCOPE_COLOR: Record<string, string> = {
    ALL: 'bg-blue-50 text-blue-700 border-blue-100',
    MALE_ONLY: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    FEMALE_ONLY: 'bg-pink-50 text-pink-700 border-pink-100',
    CUSTOM: 'bg-violet-50 text-violet-700 border-violet-100',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)}
            className="w-4 h-4 rounded accent-blue-600" />
          <span className="text-sm text-slate-600">Show inactive types</span>
        </label>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm shadow-blue-900/20">
          <Plus size={15} />New Leave Type
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <RefreshCw size={20} className="animate-spin text-slate-400" />
        </div>
      ) : types.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Layers size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No leave types yet</p>
          <p className="text-sm mt-1">Create your first leave type to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {types.map(t => (
            <div key={t.id}
              className={`bg-white rounded-2xl border p-5 shadow-sm transition-all ${t.isActive ? 'border-slate-100' : 'border-slate-100 opacity-60'}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-slate-800 text-base">{t.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${SCOPE_COLOR[t.scope]}`}>
                      {SCOPE_LABEL[t.scope]}
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${t.paid ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                      {t.paid ? 'Paid' : 'Unpaid'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setEditTarget(t)}
                    className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-700">
                    <Edit2 size={14} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-slate-50 rounded-xl p-3">
                  <div className="text-2xl font-bold text-blue-600">{t.daysEntitled}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">days / {t.accrual.toLowerCase()}</div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <div className="text-2xl font-bold text-slate-700">{t._count.requests}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">total requests</div>
                </div>
              </div>

              <div className="space-y-1.5 mb-4">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Approval</span>
                  <span className="font-medium text-slate-700">{t.approvalMode === 'AUTO' ? 'Auto-approve' : 'Manual'}</span>
                </div>
                {t.eligibilityMinMonths > 0 && (
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Min. service</span>
                    <span className="font-medium text-slate-700">{t.eligibilityMinMonths} months</span>
                  </div>
                )}
                {t.maxConsecutiveDays && (
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Max consecutive</span>
                    <span className="font-medium text-slate-700">{t.maxConsecutiveDays} days</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Carry forward</span>
                  <span className={`font-medium ${t.carryForward ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {t.carryForward ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <button onClick={() => toggleActive(t)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                    t.isActive
                      ? 'text-red-500 hover:bg-red-50'
                      : 'text-emerald-600 hover:bg-emerald-50'
                  }`}>
                  {t.isActive ? 'Deactivate' : 'Activate'}
                </button>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${t.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                  {t.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {(showCreate || editTarget !== undefined) && (
        <LeaveTypeModal
          initial={showCreate ? null : editTarget}
          onClose={() => { setShowCreate(false); setEditTarget(undefined); }}
          onSaved={() => {
            setShowCreate(false);
            setEditTarget(undefined);
            qc.invalidateQueries({ queryKey: ['leave-types'] });
          }}
        />
      )}
    </div>
  );
}

// ─── Balances Tab ─────────────────────────────────────────────────────────────

interface LeaveBalance {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  year: number;
  credited: number;
  used: number;
  available: number;
  employee: { id: string; name: string; phone: string };
  leaveType: { id: string; name: string; paid: boolean };
}

function BalancesTab({ leaveTypes }: { leaveTypes: LeaveType[] }) {
  const qc = useQueryClient();
  const year = new Date().getFullYear();
  const [empFilter, setEmpFilter]     = useState('');
  const [typeFilter, setTypeFilter]   = useState('');
  const [adjustEmp, setAdjustEmp]     = useState('');
  const [adjustType, setAdjustType]   = useState('');
  const [adjustAmt, setAdjustAmt]     = useState('');
  const [showAdjust, setShowAdjust]   = useState(false);
  const [adjustBusy, setAdjustBusy]   = useState(false);
  const [adjustErr, setAdjustErr]     = useState('');

  const empQ = useQuery({
    queryKey: ['employees-list'],
    queryFn: () => api.get('/admin/employees').then(r => (r.data.data ?? r.data).employees ?? r.data.data ?? []),
  });
  const balQ = useQuery<LeaveBalance[]>({
    queryKey: ['leave-balances', year],
    queryFn: () => api.get('/admin/leaves/balances', { params: { year } }).then(r => r.data.data ?? r.data),
  });

  const employees: any[] = empQ.data ?? [];
  const balances = (balQ.data ?? []).filter(b => {
    if (empFilter  && b.employee.name.toLowerCase().indexOf(empFilter.toLowerCase()) === -1) return false;
    if (typeFilter && b.leaveTypeId !== typeFilter) return false;
    return true;
  });

  // Group by employee for summary view
  const byEmployee = useMemo(() => {
    const map = new Map<string, { emp: LeaveBalance['employee']; rows: LeaveBalance[] }>();
    for (const b of balances) {
      if (!map.has(b.employeeId)) map.set(b.employeeId, { emp: b.employee, rows: [] });
      map.get(b.employeeId)!.rows.push(b);
    }
    return Array.from(map.values()).sort((a, b) => a.emp.name.localeCompare(b.emp.name));
  }, [balances]);

  async function submitAdjust() {
    if (!adjustEmp || !adjustType || !adjustAmt) return setAdjustErr('All fields required');
    const credit = parseFloat(adjustAmt);
    if (isNaN(credit)) return setAdjustErr('Invalid amount');
    setAdjustBusy(true); setAdjustErr('');
    try {
      await api.post('/admin/leaves/balances/adjust', { employeeId: adjustEmp, leaveTypeId: adjustType, credit });
      qc.invalidateQueries({ queryKey: ['leave-balances'] });
      setShowAdjust(false); setAdjustEmp(''); setAdjustType(''); setAdjustAmt('');
    } catch (e: any) {
      setAdjustErr(e?.response?.data?.message ?? 'Failed');
    } finally { setAdjustBusy(false); }
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <input value={empFilter} onChange={e => setEmpFilter(e.target.value)}
          placeholder="Search employee…"
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 w-52" />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All leave types</option>
          {leaveTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <div className="ml-auto">
          <button onClick={() => setShowAdjust(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm shadow-blue-200">
            <Plus size={14} /> Adjust Balance
          </button>
        </div>
      </div>

      {balQ.isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 flex items-center justify-center h-40 text-slate-400 text-sm">Loading…</div>
      ) : byEmployee.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 flex flex-col items-center justify-center h-40 text-slate-400">
          <Wallet size={32} className="opacity-20 mb-2" />
          <p className="text-sm font-medium">No balances yet — accrual runs on the 1st of each month</p>
          <p className="text-xs mt-1 text-slate-300">You can manually credit balances using "Adjust Balance"</p>
        </div>
      ) : (
        <div className="space-y-3">
          {byEmployee.map(({ emp, rows }) => (
            <div key={emp.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              {/* Employee header */}
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                  {emp.name[0]?.toUpperCase()}
                </div>
                <div>
                  <div className="font-semibold text-slate-900 text-sm">{emp.name}</div>
                  <div className="text-xs text-slate-400">{emp.phone}</div>
                </div>
              </div>
              {/* Balance rows */}
              <div className="divide-y divide-slate-50">
                {rows.map(b => {
                  const pct = b.credited > 0 ? Math.min(100, (b.used / b.credited) * 100) : 0;
                  const color = b.available === 0 ? '#dc2626' : b.available < 2 ? '#d97706' : '#16a34a';
                  return (
                    <div key={b.id} className="px-5 py-3.5 flex items-center gap-4">
                      <div className="w-36 shrink-0">
                        <span className="text-sm font-semibold text-slate-800">{b.leaveType.name}</span>
                        {b.leaveType.paid && <span className="ml-2 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">Paid</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                        </div>
                      </div>
                      <div className="flex items-center gap-5 text-sm shrink-0">
                        <div className="text-center">
                          <div className="font-bold text-slate-700">{b.credited}</div>
                          <div className="text-[10px] text-slate-400 font-semibold">Credited</div>
                        </div>
                        <div className="text-center">
                          <div className="font-bold text-slate-500">{b.used}</div>
                          <div className="text-[10px] text-slate-400 font-semibold">Used</div>
                        </div>
                        <div className="text-center w-16">
                          <div className="font-bold text-lg" style={{ color }}>{b.available}</div>
                          <div className="text-[10px] text-slate-400 font-semibold">Avail.</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Adjust Balance modal */}
      {showAdjust && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-bold text-slate-900 text-lg mb-5">Adjust Leave Balance</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Employee</label>
                <select value={adjustEmp} onChange={e => setAdjustEmp(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select employee…</option>
                  {employees.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Leave Type</label>
                <select value={adjustType} onChange={e => setAdjustType(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select leave type…</option>
                  {leaveTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Days (negative to deduct)</label>
                <input type="number" step="0.5" value={adjustAmt} onChange={e => setAdjustAmt(e.target.value)}
                  placeholder="e.g. 1.5 or -1"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {adjustErr && <p className="text-red-500 text-xs">{adjustErr}</p>}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setShowAdjust(false); setAdjustErr(''); }}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50">Cancel</button>
              <button onClick={submitAdjust} disabled={adjustBusy}
                className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50">
                {adjustBusy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LeavesPage() {
  const [tab, setTab] = useState<'requests' | 'types' | 'balances'>('requests');

  const { data: leaveTypes = [] } = useQuery<LeaveType[]>({
    queryKey: ['leave-types-active'],
    queryFn: async () => {
      const r = await api.get('/admin/leaves/types');
      return r.data.data ?? r.data;
    },
  });

  // Count pending requests for badge
  const { data: pendingRequests = [] } = useQuery<LeaveRequest[]>({
    queryKey: ['leave-requests-pending-count'],
    queryFn: async () => {
      const r = await api.get('/admin/leaves/requests', { params: { status: 'PENDING' } });
      return r.data.data ?? r.data;
    },
    refetchInterval: 30000,
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-linear-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-lg shadow-purple-900/20">
              <Umbrella size={16} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Leave Management</h1>
          </div>
          <p className="text-slate-500 text-sm ml-12">Manage leave types and employee leave requests</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <SummaryCard
          icon={<Umbrella size={16} />}
          label="Leave Types"
          value={leaveTypes.length}
          color="from-violet-500 to-purple-600"
        />
        <SummaryCard
          icon={<Clock size={16} />}
          label="Pending"
          value={pendingRequests.length}
          color="from-amber-400 to-orange-500"
          alert={pendingRequests.length > 0}
        />
        <SummaryCard
          icon={<CheckCircle2 size={16} />}
          label="Leave Types Active"
          value={leaveTypes.filter(t => t.isActive).length}
          color="from-emerald-400 to-teal-500"
        />
        <SummaryCard
          icon={<BadgeCheck size={16} />}
          label="Paid Types"
          value={leaveTypes.filter(t => t.paid).length}
          color="from-blue-500 to-blue-600"
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 w-fit mb-6">
        <button onClick={() => setTab('requests')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            tab === 'requests' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}>
          <Users size={14} />
          Requests
          {pendingRequests.length > 0 && (
            <span className="bg-amber-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {pendingRequests.length > 9 ? '9+' : pendingRequests.length}
            </span>
          )}
        </button>
        <button onClick={() => setTab('types')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            tab === 'types' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}>
          <Layers size={14} />
          Leave Types
        </button>
        <button onClick={() => setTab('balances')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            tab === 'balances' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}>
          <Wallet size={14} />
          Balances
        </button>
      </div>

      {tab === 'requests'  && <RequestsTab leaveTypes={leaveTypes} />}
      {tab === 'types'     && <TypesTab />}
      {tab === 'balances'  && <BalancesTab leaveTypes={leaveTypes} />}
    </div>
  );
}

function SummaryCard({
  icon, label, value, color, alert = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  alert?: boolean;
}) {
  return (
    <div className={`relative bg-linear-to-br ${color} rounded-2xl p-4 text-white shadow-sm overflow-hidden`}>
      <div className="flex items-center justify-between mb-3">
        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">{icon}</div>
        {alert && (
          <span className="flex w-2 h-2">
            <span className="animate-ping absolute w-2 h-2 rounded-full bg-white opacity-75" />
            <span className="w-2 h-2 rounded-full bg-white" />
          </span>
        )}
      </div>
      <div className="text-2xl font-bold mb-0.5">{value}</div>
      <div className="text-white/70 text-xs font-medium">{label}</div>
    </div>
  );
}
