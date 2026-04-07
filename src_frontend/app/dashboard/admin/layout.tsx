// frontend/src/app/dashboard/admin/layout.tsx
// Lightweight layout for Admin routes.
// We intentionally do NOT depend on the Super PermissionsProvider here
// to avoid "Loading access…" when RBAC endpoints are admin-only.

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
