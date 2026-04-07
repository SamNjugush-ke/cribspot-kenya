const BRAND_BLUE = "#004AAD";
const BRAND_RED = "#D62828";
const BRAND_GRAY = "#F4F4F4";

function wrapEmail(opts: { title: string; bodyHtml: string; footer?: string }) {
  const footer = opts.footer ?? "You can safely ignore this email if you didn't request it.";
  return `
  <div style="background:${BRAND_GRAY};padding:24px 12px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
      <div style="padding:18px 20px;background:${BRAND_BLUE};color:#fff;">
        <div style="font-size:18px;font-weight:700;">CribSpot Kenya</div>
        <div style="font-size:12px;opacity:0.9;">Find your next home. Faster.</div>
      </div>
      <div style="padding:20px;">
        <h1 style="margin:0 0 10px 0;font-size:18px;">${opts.title}</h1>
        <div style="font-size:14px;line-height:1.55;color:#111827;">${opts.bodyHtml}</div>
        <div style="margin-top:18px;font-size:12px;color:#6b7280;">${footer}</div>
      </div>
      <div style="padding:14px 20px;background:#fff;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;">
        © ${new Date().getFullYear()} CribSpot Kenya
      </div>
    </div>
  </div>`;
}

function button(href: string, label: string) {
  return `
    <div style="margin:16px 0 8px 0;">
      <a href="${href}" style="display:inline-block;background:${BRAND_RED};color:#fff;text-decoration:none;padding:10px 14px;border-radius:12px;font-weight:600;">${label}</a>
    </div>
    <div style="font-size:12px;color:#6b7280;word-break:break-all;">If the button doesn't work, copy and paste this link: <br/><span>${href}</span></div>
  `;
}

export function verifyEmailTemplate(opts: { name?: string; verifyUrl: string }) {
  const hello = opts.name ? `Hi ${escapeHtml(opts.name)},` : "Hi,";
  const body = `
    <p>${hello}</p>
    <p>Thanks for creating your CribSpot Kenya account. Please confirm your email to activate your account.</p>
    ${button(opts.verifyUrl, "Confirm email")}
    <p style="margin-top:14px;">This link will expire in 30 minutes.</p>
  `;
  return wrapEmail({ title: "Confirm your email", bodyHtml: body });
}

export function resetPasswordTemplate(opts: { name?: string; resetUrl: string }) {
  const hello = opts.name ? `Hi ${escapeHtml(opts.name)},` : "Hi,";
  const body = `
    <p>${hello}</p>
    <p>We received a request to reset your password. If you made this request, set a new password using the link below.</p>
    ${button(opts.resetUrl, "Reset password")}
    <p style="margin-top:14px;">This link will expire in 30 minutes.</p>
  `;
  return wrapEmail({ title: "Reset your password", bodyHtml: body });
}

function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
