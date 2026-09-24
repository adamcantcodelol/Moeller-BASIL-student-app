"use client";

/** Expand / collapse every Results panel (native <details>) at once. */
export function ExpandAllControl({ targetId }: { targetId: string }) {
  function setAll(open: boolean) {
    document
      .querySelectorAll<HTMLDetailsElement>(`#${targetId} details.result-panel`)
      .forEach((panel) => {
        panel.open = open;
      });
  }
  return (
    <div className="mode-row expand-all-row">
      <button type="button" className="secondary chip-button" onClick={() => setAll(true)}>
        Expand all
      </button>
      <button type="button" className="secondary chip-button" onClick={() => setAll(false)}>
        Collapse all
      </button>
    </div>
  );
}
