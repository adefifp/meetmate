// src/app/p/[token]/page.tsx
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { revalidatePath } from "next/cache";


export const dynamic = "force-dynamic";

async function getPlan(token: string) {
  return prisma.plan.findUnique({
    where: { token },
    select: {
      id: true, title: true, durationMins: true, tz: true,
      dateFrom: true, dateTo: true, windowStart: true, windowEnd: true,
      participants: { select: { id: true, email: true, name: true, status: true} },
    },
  });
}

export default async function PublicPlanPage({ params }: { params: { token: string } }) {
  const token = params.token;
  const plan = await getPlan(token);
  if (!plan) notFound();

  async function joinPlan(formData: FormData) {
    "use server";
  
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
  
    // look up the plan id from the token
    const planRow = await prisma.plan.findUnique({
      where: { token },
      select: { id: true },
    });
    if (!planRow) throw new Error("Plan not found");
  
    // try to find existing participant by planId + email
    const existing = await prisma.participant.findFirst({
      where: { planId: planRow.id, email },
      select: { id: true },
    });
  
    if (existing) {
      await prisma.participant.update({
        where: { id: existing.id },
        data: { name: name ?? null },
      });
    } else {
      // create; if you already added the unique constraint in DB,
      // this is safe. Optional: catch P2002 and retry update.
      await prisma.participant.create({
        data: { planId: planRow.id, email, name: name ?? null },
      });
    }
  
    revalidatePath(`/p/${token}`);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{plan.title}</h1>
      <p className="text-gray-600">
        {new Date(plan.dateFrom).toLocaleString()} – {new Date(plan.dateTo).toLocaleString()}
        {" • "}TZ <code>{plan.tz}</code> • {plan.windowStart}:00–{plan.windowEnd}:00 • {plan.durationMins} min
      </p>

      <section className="grid md:grid-cols-2 gap-6">
        <form action={joinPlan} className="bg-white rounded-xl shadow p-4 space-y-3">
          <input type="hidden" name="token" value={token} />
          <label className="grid gap-1">
            <span className="text-sm text-gray-700">Email</span>
            <input name="email" type="email" required className="border rounded-lg px-3 py-2" />
          </label>
          <label className="grid gap-1">
            <span className="text-sm text-gray-700">Name (optional)</span>
            <input name="name" className="border rounded-lg px-3 py-2" />
          </label>
          <button className="bg-blue-600 text-white rounded-lg px-4 py-2">Join</button>
        </form>

        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="font-medium mb-2">Participants</h2>
          <ul className="space-y-2">
            {plan.participants.map((pt) => (
                <li key={pt.id} className="text-sm flex items-center justify-between">
                <span>{pt.name ? `${pt.name} • ${pt.email}` : pt.email}</span>
                <span className="text-gray-500 capitalize">{pt.status}</span>
                </li>
            ))}
            </ul>
        </div>
      </section>
    </div>
  );
}
