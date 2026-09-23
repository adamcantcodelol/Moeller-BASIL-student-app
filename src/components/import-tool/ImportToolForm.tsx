"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ImportFormat } from "@/types/importWorkflow";

const FORMATS: ImportFormat[] = ["json", "tsv", "text", "csv", "xml"];

export function ImportToolForm({
  projectId,
  moduleSlug,
  toolName,
  instructions,
  acceptedFormats,
}: {
  projectId: string;
  moduleSlug: string;
  toolName: string;
  instructions: string;
  acceptedFormats: readonly ImportFormat[];
}) {
  const router = useRouter();
  const formats = FORMATS.filter((format) => acceptedFormats.includes(format));
  const [format, setFormat] = useState<ImportFormat>(formats[0] ?? "text");
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
      `/api/projects/${projectId}/modules/${moduleSlug}/import`,
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
      `Imported raw ${toolName} output with provenance source=import. The platform did not invent scientific results.`,
    );
    setContent("");
    router.refresh();
  }

  return (
    <form className="card form-stack" onSubmit={(event) => void onSubmit(event)}>
      <h3>Import {toolName} results</h3>
      <p className="muted">{instructions}</p>
      <label>
        Format
        <select
          value={format}
          onChange={(event) => setFormat(event.target.value as ImportFormat)}
        >
          {formats.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label>
        Raw export
        <textarea
          rows={8}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder={`Paste legitimate ${toolName} output…`}
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
