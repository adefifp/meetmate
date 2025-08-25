export default function Loading() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="card">
          <div className="card-body flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-4 w-40 rounded bg-slate-200 animate-pulse" />
              <div className="h-3 w-56 rounded bg-slate-200 animate-pulse" />
            </div>
            <div className="h-9 w-48 rounded bg-slate-200 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
