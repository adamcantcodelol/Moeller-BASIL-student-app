"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateProjectForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        studentId: formData.get("studentId") || null,
        pdbId: formData.get("pdbId") || null,
      }),
    });
    const payload = (await response.json()) as {
      error?: string;
      project?: { id: string };
    };
    setPending(false);
    if (!response.ok || !payload.project) {
      setError(payload.error ?? "Could not create the project.");
      return;
    }
    router.push(`/projects/${payload.project.id}`);
    router.refresh();
  }

  return (
    <form
      className="form-stack"
      action={(formData) => {
        void onSubmit(formData);
      }}
    >
      <label>
        Project name
        <input name="name" required maxLength={200} />
      </label>
      <label>
        Student label (optional, not an account)
        <input name="studentId" maxLength={100} />
      </label>
      <label>
        PDB ID (optional until PDB Setup)
        <input name="pdbId" placeholder="4HHB" maxLength={4} />
      </label>
      {error ? <p className="error">{error}</p> : null}
      <button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create project"}
      </button>
    </form>
  );
}
