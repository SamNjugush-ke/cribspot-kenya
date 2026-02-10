//frontend/src/components/messages/SupportTicketForm.tsx
"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { MessagesAPI } from "@/components/messages/api";

type SupportTicketFormProps = {
  onCreated?: (id: string) => void; // ✅ allow parent to receive new ticket id
};

export default function SupportTicketForm({ onCreated }: SupportTicketFormProps) {
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);

    try {
      const res = await MessagesAPI.createSupportTicket({
        subject,
        category: category || undefined,
        content,
        file: file ?? undefined,
      });

      const ticketId = res?.id || res?.ticketId || "";
      if (ticketId && onCreated) {
        onCreated(ticketId); // ✅ notify parent
      }

      setMsg("✅ Ticket created successfully!");
      setSubject("");
      setCategory("");
      setContent("");
      setFile(null);
    } catch (err: any) {
      setMsg(`❌ Failed: ${err.message || "Unknown error"}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border rounded-xl bg-white p-4 space-y-4"
    >
      <h2 className="font-semibold text-lg">New Support Ticket</h2>

      <Input
        placeholder="Subject"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        required
      />

      <Input
        placeholder="Category (e.g. Billing, Technical, Other)"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
      />

      <Textarea
        rows={5}
        placeholder="Describe your issue"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        required
      />

      <div>
        <label className="text-sm text-gray-600 block mb-1">
          Attachment (optional, max 5MB)
        </label>
        <Input
          type="file"
          accept="image/*,.pdf,.doc,.docx,.txt"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f && f.size > 5 * 1024 * 1024) {
              alert("File too large (max 5MB)");
              return;
            }
            setFile(f || null);
          }}
        />
        {file && (
          <p className="text-xs text-gray-500 mt-1">
            Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
          </p>
        )}
      </div>

      <Button
        type="submit"
        disabled={busy}
        className="bg-[#004AAD] hover:bg-[#00398a] text-white"
      >
        {busy ? "Submitting…" : "Submit Ticket"}
      </Button>

      {msg && <p className="text-sm mt-2">{msg}</p>}
    </form>
  );
}
