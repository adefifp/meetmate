import Link from "next/link";
import { ReactNode } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);
  return (
    <div className="pb-10">
      <header className="sticky top-0 z-10 bg-white/70 backdrop-blur card ring-0">
        <div className="container-page card-body flex items-center justify-between py-3">
          <nav className="flex gap-4 text-sm">
            <Link href="/plans" className="hover:underline">Plans</Link>
            <Link href="/plans/new" className="hover:underline">New Plan</Link>
          </nav>
          <div className="text-sm">
            {session?.user?.email ? (
              <div className="flex items-center gap-3">
                <span className="muted">Signed in as {session.user.email}</span>
                <Link href="/api/auth/signout" className="btn btn-ghost">Sign out</Link>
              </div>
            ) : (
                <Link href="/auth/signin" className="btn btn-primary">Sign in</Link>
            )}
          </div>
        </div>
      </header>

      <main className="container-page mt-6">{children}</main>
    </div>
  );
}
