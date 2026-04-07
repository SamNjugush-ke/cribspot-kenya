// src/components/messages/SupportTicketForm.tsx
"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SupportAPI } from "./api";

const SUPPORT_CATEGORIES = [
  "Billing",
  "Listing",
  "Subscriptions",
  "Payments",
  "Account",
  "Technical",
  "Other",
] as const;

const MAX_FILES = 2;
const MAX_SIZE = 5 * 1024 * 1024;

export function SupportTicketForm({ onCreated }: { onCreated?: () => void }) {
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<(typeof SUPPORT_CATEGORIES)[number]>("Technical");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const fileHint = useMemo(() => {
    if (!files.length) return "Attach up to 2 files (max 5MB each).";
    const total = files.map((f) => `${f.name}`).join(", ");
    return `${files.length}/${MAX_FILES}: ${total}`;
  }, [files]);

  function pickFiles(list: FileList | null) {
    const arr = Array.from(list || []);
    const next = [...files, ...arr].slice(0, MAX_FILES);

    for (const f of next) {
      if (f.size > MAX_SIZE) {
        setErr(`"${f.name}" is larger than 5MB.`);
        return;
      }
    }
    setErr(null);
    setFiles(next);
  }

  async function submit() {
    setErr(null);
    if (!message.trim()) {
      setErr("Please write your message.");
      return;
    }
    setLoading(true);
    try {
      await SupportAPI.createTicket({
        subject: subject.trim() || "Support Request",
        category,
        message: message.trim(),
        files,
      });
      setSubject("");
      setCategory("Technical");
      setMessage("");
      setFiles([]);
      onCreated?.();
    } catch (e: any) {
      setErr(e?.message || "Failed to create ticket");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold">Open a Support Ticket</div>
          <div className="text-sm text-gray-600">
            Tell us what’s wrong — include screenshots if possible.
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Subject</Label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. My listing won’t publish" />
        </div>

        <div className="space-y-1">
          <Label>Category</Label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as any)}
            className="w-full border rounded-md px-3 py-2"
          >
            {SUPPORT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <Label>Message</Label>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Describe the issue, what you expected, and what happened…"
          rows={5}
        />
      </div>

      <div className="space-y-1">
        <Label>Attachments</Label>
        <div className="flex items-center gap-3">
          <Input
            type="file"
            multiple
            onChange={(e) => pickFiles(e.target.files)}
            className="cursor-pointer"
          />
          {files.length > 0 && (
            <Button variant="outline" onClick={() => setFiles([])}>
              Clear
            </Button>
          )}
        </div>
        <div className="text-xs text-gray-600">{fileHint}</div>
      </div>

      {err && <div className="text-sm text-red-600">{err}</div>}

      <div className="flex justify-end">
        <Button onClick={submit} disabled={loading}>
          {loading ? "Submitting…" : "Open Ticket"}
        </Button>
      </div>
    </div>
  );
}