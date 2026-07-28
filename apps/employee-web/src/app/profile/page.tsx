'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BottomNav } from '@/components/BottomNav';
import { api, clearTokens } from '@/lib/api';
import { cache } from '@/lib/cache';

type Employee = {
  id: string;
  name: string;
  phone: string;
  gender: string | null;
  role: string;
  status: string;
  createdAt: string;
  monthlySalary: string | null;
  defaultSite: { id: string; name: string } | null;
};

function toLocalDateStr(d: Date = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

const GENDER_LABEL: Record<string, string> = {
  MALE: 'Male', FEMALE: 'Female', OTHER: 'Other',
};

function getInitials(name: string) {
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
}

function months(from: string) {
  const d = new Date(from);
  const now = new Date();
  return (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth();
}

export default function ProfilePage() {
  const router = useRouter();
  const [employee, setEmployee] = useState<Employee | null>(cache.get<Employee>('profile'));
  const [loading, setLoading]   = useState(!cache.get('profile'));

  // Gender edit
  const [editGender,  setEditGender]  = useState(false);
  const [selectedGender, setSelectedGender] = useState('');
  const [genderBusy,  setGenderBusy]  = useState(false);
  const [genderMsg,   setGenderMsg]   = useState('');

  async function saveGender() {
    if (!selectedGender) return;
    setGenderBusy(true); setGenderMsg('');
    try {
      const res = await api.patch('/employees/me', { gender: selectedGender });
      setEmployee(prev => prev ? { ...prev, gender: (res.data.data ?? res.data).gender } : prev);
      setEditGender(false);
      setGenderMsg('Gender updated!');
      setTimeout(() => setGenderMsg(''), 3000);
    } catch {
      setGenderMsg('Failed to update');
    } finally {
      setGenderBusy(false);
    }
  }


  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) { router.replace('/login'); return; }
    api.get('/employees/me')
      .then(r => {
        const emp = r.data.data ?? r.data;
        setEmployee(emp);
        cache.set('profile', emp);
      })
      .catch(() => router.replace('/login'))
      .finally(() => setLoading(false));
  }, [router]);


  // Payslip
  const [showPayslip, setShowPayslip] = useState(false);
  const [psYear,  setPsYear]  = useState(() => new Date().getFullYear());
  const [psMonth, setPsMonth] = useState(() => new Date().getMonth());
  const [psData,  setPsData]  = useState<{ punches: any[]; leaves: any[]; holidays: any[] } | null>(null);
  const [psBusy,  setPsBusy]  = useState(false);

  async function loadPayslip(y: number, m: number) {
    setPsBusy(true);
    const monthKey = `${y}-${String(m + 1).padStart(2,'0')}`;
    try {
      const [pRes, lRes, hRes] = await Promise.all([
        api.get('/punches/me', { params: { month: monthKey } }),
        api.get('/leaves/my-requests'),
        api.get('/holidays', { params: { year: String(y) } }),
      ]);
      setPsData({
        punches:  pRes.data.data?.punches ?? [],
        leaves:   lRes.data.data ?? lRes.data ?? [],
        holidays: hRes.data.data ?? hRes.data ?? [],
      });
    } finally {
      setPsBusy(false);
    }
  }

  function psNavPrev() {
    const nm = psMonth === 0 ? 11 : psMonth - 1;
    const ny = psMonth === 0 ? psYear - 1 : psYear;
    setPsMonth(nm); setPsYear(ny);
    loadPayslip(ny, nm);
  }
  function psNavNext() {
    const now = new Date();
    if (psYear === now.getFullYear() && psMonth === now.getMonth()) return;
    const nm = psMonth === 11 ? 0 : psMonth + 1;
    const ny = psMonth === 11 ? psYear + 1 : psYear;
    setPsMonth(nm); setPsYear(ny);
    loadPayslip(ny, nm);
  }

  function togglePayslip() {
    if (!showPayslip && !psData) loadPayslip(psYear, psMonth);
    setShowPayslip(v => !v);
  }

  function computePayslip() {
    if (!psData || !employee?.monthlySalary) return null;
    const monthlySalary = parseFloat(employee.monthlySalary);
    const lastDay = new Date(psYear, psMonth + 1, 0).getDate();

    // Working days (Mon-Sat)
    let workingDays = 0;
    for (let d = 1; d <= lastDay; d++) {
      if (new Date(psYear, psMonth, d).getDay() !== 0) workingDays++;
    }

    const holidaySet = new Set<string>();
    psData.holidays.forEach((h: any) => {
      const ds = h.date.slice(0, 10);
      if (ds >= monthStart && ds <= monthEnd) holidaySet.add(ds);
    });

    // Present days (approved IN punches)
    const presentSet = new Set<string>();
    psData.punches.forEach((p: any) => {
      if (p.type === 'IN' && p.approvalStatus === 'APPROVED') {
        const d = new Date(p.timestampServer);
        presentSet.add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
      }
    });

    // Leave days in this month
    const monthStart = `${psYear}-${String(psMonth+1).padStart(2,'0')}-01`;
    const monthEnd   = `${psYear}-${String(psMonth+1).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
    let leaveDays = 0;
    psData.leaves.forEach((lr: any) => {
      if (lr.status !== 'APPROVED') return;
      const cursor = new Date(lr.fromDate);
      const end    = new Date(lr.toDate);
      while (cursor <= end) {
        const ds = toLocalDateStr(cursor);
        if (ds >= monthStart && ds <= monthEnd) leaveDays++;
        cursor.setDate(cursor.getDate() + 1);
      }
    });

    const dailyRate     = monthlySalary / workingDays;
    const effectiveDays = Math.min(presentSet.size + leaveDays + holidaySet.size, workingDays);
    const absentDays    = Math.max(0, workingDays - presentSet.size - leaveDays);
    const earned        = Math.round(dailyRate * effectiveDays);

    return {
      monthlySalary, workingDays, presentDays: presentSet.size,
      leaveDays, holidays: holidaySet.size, absentDays, effectiveDays,
      dailyRate: Math.round(dailyRate), earned,
    };
  }

  function logout() {
    clearTokens();
    router.replace('/login');
  }

  const tenure = employee ? months(employee.createdAt) : 0;

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 36, height: 36, border: '3px solid #bfdbfe', borderTop: '3px solid #1d4ed8', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (!employee) return null;

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto', paddingBottom: 72, background: '#f8fafc' }}>

      {/* Header with avatar */}
      <div style={{ background: 'linear-gradient(135deg, #1d4ed8, #1e40af)', padding: '48px 20px 32px', textAlign: 'center', color: '#fff' }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26, fontWeight: 800, margin: '0 auto 12px',
          border: '3px solid rgba(255,255,255,0.35)',
        }}>
          {getInitials(employee.name)}
        </div>
        <div style={{ fontSize: 22, fontWeight: 700 }}>{employee.name}</div>
        <div style={{ fontSize: 13, opacity: 0.75, marginTop: 3 }}>{employee.phone}</div>
        {employee.defaultSite && (
          <div style={{ fontSize: 12, opacity: 0.65, marginTop: 4 }}>📍 {employee.defaultSite.name}</div>
        )}
      </div>

      {/* Tenure strip */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', background: '#fff', borderBottom: '1px solid #e5e7eb' }}>
        {[
          { label: 'Tenure',  value: tenure >= 12 ? `${Math.floor(tenure/12)}y ${tenure%12}m` : `${tenure}m` },
          { label: 'Role',    value: employee.role === 'SITE_MANAGER' ? 'Manager' : 'Employee' },
          { label: 'Status',  value: employee.status === 'ACTIVE' ? 'Active' : 'Inactive' },
        ].map(s => (
          <div key={s.label} style={{ padding: '12px 8px', textAlign: 'center', borderRight: '1px solid #f3f4f6' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{s.value}</div>
            <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2, fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '16px' }}>

        {/* Info card */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', overflow: 'hidden', marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '12px 16px', background: '#f9fafb', borderBottom: '1px solid #f3f4f6', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Personal Details
          </div>
          {[
            { label: 'Full Name', value: employee.name },
            { label: 'Phone',     value: employee.phone },
            { label: 'Site',      value: employee.defaultSite?.name ?? '—' },
            { label: 'Joined',    value: fmtDate(employee.createdAt) },
          ].map((row, i) => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #f9fafb' }}>
              <span style={{ fontSize: 13, color: '#6b7280' }}>{row.label}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{row.value}</span>
            </div>
          ))}

          {/* Gender — editable */}
          <div style={{ padding: '12px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#6b7280' }}>Gender</span>
              {!editGender ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                    {employee.gender ? GENDER_LABEL[employee.gender] ?? employee.gender : '—'}
                  </span>
                  <button onClick={() => { setSelectedGender(employee.gender ?? 'MALE'); setEditGender(true); setGenderMsg(''); }}
                    style={{ fontSize: 11, color: '#1d4ed8', background: '#eff6ff', border: 'none', padding: '3px 10px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                    Edit
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <select value={selectedGender} onChange={e => setSelectedGender(e.target.value)}
                    style={{ border: '1.5px solid #1d4ed8', borderRadius: 8, padding: '4px 8px', fontSize: 13, outline: 'none' }}>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                  <button onClick={saveGender} disabled={genderBusy}
                    style={{ fontSize: 12, color: '#fff', background: '#1d4ed8', border: 'none', padding: '4px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, opacity: genderBusy ? 0.7 : 1 }}>
                    {genderBusy ? '…' : 'Save'}
                  </button>
                  <button onClick={() => setEditGender(false)}
                    style={{ fontSize: 12, color: '#6b7280', background: '#f3f4f6', border: 'none', padding: '4px 10px', borderRadius: 8, cursor: 'pointer' }}>
                    ✕
                  </button>
                </div>
              )}
            </div>
            {genderMsg && <div style={{ fontSize: 12, color: '#15803d', marginTop: 4 }}>{genderMsg}</div>}
          </div>
        </div>

        {/* My Payslip */}
        {employee.monthlySalary && (
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', overflow: 'hidden', marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <button onClick={togglePayslip}
              style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>💰 My Payslip</span>
              <span style={{ fontSize: 18, color: '#9ca3af', transform: showPayslip ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>›</span>
            </button>

            {showPayslip && (
              <div style={{ borderTop: '1px solid #f3f4f6', padding: '12px 16px 16px' }}>
                {/* Month nav */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <button onClick={psNavPrev} style={{ border: 'none', background: '#f3f4f6', borderRadius: 8, padding: '6px 14px', fontSize: 18, cursor: 'pointer', color: '#374151', lineHeight: 1 }}>‹</button>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>
                    {new Date(psYear, psMonth).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                  </span>
                  <button onClick={psNavNext}
                    disabled={psYear === new Date().getFullYear() && psMonth === new Date().getMonth()}
                    style={{ border: 'none', background: '#f3f4f6', borderRadius: 8, padding: '6px 14px', fontSize: 18, cursor: 'pointer', color: '#374151', lineHeight: 1, opacity: (psYear === new Date().getFullYear() && psMonth === new Date().getMonth()) ? 0.35 : 1 }}>›</button>
                </div>

                {psBusy ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: '#9ca3af', fontSize: 13 }}>Loading…</div>
                ) : (() => {
                  const ps = computePayslip();
                  if (!ps) return <div style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '16px 0' }}>No data</div>;
                  return (
                    <>
                      {/* Earned badge */}
                      <div style={{ background: 'linear-gradient(135deg, #1d4ed8, #1e40af)', borderRadius: 14, padding: '16px', marginBottom: 12, textAlign: 'center', color: '#fff' }}>
                        <div style={{ fontSize: 11, opacity: 0.75, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Estimated Earned</div>
                        <div style={{ fontSize: 30, fontWeight: 800 }}>₹{ps.earned.toLocaleString('en-IN')}</div>
                        <div style={{ fontSize: 11, opacity: 0.65, marginTop: 4 }}>of ₹{ps.monthlySalary.toLocaleString('en-IN')} monthly</div>
                      </div>

                      {/* Attendance breakdown */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                        {[
                          { label: 'Present Days', value: ps.presentDays, color: '#15803d', bg: '#f0fdf4' },
                          { label: 'Leave Days',   value: ps.leaveDays,   color: '#0369a1', bg: '#f0f9ff' },
                          { label: 'Holidays',     value: ps.holidays,    color: '#7c3aed', bg: '#faf5ff' },
                          { label: 'Absent Days',  value: ps.absentDays,  color: '#dc2626', bg: '#fef2f2' },
                        ].map(s => (
                          <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: '10px 12px' }}>
                            <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
                            <div style={{ fontSize: 10, fontWeight: 600, color: s.color, opacity: 0.75, marginTop: 2 }}>{s.label}</div>
                          </div>
                        ))}
                      </div>

                      {/* Rate breakdown */}
                      <div style={{ background: '#f9fafb', borderRadius: 10, padding: '10px 12px', fontSize: 12, color: '#6b7280' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span>Daily Rate</span>
                          <span style={{ fontWeight: 600, color: '#374151' }}>₹{ps.dailyRate.toLocaleString('en-IN')}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span>Working Days</span>
                          <span style={{ fontWeight: 600, color: '#374151' }}>{ps.workingDays} days</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid #e5e7eb', marginTop: 2 }}>
                          <span style={{ fontWeight: 600 }}>Effective Days</span>
                          <span style={{ fontWeight: 700, color: '#1d4ed8' }}>{ps.effectiveDays} / {ps.workingDays}</span>
                        </div>
                      </div>

                      <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 8, textAlign: 'center', lineHeight: 1.5 }}>
                        Estimated based on attendance data. Actual payout may vary.
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* Logout */}
        <button onClick={logout}
          style={{ width: '100%', padding: '14px', borderRadius: 14, border: '1.5px solid #fee2e2', background: '#fff', color: '#dc2626', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
          Sign Out
        </button>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <BottomNav active="profile" />
    </div>
  );
}

