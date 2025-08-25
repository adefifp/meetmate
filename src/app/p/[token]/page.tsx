/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/p/[token]/page.tsx
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import JoinAvailability from "./JoinAvailability";
import { sendInviteEmail } from "@/lib/mailer";
import { randomUUID } from "crypto";
import { redirect } from "next/navigation";




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
  const f = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: false,
    timeZone: tz,
  });
  return Number(f.format(date)); // 0–23 hour in tz
}
function withinWindow(startHour: number, endHour: number, a: number, b: number) {
  if (a <= b) return startHour >= a && endHour <= b;
  return startHour >= a || endHour <= b;
}
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

  const step = Math.max(15, Math.min(60, durationMins));
  const totalParticipants = plan.participants.length;
  const midHour = ((windowStart + windowEnd + (windowStart > windowEnd ? 24 : 0)) / 2) % 24;

  const busyLists = plan.participants.map((p) =>
    p.busy
      .map((b) => ({ start: new Date(b.start), end: new Date(b.end) }))
      .sort((a, b) => +a.start - +b.start),
  );

  const out: { start: Date; end: Date; freeCount: number; score: number }[] = [];

  for (const start of iterateByMinutes(dateFrom, addMinutes(dateTo, -durationMins), step)) {
    const end = addMinutes(start, durationMins);


    const startHour = hourInTz(start, tz);
    const endHour = hourInTz(end, tz);
    if (!withinWindow(startHour, endHour, windowStart, windowEnd)) continue;


    let freeCount = 0;
    for (const busy of busyLists) {
      const clash = busy.some((b) => overlaps(start, end, b.start, b.end));
      if (!clash) freeCount++;
    }
    if (freeCount < minAttendees) continue;

    const busyCount = totalParticipants - freeCount;
    const hourCenter = (startHour + endHour) / 2;
    const distA = Math.abs(hourCenter - midHour);
    const distB = Math.abs(hourCenter - (midHour + 24));
    const midBias = -Math.min(distA, distB) * 2;
    const score = freeCount * 100 - busyCount * 5 + midBias;

    out.push({ start, end, freeCount, score });
  }

  return out.sort((a, b) => b.score - a.score).slice(0, max);
}


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


async function getPlanByToken(token: string) {
  return prisma.plan.findUnique({
    where: { token },
    include: {
      participants: {
        orderBy: { email: "asc" },
        select: {
          id: true,
          email: true,
          name: true,
          status: true,
          busy: { select: { id: true, start: true, end: true, source: true } },
        },
      },
      suggestions: {
        orderBy: { score: "desc" },
        take: 10,
        select: { id: true, start: true, end: true, score: true },
      },
    },
  });
}

type PlanT = NonNullable<Awaited<ReturnType<typeof getPlanByToken>>>;
type ParticipantT = PlanT["participants"][number];
type BusyT = ParticipantT["busy"][number];
type SuggestionT = PlanT["suggestions"][number];


const ParticipantStatusValues = ["pending", "accepted", "declined"] as const;
type ParticipantStatusT = (typeof ParticipantStatusValues)[number];

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
      status: z.enum(ParticipantStatusValues).optional(),
    });

    const { token, email, name, status } = S.parse({
      token: formData.get("token"),
      email: formData.get("email"),
      name: formData.get("name") ?? undefined,
      status: formData.get("status") ?? undefined,
    });

    const emailNorm = email.trim().toLowerCase();

    const starts = formData.getAll("start").map(String).filter(Boolean);
    const ends = formData.getAll("end").map(String).filter(Boolean);
    if (starts.length !== ends.length) {
      return { ok: false, error: "Each busy start needs a matching end." };
    }

    const plan = await prisma.plan.findUnique({
      where: { token },
      select: { id: true, dateFrom: true, dateTo: true },
    });
    if (!plan) return { ok: false, error: "Plan not found." };

    const existing = await prisma.participant.findFirst({
      where: { planId: plan.id, email: emailNorm },
      select: { id: true },
    });
    const participantId =
      existing?.id ??
      (
        await prisma.participant.create({
          data: {
            planId: plan.id,
            email: emailNorm,
            name: name ?? null,
            status: status ?? "pending",
          },
          select: { id: true },
        })
      ).id;

    if (existing && (name || status)) {
      await prisma.participant.update({
        where: { id: participantId },
        data: {
          ...(name ? { name } : {}),
          ...(status ? { status } : {}),
        },
      });
    }
    const rows = starts
      .map((s, i) => ({ start: new Date(s), end: new Date(ends[i]!) }))
      .filter(
        (r) =>
          r.start instanceof Date &&
          !isNaN(+r.start) &&
          r.end instanceof Date &&
          !isNaN(+r.end) &&
          r.start < r.end,
      );

    if (rows.length !== starts.length) {
      return { ok: false, error: "Invalid busy time detected. Check your dates." };
    }

    if (rows.some((r) => r.start < plan.dateFrom || r.end > plan.dateTo)) {
      return { ok: false, error: "Busy times must be within the plan window." };
    }

    rows.sort((a, b) => +a.start - +b.start);
    const merged: typeof rows = [];
    for (const r of rows) {
      const last = merged[merged.length - 1];
      if (!last) merged.push(r);
      else if (r.start <= last.end) {
        if (r.end > last.end) last.end = r.end;
      } else {
        merged.push(r);
      }
    }

    if (merged.length) {
      const minStart = merged[0]!.start;
      const maxEnd = merged[merged.length - 1]!.end;
      const existingBusy = await prisma.calendarBusy.findMany({
        where: {
          participantId,
          start: { lt: maxEnd },
          end: { gt: minStart },
        },
        select: { start: true, end: true },
      });

      const conflicts = merged.some((m) =>
        existingBusy.some((e) => m.start < e.end && e.start < m.end),
      );
      if (conflicts) {
        return {
          ok: false,
          error: "One or more busy blocks overlap your existing availability.",
        };
      }

      await prisma.calendarBusy.createMany({
        data: merged.map((m) => ({
          participantId,
          start: m.start,
          end: m.end,
          source: "manual",
        })),
      });
    }

    await recomputeAndStoreSuggestions(plan.id);
    revalidatePath(`/p/${token}`);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Something went wrong." };
  }
}

