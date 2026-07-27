'use client';
import Link from 'next/link';

type Tab = 'home' | 'history' | 'leaves' | 'profile';

function IconAttendance({ active }: { active: boolean }) {
  const c = active ? '#1d4ed8' : '#9ca3af';
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <polyline points="9 16 11 18 15 14" />
    </svg>
  );
}

function IconHistory({ active }: { active: boolean }) {
  const c = active ? '#1d4ed8' : '#9ca3af';
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 15" />
      <path d="M3.05 11a9 9 0 0 1 1.5-4.65" strokeDasharray="2 2" />
    </svg>
  );
}

function IconLeaves({ active }: { active: boolean }) {
  const c = active ? '#1d4ed8' : '#9ca3af';
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22V12" />
      <path d="M12 12C12 7 17 3 21 3c0 5-3 9-9 9z" />
      <path d="M12 12C12 7 7 3 3 3c0 5 3 9 9 9z" />
    </svg>
  );
}

function IconProfile({ active }: { active: boolean }) {
  const c = active ? '#1d4ed8' : '#9ca3af';
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

const items: { key: Tab; href: string; label: string; Icon: React.FC<{ active: boolean }> }[] = [
  { key: 'home',    href: '/home',    label: 'Attendance', Icon: IconAttendance },
  { key: 'history', href: '/history', label: 'History',    Icon: IconHistory    },
  { key: 'leaves',  href: '/leaves',  label: 'Leaves',     Icon: IconLeaves     },
  { key: 'profile', href: '/profile', label: 'Profile',    Icon: IconProfile    },
];

export function BottomNav({ active }: { active: Tab }) {
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 480, background: '#fff',
      borderTop: '1px solid #e5e7eb', display: 'flex', zIndex: 50,
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {items.map(({ key, href, label, Icon }) => {
        const isActive = active === key;
        return (
          <Link key={key} href={href} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '8px 0 6px', textDecoration: 'none',
            color: isActive ? '#1d4ed8' : '#9ca3af',
            borderTop: isActive ? '2px solid #1d4ed8' : '2px solid transparent',
          }}>
            <Icon active={isActive} />
            <span style={{ fontSize: 10, fontWeight: 600, marginTop: 3, color: isActive ? '#1d4ed8' : '#9ca3af' }}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
