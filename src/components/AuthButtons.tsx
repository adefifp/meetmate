"use client";

import { signIn, signOut } from "next-auth/react";

export default function AuthButtons({ isAuthed }: { isAuthed: boolean }) {
  if (!isAuthed) {
    return (
      <button className="btn btn-ghost btn-ghost-neutral" onClick={() => signIn(undefined, { callbackUrl: "/plans" })}>
        Sign in
      </button>
    );
  }
  return (
    <button className="btn btn-ghost btn-ghost-neutral" onClick={() => signOut({ callbackUrl: "/" })}>
      Sign out
    </button>
  );
}