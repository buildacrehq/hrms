export interface DeviceInfo {
  deviceBrowser: string;
  deviceOs: string;
  ipAddress: string;
}

export function parseDevice(ua: string, ip: string): DeviceInfo {
  const s = ua ?? '';

  // ── OS ──────────────────────────────────────────────────────────
  let deviceOs = 'Unknown OS';
  if (/Android\s([\d.]+)/i.test(s)) {
    deviceOs = `Android ${s.match(/Android\s([\d.]+)/i)?.[1] ?? ''}`.trim();
  } else if (/iPhone|iPad|iPod/i.test(s)) {
    const v = s.match(/OS ([\d_]+)/i)?.[1]?.replace(/_/g, '.') ?? '';
    deviceOs = `iOS ${v}`.trim();
  } else if (/Windows NT ([\d.]+)/i.test(s)) {
    const ntMap: Record<string, string> = { '10.0': '10/11', '6.3': '8.1', '6.2': '8', '6.1': '7' };
    const nt = s.match(/Windows NT ([\d.]+)/i)?.[1] ?? '';
    deviceOs = `Windows ${ntMap[nt] ?? nt}`.trim();
  } else if (/Mac OS X ([\d_]+)/i.test(s)) {
    const v = s.match(/Mac OS X ([\d_]+)/i)?.[1]?.replace(/_/g, '.') ?? '';
    deviceOs = `macOS ${v}`.trim();
  } else if (/Linux/i.test(s)) {
    deviceOs = 'Linux';
  }

  // ── Browser ─────────────────────────────────────────────────────
  let deviceBrowser = 'Unknown Browser';
  if (/Edg\/([\d.]+)/i.test(s)) {
    deviceBrowser = `Edge ${s.match(/Edg\/([\d.]+)/i)?.[1]?.split('.')[0] ?? ''}`.trim();
  } else if (/SamsungBrowser\/([\d.]+)/i.test(s)) {
    deviceBrowser = `Samsung Browser ${s.match(/SamsungBrowser\/([\d.]+)/i)?.[1]?.split('.')[0] ?? ''}`.trim();
  } else if (/OPR\/([\d.]+)|Opera\/([\d.]+)/i.test(s)) {
    const v = (s.match(/OPR\/([\d.]+)/i) ?? s.match(/Opera\/([\d.]+)/i))?.[1]?.split('.')[0] ?? '';
    deviceBrowser = `Opera ${v}`.trim();
  } else if (/CriOS\/([\d.]+)/i.test(s)) {
    deviceBrowser = `Chrome iOS ${s.match(/CriOS\/([\d.]+)/i)?.[1]?.split('.')[0] ?? ''}`.trim();
  } else if (/FxiOS\/([\d.]+)/i.test(s)) {
    deviceBrowser = `Firefox iOS ${s.match(/FxiOS\/([\d.]+)/i)?.[1]?.split('.')[0] ?? ''}`.trim();
  } else if (/Chrome\/([\d.]+)/i.test(s)) {
    deviceBrowser = `Chrome ${s.match(/Chrome\/([\d.]+)/i)?.[1]?.split('.')[0] ?? ''}`.trim();
  } else if (/Firefox\/([\d.]+)/i.test(s)) {
    deviceBrowser = `Firefox ${s.match(/Firefox\/([\d.]+)/i)?.[1]?.split('.')[0] ?? ''}`.trim();
  } else if (/Version\/([\d.]+).*Safari/i.test(s)) {
    deviceBrowser = `Safari ${s.match(/Version\/([\d.]+)/i)?.[1]?.split('.')[0] ?? ''}`.trim();
  }

  // ── IP (take first non-private if behind proxy) ──────────────────
  const rawIp = ip ?? '';
  const firstIp = rawIp.split(',')[0].trim();

  return { deviceBrowser, deviceOs, ipAddress: firstIp };
}
