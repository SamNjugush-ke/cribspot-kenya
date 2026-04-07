"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail, Phone, MapPin, Send, ShieldCheck, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { apiPost } from "@/lib/api";

type EmailValidationState = "idle" | "checking" | "valid" | "invalid";

type ContactCategoryValue =
  | "general"
  | "listing-help"
  | "billing"
  | "technical-bug"
  | "account-access"
  | "agent-partnership"
  | "report-listing"
  | "feedback";

const CONTACT_EMAIL = "info@cribspot.co.ke";
const CONTACT_PHONE = "+254 724873794";
const LOCATION = "Nairobi, CBD, XYZ Plaza";

const CATEGORY_OPTIONS: { value: ContactCategoryValue; label: string; hint: string }[] = [
  { value: "general", label: "General Inquiry", hint: "Questions about CribSpot Kenya" },
  { value: "listing-help", label: "Listing Help", hint: "Help adding, editing, or publishing listings" },
  { value: "billing", label: "Billing & Packages", hint: "Plans, slots, invoices, or payments" },
  { value: "technical-bug", label: "Bug / Technical Issue", hint: "Something is broken or not working as expected" },
  { value: "account-access", label: "Account Access", hint: "Login, verification, or account-related issues" },
  { value: "agent-partnership", label: "Agent / Partnership", hint: "Agency, partnership, or business inquiries" },
  { value: "report-listing", label: "Report a Listing", hint: "Flag a suspicious or inaccurate property" },
  { value: "feedback", label: "Feedback / Suggestion", hint: "Ideas to improve the platform" },
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

export default function ContactPage() {
  const [name, setName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [category, setCategory] = useState<ContactCategoryValue>("general");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const [fieldError, setFieldError] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const [emailValidationState, setEmailValidationState] = useState<EmailValidationState>("idle");
  const [emailValidationMessage, setEmailValidationMessage] = useState("");

  const normalizedEmail = useMemo(() => fromEmail.trim().toLowerCase(), [fromEmail]);
  const selectedCategory = useMemo(
    () => CATEGORY_OPTIONS.find((item) => item.value === category) || CATEGORY_OPTIONS[0],
    [category]
  );

  useEffect(() => {
    if (!normalizedEmail) {
      setEmailValidationState("idle");
      setEmailValidationMessage("");
      return;
    }

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      setEmailValidationState("invalid");
      setEmailValidationMessage("Enter a valid email format, e.g. name@example.com.");
      return;
    }

    setEmailValidationState("idle");
    setEmailValidationMessage("We will verify the email domain before sending.");
  }, [normalizedEmail]);

  async function validateEmailNow() {
    if (!normalizedEmail) {
      setEmailValidationState("invalid");
      setEmailValidationMessage("Email is required.");
      return false;
    }

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      setEmailValidationState("invalid");
      setEmailValidationMessage("Enter a valid email format, e.g. name@example.com.");
      return false;
    }

    setEmailValidationState("checking");
    setEmailValidationMessage("Checking email domain…");

    const res = await apiPost<{
      valid: boolean;
      message?: string;
      checks?: { format: boolean; mx: boolean; fallbackA: boolean };
    }>("/contact/validate-email", {
      email: normalizedEmail,
    });

    if (!res.ok || !res.data) {
      setEmailValidationState("invalid");
      setEmailValidationMessage(res.error || "Could not validate that email right now.");
      return false;
    }

    if (res.data.valid) {
      setEmailValidationState("valid");
      setEmailValidationMessage(res.data.message || "Email looks deliverable.");
      return true;
    }

    setEmailValidationState("invalid");
    setEmailValidationMessage(res.data.message || "That email domain does not appear able to receive mail.");
    return false;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldError("");
    setSuccessMessage("");

    if (!name.trim()) return setFieldError("Please enter your name.");
    if (!normalizedEmail) return setFieldError("Please enter your email address.");
    if (!EMAIL_REGEX.test(normalizedEmail)) return setFieldError("Please enter a valid email address.");
    if (!category) return setFieldError("Please choose a subject category.");
    if (!subject.trim()) return setFieldError("Please enter a subject.");
    if (subject.trim().length < 4) return setFieldError("Subject is too short.");
    if (!message.trim()) return setFieldError("Please enter your message.");
    if (message.trim().length < 10) return setFieldError("Message is too short. Add a little more detail.");

    setSubmitting(true);
    try {
      const emailOk = emailValidationState === "valid" ? true : await validateEmailNow();
      if (!emailOk) {
        setFieldError("Please provide a real email address with a working mail domain.");
        return;
      }

      const res = await apiPost<{
        ok: boolean;
        message: string;
      }>("/contact", {
        name: name.trim(),
        email: normalizedEmail,
        category,
        subject: subject.trim(),
        message: message.trim(),
      });

      if (!res.ok || !res.data?.ok) {
        setFieldError(res.error || res.data?.message || "Failed to send your message.");
        return;
      }

      setSuccessMessage(res.data.message || "Your message has been sent successfully.");
      setName("");
      setFromEmail("");
      setCategory("general");
      setSubject("");
      setMessage("");
      setEmailValidationState("idle");
      setEmailValidationMessage("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="container py-10">
      <section className="space-y-6">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className="bg-brand-blue text-white">Support</Badge>
          <Badge variant="outline">Messages go directly to our inbox</Badge>
          <Badge variant="outline">We usually respond within business hours</Badge>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="rounded-2xl lg:col-span-2">
            <CardHeader>
              <CardTitle>Contact Us</CardTitle>
              <CardDescription>
                Have a question, want to report an issue, or need help listing? Send us a message and it will go
                straight to our team inbox.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <Label htmlFor="contact-name">Your name *</Label>
                    <Input
                      id="contact-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Jane Doe"
                    />
                  </div>

                  <div>
                    <Label htmlFor="contact-email">Your email *</Label>
                    <div className="space-y-2">
                      <Input
                        id="contact-email"
                        value={fromEmail}
                        onChange={(e) => setFromEmail(e.target.value)}
                        onBlur={() => {
                          if (normalizedEmail) void validateEmailNow();
                        }}
                        placeholder="e.g. jane@example.com"
                        type="email"
                        autoComplete="email"
                      />

                      <div className="flex items-center gap-2 text-xs text-gray-600 min-h-[20px]">
                        {emailValidationState === "checking" && (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>{emailValidationMessage}</span>
                          </>
                        )}

                        {emailValidationState === "valid" && (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                            <span className="text-green-700">{emailValidationMessage}</span>
                          </>
                        )}

                        {emailValidationState === "invalid" && (
                          <>
                            <AlertCircle className="h-3.5 w-3.5 text-red-600" />
                            <span className="text-red-700">{emailValidationMessage}</span>
                          </>
                        )}

                        {emailValidationState === "idle" && emailValidationMessage && <span>{emailValidationMessage}</span>}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <Label>Subject category *</Label>
                  <Select value={category} onValueChange={(value) => setCategory(value as ContactCategoryValue)}>
                    <SelectTrigger className="mt-1 h-11">
                      <SelectValue placeholder="Choose a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-2 text-xs text-gray-500">{selectedCategory.hint}</p>
                </div>

                <div>
                  <Label htmlFor="contact-subject">Subject *</Label>
                  <Input
                    id="contact-subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. My listing cannot publish"
                  />
                </div>

                <div>
                  <Label htmlFor="contact-message">Message *</Label>
                  <Textarea
                    id="contact-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell us what’s happening. For bugs, include the page link and the steps you took."
                    rows={7}
                  />
                </div>

                {fieldError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {fieldError}
                  </div>
                )}

                {successMessage && (
                  <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                    {successMessage}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <ShieldCheck className="h-4 w-4" />
                    Please avoid sharing passwords or sensitive payment PINs.
                  </div>

                  <Button type="submit" className="bg-brand-blue text-white hover:bg-black" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Send Email
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Reach us directly</CardTitle>
              <CardDescription>Quick contacts and location</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-start gap-2">
                <Mail className="mt-1 h-4 w-4" />
                <div>
                  <div className="font-medium">Email</div>
                  <a className="text-brand-blue underline" href={`mailto:${CONTACT_EMAIL}`}>
                    {CONTACT_EMAIL}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Phone className="mt-1 h-4 w-4" />
                <div>
                  <div className="font-medium">Phone</div>
                  <a className="text-brand-blue underline" href={`tel:${CONTACT_PHONE.replace(/\s+/g, "")}`}>
                    {CONTACT_PHONE}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <MapPin className="mt-1 h-4 w-4" />
                <div>
                  <div className="font-medium">Office</div>
                  <div className="text-gray-600">{LOCATION}</div>
                </div>
              </div>

              <div className="rounded-xl border bg-gray-50 p-3 text-xs text-gray-600">
                Need help with a listing from your dashboard? You can also use the built-in support area for tracked
                conversations.
              </div>

              <div className="text-xs text-gray-600">
                Want a faster route for listing work? Go to{" "}
                <Link href="/dashboard/messages/support" className="text-brand-blue underline">
                  Support Desk
                </Link>
                .
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
