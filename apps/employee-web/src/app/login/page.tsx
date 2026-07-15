'use client';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api, saveTokens } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (phone.length !== 10 || password.length < 6) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/employee/login', { phone, password });
      const { accessToken, refreshToken } = res.data.data;
      saveTokens(accessToken, refreshToken);
      router.replace('/home');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Login failed. Check your details.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)',
        padding: '56px 28px 36px',
        color: '#fff',
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: 'rgba(255,255,255,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26, marginBottom: 20,
        }}>🏗️</div>
        <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.2, marginBottom: 6 }}>
          Buildacre<br />Workforce
        </div>
        <div style={{ fontSize: 14, opacity: 0.8 }}>Attendance & site management</div>
      </div>

      {/* Form */}
      <div style={{ flex: 1, padding: '32px 28px' }}>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Sign in</div>
        <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 28 }}>
          Use the phone and password given by your Admin
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>Mobile Number</label>
            <div style={{ position: 'relative' }}>
              <span style={prefixStyle}>+91</span>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                placeholder="9876543210"
                autoComplete="tel"
                style={{ ...inputStyle, paddingLeft: 52 }}
                required
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              style={inputStyle}
              required
            />
          </div>

          {error && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca',
              borderRadius: 10, padding: '10px 14px',
              color: '#dc2626', fontSize: 14,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || phone.length !== 10 || password.length < 6}
            style={{
              marginTop: 8,
              background: loading ? '#93c5fd' : '#1d4ed8',
              color: '#fff', border: 'none', borderRadius: 12,
              padding: '14px 0', fontSize: 16, fontWeight: 600,
              opacity: (phone.length !== 10 || password.length < 6) ? 0.5 : 1,
              transition: 'all 0.2s',
            }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p style={{ marginTop: 32, textAlign: 'center', fontSize: 12, color: '#9ca3af' }}>
          Forgot password? Contact your Admin to reset it.
        </p>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600,
  color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '13px 16px', border: '1.5px solid #e5e7eb',
  borderRadius: 10, fontSize: 16, background: '#fff', outline: 'none',
  WebkitAppearance: 'none',
};

const prefixStyle: React.CSSProperties = {
  position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
  color: '#6b7280', fontSize: 15, fontWeight: 500, pointerEvents: 'none',
};
