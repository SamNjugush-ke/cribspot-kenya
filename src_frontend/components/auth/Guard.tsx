'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { requireMe, extractRole } from '@/lib/auth';

export default function Guard({
  allowed,
  children,
}: {
  allowed: string[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const me = await requireMe(); // <-- returns the user object now
      if (!mounted) return;

      if (!me) {
        router.push(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }

      const role = extractRole(me); // ADMIN, SUPER_ADMIN, etc.
      if (!role || !allowed.includes(role)) {
        // fallback if not allowed
        router.push('/dashboard');
        return;
      }

      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [pathname, router, allowed]);

  if (loading) return <div className="p-6">Loading…</div>;
  return <>{children}</>;
}