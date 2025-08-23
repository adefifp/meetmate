"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

type Result = { ok: true } | { ok: false; error: string };

export default function CreatePlanForm({
  action,
}: {
  action: (prev: Result | null, formData: FormData) => Promise<Result>;
}) {
  const [state, formAction] = useActionState(action, null);
  const { pending } = useFormStatus();

  return (
    <form action={formAction} className="card">
      <div className="card-body section">
        {state && "ok" in state && !state.ok && (
          <div className="rounded-lg border border-red-300 bg-red-50 text-red-800 px-3 py-2 text-sm">
            {state.error}
          </div>
        )}

        <label className="field">
          <span className="label">Title</span>
          <input name="title" required className="input" placeholder="Team sync" />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="field">
            <span className="label">Duration (minutes)</span>
            <input name="durationMins" type="number" min={5} defaultValue={30} required className="input" />
          </label>
          <label className="field">
            <span className="label">Minimum attendees</span>
            <input name="minAttendees" type="number" min={1} defaultValue={2} required className="input" />
          </label>
        </div>

        <label className="field">
          <span className="label">Timezone (IANA)</span>
          <input name="tz" required className="input" placeholder="America/New_York" />
          <span className="help">Use a valid IANA TZ like America/Los_Angeles</span>
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="field">
            <span className="label">Window start (date/time)</span>
            <input name="dateFrom" type="datetime-local" required className="input" />
          </label>
          <label className="field">
            <span className="label">Window end (date/time)</span>
            <input name="dateTo" type="datetime-local" required className="input" />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="field">
            <span className="label">Day window start (0–23)</span>
            <input name="windowStart" type="number" min={0} max={23} defaultValue={9} required className="input" />
          </label>
          <label className="field">
            <span className="label">Day window end (0–23)</span>
            <input name="windowEnd" type="number" min={0} max={23} defaultValue={18} required className="input" />
          </label>
        </div>

        <button className="btn btn-primary" disabled={pending}>
          {pending ? "Creating..." : "Create plan"}
        </button>
      </div>
    </form>
  );
}
