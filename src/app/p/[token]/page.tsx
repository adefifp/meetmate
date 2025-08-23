// src/app/p/[token]/page.tsx
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { z } from "zod";
import JoinAvailability from "./JoinAvailability";


export const dynamic = "force-dynamic";

/* ---------------------------- helpers (pure) ---------------------------- */
const LOCALE: Intl.LocalesArgument = "en-US";
const fmtOpts = (tz: string) =>
  ({ timeZone: tz, dateStyle: "medium", timeStyle: "short" } as const);
const fmt = (d: Date | string, tz: string) =>
  new Date(d).toLocaleString(LOCALE, fmtOpts(tz));
type ActionResult = { ok: boolean; error?: string };
function addMinutes(d: Date, mins: number) {
  return new Date(d.getTime() + mins * 60_000);
}
function* iterateByMinutes(start: Date, end: Date, stepMins: number) {
  let t = start;
  while (t <= end) {
    yield t;
    t = addMinutes(t, stepMins);
  }
}
function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}
function hourInTz(date: Date, tz: string) {
  // 0-23 hour in given timezone
  const fmt = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: false,
    timeZone: tz,
  });
  return Number(fmt.format(date));
}

/* ------------------------ suggestions (compute) ------------------------ */

type PlanForSuggest = {
  id: string;
  durationMins: number;
  minAttendees: number;
  tz: string;
  dateFrom: Date;
  dateTo: Date;
  windowStart: number;
  windowEnd: number;
  participants: { busy: { start: Date; end: Date }[] }[];
};

function computeSuggestions(plan: PlanForSuggest, max = 20) {
  const { dateFrom, dateTo, durationMins, windowStart, windowEnd, tz, minAttendees } = plan;

  // step size: fewer candidates but reasonable coverage
  const step = Math.max(15, Math.min(60, durationMins));
  const midHour = Math.floor((windowStart + windowEnd) / 2);

  const busyLists = plan.participants.map((p) =>
    p.busy
      .map((b) => ({ start: new Date(b.start), end: new Date(b.end) }))
      .sort((a, b) => +a.start - +b.start),
  );

  const out: { start: Date; end: Date; freeCount: number; score: number }[] = [];

  for (const start of iterateByMinutes(dateFrom, addMinutes(dateTo, -durationMins), step)) {
    const end = addMinutes(start, durationMins);

    // enforce daily window in plan.tz
    const hStart = hourInTz(start, tz);
    const hEnd = hourInTz(end, tz);
    if (!(hStart >= windowStart && hEnd <= windowEnd)) continue;

    // count participants who are free
    let freeCount = 0;
    for (const busy of busyLists) {
      const clash = busy.some((b) => overlaps(start, end, b.start, b.end));
      if (!clash) freeCount++;
    }
    if (freeCount < minAttendees) continue;

    // simple score: prefer more attendees & times near mid of window
    const midBias = -Math.abs(hStart - midHour);
    const score = freeCount * 10 + midBias;

    out.push({ start, end, freeCount, score });
  }

  return out.sort((a, b) => b.score - a.score).slice(0, max);
}

/* --------------------- suggestions (persist to DB) --------------------- */

async function recomputeAndStoreSuggestions(planId: string) {
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    select: {
      id: true,
      durationMins: true,
      minAttendees: true,
      tz: true,
      dateFrom: true,
      dateTo: true,
      windowStart: true,
      windowEnd: true,
      participants: { select: { busy: { select: { start: true, end: true } } } },
    },
  });
  if (!plan) return;

  const sug = computeSuggestions(plan, 20);

  await prisma.$transaction([
    prisma.suggestion.deleteMany({ where: { planId } }),
    prisma.suggestion.createMany({
      data: sug.map((s) => ({ planId, start: s.start, end: s.end, score: s.score })),
    }),
  ]);
}

/* ------------------------------ data fetch ----------------------------- */

async function getPlanByToken(token: string) {
  return prisma.plan.findUnique({
    where: { token },
    select: {
      id: true,
      title: true,
      durationMins: true,
      minAttendees: true,
      tz: true,
      dateFrom: true,
      dateTo: true,
      windowStart: true,
      windowEnd: true,
      participants: {
        select: {
          id: true,
          email: true,
          name: true,
          status: true,
          busy: { select: { id: true, start: true, end: true, source: true } },
        },
        orderBy: { email: "asc" },
      },
      suggestions: {
        orderBy: { score: "desc" },
        take: 10,
        select: { start: true, end: true, score: true },
      },
    },
  });
}

/* --------------------------- server actions ---------------------------- */

