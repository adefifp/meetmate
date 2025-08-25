// src/lib/mailer.ts
import nodemailer from "nodemailer";
import { makeICS } from "@/lib/ics";

function sanitizeFilename(name: string) {
  return name.replace(/[/\\?%*:|"<>]/g, "-").trim() || "event";
}

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

  const html = `
    <div style="font-family: system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.45">
      <p>You’re invited to <strong>${escapeHtml(planTitle)}</strong>.</p>
      <p>
        <a href="${inviteUrl}"
           style="display:inline-block;padding:10px 14px;background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none">
          Open plan
        </a>
      </p>
      <p style="color:#667085;font-size:13px">
        If the button doesn’t work, paste this in your browser:<br/>
        <span style="word-break:break-all">${inviteUrl}</span>
      </p>
    </div>
  `;

  await mailer.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject: `You're invited: ${planTitle}`,
    text: `You're invited to "${planTitle}". Join here: ${inviteUrl}`,
    html,
  });
}

export async function sendFinalizedEmail(opts: {
  to: string;
  title: string;
  start: Date;
  end: Date;
  tz: string;
  inviteUrl: string;
}) {
  const { to, title, start, end, tz, inviteUrl } = opts;

  const ics = makeICS({
    title,
    start,
    end,
    description: `Event timezone: ${tz}\\nPlan: ${inviteUrl}`,
    url: inviteUrl,
  });

  const html = `
    <div style="font-family: system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.45">
      <p><strong>${escapeHtml(title)}</strong> has been finalized.</p>
      <p>
        <a href="${inviteUrl}"
           style="display:inline-block;padding:10px 14px;background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none">
          Open plan
        </a>
      </p>
      <p style="margin-top:8px">
        Time (your timezone "${tz}"):<br/>
        ${start.toLocaleString("en-US", { timeZone: tz })} → ${end.toLocaleString("en-US", { timeZone: tz })}
      </p>
      <p style="color:#667085;font-size:13px">Attach the event to your calendar with the attached .ics file.</p>
    </div>
  `;

  await mailer.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject: `Finalized: ${title}`,
    text: `Finalized: ${title}\n\nOpen the plan: ${inviteUrl}\nTime (${tz}): ${start.toLocaleString(
      "en-US",
      { timeZone: tz }
    )} → ${end.toLocaleString("en-US", { timeZone: tz })}`,
    html,
    attachments: [
      {
        filename: `${sanitizeFilename(title)}.ics`,
        content: ics,
        contentType: "text/calendar; charset=utf-8",
      },
    ],
  });
}

/* -------------------------- internal utilities -------------------------- */
function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
