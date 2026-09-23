"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function UniProtForm({
  projectId,
  currentAccession,
}: {
  projectId: string;
  currentAccession?: string | null;
}) {
  const router = useRouter();
  const [accession, setAccession] = useState(currentAccession ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [cacheHit, setCacheHit] = useState<boolean | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
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
    setPending(false);
    if (!response.ok) {
      setError(payload.error ?? "InterPro retrieval failed.");
      return;
    }
    setCacheHit(Boolean(payload.cacheHit));
    router.refresh();
  }

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
      <button type="submit" disabled={pending || accession.trim() === ""}>
        {pending ? "Contacting InterPro…" : "Retrieve from InterPro"}
      </button>
      {cacheHit === true ? (
        <p className="muted">Served from the legitimate response cache.</p>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}
