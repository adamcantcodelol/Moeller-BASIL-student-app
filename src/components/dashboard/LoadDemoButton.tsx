"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LoadDemoButton() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function loadDemo() {
    setError(null);
    const response = await fetch("/api/demo", { method: "POST" });
    const payload = (await response.json()) as {
      error?: string;
      projectId?: string;
    };
    if (!response.ok) {
      setError(payload.error ?? "Could not load demonstration data.");
      return;
    }
    router.refresh();
    if (payload.projectId) {
      router.push(`/projects/${payload.projectId}`);
    }
  }

  return (
    <div>
      <button className="secondary" type="button" onClick={() => void loadDemo()}>
        Load labeled demonstration project
      </button>
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
