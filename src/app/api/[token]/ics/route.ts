// src/app/api/p/[token]/ics/route.ts
import { prisma } from "@/lib/db";
import { makeICS } from "@/lib/ics";
export const runtime = "nodejs";
function sanitizeFilename(name: string) {
  return (name || "event").replace(/[/\\?%*:|"<>]/g, "-").trim();
}

export async function GET(
  _req: Request,
  ctx: { params: { token: string } }
) {
  const token = ctx.params.token;

  const plan = await prisma.plan.findUnique({
    where: { token },
    select: {
      title: true,
      finalStart: true,
      finalEnd: true,
      token: true,
      tz: true,
    },
  });

  if (!plan || !plan.finalStart || !plan.finalEnd) {
    // Return a 404 *Response* (not notFound()) so you don’t get the Next.js 404 page.
    return new Response("No finalized event.", { status: 404 });
  }

  const baseUrl =
    process.env.NEXTAUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";
  const inviteUrl = `${baseUrl}/p/${plan.token}`;

  const ics = makeICS({
    title: plan.title,
    start: new Date(plan.finalStart),
    end: new Date(plan.finalEnd),
    description: `Event timezone: ${plan.tz}\\nPlan: ${inviteUrl}`,
    url: inviteUrl,
    uid: `${plan.token}@meetmate`,
  });

  const filename = `${sanitizeFilename(plan.title)}.ics`;

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
