'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LayoutDashboard, ClipboardList, Users, MapPin, CalendarDays, Settings, BarChart2, LogOut } from 'lucide-react';

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
  const router = useRouter();

  function logout() {
    localStorage.removeItem('admin_token');
    router.push('/login');
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="px-5 py-5 border-b border-gray-100">
          <span className="font-bold text-gray-900 text-base">BA</span>
          <span className="text-xs text-gray-400 block">Admin Dashboard</span>
        </div>
        <nav className="flex-1 py-4 space-y-0.5 px-2">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                pathname.startsWith(href)
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="px-2 py-3 border-t border-gray-100">
          <button onClick={logout}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 w-full transition-colors"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-gray-50">
        {children}
      </main>
    </div>
  );
}
