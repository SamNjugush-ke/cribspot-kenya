// src/components/layout/SiteChrome.tsx
"use client";

import { usePathname } from "next/navigation";
import MainHeader from "@/components/site/MainHeader";

export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDashboard = pathname?.startsWith("/dashboard");

  return (
    <>
      {!isDashboard && <MainHeader />}
      {children}
    </>
  );
}
