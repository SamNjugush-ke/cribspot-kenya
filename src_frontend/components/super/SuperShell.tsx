"use client";

import React from "react";
import { usePermissions } from "./PermissionsProvider";

export function hasPermission(effective: string[], needed: string) {
  if (!needed) return true;
  if (effective.includes("*")) return true;
  return effective.includes(needed);
}

export default function RequirePermission({
  anyOf,
  children,
  fallback = null,
}: {
  anyOf: string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { permissions, role, loading } = usePermissions();

  // While loading, show a minimal skeleton (no blank screen)
  if (loading) {
    return (
      <div className="rounded-xl border p-4 text-sm opacity-70">
        Loading access…
      </div>
    );
  }

  // SUPER_ADMIN: always allowed
  if (role === "SUPER_ADMIN") return <>{children}</>;

  const ok = anyOf.some((p) => hasPermission(permissions, p));
  if (!ok) {
    return (
      fallback || (
        <div className="rounded-xl border p-6">
          <div className="text-base font-semibold">Access denied</div>
          <div className="mt-1 text-sm opacity-70">
            You don’t have permission to view this page.
          </div>
        </div>
      )
    );
  }

  return <>{children}</>;
}
