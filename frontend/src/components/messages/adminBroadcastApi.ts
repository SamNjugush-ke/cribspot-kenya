"use client";

import { adminFetch } from "@/lib/adminFetch";

export type BroadcastAudience = {
  roles?: string[];
  userIds?: string[];
  onlySubscribed?: boolean;
};

export async function sendBroadcast(payload: {
  subject?: string;
  content: string;
  channels: { inApp: boolean; email: boolean };
  audience: BroadcastAudience;
}) {
  return adminFetch(`/api/admin/broadcasts/send`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function searchUsers(q: string, role?: string) {
  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  if (role) qs.set("role", role);
  qs.set("take", "20");
  return adminFetch(`/api/admin/users/search?${qs.toString()}`);
}
