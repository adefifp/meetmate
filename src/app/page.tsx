// src/app/page.tsx
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  const authed = !!session?.user?.id;

  return (
    <div className="container-page space-y-10 py-10">
      <section className="section">
        <h1 className="h1">MeetMate</h1>
        <p className="muted max-w-prose">
          A full-stack project: email magic-link auth, shareable plans,
          participant availability, and smart slot suggestions — built with Next.js,
          Prisma, and Postgres.
        </p>
        <div className="flex gap-3 pt-2">
          {authed ? (
            <>
              <Link href="/plans/new" className="btn btn-primary hover:shadow">
                Create a plan
              </Link>
              <Link href="/plans" className="btn btn-ghost">
                View my plans
              </Link>
            </>
          ) : (
            <Link href="/auth/signin" className="btn btn-primary hover:shadow">
              Sign in to get started
            </Link>
          )}
        </div>
      </section>

    </div>
  );
}
