import nodemailer from "nodemailer";

type MailConfig = {
  transporter: nodemailer.Transporter;
  from: string;
};

export function getMailConfig(): MailConfig | null {
  const host = process.env.EMAIL_HOST;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (!host || !user || !pass) {
    return null;
  }

  const secure = process.env.EMAIL_SECURE === "true";
  const port = process.env.EMAIL_PORT ? Number(process.env.EMAIL_PORT) : secure ? 465 : 587;
  const from = process.env.EMAIL_FROM?.trim() || user;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass }
  });

  return { transporter, from };
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const config = getMailConfig();
  if (!config) {
    return { ok: false, error: "Email not configured" };
  }

  const subject = "Reset your attendance app password";
  const text = [
    "You requested a password reset.",
    "Use the link below to set a new password:",
    resetUrl,
    "If you did not request this, you can ignore this email."
  ].join("\n");
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Password reset</h2>
      <p>You requested a password reset. Click the button below to set a new password.</p>
      <p>
        <a href="${resetUrl}" style="display:inline-block;padding:10px 16px;border-radius:999px;background:#111827;color:#fff;text-decoration:none;">
          Reset password
        </a>
      </p>
      <p style="font-size:12px;color:#6b7280;">If you did not request this, you can ignore this email.</p>
    </div>
  `;

  await config.transporter.sendMail({
    from: config.from,
    to,
    subject,
    text,
    html
  });

  return { ok: true };
}
