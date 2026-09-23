"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirmingAction } from "@/hooks/useConfirmingAction";
import { ActionStatus } from "@/components/ui/ActionStatus";

export function UniProtForm({
  projectId,
  currentAccession,
}: {
  projectId: string;
  currentAccession?: string | null;
}) {
  const router = useRouter();
  const [accession, setAccession] = useState(currentAccession ?? "");
  const [cacheHit, setCacheHit] = useState<boolean | null>(null);
  const action = useConfirmingAction();

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    action.begin();
    setCacheHit(null);
    const response = await fetch(`/api/projects/${projectId}/modules/interpro`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uniprotAccession: accession }),
    });
    const payload = (await response.json()) as {
      error?: string;
      cacheHit?: boolean;
    };
    if (!response.ok) {
      action.fail(payload.error ?? "InterPro retrieval failed.");
      return;
    }
    setCacheHit(Boolean(payload.cacheHit));
    action.flashSuccess();
    router.refresh();
  }

  const label = action.pending
    ? "Contacting InterPro…"
    : action.success
      ? "Retrieved ✓"
      : "Retrieve from InterPro";

  return (
    <form className="card form-stack" onSubmit={(event) => void onSubmit(event)}>
      <h3>Retrieve InterPro annotations</h3>
      <p className="muted">
        Looks up domains, families, and signatures for a UniProt accession via
        the free EMBL-EBI InterPro REST API (no API key). Results are stored
        with provenance. Annotations are never invented on failure.
      </p>
      <label>
        UniProt accession
        <input
          value={accession}
          onChange={(event) => setAccession(event.target.value)}
          placeholder="P04637"
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <button
        type="submit"
        className={action.buttonClassName}
        disabled={action.pending || accession.trim() === ""}
        aria-live="polite"
      >
        {label}
      </button>
      <ActionStatus
        success={action.success}
        successLabel="InterPro annotations retrieved."
        error={action.error}
      />
      {cacheHit === true ? (
        <p className="muted">Served from the legitimate response cache.</p>
      ) : null}
    </form>
  );
}
