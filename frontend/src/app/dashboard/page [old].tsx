//frontend/src/app/dashboard/page.tsx
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { requireMe, extractRole } from '@/lib/auth';

export default function DashboardIndex() {
  const router = useRouter();
  useEffect(() => {
    (async () => {
      const me = await requireMe();
      if (!me) return router.push('/login?next=/dashboard');
      const role = extractRole(me);
      if (role === 'SUPER_ADMIN') router.replace('/dashboard/super/access');
      else if (role === 'ADMIN') router.replace('/dashboard/admin');
      else if (role === 'EDITOR') router.replace('/dashboard/editor');
      else if (role === 'AGENT') router.replace('/dashboard/agent');
      else if (role === 'LISTER') router.replace('/dashboard/lister');
      else router.replace('/');
    })();
  }, [router]);
  return <div className="p-6">Loading…</div>;
}