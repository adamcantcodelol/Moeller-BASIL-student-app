import type { ReactNode } from "react";

/** Tables with more rows than this start collapsed. */
export const COLLAPSE_ROW_THRESHOLD = 10;

/**
 * Native <details> wrapper for long data tables/lists. Content stays mounted
 * when collapsed (only hidden), so nothing interactive is torn down.
 */
export function DataCollapse({
  label,
  count,
  noun = "rows",
  defaultOpen,
  className,
  children,
}: {
  label: ReactNode;
  count?: number;
  noun?: string;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const open = defaultOpen ?? (count === undefined || count <= COLLAPSE_ROW_THRESHOLD);
  return (
    <details className={`data-collapse ${className ?? ""}`.trim()} open={open}>
      <summary>
        {label}
        {count !== undefined ? (
          <span className="muted">
            {" "}
            ({count} {noun})
          </span>
        ) : null}
      </summary>
      {children}
    </details>
  );
}
