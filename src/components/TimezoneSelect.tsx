"use client";

import * as React from "react";

const FALLBACKS = [
  "UTC",
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "Europe/London", "Europe/Berlin", "Europe/Paris",
  "Asia/Kolkata", "Asia/Singapore", "Asia/Shanghai", "Asia/Tokyo",
  "Australia/Sydney", "Pacific/Auckland",
];

export default function TimezoneSelect({
  name = "tz",
  defaultValue,
}: { name?: string; defaultValue?: string }) {
  const [all, setAll] = React.useState<string[]>(FALLBACKS);

  React.useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sup = (Intl as any)?.supportedValuesOf?.("timeZone") as string[] | undefined;
    if (sup?.length) setAll(sup);
  }, []);

  const guess = React.useMemo(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    return defaultValue ?? tz;
  }, [defaultValue]);

  // Keep selected value if it's valid, else fallback to UTC
  const initial = React.useMemo(() => (all.includes(guess) ? guess : "UTC"), [all, guess]);

  return (
    <select name={name} defaultValue={initial} className="input">
      {/* Common first */}
      <optgroup label="Common Time Zones">
        {FALLBACKS.map((tz) => (
          <option key={tz} value={tz}>{tz}</option>
        ))}
      </optgroup>
      {/* Full list (if available) */}
      {all.length > FALLBACKS.length && (
        <optgroup label="All Time Zones">
          {all.map((tz) => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </optgroup>
      )}
    </select>
  );
}
