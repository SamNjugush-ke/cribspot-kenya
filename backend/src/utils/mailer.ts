import nodemailer, { Transporter } from "nodemailer";
import dns from "node:dns";

dns.setDefaultResultOrder("ipv4first");

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const MAIL_FROM = process.env.MAIL_FROM || SMTP_USER || "no-reply@cribspot.co.ke";

type MailTo = string | string[];

type Candidate = {
  host: string;
  port: number;
};

function uniqueCandidates(): Candidate[] {
  if (!SMTP_HOST) return [];

  const preferred = { host: SMTP_HOST, port: SMTP_PORT };
  const altPort = SMTP_PORT === 465 ? 587 : 465;

  const list = [
    preferred,
    { host: SMTP_HOST, port: altPort },
  ];

  const seen = new Set<string>();
  return list.filter((c) => {
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
    auth:
      SMTP_USER && SMTP_PASS
        ? { user: SMTP_USER, pass: SMTP_PASS }
        : undefined,

    // Timeouts
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,

    // TLS
    ...(secure
      ? {
          tls: {
            rejectUnauthorized: true,
            servername: candidate.host,
          },
        }
      : {
          requireTLS: true,
          tls: {
            rejectUnauthorized: true,
            servername: candidate.host,
          },
        }),
  });
}

let activeCandidate: Candidate | null =
  SMTP_HOST && SMTP_USER && SMTP_PASS
    ? { host: SMTP_HOST, port: SMTP_PORT }
    : null;

let transporter: Transporter | null =
  activeCandidate ? makeTransport(activeCandidate) : null;

async function verifyCandidate(candidate: Candidate) {
  const testTransport = makeTransport(candidate);
  await testTransport.verify();
  return testTransport;
}

async function bootstrapVerify() {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn(
      "[MAIL] SMTP not configured (missing SMTP_HOST/SMTP_USER/SMTP_PASS)."
    );
    return;
  }

  const candidates = uniqueCandidates();

  for (const candidate of candidates) {
    try {
      console.log("[MAIL] verifying SMTP...", {
        host: candidate.host,
        port: candidate.port,
        user: SMTP_USER,
        from: MAIL_FROM,
      });

      transporter = await verifyCandidate(candidate);
      activeCandidate = candidate;

      console.log("[MAIL] SMTP ready:", {
        host: candidate.host,
        port: candidate.port,
      });
      return;
    } catch (e: any) {
      console.error("[MAIL] SMTP verify failed:", {
        host: candidate.host,
        port: candidate.port,
        error: e?.message || String(e),
      });
    }
  }

  transporter = null;
  activeCandidate = null;
}

bootstrapVerify().catch(() => null);

async function getWorkingTransport(): Promise<Transporter> {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error("SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS.");
  }

  if (transporter && activeCandidate) {
    return transporter;
  }

  const candidates = uniqueCandidates();

  for (const candidate of candidates) {
    try {
      const ready = await verifyCandidate(candidate);
      transporter = ready;
      activeCandidate = candidate;

      console.log("[MAIL] SMTP ready:", {
        host: candidate.host,
        port: candidate.port,
      });

      return transporter;
    } catch (e: any) {
      console.error("[MAIL] SMTP reconnect failed:", {
        host: candidate.host,
        port: candidate.port,
        error: e?.message || String(e),
      });
    }
  }

  throw new Error("No working SMTP transport available.");
}

export async function sendMail(opts: {
  to: MailTo;
  subject: string;
  html: string;
  from?: string;
}) {
  const from = opts.from || MAIL_FROM;
  const to = Array.isArray(opts.to) ? opts.to.filter(Boolean) : opts.to;

  const candidates = activeCandidate
    ? [activeCandidate, ...uniqueCandidates().filter(
        (c) => `${c.host}:${c.port}` !== `${activeCandidate!.host}:${activeCandidate!.port}`
      )]
    : uniqueCandidates();

  let lastError: any = null;

  for (const candidate of candidates) {
    try {
      // rebuild a fresh transport per attempt if candidate changed / transport missing
      if (
        !transporter ||
        !activeCandidate ||
        activeCandidate.host !== candidate.host ||
        activeCandidate.port !== candidate.port
      ) {
        transporter = makeTransport(candidate);
        activeCandidate = candidate;
      }

      const info = await transporter.sendMail({
        from,
        to,
        subject: opts.subject,
        html: opts.html,
      });

      console.log("[MAIL] sent:", {
        host: candidate.host,
        port: candidate.port,
        to,
        messageId: info.messageId,
      });

      return info;
    } catch (e: any) {
      lastError = e;
      console.error("[MAIL] send attempt failed:", {
        host: candidate.host,
        port: candidate.port,
        error: e?.message || String(e),
      });

      transporter = null;
      activeCandidate = null;
    }
  }

  throw lastError || new Error("Mail send failed.");
}