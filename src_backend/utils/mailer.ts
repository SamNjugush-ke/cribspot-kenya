import nodemailer, { Transporter } from "nodemailer";
import dns from "node:dns";

dns.setDefaultResultOrder("ipv4first");

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const MAIL_FROM = process.env.MAIL_FROM || SMTP_USER || "no-reply@cribspot.co.ke";
const SMTP_DEBUG = String(process.env.SMTP_DEBUG || "").trim() === "1";

type MailTo = string | string[];

type Candidate = {
  host: string;
  port: number;
};

function uniqueCandidates(): Candidate[] {
  if (!SMTP_HOST) return [];

  const preferred = { host: SMTP_HOST, port: SMTP_PORT };
  const altPort = SMTP_PORT === 465 ? 587 : 465;

  const raw = [preferred, { host: SMTP_HOST, port: altPort }];
  const seen = new Set<string>();

  return raw.filter((c) => {
    const key = `${c.host}:${c.port}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function makeTransport(candidate: Candidate): Transporter {
  const secure = candidate.port === 465;

  return nodemailer.createTransport({
    host: candidate.host,
    port: candidate.port,
    secure,
    auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,

    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,

    logger: SMTP_DEBUG,
    debug: SMTP_DEBUG,

    tls: {
      rejectUnauthorized: true,
      servername: candidate.host,
    },
  });
}

async function verifyCandidate(candidate: Candidate) {
  const transport = makeTransport(candidate);
  await transport.verify();
  return transport;
}

async function bootstrapVerify() {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn("[MAIL] SMTP not configured (missing SMTP_HOST/SMTP_USER/SMTP_PASS).");
    return;
  }

  for (const candidate of uniqueCandidates()) {
    try {
      console.log("[MAIL] verifying SMTP...", {
        host: candidate.host,
        port: candidate.port,
        user: SMTP_USER,
        from: MAIL_FROM,
      });

      await verifyCandidate(candidate);

      console.log("[MAIL] SMTP ready:", {
        host: candidate.host,
        port: candidate.port,
      });
      return;
    } catch (e: any) {
      console.error("[MAIL] SMTP verify failed:", {
        host: candidate.host,
        port: candidate.port,
        message: e?.message || String(e),
        code: e?.code,
        command: e?.command,
        response: e?.response,
      });
    }
  }
}

bootstrapVerify().catch(() => null);

export async function sendMail(opts: {
  to: MailTo;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  text?: string;
}) {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error("SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS.");
  }

  const from = opts.from || MAIL_FROM;
  const to = Array.isArray(opts.to) ? opts.to.filter(Boolean) : opts.to;

  let lastError: any = null;

  for (const candidate of uniqueCandidates()) {
    const transport = makeTransport(candidate);

    try {
      const info = await transport.sendMail({
        from,
        to,
        replyTo: opts.replyTo,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      });

      console.log("[MAIL] sent:", {
        host: candidate.host,
        port: candidate.port,
        to,
        replyTo: opts.replyTo,
        messageId: info.messageId,
        response: info.response,
        accepted: info.accepted,
        rejected: info.rejected,
      });

      return info;
    } catch (e: any) {
      lastError = e;

      console.error("[MAIL] send attempt failed:", {
        host: candidate.host,
        port: candidate.port,
        to,
        replyTo: opts.replyTo,
        message: e?.message || String(e),
        code: e?.code,
        command: e?.command,
        response: e?.response,
      });
    } finally {
      try {
        transport.close();
      } catch {}
    }
  }

  throw lastError || new Error("Mail send failed.");
}
