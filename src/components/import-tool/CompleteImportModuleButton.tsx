"use client";

import { useRouter } from "next/navigation";
import { useConfirmingAction } from "@/hooks/useConfirmingAction";
import { ActionStatus } from "@/components/ui/ActionStatus";

export function CompleteImportModuleButton({
  projectId,
  moduleSlug,
  label,
  disabled,
  alreadyComplete = false,
}: {
  projectId: string;
  moduleSlug: string;
  label: string;
  disabled: boolean;
  /** When the module run is already complete — keep green confirmation. */
  alreadyComplete?: boolean;
}) {
  const router = useRouter();
  const action = useConfirmingAction({ holdSuccess: alreadyComplete });

  async function complete() {
    if (alreadyComplete || action.pending) return;
    action.begin();
    const response = await fetch(
      `/api/projects/${projectId}/modules/${moduleSlug}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complete: true }),
      },
    );
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      action.fail(payload.error ?? "Could not complete module.");
      return;
    }
    action.flashSuccess();
    router.refresh();
  }

  const showComplete = alreadyComplete || action.success;
  const buttonLabel = showComplete
    ? "Complete ✓"
    : action.pending
      ? "Marking complete…"
      : label;

  return (
    <div>
      <button
        type="button"
        className={action.buttonClassName}
        disabled={disabled || action.pending}
        onClick={() => void complete()}
        aria-live="polite"
      >
        {buttonLabel}
      </button>
      <ActionStatus
        success={showComplete}
        successLabel="Module marked complete."
        error={action.error}
      />
    </div>
  );
}
