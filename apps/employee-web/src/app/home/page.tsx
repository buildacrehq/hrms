'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api, clearTokens } from '@/lib/api';

type Employee = {
  id: string; name: string; phone: string; defaultSite?: { id: string; name: string } | null;
};
type PunchType = 'IN' | 'OUT';
type PunchStep = 'idle' | 'camera' | 'preview' | 'submitting' | 'done';
type MonthStats = { present: number; absent: number; pending: number; workingDays: number };
type GpsData   = { lat: number; lng: number; accuracy: number; address: string };

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
  const d = new Date(isoStr), t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}
function fmtPunchDateTime(d: Date) {
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', weekday: 'short' })
    + ' | ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
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

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, b64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)![1];
  const bin  = atob(b64);
  const arr  = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

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
  const [error, setError]         = useState('');
  const [faceRequired, setFaceRequired] = useState(true);

  const videoRef     = useRef<HTMLVideoElement>(null);
  const streamRef    = useRef<MediaStream | null>(null);
  const capturingRef = useRef(false);
  const doneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const installRef   = useRef<any>(null);
  const gpsResolve   = useRef<((g: GpsData | null) => void) | null>(null);

  const [monthStats,   setMonthStats]   = useState<MonthStats | null>(null);
  const [installReady, setInstallReady] = useState(false);
  const [faceInFrame,  setFaceInFrame]  = useState<boolean | null>(null);
  const [gpsData,      setGpsData]      = useState<GpsData | null>(null);
  const [gpsLoading,   setGpsLoading]   = useState(false);
  const [previewUrl,   setPreviewUrl]   = useState<string | null>(null);
  const [previewTime,  setPreviewTime]  = useState<Date | null>(null);
  const [submitting,   setSubmitting]   = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    api.get('/employees/me')
      .then(r => { setEmployee(r.data.data ?? r.data); setLoading(false); })
      .catch(() => { clearTokens(); router.replace('/login'); });

    api.get('/settings/mobile')
      .then(r => { const d = r.data.data ?? r.data; setFaceRequired((d.require_face_detection ?? 'true') === 'true'); })
      .catch(() => {});

    api.get('/punches/my/last')
      .then(r => { const last = r.data.data; if (last?.type === 'IN' && isToday(last.timestampServer)) setNextPunch('OUT'); })
      .catch(() => {});

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
        let workingDays = 0;
        for (let i = 1; i <= d.getDate(); i++) {
          if (new Date(d.getFullYear(), d.getMonth(), i).getDay() !== 0) workingDays++;
        }
        setMonthStats({ present: presentSet.size, absent: Math.max(0, workingDays - presentSet.size), pending, workingDays });
      })
      .catch(() => {});
  }, [router]);

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); installRef.current = e; setInstallReady(true); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Live face detection loop while camera is open
  useEffect(() => {
    if (step !== 'camera') { setFaceInFrame(null); return; }
    const detector = makeFaceDetector();
    if (!detector) { setFaceInFrame(null); return; }
    let active = true;
    async function loop() {
      while (active) {
        const video = videoRef.current;
        if (video && video.readyState >= 2) {
          try {
            const faces = await detector.detect(video);
            if (active) setFaceInFrame(faces.length > 0);
          } catch { if (active) setFaceInFrame(null); break; }
        }
        await new Promise(r => setTimeout(r, 600));
      }
    }
    loop();
    return () => { active = false; };
  }, [step]);

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

  const startGps = useCallback(() => {
    setGpsData(null);
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const address = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        const data: GpsData = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, address };
        setGpsData(data);
        setGpsLoading(false);
        gpsResolve.current?.(data);
        gpsResolve.current = null;
      },
      (err) => {
        setGpsLoading(false);
        gpsResolve.current?.(null);
        gpsResolve.current = null;
        const denied = err.code === 1;
        setError(denied
          ? '📍 Location access required. Go to Settings → Site Permissions → Location → Allow.'
          : 'Could not get location. Make sure GPS is on and try again.');
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }, []);

  const startCamera = useCallback(async () => {
    setError('');
    capturingRef.current = false;
    setPreviewUrl(null);
    setPreviewTime(null);
    setStep('camera');
    // Start GPS in parallel while user aims camera
    startGps();
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
      setError(denied
        ? '📷 Camera access required. Go to Settings → Site Permissions → Camera → Allow.'
        : 'Camera not available. Please check your device.');
      setStep('idle');
    }
  }, [startGps]);

  const capture = useCallback(() => {
    if (capturingRef.current) return;
    if (!videoRef.current) return;

    if (faceRequired && faceInFrame === false) {
      setError('No face detected. Look directly at the camera and try again.');
      return;
    }
    capturingRef.current = true;

    const video  = videoRef.current;
    // Create canvas inline — canvasRef would be null here since camera is a separate early return
    const canvas = document.createElement('canvas');
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 640;
    const ctx = canvas.getContext('2d')!;
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);

    const url  = canvas.toDataURL('image/jpeg', 0.85);
    const time = new Date();
    stopCamera();
    setPreviewUrl(url);
    setPreviewTime(time);
    setStep('preview');
    capturingRef.current = false;
  }, [faceRequired, faceInFrame, stopCamera]);

  const retake = useCallback(() => {
    setPreviewUrl(null);
    setPreviewTime(null);
    startCamera();
  }, [startCamera]);

  const submitPunch = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    setError('');

    // Wait for GPS if still loading
    let gps = gpsData;
    if (!gps && gpsLoading) {
      gps = await new Promise<GpsData | null>(resolve => { gpsResolve.current = resolve; });
    }
    if (!gps) {
      setSubmitting(false);
      return; // error already set by GPS handler
    }

    // Upload photo from previewUrl (canvasRef points to new blank canvas after step change)
    let photoKey = '';
    if (previewUrl) {
      try {
        const blob   = dataUrlToBlob(previewUrl);
        const urlRes = await api.post('/punches/upload-url', { type: nextPunch });
        const { uploadUrl, uploadToken, photoKey: key } = urlRes.data.data;
        photoKey = key;
        await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'image/jpeg', Authorization: `Bearer ${uploadToken}` },
          body: blob,
        });
      } catch { photoKey = ''; }
    }

    // Submit punch
    try {
      await api.post('/punches', {
        type: nextPunch,
        lat: gps.lat, long: gps.lng, accuracy: gps.accuracy, address: gps.address,
        timestampDevice: (previewTime ?? new Date()).toISOString(),
        photoKey,
      });
      const wasIn = nextPunch === 'IN';
      setNextPunch(wasIn ? 'OUT' : 'IN');
      setPreviewUrl(null);
      setStep('done');
      doneTimerRef.current = setTimeout(() => { setStep('idle'); doneTimerRef.current = null; }, 3500);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to submit. Please try again.');
      setStep('preview'); // stay on preview so user can retry
    } finally {
      setSubmitting(false);
    }
  }, [gpsData, gpsLoading, nextPunch, previewTime, submitting]);

  const cancel = useCallback(() => {
    stopCamera();
    setPreviewUrl(null);
    setPreviewTime(null);
    setGpsData(null);
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

  // ── Camera overlay (fullscreen) ──
  if (step === 'camera') return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 200, display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto' }}>
      {/* Top bar */}
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 1 }}>
        <button onClick={cancel} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer', padding: 4 }}>
          ←
        </button>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>
          Mark {nextPunch === 'IN' ? 'Punch In' : 'Punch Out'}
        </span>
        <div style={{ width: 30 }} />
      </div>

      {/* Video */}
      <video ref={videoRef} playsInline muted autoPlay
        style={{ flex: 1, width: '100%', objectFit: 'cover', display: 'block', transform: 'scaleX(-1)' }} />

      {/* Face status badge */}
      {faceRequired && faceInFrame !== null && (
        <div style={{ position: 'absolute', top: 64, left: 0, right: 0, textAlign: 'center', pointerEvents: 'none' }}>
          <span style={{
            background: faceInFrame ? 'rgba(21,128,61,0.88)' : 'rgba(185,28,28,0.88)',
            color: '#fff', fontSize: 13, fontWeight: 700, padding: '6px 18px', borderRadius: 20,
          }}>
            {faceInFrame ? '✓ Face detected' : 'No face — look at camera'}
          </span>
        </div>
      )}

      {/* Bottom sheet */}
      <div style={{ background: '#fff', borderRadius: '24px 24px 0 0', padding: '16px 24px 32px' }}>
        {/* GPS address */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, minHeight: 28 }}>
          <span style={{ fontSize: 16 }}>📍</span>
          {gpsLoading ? (
            <span style={{ fontSize: 13, color: '#9ca3af' }}>Getting location…</span>
          ) : gpsData ? (
            <span style={{ fontSize: 13, color: '#374151', fontWeight: 500, lineHeight: 1.4 }} className="line-clamp-2">
              {gpsData.address}
            </span>
          ) : (
            <span style={{ fontSize: 13, color: '#f59e0b' }}>Location unavailable</span>
          )}
        </div>

        {/* Controls row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={cancel}
            style={{ background: 'none', border: 'none', fontSize: 15, fontWeight: 600, color: '#6b7280', cursor: 'pointer', padding: '8px 0' }}>
            Cancel
          </button>

          {/* Shutter */}
          {(() => {
            const blocked = faceRequired && faceInFrame === false;
            return (
              <button onClick={capture} disabled={blocked}
                style={{
                  width: 72, height: 72, borderRadius: '50%',
                  background: blocked ? '#fca5a5' : '#1d4ed8',
                  border: `4px solid ${blocked ? '#fca5a5' : '#fff'}`,
                  boxShadow: `0 0 0 3px ${blocked ? 'rgba(239,68,68,0.3)' : '#1d4ed8'}`,
                  cursor: blocked ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                }}
              />
            );
          })()}

          <div style={{ width: 60 }} />
        </div>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  // ── Preview / Confirm step ──
  if (step === 'preview') return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 200, display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto' }}>
      {/* Captured photo */}
      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt="Captured" style={{ flex: 1, width: '100%', objectFit: 'cover', display: 'block' }} />
      )}

      {/* Confirmation bottom sheet */}
      <div style={{ background: '#fff', borderRadius: '24px 24px 0 0', padding: '20px 24px 36px' }}>
        <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>
          {nextPunch === 'IN' ? 'Mark Punch In' : 'Mark Punch Out'}
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#111827', marginBottom: 12 }}>
          {previewTime ? fmtPunchDateTime(previewTime) : '—'}
        </div>

        {/* Address */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 20 }}>
          <span style={{ fontSize: 14, marginTop: 1 }}>📍</span>
          {gpsLoading ? (
            <span style={{ fontSize: 13, color: '#9ca3af' }}>Getting location…</span>
          ) : gpsData ? (
            <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{gpsData.address}</span>
          ) : (
            <span style={{ fontSize: 13, color: '#f59e0b' }}>Location unavailable</span>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '10px 12px', color: '#dc2626', fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={retake} disabled={submitting}
            style={{ flex: 1, padding: '14px', borderRadius: 14, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
            Retake
          </button>
          <button onClick={submitPunch} disabled={submitting || (gpsLoading && !gpsData)}
            style={{
              flex: 2, padding: '14px', borderRadius: 14, border: 'none',
              background: submitting ? '#93c5fd' : '#1d4ed8',
              color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
            }}>
            {submitting ? 'Submitting…' : gpsLoading && !gpsData ? 'Getting location…' : 'Submit'}
          </button>
        </div>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  // ── Main home screen ──
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
              style={{ background: 'none', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
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
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>This Month</div>
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
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>Install for faster access</div>
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
        <Card style={{ background: '#f0fdf4', border: '1.5px solid #86efac', textAlign: 'center', padding: '20px' }}>
          <div style={{ fontSize: 32 }}>✅</div>
          <div style={{ fontWeight: 700, color: '#16a34a', fontSize: 16, marginTop: 8 }}>
            Punched {nextPunch === 'OUT' ? 'IN' : 'OUT'} successfully!
          </div>
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

      {/* Punch button */}
      {step === 'idle' && (
        <div style={{ padding: '20px 16px' }}>
          <button onClick={startCamera} style={{
            width: '100%', padding: '18px 0', borderRadius: 16, border: 'none',
            background: nextPunch === 'IN' ? 'linear-gradient(135deg,#16a34a,#15803d)' : 'linear-gradient(135deg,#dc2626,#b91c1c)',
            color: '#fff', fontSize: 18, fontWeight: 700,
            boxShadow: '0 4px 18px rgba(0,0,0,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
            cursor: 'pointer',
          }}>
            <span style={{ fontSize: 24 }}>{nextPunch === 'IN' ? '🟢' : '🔴'}</span>
            Punch {nextPunch}
          </button>
          <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 10 }}>
            {faceRequired ? 'Selfie + GPS required' : 'GPS required'}
          </p>
        </div>
      )}

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
    <div style={{ background: '#fff', margin: '0 16px 12px', borderRadius: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.07)', ...style }}>
      {children}
    </div>
  );
}
