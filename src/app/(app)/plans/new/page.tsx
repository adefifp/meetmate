import { z } from "zod";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";
import { randomUUID } from "crypto";
import CreatePlanForm from "./CreatePlanForm";

const PlanSchema = z.object({
  title: z.string().min(3),
  durationMins: z.coerce.number().int().positive(),
  minAttendees: z.coerce.number().int().min(1),
  tz: z.string().min(1),
  dateFrom: z.coerce.date(),
  dateTo: z.coerce.date(),
  windowStart: z.coerce.number().int().min(0).max(23),
  windowEnd: z.coerce.number().int().min(0).max(23),
}).refine(d => d.dateFrom < d.dateTo, { path: ["dateTo"], message: "Window end must be after start." })
  .refine(d => d.windowStart !== d.windowEnd, { path: ["windowEnd"], message: "Day window must span some hours." });

type ActionResult = { ok: true } | { ok: false; error: string };

export default function NewPlanPage() {
  async function createPlan(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
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
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid form data." };

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { ok: false, error: "Please sign in." };

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

    redirect(`/p/${plan.token}`); // success path leaves the page
  }

  return (
    <div className="container-page space-y-6">
      <h1 className="h1">Create a new plan</h1>
      <CreatePlanForm action={createPlan} />
    </div>
  );
}
