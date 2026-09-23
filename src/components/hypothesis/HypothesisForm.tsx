"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { HypothesisReview } from "@/types/hypothesis";
import { useConfirmingAction } from "@/hooks/useConfirmingAction";
import { ActionStatus } from "@/components/ui/ActionStatus";

export function HypothesisForm({
  projectId,
  initialText,
  initialReview,
}: {
  projectId: string;
  initialText: string;
  initialReview: HypothesisReview | null;
}) {
  const router = useRouter();
  const [text, setText] = useState(initialText);
  const [reason, setReason] = useState("");
  const [review, setReview] = useState<HypothesisReview | null>(initialReview);
  const action = useConfirmingAction();

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    action.begin();
    const response = await fetch(`/api/projects/${projectId}/hypothesis`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        reasonForChange: reason || undefined,
      }),
    });
    const payload = (await response.json()) as {
      error?: string;
      review?: HypothesisReview;
    };
    if (!response.ok) {
      action.fail(payload.error ?? "Could not save hypothesis.");
      return;
    }
    setReview(payload.review ?? null);
    setReason("");
    action.flashSuccess();
    router.refresh();
  }

  const label = action.pending
    ? "Saving…"
    : action.success
      ? "Saved ✓"
      : "Save hypothesis";

  return (
    <form className="card form-stack" onSubmit={(event) => void onSubmit(event)}>
      <h3>Your hypothesis</h3>
      <p className="muted">
        You write the hypothesis. The platform only checks structure and reminds
        you to cite evidence — it will not author the claim for you.
      </p>
      <label>
        Hypothesis
        <textarea
          rows={6}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            if (action.success) action.setError(null);
          }}
          placeholder="State a testable claim grounded in your module evidence…"
          required
        />
      </label>
      <label>
        Reason for change (optional)
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="What evidence made you revise this?"
        />
      </label>
      <button
        type="submit"
        className={action.buttonClassName}
        disabled={action.pending}
        aria-live="polite"
      >
        {label}
      </button>
      <ActionStatus
        success={action.success}
        successLabel="Hypothesis saved."
        error={action.error}
      />
      {review ? (
        <div>
          <h4>Review checks</h4>
          <ul>
            {review.checks.map((check) => (
              <li key={check.id}>
                {check.passed ? "✓" : "•"} {check.label}: {check.detail}
              </li>
            ))}
          </ul>
          <h4>Guidance</h4>
          <ul>
            {review.guidance.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </form>
  );
}
