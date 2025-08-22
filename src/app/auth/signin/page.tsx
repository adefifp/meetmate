"use client";
import { useEffect, useState } from "react";

export default function SignInPage() {
  const [csrfToken, setCsrfToken] = useState("");
  useEffect(() => {
    fetch("/api/auth/csrf")
      .then(r => r.json())
      .then(j => setCsrfToken(j.csrfToken))
      .catch(console.error);
  }, []);

  return (
    <main className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Sign in</h1>
      <form method="POST" action="/api/auth/signin/email" className="space-y-4">
        <input type="hidden" name="csrfToken" value={csrfToken} />
        <input type="email" name="email" required placeholder="you@example.com" className="w-full border rounded px-3 py-2" />
        <button className="w-full rounded bg-black text-white py-2">Email me a magic link</button>
      </form>
    </main>
  );
}
