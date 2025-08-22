// src/app/(app)/plans/page.tsx
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";
import { makeShareUrl } from "@/lib/url";

export const dynamic = "force-dynamic";

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
      {plans.map((p) => (
        <li key={p.id} className="bg-white rounded-xl p-4 shadow flex items-center justify-between">
          <div>
            <div className="font-medium">{p.title}</div>
            <div className="text-sm text-gray-600">Share: <code>{makeShareUrl(p.token)}</code></div>
          </div>
          <Link href={`/p/${p.token}`} className="text-blue-600 hover:underline">Open</Link>
        </li>
      ))}
      {plans.length === 0 && <li className="text-gray-600">No plans yet.</li>}
    </ul>
  );
}
