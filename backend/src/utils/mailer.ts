// src/utils/mailer.ts
import nodemailer from "nodemailer";

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  MAIL_FROM = "CribSpot Kenya <no-reply@cribspot.co.ke>",
} = process.env;

export const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT || 587),
  secure: false,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

export async function sendMail(opts: {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
}) {
  return transporter.sendMail({
    from: MAIL_FROM,
    ...opts,
  });
}