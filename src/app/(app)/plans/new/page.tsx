// src/app/(app)/plans/new/page.tsx
import { z } from "zod";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";
import { randomUUID } from "crypto";

const PlanSchema = z.object({
  title: z.string().min(3),
  durationMins: z.coerce.number().int().positive(),
  minAttendees: z.coerce.number().int().min(1),
  tz: z.string().min(1),
  dateFrom: z.coerce.date(),
  dateTo: z.coerce.date(),
  windowStart: z.coerce.number().int().min(0).max(23),
  windowEnd: z.coerce.number().int().min(0).max(23),
});

export default function NewPlanPage() {
  async function createPlan(formData: FormData) {
    "use server";

    const parsed = PlanSchema.safeParse({
      title: formData.get("title"),
      durationMins: formData.get("durationMins"),
      minAttendees: formData.get("minAttendees"),
      tz: formData.get("tz"),
      dateFrom: formData.get("dateFrom"),
      dateTo: formData.get("dateTo"),
      windowStart: formData.get("windowStart"),
      windowEnd: formData.get("windowEnd"),
    });
    if (!parsed.success) throw new Error("Invalid form data");

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new Error("Not authenticated");

    const plan = await prisma.plan.create({
      data: {
        token: randomUUID(), // remove if your Prisma schema has @default(uuid()) and you've regenerated
        ownerId: session.user.id,
        title: parsed.data.title,
        durationMins: parsed.data.durationMins,
        minAttendees: parsed.data.minAttendees,
        tz: parsed.data.tz,
        dateFrom: parsed.data.dateFrom,
        dateTo: parsed.data.dateTo,
        windowStart: parsed.data.windowStart,
        windowEnd: parsed.data.windowEnd,
      },
      select: { token: true },
    });

    redirect(`/p/${plan.token}`);
  }

  return (
    <div className="container-page space-y-6">
  <h1 className="h1">Create a new plan</h1>

  <form action={createPlan} className="card">
    <div className="card-body section">
      <label className="field">
        <span className="label">Title</span>
        <input name="title" className="input" required />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="field">
          <span className="label">Duration (minutes)</span>
          <input name="durationMins" type="number" min={5} defaultValue={30} className="input" required />
        </label>
        <label className="field">
          <span className="label">Minimum attendees</span>
          <input name="minAttendees" type="number" min={1} defaultValue={2} className="input" required />
        </label>
      </div>

      <label className="field">
        <span className="label">Timezone (IANA)</span>
        <input name="tz" placeholder="America/New_York" className="input" required />
        <span className="help">Use a valid IANA TZ like America/Los_Angeles</span>
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="field">
          <span className="label">Window start</span>
          <input name="dateFrom" type="datetime-local" className="input" required />
        </label>
        <label className="field">
          <span className="label">Window end</span>
          <input name="dateTo" type="datetime-local" className="input" required />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="field">
          <span className="label">Day window start (0–23)</span>
          <input name="windowStart" type="number" min={0} max={23} defaultValue={9} className="input" required />
        </label>
        <label className="field">
          <span className="label">Day window end (0–23)</span>
          <input name="windowEnd" type="number" min={0} max={23} defaultValue={18} className="input" required />
        </label>
      </div>

      <div className="flex gap-3">
  <button type="submit" className="btn btn-primary">Create plan</button>
  <a href="/plans" className="btn btn-ghost">Cancel</a>
</div>
    </div>
  </form>
</div>
  );
}
