"use client";

import { useRouter } from "next/navigation";
import { useConfirmingAction } from "@/hooks/useConfirmingAction";
import { ActionStatus } from "@/components/ui/ActionStatus";

export function CompleteInterProButton({
  projectId,
  disabled,
  alreadyComplete = false,
}: {
  projectId: string;
  disabled: boolean;
  alreadyComplete?: boolean;
}) {
  const router = useRouter();
  const action = useConfirmingAction({ holdSuccess: alreadyComplete });

  async function complete() {
    if (alreadyComplete || action.pending) return;
    action.begin();
    const response = await fetch(`/api/projects/${projectId}/modules/interpro`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ complete: true }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      action.fail(payload.error ?? "Could not complete InterPro.");
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
      : "Mark InterPro complete";

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
        successLabel="InterPro marked complete."
        error={action.error}
      />
    </div>
  );
}
