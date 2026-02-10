//frontend/src/components/site/AccountMenu.tsx
'use client';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { ChevronDown, LogOut, User, LayoutDashboard } from 'lucide-react';

export default function AccountMenu({ user }: { user: { id: string; name?: string; email?: string; role?: string }}) {
  const router = useRouter();
  const initials = (user.name || user.email || 'U').split(' ').map(s=>s[0]).join('').slice(0,2).toUpperCase();

  const logout = () => {
    localStorage.removeItem('rk_token');
    localStorage.removeItem('rk_user');
    router.replace('/');
  };

  const defaultDash = user.role === 'SUPER_ADMIN' ? '/dashboard/super'
    : user.role === 'ADMIN' ? '/dashboard/admin'
    : user.role === 'EDITOR' ? '/dashboard/editor'
    : user.role === 'AGENT' ? '/dashboard/agent'
    : user.role === 'LISTER' ? '/dashboard/lister'
    : '/dashboard';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2">
        <Avatar className="h-8 w-8">
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <ChevronDown className="h-4 w-4 text-gray-600" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="text-sm font-medium">{user.name || 'Account'}</div>
          <div className="text-xs text-gray-500">{user.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={()=>router.push(defaultDash)}>
          <LayoutDashboard className="h-4 w-4 mr-2" /> Dashboard
        </DropdownMenuItem>
        <DropdownMenuItem onClick={()=>router.push('/dashboard/profile')}>
          <User className="h-4 w-4 mr-2" /> Profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout} className="text-red-600">
          <LogOut className="h-4 w-4 mr-2" /> Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}