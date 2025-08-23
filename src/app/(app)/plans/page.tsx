// src/app/(app)/plans/page.tsx
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";
import CopyButton from "@/components/CopyButton";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return <p className="muted">Please sign in.</p>;

  const plans = await prisma.plan.findMany({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, token: true },
  });

  if (plans.length === 0) {
    return (
      <div className="card">
        <div className="card-body">
          <p className="muted">No plans yet.</p>
          <Link href="/plans/new" className="btn btn-primary mt-3">
            Create your first plan
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {plans.map((p) => (
        <li key={p.id} className="card">
          <div className="card-body flex items-center justify-between">
            <div>
              <div className="font-medium">{p.title}</div>
              <div className="muted text-sm">
                Share path: <code>/p/{p.token}</code>
              </div>
            </div>
            <div className="flex gap-2">
              <CopyButton path={`/p/${p.token}`} />
              <Link href={`/p/${p.token}`} className="btn btn-primary">
                Open
              </Link>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
