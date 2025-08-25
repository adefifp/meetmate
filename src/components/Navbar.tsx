import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import AuthButtons from "./AuthButtons";

export default async function Navbar() {
  const session = await getServerSession(authOptions);
  const isAuthed = !!session?.user?.id;

  return (
    <nav className="bg-white border-b border-slate-200">
      <div className="container-page flex h-14 items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={isAuthed ? "/plans" : "/"} className="font-semibold">MeetMate Lite</Link>
          {isAuthed && (
            <>
                <Link href="/plans/new" className="btn btn-ghost btn-ghost-neutral">New Plan</Link>
              <Link href="/plans" className="btn btn-ghost btn-ghost-neutral">Previous Plans</Link>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isAuthed && <span className="muted text-sm">Signed in as {session!.user!.email}</span>}
          <AuthButtons isAuthed={isAuthed} />
        </div>
      </div>
    </nav>
  );
}
