// src/app/(app)/plans/page.tsx
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import CopyButton from "@/components/CopyButton";
import ConfirmButton from "@/components/ConfirmButton";

export const dynamic = "force-dynamic";

async function deletePlan(formData: FormData) {
  "use server";
  const id = z.string().parse(formData.get("id"));

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Not authenticated");

  const plan = await prisma.plan.findUnique({
    where: { id },
    select: { ownerId: true },
  });
  if (!plan || plan.ownerId !== session.user.id) {
    throw new Error("Not allowed");
  }

  await prisma.plan.delete({ where: { id } });
  revalidatePath("/plans");
}

export default async function PlansPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return <p>Please sign in.</p>;

  const plans = await prisma.plan.findMany({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, token: true },
  });

  return (
    <ul className="space-y-3">
      {plans.map((p: { id: string; title: string; token: string }) => (
        <li key={p.id} className="card">
          <div className="card-body flex items-center justify-between">
            <div>
              <div className="font-medium">{p.title}</div>
              <div className="muted text-sm">Share path: <code>/p/{p.token}</code></div>
            </div>
            <div className="flex gap-2">
              <CopyButton path={`/p/${p.token}`} />
              <Link href={`/p/${p.token}`} className="btn btn-primary hover:shadow">
                Open
              </Link>
              <form action={deletePlan}>
                <input type="hidden" name="id" value={p.id} />
                <ConfirmButton
                  className="btn btn-ghost btn-ghost-danger"
                  message={`Delete "${p.title}"? This removes participants and availability.`}
                >
                  Delete
                </ConfirmButton>
              </form>
            </div>
          </div>
        </li>
      ))}
      {plans.length === 0 && <li className="muted">No plans yet.</li>}
    </ul>
  );
}
