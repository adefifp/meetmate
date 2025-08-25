// src/app/auth/verify-request/page.tsx
export default function VerifyRequestPage() {
  return (
    <main className="container-page">
      <div className="card mt-8">
        <div className="card-body section">
          <h1 className="h1">Check Your Email</h1>
          <p className="muted">
            We sent you a sign-in link. Open it on this device to finish signing in.
          </p>
        </div>
      </div>
    </main>
  );
}