// src/app/p/[token]/loading.tsx
export default function Loading() {
  return (
    <div className="container-page space-y-8">
      <div className="space-y-2">
        <div className="h-7 w-48 bg-slate-200 rounded animate-pulse" />
        <div className="h-4 w-72 bg-slate-200 rounded animate-pulse" />
      </div>

      <div className="card">
        <div className="card-body space-y-3">
          <div className="h-5 w-40 bg-slate-200 rounded animate-pulse" />
          <div className="grid gap-3 md:grid-cols-2">
            <div className="h-10 bg-slate-200 rounded animate-pulse" />
            <div className="h-10 bg-slate-200 rounded animate-pulse" />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="h-10 bg-slate-200 rounded animate-pulse" />
            <div className="h-10 bg-slate-200 rounded animate-pulse" />
          </div>
          <div className="h-10 w-32 bg-slate-200 rounded animate-pulse" />
        </div>
      </div>

      <div className="card">
        <div className="card-body space-y-3">
          <div className="h-5 w-32 bg-slate-200 rounded animate-pulse" />
          <div className="h-16 bg-slate-200 rounded animate-pulse" />
          <div className="h-16 bg-slate-200 rounded animate-pulse" />
        </div>
      </div>

      <div className="card">
        <div className="card-body space-y-3">
          <div className="h-5 w-36 bg-slate-200 rounded animate-pulse" />
          <div className="h-16 bg-slate-200 rounded animate-pulse" />
          <div className="h-16 bg-slate-200 rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}
