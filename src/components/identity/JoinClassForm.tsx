"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function JoinClassForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const response = await fetch("/api/identity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentName: formData.get("studentName"),
        classCode: formData.get("classCode"),
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    setPending(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not join the class.");
      return;
    }
    router.refresh();
  }

  return (
    <form
      className="form-stack"
      action={(formData) => {
        void onSubmit(formData);
      }}
    >
      <p className="muted">
        Optional: enter your name and class code so your projects follow you to
        any computer. Or just skip this and create a project below — it will be
        saved privately on this computer.
      </p>
      <label>
        Your name
        <input name="studentName" required maxLength={60} autoComplete="name" />
      </label>
      <label>
        Class code (from your teacher)
        <input name="classCode" required maxLength={20} placeholder="BIO-7K3Q" />
      </label>
      {error ? <p className="error">{error}</p> : null}
      <button type="submit" disabled={pending}>
        {pending ? "Joining…" : "Join class"}
      </button>
    </form>
  );
}
