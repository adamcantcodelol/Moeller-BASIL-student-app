"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ImportFormat } from "@/types/importWorkflow";

const FORMATS: ImportFormat[] = ["json", "tsv", "text"];

export function InterProImportForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [format, setFormat] = useState<ImportFormat>("json");
  const [content, setContent] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [okMessage, setOkMessage] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setOkMessage(null);
    const response = await fetch(
      `/api/projects/${projectId}/modules/interpro/import`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, content, notes: notes || undefined }),
      },
    );
    const payload = (await response.json()) as { error?: string };
    setPending(false);
    if (!response.ok) {
      setError(payload.error ?? "Import failed.");
      return;
    }
    setOkMessage(
      "Imported raw InterPro output with provenance source=import. Normalized science is not invented from imports.",
    );
    setContent("");
    router.refresh();
  }

  return (
    <form className="card form-stack" onSubmit={(event) => void onSubmit(event)}>
      <h3>Import fallback</h3>
      <p className="muted">
        If the live InterPro API is unavailable or rate-limited, export results
        from{" "}
        <a
          href="https://www.ebi.ac.uk/interpro/"
          target="_blank"
          rel="noreferrer"
        >
          interpro.ebi.ac.uk
        </a>{" "}
        or InterProScan and paste them here. Do not paste fabricated
        annotations.
      </p>
      <label>
        Format
        <select
          value={format}
          onChange={(event) => setFormat(event.target.value as ImportFormat)}
        >
          {FORMATS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label>
        Raw export
        <textarea
          rows={6}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Paste legitimate InterPro / InterProScan output…"
        />
      </label>
      <label>
        Notes (optional)
        <input
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="How this export was obtained"
        />
      </label>
      <button type="submit" disabled={pending || content.trim() === ""}>
        {pending ? "Importing…" : "Import raw results"}
      </button>
      {okMessage ? <p className="muted">{okMessage}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}
