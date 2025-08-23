"use client";

import React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

type ActionResult = { ok: boolean; error?: string };

export default function JoinAvailability({
  token,
  action,
}: {
  token: string;
  action: (prevState: ActionResult | null, formData: FormData) => Promise<ActionResult>;
}) {
  const [state, formAction] = useActionState(action, null);

  return (
    <form action={formAction} className="card">
      <div className="card-body section">
        <input type="hidden" name="token" value={token} />
        <h2 className="h2">Join & add your availability</h2>

        {state?.error && (
          <div className="rounded-lg border border-red-300 bg-red-50 text-red-800 px-3 py-2 text-sm">
            {state.error}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="field">
            <span className="label">Email</span>
            <input name="email" type="email" required className="input" placeholder="you@example.com" />
          </label>
          <label className="field">
            <span className="label">Name (optional)</span>
            <input name="name" className="input" placeholder="Your name" />
          </label>
        </div>

        {/* Multiple busy blocks */}
        <BusyRows />

        <Submit />
      </div>
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary" disabled={pending}>
      {pending ? "Saving..." : "Save & Update"}
    </button>
  );
}

function BusyRows() {
  const [rows, setRows] = React.useState([{ id: 1 }]);
  return (
    <div className="section">
      <div>
        <div className="label">Busy blocks (optional)</div>
        <div className="help">Add one or more busy intervals; suggestions avoid these.</div>
      </div>
      <div className="space-y-3">
        {rows.map((r, i) => (
          <div key={r.id} className="grid gap-3 md:grid-cols-2">
            <input name="start" type="datetime-local" className="input" />
            <div className="flex gap-2">
              <input name="end" type="datetime-local" className="input" />
              {rows.length > 1 && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setRows(rows.filter((x) => x.id !== r.id))}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <div>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setRows([...rows, { id: rows[rows.length - 1].id + 1 }])}
        >
          + Add interval
        </button>
      </div>
    </div>
  );
}