function freeCountFor(plan: PlanT, start: Date, end: Date) {
  let free = 0;
  for (const p of plan.participants as ParticipantT[]) {
    const clash = (p.busy as BusyT[]).some((b) => start < b.end && b.start < end);
    if (!clash) free++;
  }
  return free;
}
function toGCalDateUTC(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}


async function removeBusy(formData: FormData) {
  "use server";
  const token = z.string().parse(formData.get("token"));
  const busyId = z.string().parse(formData.get("busyId"));

  const plan = await prisma.plan.findFirst({
    where: { token },
    select: { id: true, ownerId: true },
  });
  if (!plan) throw new Error("Plan not found");

  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.id !== plan.ownerId) {
    throw new Error("Only the plan owner can remove busy entries.");
  }

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
    select: { id: true, ownerId: true },
  });
  if (!plan) throw new Error("Plan not found");

  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.id !== plan.ownerId) {
    throw new Error("Only the plan owner can remove participants.");
  }

  await prisma.participant.delete({ where: { id: participantId } }); // cascades busy rows
  await recomputeAndStoreSuggestions(plan.id);
  revalidatePath(`/p/${token}`);
}

/* --------------------------- finalize controls ------------------------- */
async function finalizeSlot(formData: FormData) {
  "use server";
  const token = z.string().parse(formData.get("token"));
  const start = new Date(z.string().parse(formData.get("start")));
  const end = new Date(z.string().parse(formData.get("end")));

  const plan = await prisma.plan.findFirst({
    where: { token },
    select: { id: true, ownerId: true },
  });
  if (!plan) throw new Error("Plan not found");

  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.id !== plan.ownerId) {
    throw new Error("Only the plan owner can finalize a slot.");
  }

  if (!(start instanceof Date && !isNaN(+start) && end instanceof Date && !isNaN(+end) && start < end)) {
    throw new Error("Invalid slot times.");
  }

  await prisma.plan.update({
    where: { id: plan.id },
    data: { finalStart: start, finalEnd: end },
  });

  // Optional: clear suggestions after finalizing
  await prisma.suggestion.deleteMany({ where: { planId: plan.id } });

  revalidatePath(`/p/${token}`);
}
function localParts(date: Date, tz: string) {
  // Get HH:mm and a stable yyyy-mm-dd key in the given tz
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (type: string) => Number(parts.find(p => p.type === type)?.value ?? 0);
  const hour = get("hour");
  const minute = get("minute");
  const year = get("year");
  const month = get("month");
  const day = get("day");

  const minutesOfDay = hour * 60 + minute;
  const ymd = `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
  return { minutesOfDay, ymd };
}

function withinWindowMinutes(
  startLocal: { minutesOfDay: number; ymd: string },
  endLocal:   { minutesOfDay: number; ymd: string },
  windowStartHour: number,
  windowEndHour: number
) {
  const ws = windowStartHour * 60;
  const we = windowEndHour * 60;

  if (windowStartHour <= windowEndHour) {
    if (startLocal.ymd !== endLocal.ymd) return false;
    return startLocal.minutesOfDay >= ws && endLocal.minutesOfDay <= we;
  } else {
    return startLocal.minutesOfDay >= ws || endLocal.minutesOfDay <= we;
  }
}

async function clearFinal(formData: FormData) {
  "use server";
  const token = z.string().parse(formData.get("token"));

  const plan = await prisma.plan.findFirst({
    where: { token },
    select: { id: true, ownerId: true },
  });
  if (!plan) throw new Error("Plan not found");

  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.id !== plan.ownerId) {
    throw new Error("Only the plan owner can clear the final slot.");
  }

  await prisma.plan.update({
    where: { id: plan.id },
    data: { finalStart: null, finalEnd: null },
  });

  await recomputeAndStoreSuggestions(plan.id);
  revalidatePath(`/p/${token}`);
}

async function inviteParticipants(formData: FormData) {
  "use server";

  const token = z.string().min(1).parse(formData.get("token"));
  const raw = z.string().min(1).parse(formData.get("emails"));

  const emails = Array.from(
    new Set(
      raw
        .split(/[,\s]+/)
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean)
    )
  );

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Not authenticated.");

  const plan = await prisma.plan.findUnique({
    where: { token },
    select: { id: true, ownerId: true, title: true, token: true },
  });
  if (!plan) throw new Error("Plan not found.");
  if (session.user.id !== plan.ownerId) {
    throw new Error("Only the plan owner can send invites.");
  }

  const baseUrl =
    process.env.NEXTAUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";
  const inviteUrl = `${baseUrl}/p/${plan.token}`;

  let sentCount = 0;
  let failedCount = 0;

  for (const email of emails) {
    const exists = await prisma.participant.findFirst({
      where: { planId: plan.id, email },
      select: { id: true },
    });
    if (!exists) {
      await prisma.participant.create({
        data: { planId: plan.id, email, status: "pending" as const},
      });
    }

    const idempotencyKey = randomUUID();

    try {
      await sendInviteEmail({
        to: email,
        planTitle: plan.title,
        inviteUrl,
      });

      await prisma.emailLog.create({
        data: {
          planId: plan.id,
          to: email,
          type: "invite",
          attempt: 1,
          status: "sent",
          idempotencyKey,
        },
      });

      sentCount++;
    } catch (err) {
      console.error("Invite email failed:", email, err);
      await prisma.emailLog.create({
        data: {
          planId: plan.id,
          to: email,
          type: "invite",
          attempt: 1,
          status: "error",
          idempotencyKey,
        },
      });
      failedCount++;
    }
  }

  revalidatePath(`/p/${token}`);
  redirect(`/p/${token}?invites=${sentCount}&failed=${failedCount}`);
}

export default async function PublicPlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const sp = await searchParams;

  const invitesParam = Array.isArray(sp.invites) ? sp.invites[0] : sp.invites;
  const failedParam  = Array.isArray(sp.failed)  ? sp.failed[0]  : sp.failed;

  const invites = Number(invitesParam ?? 0);
  const failed  = Number(failedParam ?? 0);

  const plan = await getPlanByToken(token);
  if (!plan) notFound();

  const session = await getServerSession(authOptions);
  const isOwner = session?.user?.id === plan.ownerId;

  const baseUrl =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.NEXTAUTH_URL ??
  "http://localhost:3000";
const shareUrl = `${baseUrl}/p/${token}`;

const gcalHref =
  plan.finalStart && plan.finalEnd
    ? (() => {
        const startUtc = toGCalDateUTC(new Date(plan.finalStart));
        const endUtc   = toGCalDateUTC(new Date(plan.finalEnd));
        const params = new URLSearchParams({
          action: "TEMPLATE",
          text: plan.title,
          details: `Plan: ${shareUrl}`,
          dates: `${startUtc}/${endUtc}`,
        });
        return `https://calendar.google.com/calendar/render?${params.toString()}`;
      })()
    : undefined;


  return (
    <div className="container-page space-y-8">
      <header className="section">
        <h1 className="h1">{plan.title}</h1>
        <p className="muted">
          {fmt(plan.dateFrom, plan.tz)} – {fmt(plan.dateTo, plan.tz)} · TZ{" "}
          <code>{plan.tz}</code> · Window {plan.windowStart}:00–{plan.windowEnd}:00 ·{" "}
          {plan.durationMins} min · Min {plan.minAttendees} Attendees
        </p>

        {plan.finalStart && plan.finalEnd && (
          <div className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-900 px-4 py-3">
            <div className="font-medium">Finalized Slot</div>
            <div className="text-sm">
              {fmt(plan.finalStart, plan.tz)} → {fmt(plan.finalEnd, plan.tz)}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {gcalHref && (
                <a
                  href={gcalHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                >
                  Add to Google Calendar
                </a>
              )}
              <a href={`/api/${token}/ics`} className="btn btn-ghost">
                Download .ics
              </a>
            </div>
            {isOwner && (
              <form action={clearFinal} className="mt-3">
                <input type="hidden" name="token" value={token} />
                <button className="btn btn-ghost btn-ghost-danger">Clear Time</button>
              </form>
            )}
          </div>
        )}
      </header>

      {(invites > 0 || failed > 0) && (
        <div
          role="alert"
          className={`rounded-lg px-4 py-3 border ${
            failed > 0
              ? "border-amber-300 bg-amber-50 text-amber-900"
              : "border-emerald-300 bg-emerald-50 text-emerald-900"
          }`}
        >
          <div className="font-medium">
            {failed > 0 ? "Invites sent with issues" : "Invites sent"}
          </div>
          <div className="text-sm mt-1">
            {invites > 0 && <span>{invites} invite{invites === 1 ? "" : "s"} sent.</span>}
            {failed > 0 && (
              <>
                {" "}
                <span>{failed} failed.</span>{" "}
                <span className="muted">Check your SMTP settings and try again.</span>
              </>
            )}
          </div>
        </div>
      )}
      <section>
        <JoinAvailability token={token} action={joinOrUpdateWithBusy} />
      </section>

      {isOwner && (
        <section className="card">
          <div className="card-body section">
            <h2 className="h2">Invite people</h2>
            <form action={inviteParticipants} className="space-y-3">
              <input type="hidden" name="token" value={token} />
              <label className="field">
                <span className="label">Emails (comma or space separated)</span>
                <textarea
                  name="emails"
                  rows={2}
                  className="input"
                  placeholder="you@example.com, me@example.com"
                  required
                />
              </label>
              <button className="btn btn-primary">Send invites</button>
              <p className="help">We’ll email them a link to this plan.</p>
            </form>
          </div>
        </section>
      )}

      <section className="card">
        <div className="card-body section">
          <h2 className="h2">Participants</h2>
          <ul className="space-y-3">
            {plan.participants.map((pt: ParticipantT) => (
              <li key={pt.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">
                    {pt.name ? `${pt.name} • ${pt.email}` : pt.email}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="badge capitalize">{pt.status}</span>
                    {isOwner && (
                      <form action={removeParticipant}>
                        <input type="hidden" name="token" value={token} />
                        <input type="hidden" name="participantId" value={pt.id} />
                        <button className="btn btn-ghost btn-ghost-danger">Remove Person</button>
                      </form>
                    )}
                  </div>
                </div>

                {pt.busy.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-sm">
                    {pt.busy.map((b: BusyT) => (
                      <li key={b.id} className="flex items-center justify-between">
                        <span>
                          {fmt(b.start, plan.tz)} → {fmt(b.end, plan.tz)}{" "}
                          <span className="muted">({b.source})</span>
                        </span>
                        {isOwner && (
                          <form action={removeBusy}>
                            <input type="hidden" name="token" value={token} />
                            <input type="hidden" name="busyId" value={b.id} />
                            <button className="btn btn-ghost btn-ghost-danger">Remove</button>
                          </form>
                        )}
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

      <section className="card">
        <div className="card-body section">
          <h2 className="h2">Suggested Slots</h2>
          {!plan.finalStart && !plan.finalEnd ? (
            plan.suggestions.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {plan.suggestions.map((s: SuggestionT, i: number) => (
                  <li
                    key={i}
                    className="text-sm flex items-center justify-between rounded-lg border border-slate-200 p-3"
                  >
                    <div>
                      <strong>{fmt(s.start, plan.tz)}</strong> → {fmt(s.end, plan.tz)}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="badge">
                        {freeCountFor(plan, new Date(s.start), new Date(s.end))} can attend
                      </span>
                      <span className="badge">score {Math.round(s.score)}</span>

                      {isOwner && (
                        <form action={finalizeSlot}>
                          <input type="hidden" name="token" value={token} />
                          <input
                            type="hidden"
                            name="start"
                            value={new Date(s.start).toISOString()}
                          />
                          <input type="hidden" name="end" value={new Date(s.end).toISOString()} />
                          <button className="btn btn-primary">Finalize</button>
                        </form>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="muted text-sm">
                No suggestions yet. Add participants and busy times, and confirm the daily window (
                {plan.windowStart}:00–{plan.windowEnd}:00 in {plan.tz}) can fit a {plan.durationMins}
                -minute slot.
              </div>
            )
          ) : (
            <div className="muted text-sm">A time is finalized. Clear it to see suggestions again.</div>
          )}
        </div>
      </section>
    </div>
  );
}
