'use client';
import { LayoutDashboard, CheckCircle, User, Settings, LogOut, Calendar } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { logout } from '@/api/userProvider';
import { useState } from 'react';
import { BUTTON_SECONDARY } from '@/lib/buttonStyles';

const Sidebar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  const menuItems = [
    { href: '/dashboard', icon: LayoutDashboard },
    { href: '/dashboard/tasks', icon: CheckCircle },
    { href: '/dashboard/calendar', icon: Calendar },
    { href: '/dashboard/profile', icon: User },
    { href: '/dashboard/settings', icon: Settings },
  ];

  const handleLogout = async () => {
    if (isLoggingOut) return;
    try {
      setIsLoggingOut(true);
      await logout();
    } catch (error) {
      console.error('Logout API failed, continuing local logout:', error);
    } finally {
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      setIsLoggingOut(false);
      router.push('/login');
    }
  };

  return (
    <aside className="sticky top-0 h-screen w-[180px] shrink-0 border-r border-border bg-card">
      <div className="h-full overflow-y-auto px-3 py-5">
        <ul className="flex min-h-full flex-col items-center gap-4 text-foreground">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          
          return (
            <li
              key={item.href}
              className={`w-12 cursor-pointer transition-colors p-2.5 rounded-xl ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent hover:text-accent-foreground'
              }`}
            >
              <Link href={item.href} className="flex flex-col items-center gap-2">
                <Icon size={24} />
              </Link>
            </li>
          );
        })}
        <li className="w-12 mt-auto pt-2">
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className={`${BUTTON_SECONDARY} w-12 px-0 py-2.5`}
            aria-label="Logout"
            title="Logout"
          >
            <LogOut size={24} />
          </button>
        </li>
        </ul>
      </div>
    </aside>
  );
};

export default Sidebar;
