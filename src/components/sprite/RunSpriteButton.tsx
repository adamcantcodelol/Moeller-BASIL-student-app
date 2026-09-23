"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_SPRITE_DATABASE,
  SPRITE_SAFE_DATABASES,
  type SpriteDatabase,
} from "@/adapters/sprite";

export function RunSpriteButton({
  projectId,
  pdbId,
  disabled,
}: {
  projectId: string;
  pdbId?: string | null;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [database, setDatabase] = useState<SpriteDatabase>(
    DEFAULT_SPRITE_DATABASE,
  );

  async function poll(jobId: string) {
    // SPRITE jobs commonly take 1–5 minutes; poll our Worker, never the
    // student browser against grafss.ukm.my.
    for (let attempt = 0; attempt < 60; attempt += 1) {
      setStatus(
        `SPRITE still running — polling Worker (attempt ${attempt + 1}/60)…`,
      );
      await new Promise((resolve) => setTimeout(resolve, 5000));
      const response = await fetch(
        `/api/projects/${projectId}/modules/sprite/poll`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId }),
        },
      );
      const payload = (await response.json()) as {
        error?: string;
        pending?: boolean;
      };
      if (!response.ok && response.status !== 202) {
        setError(payload.error ?? "SPRITE poll failed.");
        return;
      }
      if (!payload.pending) {
        setStatus("SPRITE search complete.");
        router.refresh();
        return;
      }
    }
    setError(
      "SPRITE is still running after ~5 minutes. Leave this page open and refresh later, or use the optional import fallback. No hits were invented.",
    );
  }

  async function onClick() {
    setPending(true);
    setError(null);
    setStatus("Submitting SPRITE via Moeller Worker…");
    const response = await fetch(
      `/api/projects/${projectId}/modules/sprite`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(pdbId ? { pdbId } : {}),
          database,
        }),
      },
    );
    const payload = (await response.json()) as {
      error?: string;
      pending?: boolean;
      job?: { id: string };
    };
    if (!response.ok && response.status !== 202) {
      setPending(false);
      setError(payload.error ?? "SPRITE submit failed.");
      return;
    }
    if (payload.pending && payload.job?.id) {
      await poll(payload.job.id);
      setPending(false);
      return;
    }
    setPending(false);
    setStatus("SPRITE search complete.");
    router.refresh();
  }

  return (
    <div className="form-stack">
      <label>
        Pattern database
        <select
          value={database}
          disabled={pending}
          onChange={(event) =>
            setDatabase(event.target.value as SpriteDatabase)
          }
        >
          {SPRITE_SAFE_DATABASES.map((db) => (
            <option key={db} value={db}>
              {db}
              {db === DEFAULT_SPRITE_DATABASE
                ? " (default — CSA active-site, exclude 2-residue)"
                : ""}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        disabled={disabled || pending || !pdbId}
        onClick={() => {
          void onClick();
        }}
      >
        {pending ? "Running SPRITE…" : `Run SPRITE (${database})`}
      </button>
      <p className="muted">
        The Worker submits your project PDB ID to GrAfSS SPRITE
        (`grafss.ukm.my`) and polls until results arrive. Students stay on this
        Moeller BASIL site — the school network does not need to allow
        grafss.ukm.my. Jobs often take 1–5 minutes. Hits are never invented.
      </p>
      {status ? <p className="muted">{status}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
