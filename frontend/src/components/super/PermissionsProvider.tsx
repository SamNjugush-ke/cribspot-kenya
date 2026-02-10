"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { fetchMyEffectivePermissions, Permission } from "@/lib/super/api";
import { getToken, getJwtPayload } from "@/lib/super/auth";

type PermState = {
  role: string | null;
  permissions: Permission[];
  loading: boolean;
};

const Ctx = createContext<PermState>({ role: null, permissions: [], loading: true });

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);

useEffect(() => {
  let alive = true;

  async function run() {
    setLoading(true);
    try {
      const token = getToken();
      const payload = token ? getJwtPayload(token) : null;
      const r = payload?.role || null;
      if (!alive) return;
      setRole(r);

      let perms: Permission[] = [];
      try {
        perms = await fetchMyEffectivePermissions();
      } catch {
        perms = [];
      }
      if (!alive) return;
      setPermissions(perms);
    } finally {
      if (alive) setLoading(false);
    }
  }

  run();
  return () => { alive = false; };
}, []);


  const value = useMemo(() => ({ role, permissions, loading }), [role, permissions, loading]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePermissions() {
  return useContext(Ctx);
}