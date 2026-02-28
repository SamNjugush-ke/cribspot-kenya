// frontend/src/app/contact/page.tsx
"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, MapPin, Send, ShieldCheck } from "lucide-react";

const CONTACT_EMAIL = "info@cribspot.co.ke";
const CONTACT_PHONE = "+254 724873794";
const LOCATION = "Nairobi, CBD, XYZ Plaza";

function encodeMailto(v: string) {
  return encodeURIComponent(v).replace(/%20/g, "+");
}

export default function ContactPage() {
  const [name, setName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [subject, setSubject] = useState("CribSpot Kenya Inquiry");
  const [message, setMessage] = useState("");

  const mailtoHref = useMemo(() => {
    const bodyLines = [
      `Name: ${name || "-"}`,
      `Email: ${fromEmail || "-"}`,
      "",
      message || "",
      "",
      "—",
      "Sent via CribSpot Kenya Contact Form",
    ];

    const body = bodyLines.join("\n");
    return `mailto:${CONTACT_EMAIL}?subject=${encodeMailto(subject)}&body=${encodeMailto(body)}`;
  }, [name, fromEmail, subject, message]);

  const canSend = subject.trim().length > 0 && message.trim().length > 0;

  return (
    <main className="container py-10">
      <section className="space-y-6">
        <div className="flex items-center gap-2">
          <Badge className="bg-brand-blue text-white">Support</Badge>
          <Badge variant="outline">We usually respond within business hours</Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="rounded-2xl lg:col-span-2">
            <CardHeader>
              <CardTitle>Contact Us</CardTitle>
              <CardDescription>
                Have a question, want to report an issue, or need help listing? Send us a message.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Your name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jane Doe" />
                </div>
                <div>
                  <Label>Your email</Label>
                  <Input
                    value={fromEmail}
                    onChange={(e) => setFromEmail(e.target.value)}
                    placeholder="e.g. jane@example.com"
                    type="email"
                  />
                </div>
              </div>

              <div>
                <Label>Subject *</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. I need help publishing" />
              </div>

              <div>
                <Label>Message *</Label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us what’s happening… include links or steps if it’s a bug."
                  rows={6}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 justify-between">
                <div className="text-xs text-gray-600 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Please avoid sharing passwords or sensitive payment PINs.
                </div>

                <Button
                  className="bg-brand-blue text-white hover:bg-black"
                  disabled={!canSend}
                  onClick={() => {
                    // open mail client
                    window.location.href = mailtoHref;
                  }}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send Email
                </Button>
              </div>

              <div className="text-xs text-gray-500">
                Tip: This form opens your email app (mailto). If you don’t have an email client configured, just email us
                directly at <span className="font-medium text-gray-800">{CONTACT_EMAIL}</span>.
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Reach us directly</CardTitle>
              <CardDescription>Quick contacts and location</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <Mail className="h-4 w-4 mt-1" />
                <div>
                  <div className="font-medium">Email</div>
                  <a className="text-brand-blue underline" href={`mailto:${CONTACT_EMAIL}`}>
                    {CONTACT_EMAIL}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Phone className="h-4 w-4 mt-1" />
                <div>
                  <div className="font-medium">Phone</div>
                  <a className="text-brand-blue underline" href={`tel:${CONTACT_PHONE.replace(/\s+/g, "")}`}>
                    {CONTACT_PHONE}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-1" />
                <div>
                  <div className="font-medium">Office</div>
                  <div className="text-gray-600">{LOCATION}</div>
                </div>
              </div>

              <div className="pt-2 text-xs text-gray-600">
                For listing help, you may consider log-in to your dashboard and using the support system available.
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}