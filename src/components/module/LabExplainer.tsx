import {
  getLabExplainer,
  type LabExplainerCopy,
} from "@/modules/labExplainers";

export function LabExplainer({
  labKey,
  copy,
  className,
}: {
  /** Curriculum module id or results tool key (e.g. "sprite"). */
  labKey?: string;
  /** Optional override; otherwise loaded from labExplainers registry. */
  copy?: LabExplainerCopy;
  className?: string;
}) {
  const resolved = copy ?? (labKey ? getLabExplainer(labKey) : undefined);
  if (!resolved) {
    return null;
  }

  return (
    <details className={`lab-explainer ${className ?? ""}`.trim()}>
      <summary>{resolved.summary}</summary>
      <div className="lab-explainer-body">
        {resolved.paragraphs.map((paragraph) => (
          <p key={paragraph.slice(0, 48)}>{paragraph}</p>
        ))}
        {resolved.lookFor && resolved.lookFor.length > 0 ? (
          <>
            <p className="lab-explainer-lookfor-label">You’ll look for…</p>
            <ul>
              {resolved.lookFor.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </details>
  );
}
