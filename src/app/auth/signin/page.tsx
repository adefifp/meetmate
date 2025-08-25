// src/app/auth/signin/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function SignInPage() {
  const [csrfToken, setCsrfToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/csrf")
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setCsrfToken(j?.csrfToken ?? "");
      })
      .catch((e) => {
        console.error(e);
        if (!cancelled) setErr("Could not fetch CSRF token. Hard-refresh and try again.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-md">
        <div className="text-center mb-6">
          <h1 className="h1">Sign In</h1>
          <p className="muted text-sm">We’ll email you a secure magic link.</p>
        </div>

        <div className="card">
          <div className="card-body section">
            {err && (
              <div
                role="alert"
                className="rounded-lg border border-red-300 bg-red-50 text-red-800 px-3 py-2 text-sm"
              >
                {err}
              </div>
            )}

            <form
              method="POST"
              action="/api/auth/signin/email"
              className="space-y-4"
              onSubmit={() => setLoading(true)}
            >
              <input type="hidden" name="csrfToken" value={csrfToken} />

              <label className="field">
                <span className="label">Email</span>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="you@example.com"
                  className="input"
                  autoComplete="email"
                  inputMode="email"
                />
                <span className="help">
                  Please input a valid email.
                </span>
              </label>

              <button className="btn btn-primary w-full" disabled={loading || !csrfToken}>
                {loading ? "Sending…" : "Email me a magic link"}
              </button>
            </form>

            <div className="mt-3 text-center">
              <p className="help">
                No passwords stored.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-3">
          <Link href="/" className="btn btn-ghost">
            ← Back
          </Link>
          <Link href="/plans" className="btn btn-ghost">
            View plans
          </Link>
        </div>
      </div>
    </div>
  );
}
