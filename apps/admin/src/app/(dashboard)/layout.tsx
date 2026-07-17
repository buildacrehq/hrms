'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, ClipboardList, Users, MapPin,
  CalendarDays, Settings, BarChart2, LogOut, Building2,
} from 'lucide-react';

const nav = [
  { href: '/dashboard', label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/punches',   label: 'Approvals',  icon: ClipboardList },
  { href: '/employees', label: 'Employees',  icon: Users },
  { href: '/sites',     label: 'Sites',      icon: MapPin },
  { href: '/holidays',  label: 'Holidays',   icon: CalendarDays },
  { href: '/reports',   label: 'Reports',    icon: BarChart2 },
  { href: '/settings',  label: 'Settings',   icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();

  function logout() {
    localStorage.removeItem('admin_token');
    router.push('/login');
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar */}
      <aside className="w-60 bg-slate-900 flex flex-col shrink-0">
        {/* Brand */}
        <div className="px-5 py-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-linear-to-br from-blue-500 to-blue-700 flex items-center justify-center shrink-0 shadow-lg shadow-blue-900/40">
              <Building2 size={16} className="text-white" />
            </div>
            <div>
              <div className="text-white font-bold text-sm tracking-wide">BA Workforce</div>
              <div className="text-slate-500 text-xs mt-0.5">Admin Console</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link key={href} href={href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                  active
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/30'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100',
                )}
              >
                <Icon size={16} className={active ? 'opacity-100' : 'opacity-70'} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="px-3 pb-4 border-t border-slate-800 pt-3">
          <button onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-500 hover:text-red-400 hover:bg-slate-800 w-full transition-all duration-150"
          >
            <LogOut size={15} />Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
