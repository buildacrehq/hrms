'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api, clearTokens } from '@/lib/api';

type Employee = {
  id: string; name: string; phone: string; defaultSite?: { id: string; name: string } | null;
};
type PunchType = 'IN' | 'OUT';
type PunchStep = 'idle' | 'camera' | 'detecting' | 'gps' | 'submitting' | 'done';

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

type FaceResult = { detected: boolean; error?: string };

async function detectFaceOnCanvas(canvas: HTMLCanvasElement): Promise<FaceResult> {
  // Native FaceDetector API — instant, no model download, works on Chrome Android
  if ('FaceDetector' in window) {
    try {
      const detector = new (window as any).FaceDetector({ maxDetectedFaces: 1, fastMode: true });
      const faces = await detector.detect(canvas);
      return { detected: faces.length > 0 };
    } catch {
      return { detected: true }; // API exists but failed — allow punch
    }
  }
  // Not supported (iOS Safari, Firefox) — allow punch
  return { detected: true };
}

export default function HomePage() {
  const router = useRouter();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const [nextPunch, setNextPunch] = useState<PunchType>('IN');
  const [step, setStep] = useState<PunchStep>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError] = useState('');
  const [faceRequired, setFaceRequired] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    api.get('/employees/me')
      .then(r => { setEmployee(r.data.data); setLoading(false); })
      .catch(() => { clearTokens(); router.replace('/login'); });

    api.get('/settings/mobile')
      .then(r => {
        const d = r.data.data ?? r.data;
        setFaceRequired((d.require_face_detection ?? 'true') === 'true');
      })
      .catch(() => {});

    api.get('/punches/my/last')
      .then(r => { if (r.data.data?.type === 'IN') setNextPunch('OUT'); })
      .catch(() => {});
  }, [router]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startCamera = useCallback(async () => {
    setError('');
    setStep('camera');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err: any) {
      const denied = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError';
      setError(
        denied
          ? '📷 Camera access is required to punch. Please tap Allow when your browser asks, then try again. If you already denied it, go to your browser Settings → Site Permissions → Camera → Allow.'
          : 'Camera not available. Please check your device.'
      );
      setStep('idle');
    }
  }, []);

  const capture = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    // Mirror to match preview
    const ctx = canvas.getContext('2d')!;
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    stopCamera();

    // ── Face detection ──
    if (faceRequired) {
      setStep('detecting');
      setStatusMsg('Verifying face…');
      const result = await detectFaceOnCanvas(canvas);
      if (result.error) {
        setError(result.error);
        setStep('idle');
        return;
      }
      if (!result.detected) {
        setError('No face detected. Look directly at the camera and try again.');
        setStep('idle');
        return;
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
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
      accuracy = pos.coords.accuracy;
      address = await reverseGeocode(lat, lng);
    } catch (err: any) {
      const denied = err?.code === 1; // PERMISSION_DENIED
      setError(
        denied
          ? '📍 Location access is required to punch. Please tap Allow when your browser asks, then try again. If already denied, go to browser Settings → Site Permissions → Location → Allow.'
          : 'Could not get location. Make sure GPS is turned on and try again.'
      );
      setStep('idle');
      return;
    }

    // ── Upload photo via Supabase signed URL ──
    setStep('submitting');
    setStatusMsg('Uploading photo…');
    let photoKey = '';
    try {
      const blob = await canvasToBlob(canvas);
      const urlRes = await api.post('/punches/upload-url', { type: nextPunch });
      const { uploadUrl, uploadToken, photoKey: key } = urlRes.data.data;
      photoKey = key;
      await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg', Authorization: `Bearer ${uploadToken}` },
        body: blob,
      });
    } catch {
      // Photo upload failed; allow punch without photo (API setting controls this)
      photoKey = '';
    }

    // ── Submit punch ──
    setStatusMsg('Submitting punch…');
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
      setTimeout(() => { setStep('idle'); setStatusMsg(''); }, 3500);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to submit. Please try again.');
      setStep('idle');
    }
  }, [faceRequired, nextPunch, stopCamera]);

  const cancel = useCallback(() => {
    stopCamera();
    setStep('idle');
    setError('');
  }, [stopCamera]);

  if (loading) return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spinner size={32} />
    </div>
  );

  const isBusy = step === 'detecting' || step === 'gps' || step === 'submitting';

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1d4ed8, #1e40af)', padding: '48px 20px 22px', color: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 13, opacity: 0.8 }}>Good {getGreeting()},</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>{employee?.name}</div>
            {employee?.defaultSite && (
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 3 }}>📍 {employee.defaultSite.name}</div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar name={employee?.name ?? ''} />
            <button
              onClick={() => { clearTokens(); router.replace('/login'); }}
              style={{ background: 'none', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', borderRadius: 8, padding: '6px 12px', fontSize: 12 }}
            >Logout</button>
          </div>
        </div>
      </div>

      {/* Clock */}
      <Card style={{ textAlign: 'center', padding: '22px 20px' }}>
        <div style={{ fontSize: 44, fontWeight: 700, color: '#111827', letterSpacing: -1, lineHeight: 1 }}>{formatTime(now)}</div>
        <div style={{ fontSize: 14, color: '#6b7280', marginTop: 6 }}>{formatDate(now)}</div>
      </Card>

      {/* Alerts */}
      {step === 'done' && (
        <Card style={{ background: '#f0fdf4', border: '1.5px solid #86efac', textAlign: 'center', padding: '18px 20px' }}>
          <div style={{ fontSize: 28 }}>✅</div>
          <div style={{ fontWeight: 600, color: '#16a34a', marginTop: 4 }}>{statusMsg}</div>
        </Card>
      )}
      {error && (
        <Card style={{ background: '#fef2f2', border: '1.5px solid #fca5a5', padding: '12px 16px' }}>
          <div style={{ color: '#dc2626', fontSize: 14 }}>{error}</div>
          <button onClick={() => setError('')} style={{ color: '#dc2626', background: 'none', border: 'none', fontSize: 12, marginTop: 4, padding: 0, textDecoration: 'underline' }}>Dismiss</button>
        </Card>
      )}
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
        <div style={{ margin: '0 16px', borderRadius: 16, overflow: 'hidden', background: '#000', position: 'relative' }}>
          <video ref={videoRef} playsInline muted autoPlay
            style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', display: 'block', transform: 'scaleX(-1)' }} />
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            padding: '12px 0', textAlign: 'center',
          }}>
            <span style={{ background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 12, padding: '4px 14px', borderRadius: 20 }}>
              {faceRequired ? '👁 Face required — look at camera' : '📸 Take your selfie'}
            </span>
          </div>
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            padding: '20px', background: 'linear-gradient(transparent,rgba(0,0,0,0.6))',
            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 28,
          }}>
            <button onClick={cancel}
              style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              ✕
            </button>
            {/* Shutter */}
            <button onClick={capture}
              style={{ width: 70, height: 70, borderRadius: '50%', background: '#fff', border: '4px solid #fff', boxShadow: '0 0 0 3px rgba(255,255,255,0.4)' }} />
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
          }}>
            <span style={{ fontSize: 24 }}>{nextPunch === 'IN' ? '🟢' : '🔴'}</span>
            Punch {nextPunch}
          </button>
          <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 10 }}>
            {faceRequired ? 'Face detection + GPS required' : 'GPS required'}
          </p>
        </div>
      )}

      {/* Hidden canvas */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
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
