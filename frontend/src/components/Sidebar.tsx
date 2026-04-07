"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { Role } from "@/types/user";
import { useSocket } from "@/contexts/SocketProvider";
import {
  LayoutDashboard,
  FilePlus,
  CreditCard,
  Settings,
  Building2,
  Users,
  Wallet,
  BarChart3,
  Home,
  Bookmark,
  MessageSquare,
  UserCog,
  ListChecks,
  PenSquare,
  PackagePlus,
  Receipt,
  Lock,
  PieChart,
  Tv,
  HeadsetIcon,
  InboxIcon,
  ChevronDown,
  ImageIcon,
  MonitorCog,
  X,
} from "lucide-react";

type Item = {
  label: string;
  href?: string;
  icon?: React.ComponentType<{ className?: string }>;
  children?: Item[];
};

const MSG = {
  HUB: "/dashboard/messages",
  LEADS: "/dashboard/messages/leads",
  SUPPORT: "/dashboard/messages/support",
  BROADCASTS: "/dashboard/messages/broadcasts",
};

const navByRole: Record<Role, Item[]> = {
  SUPER_ADMIN: [
    { label: "Overview", href: "/dashboard/super", icon: LayoutDashboard },
    { label: "Users", href: "/dashboard/super/users", icon: Users },
    { label: "Listings", href: "/dashboard/super/listings", icon: Building2 },
    { label: "Payments", href: "/dashboard/super/payments", icon: Wallet },
    { label: "Plans", href: "/dashboard/super/plans", icon: PackagePlus },
    { label: "Subscriptions", href: "/dashboard/super/subscriptions", icon: Receipt },
    { label: "Reports", href: "/dashboard/super/reports", icon: BarChart3 },
    { label: "Analytics", href: "/dashboard/super/analytics", icon: PieChart },
    { label: "Access Control", href: "/dashboard/super/access", icon: Lock },
    { label: "Inbox", href: MSG.HUB, icon: InboxIcon },
    { label: "Broadcasts", href: MSG.BROADCASTS, icon: Tv },
    { label: "Support", href: MSG.SUPPORT, icon: HeadsetIcon },
    { label: "Settings", href: "/dashboard/super/settings", icon: Settings },
    { label: "Audit Log", href: "/dashboard/super/audit", icon: MonitorCog },
  ],
  ADMIN: [
    { label: "Overview", href: "/dashboard/admin", icon: LayoutDashboard },
    { label: "Listings", href: "/dashboard/admin/listings", icon: Building2 },
    { label: "Users", href: "/dashboard/admin/users", icon: Users },
    { label: "Payments", href: "/dashboard/admin/payments", icon: Wallet },
    { label: "Subscriptions", href: "/dashboard/admin/subscriptions", icon: Receipt },
    {
      label: "Blogs",
      icon: PenSquare,
      children: [
        { label: "All Posts", href: "/dashboard/admin/blogs" },
        { label: "Add Post", href: "/dashboard/admin/blog-editor" },
        { label: "Categories", href: "/dashboard/admin/categories" },
        { label: "Tags", href: "/dashboard/admin/tags" },
      ],
    },
    { label: "Reports", href: "/dashboard/admin/reports", icon: BarChart3 },
    { label: "Messages", href: MSG.HUB, icon: InboxIcon },
    { label: "Broadcasts", href: MSG.BROADCASTS, icon: Tv },
    { label: "Support", href: MSG.SUPPORT, icon: HeadsetIcon },
    { label: "Settings", href: "/dashboard/admin/settings", icon: Settings },
  ],
  LISTER: [
    { label: "Overview", href: "/dashboard/lister", icon: LayoutDashboard },
    { label: "My Listings", href: "/dashboard/lister/listings", icon: Home },
    { label: "Add Listing", href: "/dashboard/lister/list", icon: FilePlus },
    { label: "Billing", href: "/dashboard/lister/billing", icon: CreditCard },
    { label: "Messages", href: MSG.HUB, icon: InboxIcon },
    { label: "Support", href: MSG.SUPPORT, icon: HeadsetIcon },
    { label: "Settings", href: "/dashboard/lister/settings", icon: Settings },
    { label: "Profile", href: "/dashboard/profile", icon: UserCog },
  ],
  RENTER: [
    { label: "Overview", href: "/dashboard/renter", icon: LayoutDashboard },
    { label: "Saved", href: "/dashboard/renter/saved", icon: Bookmark },
    { label: "Messages", href: MSG.HUB, icon: InboxIcon },
    { label: "Settings", href: "/dashboard/renter/settings", icon: Settings },
    { label: "Profile", href: "/dashboard/profile", icon: UserCog },
  ],
  AGENT: [
    { label: "Overview", href: "/dashboard/agent", icon: LayoutDashboard },
    { label: "Pipeline", href: "/dashboard/agent/pipeline", icon: ListChecks },
    { label: "Leads", href: MSG.LEADS, icon: Users },
    { label: "Inbox", href: MSG.HUB, icon: InboxIcon },
    { label: "Support", href: MSG.SUPPORT, icon: HeadsetIcon },
    { label: "Settings", href: "/dashboard/agent/settings", icon: Settings },
    { label: "Profile", href: "/dashboard/profile", icon: UserCog },
  ],
  EDITOR: [
    { label: "Overview", href: "/dashboard/editor", icon: LayoutDashboard },
    {
      label: "Posts",
      icon: PenSquare,
      children: [
        { label: "All Posts", href: "/dashboard/editor/blogs" },
        { label: "Add Post", href: "/dashboard/editor/blog-editor" },
        { label: "Categories", href: "/dashboard/editor/categories" },
        { label: "Tags", href: "/dashboard/editor/tags" },
      ],
    },
    {
      label: "Media",
      icon: ImageIcon,
      children: [
        { label: "Library", href: "/dashboard/editor/media" },
        { label: "Add Media File", href: "/dashboard/editor/media/new" },
      ],
    },
    { label: "Comments", href: "/dashboard/editor/comments", icon: MessageSquare },
    { label: "Messages", href: MSG.HUB, icon: InboxIcon },
    { label: "Settings", href: "/dashboard/editor/settings", icon: Settings },
    { label: "Profile", href: "/dashboard/profile", icon: UserCog },
  ],
};

