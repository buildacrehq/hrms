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

function toLocalDateStr(d: Date = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function getInitials(name: string) {
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
}
function formatTime(d: Date) {
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}
function formatDate(d: Date) {
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
}
function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
}

const DAILY_WISHES = [
  'Hello {Name}, top of the {Time}! Ready to make it the best? 🚀',
  'Hey {Name}, warm {Time} greetings! Great to see you. 😊',
  '{Time} check, {Name}! Coffee strong, focus sharp. ☕',
  'Hello {Name}, awesome {Time}! Let\'s conquer the checklist. ✅',
  'Happy {Time}, {Name}! Sending high energy your way. ⚡',
  'Good {Time}, {Name}! Time to work your magic. ✨',
  'Hey {Name}, great {Time}! Let\'s turn goals into wins today. 🎯',
  'Hello {Name}, pleasant {Time}! Hope your shift runs smoothly. 🌿',
  '{Time} vibes, {Name}! Let\'s crush those targets. 💪',
  'Hey {Name}, cheerful {Time}! Ready to shine today? 🙌',
  'Good {Time}, {Name}! Fresh start, let\'s roll. 🌊',
  'Hello {Name}, lovely {Time}! Time to bring your best. 🔥',
  'Hey {Name}, fantastic {Time}! Wishing you effortless progress today. 📈',
  '{Time} alert, {Name}! Let\'s make this session count. 📊',
  'Good {Time}, {Name}! One win at a time. 🏆',
  'Hello {Name}, inspiring {Time}! Let\'s create big things. 💡',
  'Hey {Name}, productive {Time}! Let\'s get down to business. 👊',
  'Good {Time}, {Name}! May your workflow be fast and light. ⚡',
  'Hello {Name}, smooth {Time} ahead! You\'ve got this handled. 🛡️',
  'Hey {Name}, vibrant {Time}! Hope you\'re feeling locked in. 🔐',
  '{Time} greetings, {Name}! Small steps lead to big results. 🐾',
  'Hello {Name}, bright {Time}! Ready to show off your skills? 🎨',
  'Hey {Name}, welcome to this {Time} shift! Glad you\'re here. 🤝',
  'Good {Time}, {Name}! Let\'s keep the momentum going. 🎢',
  'Hello {Name}, calm {Time}! Stay steady and focused. 🧘',
  'Hey {Name}, power {Time}! Let\'s make every minute count. ⏱️',
  'Good {Time}, {Name}! Positive vibes for your workday ahead. 🌟',
  'Hello {Name}, quick {Time} check-in! Let\'s smash today\'s goals. 📝',
  'Hey {Name}, golden {Time}! Hope your day runs like clockwork. ⚙️',
  'Good {Time}, {Name}! Time to turn caffeine into results. 💻',
  'Hello {Name}, peaceful {Time}! Finish strong and own the day. 🏁',
];

