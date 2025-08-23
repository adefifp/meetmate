"use client";

import { useState } from "react";

export default function CopyButton({ path }: { path: string }) {
  const [ok, setOk] = useState<null | boolean>(null);
  return (
    <button
      className="btn btn-ghost"
      onClick={async () => {
        try {
          const url = `${window.location.origin}${path}`;
          await navigator.clipboard.writeText(url);
          setOk(true);
          setTimeout(() => setOk(null), 1500);
        } catch {
          setOk(false);
          setTimeout(() => setOk(null), 1500);
        }
      }}
      aria-live="polite"
    >
      {ok === true ? "Copied!" : ok === false ? "Failed" : "Copy link"}
    </button>
  );
}
