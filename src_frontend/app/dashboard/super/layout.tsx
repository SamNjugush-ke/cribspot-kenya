// frontend/src/app/dashboard/super/layout.tsx
import { PermissionsProvider } from "@/components/super/PermissionsProvider";

export default function SuperLayout({ children }: { children: React.ReactNode }) {
  return <PermissionsProvider>{children}</PermissionsProvider>;
}
