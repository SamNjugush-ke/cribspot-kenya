'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { Role } from '@/types/user';
import { API_BASE } from '@/lib/api';
import { useSocket } from "@/contexts/SocketProvider";
import {
  LayoutDashboard, FilePlus, CreditCard, Settings, Building2, Users, Wallet,
  BarChart3, Home, Bookmark, MessageSquare, UserCog, ListChecks, PenSquare,
  PackagePlus, Folder, Receipt, Lock, PieChart, Tv, HeadsetIcon, InboxIcon,
  ChartLine, Tags, ChevronDown, ImageIcon, MonitorCog
} from 'lucide-react';

type Item = {
  label: string;
  href?: string;
  icon?: React.ComponentType<{ className?: string }>;
  children?: Item[];
};

/** Unified messaging routes */
const MSG = {
  HUB: '/dashboard/messages',
  LEADS: '/dashboard/messages/leads',
  SUPPORT: '/dashboard/messages/support',
  BROADCASTS: '/dashboard/messages/broadcasts',
};

const navByRole: Record<Role, Item[]> = {
  SUPER_ADMIN: [
    { label: 'Overview', href: '/dashboard/super', icon: LayoutDashboard },
    { label: 'Users', href: '/dashboard/super/users', icon: Users },
    { label: 'Listings', href: '/dashboard/super/listings', icon: Building2 },
    { label: 'Payments', href: '/dashboard/super/payments', icon: Wallet },
    { label: 'Plans', href: '/dashboard/super/plans', icon: PackagePlus },
    { label: 'Subscriptions', href: '/dashboard/super/subscriptions', icon: Receipt },
    { label: 'Reports', href: '/dashboard/super/reports', icon: BarChart3 },
    { label: 'Analytics', href: '/dashboard/super/analytics', icon: PieChart },
    { label: 'Access Control', href: '/dashboard/super/access', icon: Lock },
    { label: 'Inbox', href: MSG.HUB, icon: InboxIcon },
    { label: 'Broadcasts', href: MSG.BROADCASTS, icon: Tv },
    { label: 'Support', href: MSG.SUPPORT, icon: HeadsetIcon },
    { label: 'Settings', href: '/dashboard/super/settings', icon: Settings },
    { label: 'Audit Log', href: '/dashboard/super/audit', icon: MonitorCog }, 
  ],
  ADMIN: [
    { label: 'Overview', href: '/dashboard/admin', icon: LayoutDashboard },
    { label: 'Listings', href: '/dashboard/admin/listings', icon: Building2 },
    { label: 'Users', href: '/dashboard/admin/users', icon: Users },
    { label: 'Payments', href: '/dashboard/admin/payments', icon: Wallet },
    { label: 'Reports', href: '/dashboard/admin/reports', icon: BarChart3 },
    { label: 'Inbox', href: MSG.HUB, icon: InboxIcon },
    { label: 'Broadcasts', href: MSG.BROADCASTS, icon: Tv },
    { label: 'Support', href: MSG.SUPPORT, icon: HeadsetIcon },
    { label: 'Settings', href: '/dashboard/admin/settings', icon: Settings },
  ],
  LISTER: [
    { label: 'Overview', href: '/dashboard/lister', icon: LayoutDashboard },
    { label: 'My Listings', href: '/dashboard/lister/listings', icon: Home },
    { label: 'Add Listing', href: '/dashboard/lister/list', icon: FilePlus },
    { label: 'Billing & Quota', href: '/dashboard/lister/billing', icon: CreditCard },
    { label: 'Leads', href: MSG.LEADS, icon: ChartLine },
    { label: 'Inbox', href: MSG.HUB, icon: InboxIcon },
    { label: 'Support', href: MSG.SUPPORT, icon: HeadsetIcon },
    { label: 'Settings', href: '/dashboard/lister/settings', icon: Settings },
    { label: 'Profile', href: '/dashboard/profile', icon: UserCog },
  ],
  RENTER: [
    { label: 'Overview', href: '/dashboard/renter', icon: LayoutDashboard },
    { label: 'Saved', href: '/dashboard/renter/saved', icon: Bookmark },
    { label: 'Applications', href: '/dashboard/renter/applications', icon: ListChecks },
    { label: 'Inbox', href: MSG.HUB, icon: InboxIcon },
    { label: 'Support', href: MSG.SUPPORT, icon: HeadsetIcon },
    { label: 'Profile', href: '/dashboard/profile', icon: UserCog },
    { label: 'Settings', href: '/dashboard/renter/settings', icon: Settings },
  ],
  AGENT: [
    { label: 'Overview', href: '/dashboard/agent', icon: LayoutDashboard },
    { label: 'Pipeline', href: '/dashboard/agent/pipeline', icon: ListChecks },
    { label: 'Leads', href: MSG.LEADS, icon: Users },
    { label: 'Inbox', href: MSG.HUB, icon: InboxIcon },
    { label: 'Support', href: MSG.SUPPORT, icon: HeadsetIcon },
    { label: 'Settings', href: '/dashboard/agent/settings', icon: Settings },
    { label: 'Profile', href: '/dashboard/profile', icon: UserCog },
  ],

  EDITOR: [
    { label: 'Overview', href: '/dashboard/editor', icon: LayoutDashboard },
    {
      label: 'Posts',
      icon: PenSquare,
      children: [
        { label: 'All Posts', href: '/dashboard/editor/blogs' },
        { label: 'Add Post', href: '/dashboard/editor/blog-editor' },
        { label: 'Categories', href: '/dashboard/editor/categories' },
        { label: 'Tags', href: '/dashboard/editor/tags' },
      ],
    },
    {
      label: 'Media',
      icon: ImageIcon,
      children: [
        { label: 'Library', href: '/dashboard/editor/media' },
        { label: 'Add Media File', href: '/dashboard/editor/media/new' },
      ],
    },
    { label: 'Comments', href: '/dashboard/editor/comments', icon: MessageSquare },
    { label: 'Inbox', href: MSG.HUB, icon: InboxIcon },
    { label: 'Settings', href: '/dashboard/editor/settings', icon: Settings },
    { label: 'Profile', href: '/dashboard/profile', icon: UserCog },
  ],
};

