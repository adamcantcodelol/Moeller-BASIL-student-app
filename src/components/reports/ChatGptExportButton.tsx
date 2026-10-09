/** Download link for the "Export for ChatGPT" PDF, with a short how-to. */
export function ChatGptExportButton({ projectId }: { projectId: string }) {
  return (
    <div className="form-stack">
      <a
        className="button-link"
        href={`/api/projects/${projectId}/export/chatgpt`}
        download
        title="Downloads one PDF with ShannonGPT instructions and your real results. Upload it to ChatGPT and type: Follow the instructions at the top of this file."
      >
        Export for ChatGPT (PDF)
      </a>
      <p className="muted">
        Get ShannonGPT feedback in regular (free) ChatGPT: download this PDF,
        upload it in a new ChatGPT chat, and type{" "}
        <strong>Follow the instructions at the top of this file.</strong> It
        includes only your stored results, evidence, notes and hypothesis, not
        your name. Export again after you change anything.
      </p>
    </div>
  );
}
