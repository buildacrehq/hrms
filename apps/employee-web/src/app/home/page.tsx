'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api, clearTokens } from '@/lib/api';

type Employee = {
  id: string; name: string; phone: string; defaultSite?: { id: string; name: string } | null;
};
type PunchType = 'IN' | 'OUT';
type PunchStep = 'idle' | 'camera' | 'detecting' | 'gps' | 'submitting' | 'done';
type MonthStats = { present: number; absent: number; pending: number; workingDays: number };

function getInitials(name: string) {
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
}
function formatTime(d: Date) {
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}
function formatDate(d: Date) {
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
}
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
function isToday(isoStr: string) {
  const d = new Date(isoStr);
  const t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
      { headers: { 'User-Agent': 'BA-Workforce/1.0', 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    const addr = data.address ?? {};
    const parts: string[] = [];
    for (const key of ['amenity', 'house_number', 'road', 'suburb', 'city', 'town', 'village']) {
      const v = addr[key];
      if (v && !parts.includes(v)) parts.push(v);
      if (parts.length >= 4) break;
    }
    let full = parts.join(', ');
    if (addr.postcode) full += ` - ${addr.postcode}`;
    if (addr.state && !full.includes(addr.state)) full += `, ${addr.state}`;
    return full || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((res, rej) =>
    canvas.toBlob(b => (b ? res(b) : rej(new Error('Canvas empty'))), 'image/jpeg', 0.85)
  );
}

// Returns a FaceDetector instance, or null if the API is unavailable.
function makeFaceDetector(): any | null {
  if (!('FaceDetector' in window)) return null;
  try { return new (window as any).FaceDetector({ maxDetectedFaces: 1 }); }
  catch { return null; }
}

export default function HomePage() {
  const router = useRouter();
  const [employee, setEmployee]   = useState<Employee | null>(null);
  const [loading, setLoading]     = useState(true);
  const [now, setNow]             = useState(new Date());
  const [nextPunch, setNextPunch] = useState<PunchType>('IN');
  const [step, setStep]           = useState<PunchStep>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError]         = useState('');
  const [faceRequired, setFaceRequired] = useState(true);

  const videoRef     = useRef<HTMLVideoElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const streamRef    = useRef<MediaStream | null>(null);
  const capturingRef = useRef(false);   // prevents double-tap
  const doneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const installRef   = useRef<any>(null); // beforeinstallprompt event

  const [monthStats, setMonthStats] = useState<MonthStats | null>(null);
  const [installReady, setInstallReady] = useState(false);
  // null = API not available on device, true/false = live detection result
  const [faceInFrame, setFaceInFrame] = useState<boolean | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    api.get('/employees/me')
      .then(r => { setEmployee(r.data.data ?? r.data); setLoading(false); })
      .catch(() => { clearTokens(); router.replace('/login'); });

    api.get('/settings/mobile')
      .then(r => {
        const d = r.data.data ?? r.data;
        setFaceRequired((d.require_face_detection ?? 'true') === 'true');
      })
      .catch(() => {});

    // Only carry over the last punch state if it happened TODAY
    api.get('/punches/my/last')
      .then(r => {
        const last = r.data.data;
        if (last?.type === 'IN' && isToday(last.timestampServer)) setNextPunch('OUT');
      })
      .catch(() => {});

    // Monthly attendance summary
    const d = new Date();
    const monthKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    api.get('/punches/me', { params: { month: monthKey } })
      .then(r => {
        const punches: any[] = r.data.punches ?? [];
        const presentSet = new Set<string>();
        let pending = 0;
        punches.forEach((p: any) => {
          const ds = new Date(p.timestampServer).toISOString().slice(0, 10);
          if (p.type === 'IN' && p.approvalStatus === 'APPROVED') presentSet.add(ds);
          if (p.approvalStatus === 'PENDING') pending++;
        });
        const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        let workingDays = 0;
        for (let i = 1; i <= d.getDate(); i++) {
          if (new Date(d.getFullYear(), d.getMonth(), i).getDay() !== 0) workingDays++;
        }
        setMonthStats({ present: presentSet.size, absent: Math.max(0, workingDays - presentSet.size), pending, workingDays });
      })
      .catch(() => {});
  }, [router]);

  // Capture beforeinstallprompt for Add to Home Screen
  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); installRef.current = e; setInstallReady(true); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Live face detection loop — runs every 600ms while camera is active
  useEffect(() => {
    if (step !== 'camera') { setFaceInFrame(null); return; }
    const detector = makeFaceDetector();
    if (!detector) { setFaceInFrame(null); return; } // API not available — can't enforce
    let active = true;
    async function loop() {
      while (active) {
        const video = videoRef.current;
        if (video && video.readyState >= 2) {
          try {
            const faces = await detector.detect(video);
            if (active) setFaceInFrame(faces.length > 0);
          } catch {
            if (active) setFaceInFrame(null); // API broke mid-session
            break;
          }
        }
        await new Promise(r => setTimeout(r, 600));
      }
    }
    loop();
    return () => { active = false; };
  }, [step]);

  // Clean up camera stream and pending timer on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (doneTimerRef.current) clearTimeout(doneTimerRef.current);
    };
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startCamera = useCallback(async () => {
    setError('');
    capturingRef.current = false;
    setStep('camera');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      const denied = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError';
      setError(
        denied
          ? '📷 Camera access is required to punch. Tap Allow when your browser asks, or go to Settings → Site Permissions → Camera → Allow.'
          : 'Camera not available. Please check your device.'
      );
      setStep('idle');
    }
  }, []);

  const capture = useCallback(async () => {
    if (capturingRef.current) return;   // prevent double-tap
    if (!videoRef.current || !canvasRef.current) return;
    capturingRef.current = true;

    // Capture frame to canvas (synchronous)
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 640;
    const ctx = canvas.getContext('2d')!;
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Block immediately if live detection says no face (API available and confirmed absent)
    if (faceRequired && faceInFrame === false) {
      setError('No face detected. Look directly at the camera and try again.');
      capturingRef.current = false;
      return;
    }

    // Hide camera immediately — frame is on canvas
    setStep('detecting');
    setStatusMsg('Verifying…');
    stopCamera();

    // Final face check on the captured frame (catches edge-case where face disappeared between loop tick and shutter)
    if (faceRequired && faceInFrame !== null) {
      const detector = makeFaceDetector();
      if (detector) {
        try {
          const faces = await detector.detect(canvas);
          if (faces.length === 0) {
            setError('No face detected. Look directly at the camera and try again.');
            setStep('idle');
            capturingRef.current = false;
            return;
          }
        } catch { /* API error — let punch through, admin reviews photo */ }
      }
    }

    // ── GPS ──
    setStep('gps');
    setStatusMsg('Getting location…');
    let lat = 0, lng = 0, accuracy = 0, address = '';
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 15000 })
      );
      lat      = pos.coords.latitude;
      lng      = pos.coords.longitude;
      accuracy = pos.coords.accuracy;
      address  = await reverseGeocode(lat, lng);
    } catch (err: any) {
      const denied = err?.code === 1;
      setError(
        denied
          ? '📍 Location access is required. Tap Allow when your browser asks, or go to Settings → Site Permissions → Location → Allow.'
          : 'Could not get location. Make sure GPS is turned on and try again.'
      );
      setStep('idle');
      capturingRef.current = false;
      return;
    }

    // ── Upload photo ──
    setStep('submitting');
    setStatusMsg('Uploading photo…');
    let photoKey = '';
    try {
      const blob     = await canvasToBlob(canvas);
      const urlRes   = await api.post('/punches/upload-url', { type: nextPunch });
      const { uploadUrl, uploadToken, photoKey: key } = urlRes.data.data;
      photoKey = key;
      await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg', Authorization: `Bearer ${uploadToken}` },
        body: blob,
      });
    } catch {
      photoKey = ''; // allow punch without photo; API setting enforces requirement
    }

    // ── Submit punch ──
    setStatusMsg('Submitting…');
    try {
      await api.post('/punches', {
        type: nextPunch,
        lat, long: lng, accuracy, address,
        timestampDevice: new Date().toISOString(),
        photoKey,
      });
      const wasIn = nextPunch === 'IN';
      setNextPunch(wasIn ? 'OUT' : 'IN');
      setStep('done');
      setStatusMsg(`Punched ${wasIn ? 'IN' : 'OUT'} successfully!`);
      doneTimerRef.current = setTimeout(() => {
        setStep('idle');
        setStatusMsg('');
        doneTimerRef.current = null;
      }, 3500);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to submit. Please try again.');
      setStep('idle');
    }
    capturingRef.current = false;
  }, [faceRequired, nextPunch, stopCamera]);

  const cancel = useCallback(() => {
    stopCamera();
    setStep('idle');
    setError('');
    capturingRef.current = false;
  }, [stopCamera]);

  if (loading) return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spinner size={32} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const isBusy = step === 'detecting' || step === 'gps' || step === 'submitting';

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto', paddingBottom: 72 }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1d4ed8, #1e40af)', padding: '48px 20px 22px', color: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 13, opacity: 0.8 }}>Good {getGreeting()},</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>{employee?.name ?? '…'}</div>
            {employee?.defaultSite && (
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 3 }}>📍 {employee.defaultSite.name}</div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar name={employee?.name ?? ''} />
            <button onClick={() => { clearTokens(); router.replace('/login'); }}
              style={{ background: 'none', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', borderRadius: 8, padding: '6px 12px', fontSize: 12 }}>
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Clock */}
      <Card style={{ textAlign: 'center', padding: '22px 20px' }}>
        <div style={{ fontSize: 44, fontWeight: 700, color: '#111827', letterSpacing: -1, lineHeight: 1 }}>{formatTime(now)}</div>
        <div style={{ fontSize: 14, color: '#6b7280', marginTop: 6 }}>{formatDate(now)}</div>
      </Card>

      {/* Monthly summary */}
      {monthStats && (
        <Card style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            This Month
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {[
              { label: 'Present', value: monthStats.present, color: '#15803d', bg: '#f0fdf4' },
              { label: 'Absent',  value: monthStats.absent,  color: '#dc2626', bg: '#fef2f2' },
              { label: 'Pending', value: monthStats.pending, color: '#a16207', bg: '#fefce8' },
            ].map(s => (
              <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: s.color, opacity: 0.75, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 8, textAlign: 'center' }}>
            {monthStats.workingDays} working days so far this month
          </div>
        </Card>
      )}

      {/* Install banner */}
      {installReady && (
        <div style={{ margin: '0 16px 12px', background: 'linear-gradient(135deg, #1d4ed8, #1e40af)', borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Add to Home Screen</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>Install for faster access & offline use</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={async () => { await installRef.current?.prompt(); setInstallReady(false); }}
              style={{ background: '#fff', color: '#1d4ed8', border: 'none', borderRadius: 10, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              Install
            </button>
            <button onClick={() => setInstallReady(false)}
              style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none', borderRadius: 10, padding: '7px 10px', fontSize: 12, cursor: 'pointer' }}>
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Success */}
      {step === 'done' && (
        <Card style={{ background: '#f0fdf4', border: '1.5px solid #86efac', textAlign: 'center', padding: '18px 20px' }}>
          <div style={{ fontSize: 28 }}>✅</div>
          <div style={{ fontWeight: 600, color: '#16a34a', marginTop: 4 }}>{statusMsg}</div>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Card style={{ background: '#fef2f2', border: '1.5px solid #fca5a5', padding: '12px 16px' }}>
          <div style={{ color: '#dc2626', fontSize: 14 }}>{error}</div>
          <button onClick={() => setError('')} style={{ color: '#dc2626', background: 'none', border: 'none', fontSize: 12, marginTop: 4, padding: 0, textDecoration: 'underline', cursor: 'pointer' }}>
            Dismiss
          </button>
        </Card>
      )}

      {/* Busy */}
      {isBusy && (
        <Card style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe', padding: '16px 20px', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <Spinner size={18} />
            <span style={{ color: '#1d4ed8', fontWeight: 500 }}>{statusMsg}</span>
          </div>
        </Card>
      )}

      {/* Camera */}
      {step === 'camera' && (
        <div style={{ margin: '0 16px', borderRadius: 16, overflow: 'hidden', background: '#000', position: 'relative', aspectRatio: '1/1' }}>
          <video ref={videoRef} playsInline muted autoPlay
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transform: 'scaleX(-1)' }} />

          {/* Face oval guide */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <svg width="100%" height="100%" viewBox="0 0 320 320" preserveAspectRatio="xMidYMid slice">
              <defs>
                <mask id="face-mask">
                  <rect width="320" height="320" fill="white" />
                  <ellipse cx="160" cy="148" rx="100" ry="128" fill="black" />
                </mask>
              </defs>
              <rect width="320" height="320" fill="rgba(0,0,0,0.38)" mask="url(#face-mask)" />
              <ellipse cx="160" cy="148" rx="100" ry="128" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" strokeDasharray="10 5" />
            </svg>
          </div>

          {/* Live face detection status */}
          <div style={{ position: 'absolute', top: 12, left: 0, right: 0, textAlign: 'center', pointerEvents: 'none' }}>
            {faceRequired && faceInFrame === true  && (
              <span style={{ background: 'rgba(21,128,61,0.85)', color: '#fff', fontSize: 12, fontWeight: 700, padding: '5px 16px', borderRadius: 20 }}>
                ✓ Face detected
              </span>
            )}
            {faceRequired && faceInFrame === false && (
              <span style={{ background: 'rgba(185,28,28,0.85)', color: '#fff', fontSize: 12, fontWeight: 700, padding: '5px 16px', borderRadius: 20 }}>
                No face — look at camera
              </span>
            )}
            {(!faceRequired || faceInFrame === null) && (
              <span style={{ background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 12, padding: '4px 14px', borderRadius: 20 }}>
                {faceRequired ? '👁 Center your face in the oval' : '📸 Take your selfie'}
              </span>
            )}
          </div>

          {/* Controls */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            padding: '20px', background: 'linear-gradient(transparent,rgba(0,0,0,0.6))',
            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 28,
          }}>
            <button onClick={cancel}
              style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              ✕
            </button>
            {/* Shutter — red ring when face required but not detected */}
            {(() => {
              const blocked = faceRequired && faceInFrame === false;
              return (
                <button onClick={capture} disabled={blocked}
                  style={{
                    width: 72, height: 72, borderRadius: '50%',
                    background: blocked ? '#fca5a5' : '#fff',
                    border: `4px solid ${blocked ? 'rgba(239,68,68,0.6)' : 'rgba(255,255,255,0.5)'}`,
                    boxShadow: `0 0 0 3px ${blocked ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.3)'}`,
                    cursor: blocked ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                  }}
                />
              );
            })()}
            <div style={{ width: 44 }} />
          </div>
        </div>
      )}

      {/* Punch button */}
      {step === 'idle' && (
        <div style={{ padding: '20px 16px' }}>
          <button onClick={startCamera} style={{
            width: '100%', padding: '18px 0', borderRadius: 16, border: 'none',
            background: nextPunch === 'IN'
              ? 'linear-gradient(135deg,#16a34a,#15803d)'
              : 'linear-gradient(135deg,#dc2626,#b91c1c)',
            color: '#fff', fontSize: 18, fontWeight: 700,
            boxShadow: '0 4px 18px rgba(0,0,0,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
            cursor: 'pointer',
          }}>
            <span style={{ fontSize: 24 }}>{nextPunch === 'IN' ? '🟢' : '🔴'}</span>
            Punch {nextPunch}
          </button>
          <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 10 }}>
            {faceRequired ? 'Face + GPS required' : 'GPS required'}
          </p>
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <nav style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 480, background: '#fff',
        borderTop: '1px solid #e5e7eb', display: 'flex', zIndex: 50,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {[
          { key: 'home',    href: '/home',    icon: '🏠', label: 'Attendance' },
          { key: 'history', href: '/history', icon: '📋', label: 'History' },
          { key: 'leaves',  href: '/leaves',  icon: '🌴', label: 'Leaves' },
          { key: 'profile', href: '/profile', icon: '👤', label: 'Profile' },
        ].map(item => (
          <a key={item.key} href={item.href} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '8px 0 6px', textDecoration: 'none',
            color: item.key === 'home' ? '#1d4ed8' : '#9ca3af',
            borderTop: item.key === 'home' ? '2px solid #1d4ed8' : '2px solid transparent',
          }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>{item.icon}</span>
            <span style={{ fontSize: 10, fontWeight: 600, marginTop: 2 }}>{item.label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}

function Spinner({ size = 20 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size,
      border: `${Math.max(2, size / 10)}px solid #bfdbfe`,
      borderTop: `${Math.max(2, size / 10)}px solid #1d4ed8`,
      borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0,
    }} />
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: 42, height: 42, borderRadius: '50%',
      background: 'rgba(255,255,255,0.2)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 15, fontWeight: 700, color: '#fff',
    }}>{initials}</div>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: '#fff', margin: '0 16px 12px', borderRadius: 16,
      boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
      ...style,
    }}>{children}</div>
  );
}
