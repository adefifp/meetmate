// src/lib/urls.ts
export function makeShareUrl(token: string) {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    return `${base}/p/${token}`;
  }