function useUnreadCount() {
  const [unread, setUnread] = useState<number>(0);
  const timerRef = useRef<number | null>(null);
  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('rk_token') : null;
        if (!token) return setUnread(0);
        const res = await fetch(`${API_BASE}/api/messages/unread-count`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const json = await res.json();
        setUnread(Number(json?.unread || 0));
      } catch {}
    };
    fetchUnread();
    timerRef.current = window.setInterval(fetchUnread, 20_000);
    //return () => timerRef.current && clearInterval(timerRef.current);
    return () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }}
  }, []);
  return unread;
}

export default function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const { unread } = useSocket();
  const items = navByRole[role] || [];
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});

  const toggleMenu = (label: string) => {
    setOpenMenus((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <aside className="w-64 shrink-0 border-r bg-white sticky top-0 h-screen hidden md:flex md:flex-col">
      <div className="h-14 flex items-center px-4 border-b">
        <Link href="/" className="font-bold text-brand-blue">
          Dashboard
        </Link>
      </div>
      <nav className="p-3 space-y-1 overflow-y-auto">
        {items.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          const hasChildren = item.children && item.children.length > 0;
          const isOpen = openMenus[item.label];

          if (hasChildren) {
            return (
              <div key={item.label}>
                <button
                  onClick={() => toggleMenu(item.label)}
                  className={cn(
                    'flex items-center justify-between w-full px-3 py-2 rounded-md text-sm hover:bg-brand-gray',
                    'text-gray-700'
                  )}
                >
                  <div className="flex items-center gap-2">
                    {Icon && <Icon className="h-4 w-4" />}
                    <span>{item.label}</span>
                  </div>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 transition-transform',
                      isOpen ? 'rotate-180' : 'rotate-0'
                    )}
                  />
                </button>
                {isOpen && (
                  <div className="ml-6 mt-1 space-y-1">
                    {item.children!.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href!}
                        className={cn(
                          'block px-3 py-1 rounded-md text-sm hover:bg-brand-gray',
                          pathname === child.href ? 'bg-brand-gray font-medium' : 'text-gray-600'
                        )}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href!}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-brand-gray relative',
                active ? 'bg-brand-gray font-medium' : 'text-gray-700'
              )}
            >
              {Icon && <Icon className="h-4 w-4" />}
              <span>{item.label}</span>
              {item.href === MSG.HUB && unread > 0 && (
                <span className="ml-auto inline-flex items-center justify-center rounded-full bg-red-600 text-white text-xs px-2 py-0.5">
                  {unread}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
