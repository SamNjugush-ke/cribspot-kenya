'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Home,
  FilePlus2,
  CreditCard,
  BarChart3,
  MessageSquare,
  Settings,
  Bookmark,
  ClipboardList,
  Users,
  Newspaper,
  Lock,
} from 'lucide-react';

type Role = 'SUPER_ADMIN' | 'ADMIN' | 'LISTER' | 'RENTER' | 'AGENT' | 'EDITOR';

type Item = { label: string; href: string; icon: React.ElementType };

const menus: Record<Role, Item[]> = {
  SUPER_ADMIN: [
    { label: 'Overview', href: '/dashboard/super', icon: Home },
    { label: 'Users & Access', href: '/dashboard/super/users', icon: Users },
    { label: 'Listings', href: '/dashboard/super/listings', icon: ClipboardList },
    { label: 'Subscriptions', href: '/dashboard/super/subscriptions', icon: CreditCard },
    { label: 'Reports', href: '/dashboard/super/reports', icon: BarChart3 },
    { label: 'Access Control', href: '/dashboard/super/access/', icon: Lock },
    { label: 'Settings', href: '/dashboard/super/settings', icon: Settings },
  ],
  ADMIN: [
    { label: 'Overview', href: '/dashboard/admin', icon: Home },
    { label: 'Listings', href: '/dashboard/admin/listings', icon: ClipboardList },
    { label: 'Reports', href: '/dashboard/admin/reports', icon: BarChart3 },
    { label: 'Settings', href: '/dashboard/admin/settings', icon: Settings },
  ],
  LISTER: [
    { label: 'Overview', href: '/dashboard/lister', icon: Home },
    { label: 'My Listings', href: '/dashboard/lister/listings', icon: ClipboardList },
    { label: 'Create Listing', href: '/lister/list', icon: FilePlus2 },
    { label: 'Billing & Quota', href: '/dashboard/lister/billing', icon: CreditCard },
    { label: 'Messages', href: '/dashboard/lister/messages', icon: MessageSquare },
    { label: 'Analytics', href: '/dashboard/lister/analytics', icon: BarChart3 },
    { label: 'Settings', href: '/dashboard/settings', icon: Settings },
  ],
  RENTER: [
    { label: 'Overview', href: '/dashboard/renter', icon: Home },
    { label: 'Saved', href: '/dashboard/renter/saved', icon: Bookmark },
    { label: 'Applications', href: '/dashboard/renter/applications', icon: ClipboardList },
    { label: 'Messages', href: '/dashboard/renter/messages', icon: MessageSquare },
    { label: 'Settings', href: '/dashboard/settings', icon: Settings },
  ],
  AGENT: [
    { label: 'Overview', href: '/dashboard/agent', icon: Home },
    { label: 'Pipeline', href: '/dashboard/agent', icon: ClipboardList },
    { label: 'Leads', href: '/dashboard/agent/leads', icon: Users },
    { label: 'Messages', href: '/dashboard/agent/messages', icon: MessageSquare },
    { label: 'Settings', href: '/dashboard/settings', icon: Settings },
  ],
  EDITOR: [
    { label: 'Overview', href: '/dashboard/editor', icon: Home },
    { label: 'Posts', href: '/dashboard/editor', icon: Newspaper },
    { label: 'New Post', href: '/dashboard/editor/new', icon: FilePlus2 },
    { label: 'Moderation', href: '/dashboard/editor/moderation', icon: ClipboardList },
    { label: 'Settings', href: '/dashboard/settings', icon: Settings },
  ],
};

export default function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = menus[role] ?? [];

  return (
    <aside className="w-64 shrink-0 border-r bg-white h-[calc(100vh-4rem)] sticky top-16">
      <nav className="p-3 space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-muted transition',
                active ? 'bg-muted font-medium' : 'text-gray-700'
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
