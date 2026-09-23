"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CompleteInterProButton({
  projectId,
  disabled,
}: {
  projectId: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function complete() {
    setError(null);
    const response = await fetch(`/api/projects/${projectId}/modules/interpro`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ complete: true }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Could not complete InterPro.");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <button type="button" disabled={disabled} onClick={() => void complete()}>
        Mark InterPro complete
      </button>
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