type SidebarProps = {
  role: Role;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

function roleLabel(role: Role) {
  return role.replaceAll("_", " ");
}

export default function Sidebar({
  role,
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname();
  const { unread } = useSocket();
  const items = navByRole[role] || [];

  const autoOpenMenus = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const item of items) {
      if (item.children?.some((child) => pathname === child.href)) {
        map[item.label] = true;
      }
    }
    return map;
  }, [items, pathname]);

  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>(autoOpenMenus);

  useEffect(() => {
    setOpenMenus((prev) => ({ ...autoOpenMenus, ...prev }));
  }, [autoOpenMenus]);

  const toggleMenu = (label: string) => {
    setOpenMenus((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const navContent = (
    <>
      <div className="flex h-16 items-center justify-between border-b px-4">
        <div className="min-w-0">
          <Link
            href="/"
            className="block truncate text-base font-bold text-brand-blue"
            onClick={onMobileClose}
          >
            CribSpot Kenya
          </Link>
          <div className="text-xs text-gray-500 truncate">{roleLabel(role)}</div>
        </div>

        <button
          type="button"
          onClick={onMobileClose}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border text-gray-600 hover:bg-gray-50 md:hidden"
          aria-label="Close navigation"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          const hasChildren = !!item.children?.length;
          const isOpen = !!openMenus[item.label];

          if (hasChildren) {
            return (
              <div key={item.label}>
                <button
                  type="button"
                  onClick={() => toggleMenu(item.label)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm transition-colors",
                    "text-gray-700 hover:bg-brand-gray"
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
                    <span className="truncate">{item.label}</span>
                  </div>

                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 transition-transform",
                      isOpen ? "rotate-180" : "rotate-0"
                    )}
                  />
                </button>

                {isOpen && (
                  <div className="mt-1 space-y-1 pl-4">
                    {item.children!.map((child) => {
                      const childActive = pathname === child.href;
                      return (
                        <Link
                          key={child.href}
                          href={child.href!}
                          onClick={onMobileClose}
                          className={cn(
                            "block rounded-lg px-3 py-2 text-sm transition-colors",
                            childActive
                              ? "bg-brand-blue/10 font-medium text-brand-blue"
                              : "text-gray-600 hover:bg-brand-gray"
                          )}
                        >
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href!}
              onClick={onMobileClose}
              className={cn(
                "relative flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-brand-blue/10 font-medium text-brand-blue"
                  : "text-gray-700 hover:bg-brand-gray"
              )}
            >
              {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
              <span className="truncate">{item.label}</span>

              {item.href === MSG.HUB && unread > 0 && (
                <span className="ml-auto inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-red-600 px-2 py-0.5 text-xs text-white">
                  {unread}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </>
  );

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r bg-white md:flex md:flex-col">
        {navContent}
      </aside>

      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/40 transition-opacity md:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onMobileClose}
        aria-hidden="true"
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[86vw] max-w-[320px] flex-col border-r bg-white shadow-xl transition-transform md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        aria-hidden={!mobileOpen}
      >
        {navContent}
      </aside>
    </>
  );
}