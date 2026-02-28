"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import RequirePermission from "@/components/super/RequirePermission";
import { sendBroadcast, searchUsers, listBroadcastHistory } from "@/components/messages/adminBroadcastApi";
import { cn } from "@/lib/utils";

// ✅ Keep Role type LOCAL (since adminBroadcastApi.ts doesn't export it)
type Role = "SUPER_ADMIN" | "ADMIN" | "LISTER" | "RENTER" | "AGENT" | "EDITOR";
const ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "LISTER", "RENTER", "AGENT", "EDITOR"];

type PickedUser = { id: string; email: string; name?: string | null; role?: string };

type AudienceMode = "ROLES" | "USERS";

function fmt(iso?: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function BroadcastsPage() {
  return (
    <RequirePermission anyOf={["SEND_ANNOUNCEMENTS"]}>
      <BroadcastsInner />
    </RequirePermission>
  );
}

function BroadcastsInner() {
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");

  // channels
  const [inApp, setInApp] = useState(true);
  const [email, setEmail] = useState(false);

  // audience
  const [mode, setMode] = useState<AudienceMode>("ROLES");
  const [rolePick, setRolePick] = useState<Partial<Record<Role, boolean>>>({
    LISTER: true,
    RENTER: true,
  });
  const [onlySubscribed, setOnlySubscribed] = useState(false);

  // user picker
  const [userQuery, setUserQuery] = useState("");
  const [userResults, setUserResults] = useState<PickedUser[]>([]);
  const [picked, setPicked] = useState<PickedUser[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // history
  const [history, setHistory] = useState<any[]>([]);
  const [histBusy, setHistBusy] = useState(false);

  const selectedRoles: Role[] = useMemo(() => {
    return Object.entries(rolePick)
      .filter(([, v]) => !!v)
      .map(([k]) => k as Role);
  }, [rolePick]);

  const canSend =
    content.trim().length > 0 &&
    (inApp || email) &&
    ((mode === "ROLES" && selectedRoles.length > 0) || (mode === "USERS" && picked.length > 0));

  const doSearch = async () => {
    const q = userQuery.trim();
    if (!q) return setUserResults([]);
    try {
      setSearchBusy(true);
      const res = await searchUsers(q);
      setUserResults(Array.isArray((res as any)?.items) ? (res as any).items : []);
    } catch (e: any) {
      setUserResults([]);
      setMsg(e?.message || "User search failed");
    } finally {
      setSearchBusy(false);
    }
  };

  const addUser = (u: PickedUser) => {
    setPicked((arr) => (arr.some((x) => x.id === u.id) ? arr : [...arr, u]));
  };

  const removeUser = (id: string) => setPicked((arr) => arr.filter((x) => x.id !== id));

  const loadHistory = async () => {
    try {
      setHistBusy(true);
      const res = await listBroadcastHistory();
      setHistory(Array.isArray((res as any)?.items) ? (res as any).items : []);
    } catch {
      setHistory([]);
    } finally {
      setHistBusy(false);
    }
  };

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = async () => {
    setMsg(null);
    if (!canSend) return;

    try {
      setBusy(true);

      // ✅ audience.roles is Role[] now (not string[])
      const audience =
        mode === "ROLES"
          ? ({ roles: selectedRoles, onlySubscribed } as any)
          : ({ userIds: picked.map((u) => u.id), onlySubscribed } as any);

      const res = await sendBroadcast({
        subject: subject.trim() || undefined,
        content: content.trim(),
        channels: { inApp, email },
        audience,
      } as any);

      setMsg(
        `✅ Sent. Audience: ${(res as any)?.audienceCount ?? "?"}. In-app: ${(res as any)?.inApp?.recipients ?? 0}, Email: ${
          (res as any)?.email?.sent ?? 0
        }`
      );

      setContent("");
      setSubject("");
      await loadHistory();
    } catch (e: any) {
      setMsg(`❌ ${e?.message || "Failed to send"}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Broadcasts</h1>
        <p className="text-sm text-gray-600">
          Send announcements via <b>in-app notifications</b>, <b>email</b>, or both — to roles or a selected batch of users.
        </p>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Compose */}
        <div className="col-span-12 lg:col-span-7 border rounded-2xl bg-white p-4 space-y-3">
          <div className="grid gap-2">
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject (optional)" />
            <Textarea rows={8} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Message…" />
          </div>

          {/* Channels */}
          <div className="border rounded-xl p-3">
            <div className="font-semibold text-sm mb-2">Channels</div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={inApp} onChange={(e) => setInApp(e.target.checked)} />
                In-app notification
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} />
                Email
              </label>

              <label className="flex items-center gap-2 text-sm ml-auto">
                <input type="checkbox" checked={onlySubscribed} onChange={(e) => setOnlySubscribed(e.target.checked)} />
                Only subscribed users
              </label>
            </div>
            {!inApp && !email && <div className="text-xs text-brand-red mt-2">Pick at least one channel.</div>}
          </div>

          <Button disabled={busy || !canSend} onClick={send} className="bg-brand-blue text-white w-full rounded-xl2">
            {busy ? "Sending…" : "Send broadcast"}
          </Button>

          {msg && <div className="text-sm">{msg}</div>}
        </div>

        {/* Audience */}
        <div className="col-span-12 lg:col-span-5 border rounded-2xl bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Audience</div>
            <div className="flex gap-2">
              <button
                className={cn("px-3 py-1.5 text-sm rounded-md border", mode === "ROLES" ? "bg-brand-gray" : "bg-white")}
                onClick={() => setMode("ROLES")}
                type="button"
              >
                By Roles
              </button>
              <button
                className={cn("px-3 py-1.5 text-sm rounded-md border", mode === "USERS" ? "bg-brand-gray" : "bg-white")}
                onClick={() => setMode("USERS")}
                type="button"
              >
                Pick Users
              </button>
            </div>
          </div>

          {mode === "ROLES" ? (
            <div className="space-y-2">
              <div className="text-sm text-gray-600">Select one or more roles:</div>
              <div className="grid grid-cols-2 gap-2">
                {ROLES.map((r) => (
                  <label key={r} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!rolePick[r]}
                      onChange={(e) => setRolePick((m) => ({ ...m, [r]: e.target.checked }))}
                    />
                    {r}
                  </label>
                ))}
              </div>
              {!selectedRoles.length && <div className="text-xs text-brand-red">Pick at least one role.</div>}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm text-gray-600">Search and add users (multi-select, sent as BCC):</div>

              <div className="flex gap-2">
                <Input
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  placeholder="Search by email or name…"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      doSearch();
                    }
                  }}
                />
                <Button variant="outline" onClick={doSearch} disabled={searchBusy}>
                  {searchBusy ? "…" : "Search"}
                </Button>
              </div>

              {!!picked.length && (
                <div className="flex flex-wrap gap-2">
                  {picked.map((u) => (
                    <span key={u.id} className="text-xs border rounded-full px-2 py-1 bg-brand-gray">
                      {u.email}
                      <button
                        className="ml-2 text-gray-500 hover:text-black"
                        onClick={() => removeUser(u.id)}
                        type="button"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="border rounded-xl overflow-hidden">
                {!userResults.length ? (
                  <div className="p-3 text-sm text-gray-500">No results.</div>
                ) : (
                  <ul className="divide-y">
                    {userResults.map((u) => (
                      <li key={u.id} className="p-3 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{u.email}</div>
                          <div className="text-xs text-gray-500 truncate">
                            {u.name || "—"} · {u.role || "—"}
                          </div>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => addUser(u)}>
                          Add
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {!picked.length && <div className="text-xs text-brand-red">Pick at least one user.</div>}
            </div>
          )}
        </div>
      </div>

      {/* History */}
      <div className="border rounded-2xl bg-white overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <div className="font-semibold">Past broadcasts</div>
            <div className="text-xs text-gray-600">Recent broadcasts sent from this dashboard.</div>
          </div>
          <Button variant="outline" onClick={loadHistory} disabled={histBusy}>
            {histBusy ? "…" : "Refresh"}
          </Button>
        </div>

        {histBusy ? (
          <div className="p-4 text-sm text-gray-600">Loading…</div>
        ) : history.length === 0 ? (
          <div className="p-4 text-sm text-gray-600">No broadcasts yet.</div>
        ) : (
          <div className="divide-y">
            {history.map((h) => (
              <div key={h.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{h.metadata?.subject || "Announcement"}</div>
                    <div className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{h.metadata?.contentPreview || ""}</div>
                    <div className="text-xs text-gray-500 mt-2">
                      {fmt(h.createdAt)} · by {h.actor?.email || "admin"}
                    </div>
                  </div>
                  <div className="text-xs text-gray-600 shrink-0">
                    <div>In-app: {h.metadata?.inApp?.recipients ?? 0}</div>
                    <div>Email: {h.metadata?.email?.sent ?? 0}</div>
                    <div>Total: {h.metadata?.audienceCount ?? "?"}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}