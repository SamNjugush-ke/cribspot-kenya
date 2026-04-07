import { Request, Response } from "express";
import dns from "node:dns/promises";
import { sendMail } from "../utils/mailer";

const CONTACT_EMAIL = process.env.CONTACT_FORM_TO || "info@cribspot.co.ke";
const APP_BASE_URL = process.env.APP_BASE_URL || process.env.PUBLIC_BASE_URL || "http://localhost:3000";

const CATEGORY_LABELS: Record<string, string> = {
  general: "General Inquiry",
  "listing-help": "Listing Help",
  billing: "Billing & Packages",
  "technical-bug": "Bug / Technical Issue",
  "account-access": "Account Access",
  "agent-partnership": "Agent / Partnership",
  "report-listing": "Report a Listing",
  feedback: "Feedback / Suggestion",
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

function normalizeEmail(email: unknown) {
  return String(email || "").trim().toLowerCase();
}

function isValidEmailFormat(email: string) {
  return EMAIL_REGEX.test(email);
}

async function hasMailCapableDomain(email: string) {
  const domain = email.split("@")[1]?.trim().toLowerCase();
  if (!domain) {
    return { ok: false, format: false, mx: false, fallbackA: false };
  }

  try {
    const mx = await dns.resolveMx(domain);
    if (Array.isArray(mx) && mx.length > 0) {
      return { ok: true, format: true, mx: true, fallbackA: false };
    }
  } catch {}

  try {
    const a = await dns.resolve4(domain);
    if (Array.isArray(a) && a.length > 0) {
      return { ok: true, format: true, mx: false, fallbackA: true };
    }
  } catch {}

  try {
    const aaaa = await dns.resolve6(domain);
    if (Array.isArray(aaaa) && aaaa.length > 0) {
      return { ok: true, format: true, mx: false, fallbackA: true };
    }
  } catch {}

  return { ok: false, format: true, mx: false, fallbackA: false };
}

async function validateEmailDeliverability(email: string) {
  const normalized = normalizeEmail(email);

  if (!normalized) {
    return {
      valid: false,
      message: "Email is required.",
      checks: { format: false, mx: false, fallbackA: false },
    };
  }

  if (!isValidEmailFormat(normalized)) {
    return {
      valid: false,
      message: "Enter a valid email address.",
      checks: { format: false, mx: false, fallbackA: false },
    };
  }

  const result = await hasMailCapableDomain(normalized);
  if (!result.ok) {
    return {
      valid: false,
      message: "This email domain does not appear able to receive mail.",
      checks: result,
    };
  }

  return {
    valid: true,
    message: result.mx
      ? "Email format looks valid and the domain can receive mail."
      : "Email format looks valid and the domain appears reachable.",
    checks: result,
  };
}

export async function validateContactEmail(req: Request, res: Response) {
  try {
    const email = normalizeEmail(req.body?.email);
    const result = await validateEmailDeliverability(email);
    return res.status(result.valid ? 200 : 400).json(result);
  } catch (error: any) {
    return res.status(500).json({
      valid: false,
      message: error?.message || "Could not validate email right now.",
    });
  }
}

export async function submitContactForm(req: Request, res: Response) {
  try {
    const name = String(req.body?.name || "").trim();
    const email = normalizeEmail(req.body?.email);
    const category = String(req.body?.category || "general").trim();
    const subject = String(req.body?.subject || "").trim();
    const message = String(req.body?.message || "").trim();

    if (!name) return res.status(400).json({ ok: false, message: "Name is required." });
    if (!email) return res.status(400).json({ ok: false, message: "Email is required." });
    if (!subject) return res.status(400).json({ ok: false, message: "Subject is required." });
    if (!message) return res.status(400).json({ ok: false, message: "Message is required." });
    if (message.length < 10) return res.status(400).json({ ok: false, message: "Message is too short." });

    const categoryLabel = CATEGORY_LABELS[category];
    if (!categoryLabel) {
      return res.status(400).json({ ok: false, message: "Invalid contact category." });
    }

    const emailCheck = await validateEmailDeliverability(email);
    if (!emailCheck.valid) {
      return res.status(400).json({ ok: false, message: emailCheck.message || "Invalid email address." });
    }

    const escaped = {
      name: name.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m] || m)),
      email: email.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m] || m)),
      subject: subject.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m] || m)),
      categoryLabel: categoryLabel.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m] || m)),
      message: message.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m] || m)).replace(/\n/g, "<br />"),
    };

    await sendMail({
      to: CONTACT_EMAIL,
      replyTo: email,
      subject: `[CribSpot Contact] [${categoryLabel}] ${subject}`,
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#111827;max-width:720px;margin:0 auto;">
          <h2 style="margin-bottom:12px;">New contact form message</h2>
          <p style="margin:0 0 16px;">A new message was sent from the CribSpot Kenya contact page.</p>

          <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
            <tr>
              <td style="padding:8px;border:1px solid #e5e7eb;background:#f9fafb;width:180px;"><strong>Name</strong></td>
              <td style="padding:8px;border:1px solid #e5e7eb;">${escaped.name}</td>
            </tr>
            <tr>
              <td style="padding:8px;border:1px solid #e5e7eb;background:#f9fafb;"><strong>Email</strong></td>
              <td style="padding:8px;border:1px solid #e5e7eb;">${escaped.email}</td>
            </tr>
            <tr>
              <td style="padding:8px;border:1px solid #e5e7eb;background:#f9fafb;"><strong>Category</strong></td>
              <td style="padding:8px;border:1px solid #e5e7eb;">${escaped.categoryLabel}</td>
            </tr>
            <tr>
              <td style="padding:8px;border:1px solid #e5e7eb;background:#f9fafb;"><strong>Subject</strong></td>
              <td style="padding:8px;border:1px solid #e5e7eb;">${escaped.subject}</td>
            </tr>
          </table>

          <div style="padding:12px;border:1px solid #e5e7eb;border-radius:12px;background:#ffffff;">
            <div style="font-weight:700;margin-bottom:8px;">Message</div>
            <div>${escaped.message}</div>
          </div>

          <p style="margin-top:16px;font-size:12px;color:#6b7280;">
            Sent from: ${APP_BASE_URL}/contact
          </p>
        </div>
      `,
    });

    return res.status(200).json({
      ok: true,
      message: "Your message has been sent. We will get back to you shortly.",
    });
  } catch (error: any) {
    return res.status(500).json({
      ok: false,
      message: error?.message || "Failed to send contact message.",
    });
  }
}
