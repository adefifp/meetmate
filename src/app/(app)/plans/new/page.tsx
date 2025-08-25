// src/app/(app)/plans/new/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { redirect } from "next/navigation";
import CreatePlanForm from "./CreatePlanForm";

export const dynamic = "force-dynamic";

type Result = { ok: true } | { ok: false; error: string };

function spanMinutes(windowStart: number, windowEnd: number) {
  const hours = windowEnd >= windowStart
    ? (windowEnd - windowStart)
    : (24 - windowStart + windowEnd);
  return hours * 60;
}

function isValidIanaTz(tz: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sv = (Intl as any).supportedValuesOf?.("timeZone");
  return Array.isArray(sv) ? sv.includes(tz) : true;
}

async function createPlan(_prev: Result | null, formData: FormData): Promise<Result> {
  "use server";

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { ok: false, error: "Please sign in." };

  const S = z.object({
    title: z.string().min(1),
    durationMins: z.coerce.number().int().positive(),
    minAttendees: z.coerce.number().int().min(1),
    tz: z.string().min(1),
    dateFrom: z.string().min(1),
    dateTo: z.string().min(1),
    windowStart: z.coerce.number().int().min(0).max(23),
    windowEnd: z.coerce.number().int().min(0).max(23),
  });

  const parsed = S.safeParse({
    title: formData.get("title"),
    durationMins: formData.get("durationMins"),
    minAttendees: formData.get("minAttendees"),
    tz: formData.get("tz"),
    dateFrom: formData.get("dateFrom"),
    dateTo: formData.get("dateTo"),
    windowStart: formData.get("windowStart"),
    windowEnd: formData.get("windowEnd"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid form." };
  }

  const { title, durationMins, minAttendees, tz, dateFrom, dateTo, windowStart, windowEnd } = parsed.data;

  if (!isValidIanaTz(tz)) {
    return { ok: false, error: "Please choose a valid timezone." };
  }

  const from = new Date(dateFrom);
  const to = new Date(dateTo);
  if (!(from instanceof Date && !isNaN(+from) && to instanceof Date && !isNaN(+to))) {
    return { ok: false, error: "Dates are invalid." };
  }
  if (to <= from) {
    return { ok: false, error: "End must be after start." };
  }

  if (durationMins > spanMinutes(windowStart, windowEnd)) {
    return { ok: false, error: "Day window is too small to fit the duration." };
  }

  await prisma.plan.create({
    data: {
      ownerId: session.user.id,
      title,
      durationMins,
      minAttendees,
      tz,
      dateFrom: from,
      dateTo: to,
      windowStart,
      windowEnd,
    },
  });

  redirect("/plans?created=1");
}

export default async function NewPlanPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/plans/new");
  }

  return <CreatePlanForm action={createPlan} />;
}
