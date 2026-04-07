// frontend/src/app/dashboard/layout.tsx
import type { ReactNode } from "react";
import DashboardShellClient from "@/components/DashboardShellClient";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <DashboardShellClient>{children}</DashboardShellClient>;
}
