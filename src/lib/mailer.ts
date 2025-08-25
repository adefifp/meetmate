// src/lib/mailer.ts
import nodemailer from "nodemailer";

export const mailer = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER!,
    pass: process.env.EMAIL_PASS!,
  },
});

export async function sendInviteEmail(opts: {
  to: string;
  planTitle: string;
  inviteUrl: string;
}) {
  const { to, planTitle, inviteUrl } = opts;
  await mailer.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject: `You're invited to: ${planTitle}`,
    text: `You're invited to "${planTitle}". Join here: ${inviteUrl}`,
    html: `
      <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif">
        <p>You’re invited to <strong>${planTitle}</strong>.</p>
        <p><a href="${inviteUrl}" style="display:inline-block;padding:10px 14px;background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none">Open plan</a></p>
        <p>If the button doesn’t work, paste this in your browser: <br/>${inviteUrl}</p>
      </div>
    `,
  });
}
