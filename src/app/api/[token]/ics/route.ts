import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic"; 

function pad(n: number) {
  return n.toString().padStart(2, "0");
}
function toIcsUtc(dt: Date) {
  const y = dt.getUTCFullYear();
  const m = pad(dt.getUTCMonth() + 1);
  const d = pad(dt.getUTCDate());
  const hh = pad(dt.getUTCHours());
  const mm = pad(dt.getUTCMinutes());
  const ss = pad(dt.getUTCSeconds());
  return `${y}${m}${d}T${hh}${mm}${ss}Z`;
}
function esc(s: string) {
  return s.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function GET(_req: Request, context: any) {
  const token = context?.params?.token as string | undefined;
  if (!token) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const plan = await prisma.plan.findUnique({
    where: { token },
    select: { title: true, finalStart: true, finalEnd: true, tz: true },
  });

  if (!plan || !plan.finalStart || !plan.finalEnd) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const now = new Date();
  const dtstamp = toIcsUtc(now);
  const dtstart = toIcsUtc(new Date(plan.finalStart));
  const dtend   = toIcsUtc(new Date(plan.finalEnd));

  const uid = `meetmate-${token}@${process.env.NEXT_PUBLIC_APP_URL ?? "localhost"}`;

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MeetMate//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${esc(plan.title)}`,
    `DESCRIPTION:${esc("Scheduled via MeetMate")}`,
    "END:VEVENT",
    "END:VCALENDAR",
    ""
  ].join("\r\n");

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="meetmate-${token}.ics"`,
    },
  });
}
