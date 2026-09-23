"use client";

/** Inline success line under Save / Complete buttons. */
export function ActionStatus({
  success,
  successLabel,
  error,
}: {
  success: boolean;
  successLabel: string;
  error: string | null;
}) {
  if (error) return <p className="error">{error}</p>;
  if (success) return <p className="action-success">{successLabel}</p>;
  return null;
}
