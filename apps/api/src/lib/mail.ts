import nodemailer from "nodemailer";
import { env } from "../env.js";

/**
 * Outbound email. Points at Mailpit in development, a real provider otherwise.
 *
 * Magic-link sign-in is unusable if this fails, so send errors are surfaced to
 * the caller rather than swallowed.
 */
const transport = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth:
    env.SMTP_USER && env.SMTP_PASSWORD
      ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
      : undefined,
  // Mailpit presents a self-signed certificate.
  tls: { rejectUnauthorized: env.NODE_ENV === "production" },
});

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendMail(message: MailMessage): Promise<void> {
  await transport.sendMail({
    from: env.EMAIL_FROM,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
}

export function magicLinkEmail(url: string): { subject: string; text: string; html: string } {
  return {
    subject: "Your LunchMeet sign-in link",
    text: [
      "Tap the link below to sign in to LunchMeet.",
      "",
      url,
      "",
      "This link expires shortly and can only be used once.",
      "If you did not request it, you can ignore this email.",
    ].join("\n"),
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h1 style="font-size:20px;color:#E85D4C;margin:0 0 16px">LunchMeet</h1>
        <p style="font-size:15px;line-height:1.5;color:#333">Tap the button below to sign in.</p>
        <p style="margin:24px 0">
          <a href="${url}"
             style="background:#E85D4C;color:#fff;padding:12px 20px;border-radius:8px;
                    text-decoration:none;display:inline-block;font-weight:600">
            Sign in to LunchMeet
          </a>
        </p>
        <p style="font-size:13px;color:#777;line-height:1.5">
          This link expires shortly and can only be used once.
          If you did not request it, you can ignore this email.
        </p>
      </div>
    `,
  };
}
