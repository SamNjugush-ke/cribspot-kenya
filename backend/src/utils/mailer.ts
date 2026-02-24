import nodemailer from "nodemailer";
import dns from "node:dns";

// ✅ Force IPv4 resolution (avoids IPv6 weirdness / broken routes)
dns.setDefaultResultOrder("ipv4first");

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const MAIL_FROM = process.env.MAIL_FROM || SMTP_USER || "no-reply@cribspot.co.ke";

function makeTransport(port: number) {
  const secure = port === 465;

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure,
    auth:
      SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,

    // ✅ Make failures fast + reduce "hangs forever"
    connectionTimeout: 12_000,
    greetingTimeout: 12_000,
    socketTimeout: 20_000,

    // ✅ TLS settings that work with most cPanel servers
    ...(secure
      ? {
          tls: { rejectUnauthorized: true },
        }
      : {
          requireTLS: true,
          tls: { rejectUnauthorized: true },
        }),
  });
}

let transporter =
  SMTP_HOST && SMTP_USER && SMTP_PASS ? makeTransport(SMTP_PORT) : null;

async function verifyNow() {
  if (!transporter) {
    console.warn(
      "[MAIL] SMTP not configured (missing SMTP_HOST/SMTP_USER/SMTP_PASS)."
    );
    return;
  }

  try {
    console.log("[MAIL] verifying SMTP...", {
      host: SMTP_HOST,
      port: SMTP_PORT,
      user: SMTP_USER,
      from: MAIL_FROM,
    });
    await transporter.verify();
    console.log("[MAIL] SMTP ready:", { host: SMTP_HOST, port: SMTP_PORT });
  } catch (e: any) {
    console.error("[MAIL] SMTP verify failed:", e?.message || e);

    // ✅ Automatic fallback: if 465 fails, try 587 (or vice versa)
    const fallback = SMTP_PORT === 465 ? 587 : 465;
    try {
      console.log("[MAIL] trying fallback port...", {
        host: SMTP_HOST,
        port: fallback,
      });
      transporter = makeTransport(fallback);
      await transporter.verify();
      console.log("[MAIL] SMTP ready on fallback:", {
        host: SMTP_HOST,
        port: fallback,
      });
    } catch (e2: any) {
      console.error("[MAIL] SMTP fallback verify failed:", e2?.message || e2);
    }
  }
}

// Verify once at startup
verifyNow().catch(() => null);

type MailTo = string | string[];

export async function sendMail(opts: {
  to: MailTo;
  subject: string;
  html: string;
  from?: string;
}) {
  const from = opts.from || MAIL_FROM;

  if (!transporter) {
    throw new Error("SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS.");
  }

  // Re-verify lazily if needed (helps after network changes)
  transporter.verify().catch(() => null);

  // Nodemailer accepts array, but also fine to stringify
  const to = Array.isArray(opts.to) ? opts.to.filter(Boolean) : opts.to;

  return transporter.sendMail({
    from,
    to,
    subject: opts.subject,
    html: opts.html,
  });
}