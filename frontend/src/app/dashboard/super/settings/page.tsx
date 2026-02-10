"use client";

import { useEffect, useMemo, useState } from "react";
import RequirePermission from "@/components/super/RequirePermission";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import ReasonConfirmModal from "@/components/super/ReasonConfirmModal";
import { adminFetch } from "@/lib/adminFetch";

type Settings = {
  id: string;
  brandName: string;
  supportEmail: string;
  config: any; // JSON object
  createdAt?: string;
  updatedAt?: string;
};

function safePretty(obj: any) {
  try {
    return JSON.stringify(obj ?? {}, null, 2);
  } catch {
    return "{}";
  }
}

function safeParseJsonObject(s: string): { ok: true; value: Record<string, any> } | { ok: false; error: string } {
  try {
    const v = JSON.parse(s);
    if (!v || typeof v !== "object" || Array.isArray(v)) return { ok: false, error: "Config must be a JSON object (not array/null)." };
    return { ok: true, value: v };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Invalid JSON" };
  }
}

export default function SuperSettingsPage() {
  return (
    <RequirePermission anyOf={["MANAGE_SETTINGS"]}>
      <SettingsInner />
    </RequirePermission>
  );
}

function SettingsInner() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [original, setOriginal] = useState<Settings | null>(null);

  // draft fields
  const [brandName, setBrandName] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [configText, setConfigText] = useState("{}");

  // reason modal
  const [confirmOpen, setConfirmOpen] = useState(false);

  // local validation
  const parse = useMemo(() => safeParseJsonObject(configText), [configText]);
  const canSave = useMemo(() => {
    if (!original) return false;
    if (!brandName.trim()) return false;
    if (!supportEmail.trim()) return false;
    if (!parse.ok) return false;
    // dirty check
    const dirty =
      brandName !== original.brandName ||
      supportEmail !== original.supportEmail ||
      safePretty(parse.ok ? parse.value : {}) !== safePretty(original.config);
    return dirty;
  }, [original, brandName, supportEmail, parse]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const s = await adminFetch<Settings>("/api/admin/settings");
        setOriginal(s);
        setBrandName(s.brandName ?? "");
        setSupportEmail(s.supportEmail ?? "");
        setConfigText(safePretty(s.config));
      } catch (e: any) {
        alert(`Failed to load settings: ${e?.message || e}`);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function doSave(reason: string) {
    if (!original) return;
    if (!parse.ok) return alert(parse.error);
    setSaving(true);
    try {
      // Backend already logs SETTINGS_UPDATED via auditLog(req, ...)
      // We pass reason as metadata to support “why was this changed”
      await adminFetch<Settings>("/api/admin/settings", {
        method: "PUT",
        json: {
          brandName: brandName.trim(),
          supportEmail: supportEmail.trim(),
          config: parse.value,
          reason, // backend currently ignores this; safe to send, and you can log it later if you want
        },
      });

      // Reload to ensure we reflect server-merged config truth
      const s = await adminFetch<Settings>("/api/admin/settings");
      setOriginal(s);
      setBrandName(s.brandName ?? "");
      setSupportEmail(s.supportEmail ?? "");
      setConfigText(safePretty(s.config));
    } catch (e: any) {
      alert(`Save failed: ${e?.message || e}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-gray-600">Platform configuration (safe-merged on the server).</p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.location.reload()} disabled={loading || saving}>
            Reload
          </Button>
          <Button
            className="bg-brand-blue text-white"
            disabled={!canSave || saving || loading}
            onClick={() => setConfirmOpen(true)}
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>

      {loading ? (
        <Card className="shadow-soft">
          <CardContent className="p-6 text-sm text-gray-600">Loading…</CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Card className="shadow-soft xl:col-span-1">
            <CardContent className="p-4 space-y-3">
              <div>
                <Label>Brand name</Label>
                <Input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="CribSpot Kenya" />
              </div>

              <div>
                <Label>Support email</Label>
                <Input value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} placeholder="support@…" />
              </div>

              <div className="text-xs text-gray-500">
                Save requires a reason (audited). Config is a JSON object merged server-side.
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft xl:col-span-2">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">Config (JSON)</div>
                  <div className="text-xs text-gray-500">Must be a JSON object (not array/null).</div>
                </div>
                {!parse.ok && <div className="text-xs text-brand-red font-medium">{parse.error}</div>}
              </div>

              <Textarea
                value={configText}
                onChange={(e) => setConfigText(e.target.value)}
                className="min-h-[360px] font-mono text-xs"
                spellCheck={false}
              />
            </CardContent>
          </Card>
        </div>
      )}

      <ReasonConfirmModal
        open={confirmOpen}
        title="Save settings changes"
        confirmText="Save"
        onClose={() => setConfirmOpen(false)}
        onConfirm={async (reason) => {
          await doSave(reason);
        }}
      />
    </section>
  );
}
