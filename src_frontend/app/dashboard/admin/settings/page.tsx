"use client";

import Guard from "@/components/auth/Guard";

export default function AdminSettingsPage() {
  return (
    <Guard allowed={["ADMIN", "SUPER_ADMIN"]}>
      <section className="space-y-3">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Admin settings are intentionally minimal here. Most platform configuration lives in the Super Admin
          area.
        </p>

        <div className="rounded-xl border bg-white p-4 text-sm text-muted-foreground">
          If you want this page to manage things like site banners, support contacts, or moderation rules,
          tell me what settings you want exposed and which backend endpoints you prefer.
        </div>
      </section>
    </Guard>
  );
}