// Single action: ensure participant exists/updated and optionally add one busy block
async function joinOrUpdateWithBusy(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  "use server";

  try {
    const S = z.object({
      token: z.string().min(1),
      email: z.string().email(),
      name: z.string().optional(),
    });

    const { token, email, name } = S.parse({
      token: formData.get("token"),
      email: formData.get("email"),
      name: formData.get("name") ?? undefined,
    });

    const starts = formData.getAll("start").map((v) => v?.toString()).filter(Boolean) as string[];
    const ends   = formData.getAll("end").map((v) => v?.toString()).filter(Boolean) as string[];
    if (starts.length !== ends.length) {
      return { ok: false, error: "Each busy start needs a matching end." };
    }

    const plan = await prisma.plan.findUnique({
      where: { token },
      select: { id: true, dateFrom: true, dateTo: true },
    });
    if (!plan) return { ok: false, error: "Plan not found." };

    // ensure participant exists / update name
    const existing = await prisma.participant.findFirst({
      where: { planId: plan.id, email },
      select: { id: true },
    });
    const participantId =
      existing?.id ??
      (
        await prisma.participant.create({
          data: { planId: plan.id, email, name: name ?? null },
          select: { id: true },
        })
      ).id;

    if (existing && name) {
      await prisma.participant.update({ where: { id: participantId }, data: { name } });
    }

    // build valid busy rows
    const rows: { participantId: string; start: Date; end: Date; source: string }[] = [];
    for (let i = 0; i < starts.length; i++) {
      const s = new Date(starts[i]!);
      const e = new Date(ends[i]!);
      if (!(s instanceof Date && !isNaN(+s) && e instanceof Date && !isNaN(+e) && s < e)) {
        return { ok: false, error: "Invalid busy time detected. Check your dates." };
      }
      if (s < plan.dateFrom || e > plan.dateTo) {
        return { ok: false, error: "Busy times must be within the plan window." };
      }
      rows.push({ participantId, start: s, end: e, source: "manual" });
    }

    if (rows.length) {
      await prisma.calendarBusy.createMany({ data: rows });
    }

    await recomputeAndStoreSuggestions(plan.id);
    revalidatePath(`/p/${token}`);
    return { ok: true };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Something went wrong." };
  }
}
function freeCountFor(plan: NonNullable<Awaited<ReturnType<typeof getPlanByToken>>>, start: Date, end: Date) {
  return plan.participants.reduce((acc, p) => {
    const clashes = p.busy.some(b => start < new Date(b.end) && new Date(b.start) < end);
    return acc + (clashes ? 0 : 1);
  }, 0);
}

async function removeBusy(formData: FormData) {
  "use server";
  const token = z.string().parse(formData.get("token"));
  const busyId = z.string().parse(formData.get("busyId"));

  const plan = await prisma.plan.findFirst({
    where: { token },
    select: { id: true },
  });
  if (!plan) throw new Error("Plan not found");

  await prisma.calendarBusy.delete({ where: { id: busyId } });
  await recomputeAndStoreSuggestions(plan.id);
  revalidatePath(`/p/${token}`);
}
async function removeParticipant(formData: FormData) {
  "use server";
  const token = z.string().parse(formData.get("token"));
  const participantId = z.string().parse(formData.get("participantId"));

  const plan = await prisma.plan.findFirst({
    where: { token },
    select: { id: true },
  });
  if (!plan) throw new Error("Plan not found");

  await prisma.participant.delete({ where: { id: participantId } }); // cascades busy rows
  await recomputeAndStoreSuggestions(plan.id);
  revalidatePath(`/p/${token}`);
}

/* --------------------------------- page -------------------------------- */

export default async function PublicPlanPage({ params }: { params: { token: string } }) {
  const token = params.token;
  const plan = await getPlanByToken(token);
  if (!plan) notFound();

  const fmtOpts = (tz: string) =>
    ({ timeZone: tz, dateStyle: "medium", timeStyle: "short" } as const);

  return (
    <div className="container-page space-y-8">
      <header className="section">
        <h1 className="h1">{plan.title}</h1>
        <p className="muted">
          {fmt(plan.dateFrom, plan.tz)} – {fmt(plan.dateTo, plan.tz)}
          <code>{plan.tz}</code> · Window {plan.windowStart}:00–{plan.windowEnd}:00 ·{" "}
          {plan.durationMins} min · Min {plan.minAttendees}
        </p>
      </header>
  
      {/* Combined form */}
      <section>
        <JoinAvailability token={token} action={joinOrUpdateWithBusy} />
      </section>
  
      {/* Participants */}
      <section className="card">
        <div className="card-body section">
          <h2 className="h2">Participants</h2>
          <ul className="space-y-3">
            {plan.participants.map((pt) => (
              <li key={pt.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">
                    {pt.name ? `${pt.name} • ${pt.email}` : pt.email}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="badge capitalize">{pt.status}</span>
                    <form action={removeParticipant}>
                      <input type="hidden" name="token" value={token} />
                      <input type="hidden" name="participantId" value={pt.id} />
                      <button className="btn btn-ghost btn-ghost-danger">Remove person</button>
                    </form>
                  </div>
                </div>
  
                {pt.busy.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-sm">
                    {pt.busy.map((b) => (
                      <li key={b.id} className="flex items-center justify-between">
                        <span>
                          {fmt(b.start, plan.tz)} → {fmt(b.end, plan.tz)}
                          <span className="muted">({b.source})</span>
                        </span>
                        <form action={removeBusy}>
                          <input type="hidden" name="token" value={token} />
                          <input type="hidden" name="busyId" value={b.id} />
                          <button className="btn btn-ghost btn-ghost-danger">Remove</button>
                        </form>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="muted text-sm">No busy times added.</div>
                )}
              </li>
            ))}
            {plan.participants.length === 0 && <li className="muted">No participants yet.</li>}
          </ul>
        </div>
      </section>
  
      {/* Suggestions */}
      <section className="card">
        <div className="card-body section">
          <h2 className="h2">Suggested slots</h2>
          {plan.suggestions.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {plan.suggestions.map((s, i) => (
                <li key={i} className="text-sm flex items-center justify-between rounded-lg border border-slate-200 p-3">
                <div>
                  <strong>{fmt(s.start, plan.tz)}</strong> → {fmt(s.end, plan.tz)}
                </div>
                <div className="flex items-center gap-2">
                  <span className="badge">
                    {freeCountFor(plan, new Date(s.start), new Date(s.end))} can attend
                  </span>
                  <span className="badge">score {Math.round(s.score)}</span>
                </div>
              </li>
              ))}
            </ul>
          ) : (
            <div className="muted text-sm">
              No suggestions yet. Add busy times and ensure the daily window fits {plan.durationMins} minutes.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
