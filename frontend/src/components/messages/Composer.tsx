//frontend/src/components/messages/Composer.tsx
"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

export default function Composer({ onSend }: { onSend: (text: string) => Promise<void> | void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      setBusy(true);
      await onSend(text.trim());
      setText("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type a message…"
        className="h-11"
      />
      <Button type="submit" disabled={busy} className="h-11 bg-[#004AAD] hover:bg-[#00398a]">
        <Send className="h-4 w-4 mr-2" />
        Send
      </Button>
    </form>
  );
}