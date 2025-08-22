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
        token: randomUUID(),
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
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Create a new plan</h1>

      <form action={createPlan} className="grid gap-4 max-w-md bg-white p-4 rounded-xl shadow">
        <label className="grid gap-1">
          <span className="text-sm text-gray-700">Title</span>
          <input name="title" required className="border rounded-lg px-3 py-2" placeholder="Team sync" />
        </label>

        <label className="grid gap-1">
          <span className="text-sm text-gray-700">Duration (minutes)</span>
          <input name="durationMins" type="number" min={5} defaultValue={30} required className="border rounded-lg px-3 py-2" />
        </label>

        <label className="grid gap-1">
          <span className="text-sm text-gray-700">Minimum attendees</span>
          <input name="minAttendees" type="number" min={1} defaultValue={2} required className="border rounded-lg px-3 py-2" />
        </label>

        <label className="grid gap-1">
          <span className="text-sm text-gray-700">Timezone (IANA)</span>
          <input name="tz" required className="border rounded-lg px-3 py-2" placeholder="America/New_York" />
        </label>

        <label className="grid gap-1">
          <span className="text-sm text-gray-700">Window start (date/time)</span>
          <input name="dateFrom" type="datetime-local" required className="border rounded-lg px-3 py-2" />
        </label>

        <label className="grid gap-1">
          <span className="text-sm text-gray-700">Window end (date/time)</span>
          <input name="dateTo" type="datetime-local" required className="border rounded-lg px-3 py-2" />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="grid gap-1">
            <span className="text-sm text-gray-700">Day window start (0–23)</span>
            <input name="windowStart" type="number" min={0} max={23} defaultValue={9} required className="border rounded-lg px-3 py-2" />
          </label>
          <label className="grid gap-1">
            <span className="text-sm text-gray-700">Day window end (0–23)</span>
            <input name="windowEnd" type="number" min={0} max={23} defaultValue={18} required className="border rounded-lg px-3 py-2" />
          </label>
        </div>

        <button className="bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700">Create plan</button>
      </form>
    </div>
  );
}