function getDailyWish(name: string): string {
  const day = new Date().getDate(); // 1–31
  const time = getTimeOfDay();
  const tpl  = DAILY_WISHES[(day - 1) % DAILY_WISHES.length];
  return tpl.replace(/\{Name\}/g, name).replace(/\{Time\}/g, time);
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

  const isNativeApp = typeof window !== 'undefined' && !!(window as any).Capacitor;

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
        const punches: any[] = r.data.data?.punches ?? [];
        const presentSet = new Set<string>();
        let pending = 0;
        punches.forEach((p: any) => {
          const ds = toLocalDateStr(new Date(p.timestampServer));
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
    setError('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        // Approximate location (Android "Neighbourhood") gives >500m accuracy — reject it
        if (accuracy > 500) {
          setGpsLoading(false);
          setError('LOCATION_APPROXIMATE');
          gpsResolve.current?.(null);
          gpsResolve.current = null;
          return;
        }
        const address = await reverseGeocode(lat, lng);
        const data: GpsData = { lat, lng, accuracy, address };
        setGpsData(data);
        setGpsLoading(false);
        gpsResolve.current?.(data);
        gpsResolve.current = null;
      },
      (err) => {
        setGpsLoading(false);
        gpsResolve.current?.(null);
        gpsResolve.current = null;
        if (err.code === 1) {
          setError('LOCATION_DENIED');
        } else if (err.code === 2) {
          setError('LOCATION_OFF'); // system GPS is turned off
        } else if (err.code === 3) {
          setError('LOCATION_TIMEOUT');
        } else {
          setError('LOCATION_ERROR');
        }
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  }, []);

  // Start GPS on mount so it's ready before user taps Punch
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { startGps(); }, []);

  const startCamera = useCallback(async () => {
    setError('');
    startGps(); // fresh location for every punch — don't reuse stale mount reading
    capturingRef.current = false;
    setPreviewUrl(null);
    setPreviewTime(null);
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
      stopCamera();
      const denied = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError';
      setError(denied
        ? 'CAMERA_DENIED'
        : '📷 Camera not available. Please check your device.');
      setStep('idle');
    }
  }, [startGps, stopCamera]);

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

    // Wait for GPS if still loading
    let gps = gpsData;
    if (!gps && gpsLoading) {
      setSubmitting(true);
      gps = await new Promise<GpsData | null>(resolve => { gpsResolve.current = resolve; });
    }
    if (!gps) {
      setSubmitting(false);
      setError('📍 Location is required to punch. Please enable location and tap Retry.');
      return;
    }
    setSubmitting(true);
    setError('');

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

  // ── Location denied / off — blocking screen ──
  if (step === 'camera' && (error === 'LOCATION_DENIED' || error === 'LOCATION_OFF')) return (
    <div style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>📍</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: '#111827', marginBottom: 10 }}>
        {error === 'LOCATION_OFF' ? 'GPS is Turned Off' : 'Location Required'}
      </div>
      <div style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6, marginBottom: 28 }}>
        {error === 'LOCATION_OFF'
          ? <>Your phone's GPS is off.<br /><br /><strong>Go to Settings → Location</strong> and turn it on, then tap Try Again.</>
          : isNativeApp
            ? <>Location access is required to punch.<br /><br /><strong>Go to Settings → Apps → BA Workforce → Permissions → Location → Allow</strong></>
            : <>Location access is required to punch.<br /><br /><strong>Tap the 🔒 lock icon → Permissions → Location → Allow</strong></>
        }
      </div>
      <button onClick={startGps}
        style={{ width: '100%', padding: '16px', borderRadius: 14, border: 'none', background: '#1d4ed8', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', marginBottom: 12 }}>
        Try Again
      </button>
      <button onClick={cancel}
        style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 14, cursor: 'pointer' }}>
        Cancel
      </button>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, minHeight: 28 }}>
          <span style={{ fontSize: 16 }}>📍</span>
          {gpsLoading ? (
            <span style={{ fontSize: 13, color: '#9ca3af' }}>Getting location…</span>
          ) : gpsData ? (
            <span style={{ fontSize: 13, color: '#374151', fontWeight: 500, lineHeight: 1.4 }}>
              {gpsData.address}
            </span>
          ) : error ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
              <span style={{ fontSize: 13, color: error === 'LOCATION_APPROXIMATE' ? '#d97706' : '#dc2626', flex: 1 }}>
                {error === 'LOCATION_DENIED' ? 'Location denied — allow in browser settings' :
                 error === 'LOCATION_APPROXIMATE' ? 'Approximate location — select Precise and retry' :
                 error === 'LOCATION_TIMEOUT' ? 'Location timed out — move to open area' :
                 'Cannot get location'}
              </span>
              <button onClick={startGps} style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Retry
              </button>
            </div>
          ) : null}
        </div>

        {/* Controls row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={cancel}
            style={{ background: 'none', border: 'none', fontSize: 15, fontWeight: 600, color: '#6b7280', cursor: 'pointer', padding: '8px 0' }}>
            Cancel
          </button>

          {/* Shutter — blocked if face missing OR location not yet obtained */}
          {(() => {
            const noFace = faceRequired && faceInFrame === false;
            const noGps  = !gpsData && !gpsLoading;
            const blocked = noFace || noGps;
            const title   = noGps ? 'Waiting for location…' : noFace ? 'Look at the camera' : '';
            return (
              <button onClick={capture} disabled={blocked} title={title}
                style={{
                  width: 72, height: 72, borderRadius: '50%',
                  background: blocked ? '#d1d5db' : '#1d4ed8',
                  border: `4px solid ${blocked ? '#d1d5db' : '#fff'}`,
                  boxShadow: `0 0 0 3px ${blocked ? 'rgba(107,114,128,0.3)' : '#1d4ed8'}`,
                  cursor: blocked ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                }}
              />
            );
          })()}

          <div style={{ width: 60 }} />
        </div>

        {/* Hint below shutter */}
        {!gpsData && !gpsLoading && !error && (
          <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 10 }}>Waiting for location to enable shutter…</p>
        )}
        {gpsLoading && (
          <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 10 }}>Getting location, shutter will unlock shortly…</p>
        )}
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
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 16 }}>
          <span style={{ fontSize: 14, marginTop: 1 }}>📍</span>
          {gpsLoading ? (
            <span style={{ fontSize: 13, color: '#9ca3af' }}>Getting location…</span>
          ) : gpsData ? (
            <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{gpsData.address}</span>
          ) : (
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: '#dc2626', marginBottom: 6 }}>
                {error === 'LOCATION_DENIED'
                  ? '📍 Location access denied. Enable location in browser settings then tap Retry.'
                  : (error || '📍 Location unavailable.')}
              </div>
              <button onClick={startGps}
                style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Retry Location
              </button>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={retake} disabled={submitting}
            style={{ flex: 1, padding: '14px', borderRadius: 14, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
            Retake
          </button>
          <button onClick={submitPunch}
            disabled={submitting || gpsLoading || (!gpsData)}
            style={{
              flex: 2, padding: '14px', borderRadius: 14, border: 'none',
              background: submitting || gpsLoading || !gpsData ? '#93c5fd' : '#1d4ed8',
              color: '#fff', fontSize: 15, fontWeight: 700,
              cursor: submitting || gpsLoading || !gpsData ? 'not-allowed' : 'pointer',
            }}>
            {submitting ? 'Submitting…' : gpsLoading ? 'Getting location…' : !gpsData ? 'Location required' : 'Submit'}
          </button>
        </div>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  // ── Main home screen ──
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto', background: 'linear-gradient(160deg, #1e3a8a 0%, #1d4ed8 45%, #1e40af 100%)', paddingBottom: 140 }}>

      {/* ── Hero Header ── */}
      <div style={{
        padding: '54px 20px 28px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative circles */}
        <div style={{ position: 'absolute', top: -50, right: -50, width: 190, height: 190, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -15, left: 10, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />

        {/* Brand name + Avatar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>BA Workforce</span>
          <Avatar name={employee?.name ?? ''} />
        </div>

        {/* Large clock */}
        <div style={{ fontSize: 62, fontWeight: 800, color: '#fff', letterSpacing: -2, lineHeight: 1 }}>
          {formatTime(now)}
        </div>

        {/* Date */}
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', marginTop: 8, fontWeight: 500 }}>
          {formatDate(now)}
        </div>

        {/* Site */}
        {employee?.defaultSite && (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.42)', marginTop: 4 }}>
            📍 {employee.defaultSite.name}
          </div>
        )}

        {/* Greeting bubble */}
        {employee && (
          <div style={{
            marginTop: 18, background: 'rgba(255,255,255,0.11)',
            borderRadius: 14, padding: '11px 14px',
            fontSize: 13, color: 'rgba(255,255,255,0.92)',
            lineHeight: 1.55, fontWeight: 500,
          }}>
            {getDailyWish(employee.name)}
          </div>
        )}
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, padding: '14px 14px 0' }}>

        {/* Clocked-in status pill */}
        {nextPunch === 'OUT' && step !== 'done' && (
          <div style={{
            background: 'rgba(255,255,255,0.12)', borderRadius: 16, padding: '13px 16px', marginBottom: 12,
            display: 'flex', alignItems: 'center', gap: 12,
            border: '1px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)',
          }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#4ade80', flexShrink: 0, boxShadow: '0 0 0 4px rgba(74,222,128,0.25)' }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>You're clocked in</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 1 }}>Remember to punch out at end of shift</div>
            </div>
          </div>
        )}

        {/* Success */}
        {step === 'done' && (
          <div style={{ background: 'rgba(22,163,74,0.25)', border: '1px solid rgba(74,222,128,0.35)', borderRadius: 16, textAlign: 'center', padding: '20px', marginBottom: 12, backdropFilter: 'blur(10px)' }}>
            <div style={{ fontSize: 32 }}>✅</div>
            <div style={{ fontWeight: 700, color: '#fff', fontSize: 16, marginTop: 8 }}>
              Punched {nextPunch === 'OUT' ? 'IN' : 'OUT'} successfully!
            </div>
          </div>
        )}

        {/* Location denied */}
        {error === 'LOCATION_DENIED' && step === 'idle' && (
          <div style={{ background: '#fff', border: '1.5px solid #fca5a5', borderRadius: 16, padding: '16px', marginBottom: 12 }}>
            <div style={{ fontSize: 28, textAlign: 'center', marginBottom: 8 }}>📍</div>
            <div style={{ fontWeight: 700, color: '#dc2626', fontSize: 14, textAlign: 'center', marginBottom: 6 }}>Location Permission Denied</div>
            <div style={{ color: '#7f1d1d', fontSize: 13, lineHeight: 1.6, textAlign: 'center', marginBottom: 14 }}>
              {isNativeApp
                ? 'Go to phone Settings → Apps → BA Workforce → Permissions → Location → Allow.'
                : 'Tap the 🔒 lock icon in the browser address bar → Permissions → Location → Allow.'}
            </div>
            <button onClick={startGps}
              style={{ width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: '#dc2626', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
              Retry Location
            </button>
          </div>
        )}

        {/* Location off at system level */}
        {error === 'LOCATION_OFF' && step === 'idle' && (
          <div style={{ background: '#fff', border: '1.5px solid #fca5a5', borderRadius: 16, padding: '16px', marginBottom: 12 }}>
            <div style={{ fontSize: 28, textAlign: 'center', marginBottom: 8 }}>📍</div>
            <div style={{ fontWeight: 700, color: '#dc2626', fontSize: 14, textAlign: 'center', marginBottom: 6 }}>GPS is Turned Off</div>
            <div style={{ color: '#7f1d1d', fontSize: 13, lineHeight: 1.6, textAlign: 'center', marginBottom: 14 }}>
              Your phone's location is off. Go to{' '}
              <strong>Settings → Location</strong> and turn it on, then tap Retry.
            </div>
            <button onClick={startGps}
              style={{ width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: '#dc2626', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
              Retry Location
            </button>
          </div>
        )}

        {/* Location approximate / timeout / error */}
        {(error === 'LOCATION_APPROXIMATE' || error === 'LOCATION_TIMEOUT' || error === 'LOCATION_ERROR') && step === 'idle' && (
          <div style={{ background: '#fff', border: '1.5px solid #fde68a', borderRadius: 16, padding: '16px', marginBottom: 12 }}>
            <div style={{ fontSize: 28, textAlign: 'center', marginBottom: 8 }}>📍</div>
            <div style={{ fontWeight: 700, color: '#b45309', fontSize: 14, textAlign: 'center', marginBottom: 6 }}>
              {error === 'LOCATION_APPROXIMATE' ? 'Approximate Location Detected' : 'Location Unavailable'}
            </div>
            <div style={{ color: '#78350f', fontSize: 13, lineHeight: 1.6, textAlign: 'center', marginBottom: 14 }}>
              {error === 'LOCATION_APPROXIMATE'
                ? 'Go to Settings → Privacy → Location → select Precise location, then tap Retry.'
                : error === 'LOCATION_TIMEOUT'
                ? 'Location timed out. Move to an open area and tap Retry.'
                : 'Cannot get your location. Check location settings and tap Retry.'}
            </div>
            <button onClick={startGps}
              style={{ width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: '#d97706', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
              Retry Location
            </button>
          </div>
        )}

        {/* Camera denied */}
        {error === 'CAMERA_DENIED' && (
          <div style={{ background: '#fff', border: '1.5px solid #fca5a5', borderRadius: 16, padding: '16px', marginBottom: 12 }}>
            <div style={{ fontSize: 28, textAlign: 'center', marginBottom: 8 }}>📷</div>
            <div style={{ fontWeight: 700, color: '#dc2626', fontSize: 14, textAlign: 'center', marginBottom: 6 }}>Camera Access Required</div>
            <div style={{ color: '#7f1d1d', fontSize: 13, lineHeight: 1.6, textAlign: 'center', marginBottom: 14 }}>
              {isNativeApp
                ? 'Go to Settings → Apps → BA Workforce → Permissions → Camera → Allow, then tap Retry.'
                : 'Tap the 🔒 lock icon in the browser address bar → Permissions → Camera → Allow, then tap Retry.'}
            </div>
            <button onClick={startCamera}
              style={{ width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: '#dc2626', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
              Retry Camera
            </button>
          </div>
        )}

        {/* Install banner — hidden in APK */}
        {installReady && !isNativeApp && (
          <div style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 16, padding: '14px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, backdropFilter: 'blur(10px)' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Add to Home Screen</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>Install BA Workforce for faster access</div>
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
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Fixed punch button — sits above bottom nav */}
      {step === 'idle' && (() => {
        const gpsReady = !!gpsData && !gpsLoading;
        return (
          <div style={{
            position: 'fixed', bottom: 'calc(56px + env(safe-area-inset-bottom))',
            left: '50%', transform: 'translateX(-50%)',
            width: '100%', maxWidth: 480,
            padding: '10px 16px 12px',
            background: 'linear-gradient(to top, #1e3a8a 70%, rgba(30,58,138,0))',
            zIndex: 40,
          }}>
            <button
              onClick={gpsReady ? startCamera : undefined}
              disabled={!gpsReady}
              style={{
                width: '100%', padding: '18px 0', borderRadius: 16, border: 'none',
                background: !gpsReady
                  ? '#d1d5db'
                  : nextPunch === 'IN'
                    ? 'linear-gradient(135deg,#16a34a,#15803d)'
                    : 'linear-gradient(135deg,#dc2626,#b91c1c)',
                color: !gpsReady ? '#9ca3af' : '#fff',
                fontSize: 18, fontWeight: 700,
                boxShadow: gpsReady ? '0 4px 18px rgba(0,0,0,0.18)' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                cursor: gpsReady ? 'pointer' : 'not-allowed',
                transition: 'all 0.25s',
              }}>
              {gpsLoading ? (
                <>
                  <Spinner size={20} />
                  <span>Getting Location…</span>
                </>
              ) : (
                <>
                  <span style={{ fontSize: 24 }}>{nextPunch === 'IN' ? '🟢' : '🔴'}</span>
                  Punch {nextPunch}
                </>
              )}
            </button>
            <p style={{ textAlign: 'center', fontSize: 12, color: error === 'LOCATION_DENIED' ? '#fca5a5' : 'rgba(255,255,255,0.55)', marginTop: 6, marginBottom: 0 }}>
              {error === 'LOCATION_DENIED' ? '📍 Turn ON location to punch' :
               error === 'LOCATION_APPROXIMATE' ? '📍 Precise location required' :
               !gpsReady ? 'Waiting for precise location…' : faceRequired ? 'Selfie + GPS required' : 'GPS required'}
            </p>
          </div>
        );
      })()}

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
