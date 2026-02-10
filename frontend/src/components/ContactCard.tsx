"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquareText, PhoneCall, Share2 } from "lucide-react";
import { API_BASE } from "@/lib/api";


type Props = {
  lister?: { id: string; name: string; phone?: string | null };
  propertyId: string;
};

function normalizePhone(p?: string | null) {
  if (!p) return "";
  const d = p.replace(/\D+/g, "");
  if (d.startsWith("254")) return d;
  if (d.startsWith("0")) return "254" + d.slice(1);
  return d;
}
function waHref(phone: string) {
  const d = normalizePhone(phone);
  return d ? `https://wa.me/${d}` : "#";
}
function telHref(phone: string) {
  const d = normalizePhone(phone);
  return d ? (d.startsWith("254") ? `tel:+${d}` : `tel:${d}`) : "#";
}

export default function ContactCard({ lister, propertyId }: Props) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [sending, setSending] = useState(false);

  const phone = lister?.phone || "";
  const isAuthed =
    typeof window !== "undefined" && !!localStorage.getItem("rk_token");

  async function sendMessage() {
    if (!message.trim()) {
      setOpen(false);
      return;
    }
    setSending(true);
    try {
      if (isAuthed && lister?.id) {
        const token = localStorage.getItem("rk_token")!;
        await fetch(`${API_BASE}/api/messages/threads`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            propertyId,
            toUserId: lister.id,
            content: message,
          }),
        });
      } else {
        await fetch(`${API_BASE}/api/contact`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            propertyId,
            email: guestEmail,
            content: message,
          }),
        });
      }
    } finally {
      setSending(false);
      setOpen(false);
      setMessage("");
      setGuestEmail("");
    }
  }

  async function shareListing() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({
          title: lister?.name
            ? `Contact ${lister.name}`
            : "Property Listing",
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        alert("Link copied to clipboard.");
      }
    } catch {}
  }

  return (
    <div className="rounded-xl border bg-white p-4 shadow space-y-4">
      <h3 className="text-lg font-semibold">Contact Lister</h3>
      {lister ? (
        <>
          <p className="text-brand-blue font-medium">{lister.name}</p>
          {phone && (
            <p className="text-gray-700 text-sm flex items-center gap-2">
              <PhoneCall className="h-4 w-4 text-brand-blue" /> {phone}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2 mt-3">
            <a
              href={phone ? waHref(phone) : "#"}
              target="_blank"
              rel="noreferrer"
              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                phone
                  ? "bg-brand-sky hover:opacity-90"
                  : "bg-gray-300 cursor-not-allowed"
              }`}
            >
              <MessageSquareText className="h-4 w-4" /> WhatsApp
            </a>

            <a
              href={phone ? telHref(phone) : "#"}
              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                phone
                  ? "bg-brand-blue text-white hover:opacity-90"
                  : "bg-gray-300 cursor-not-allowed"
              }`}
            >
              <PhoneCall className="h-4 w-4" /> Call
            </a>
          </div>

          <Button
            variant="secondary"
            className="w-full mt-3 flex items-center gap-2"
            onClick={shareListing}
          >
            <Share2 className="h-4 w-4" /> Share Listing
          </Button>

          <Button
            className="w-full bg-brand-blue text-white hover:bg-brand-blue/90"
            onClick={() => setOpen(true)}
          >
            Send Message
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm text-gray-600">
            Sign in or continue as guest to message the lister.
          </p>
          <Button
            className="mt-3 w-full bg-brand-blue text-white hover:bg-brand-blue/90"
            onClick={() => setOpen(true)}
          >
            Contact Us
          </Button>
        </>
      )}

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Contact {lister?.name || "Lister / Admin"}
            </DialogTitle>
            <DialogDescription>
              Ask about availability, viewing, or more details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {!isAuthed && (
              <Input
                placeholder="Your email (required if guest)"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
              />
            )}
            <textarea
              rows={5}
              className="w-full rounded border px-3 py-2 text-sm"
              placeholder="Hi, I'm interested in this property…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={sending}
            >
              Cancel
            </Button>
            <Button
              onClick={sendMessage}
              disabled={sending || !message.trim() || (!isAuthed && !guestEmail.trim())}
            >
              {sending ? "Sending…" : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
