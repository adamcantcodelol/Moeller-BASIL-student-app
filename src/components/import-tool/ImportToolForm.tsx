"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirmingAction } from "@/hooks/useConfirmingAction";
import { ActionStatus } from "@/components/ui/ActionStatus";
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
  const action = useConfirmingAction();
  const [okMessage, setOkMessage] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    action.begin();
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
    if (!response.ok) {
      action.fail(payload.error ?? "Import failed.");
      return;
    }
    action.flashSuccess();
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
      <button
        type="submit"
        className={action.buttonClassName}
        disabled={action.pending || content.trim() === ""}
        aria-live="polite"
      >
        {action.pending ? "Importing…" : action.success ? "Imported ✓" : "Import raw results"}
      </button>
      <ActionStatus
        success={action.success}
        successLabel="Import saved."
        error={action.error}
      />
      {okMessage ? <p className="muted">{okMessage}</p> : null}
    </form>
  );
}
