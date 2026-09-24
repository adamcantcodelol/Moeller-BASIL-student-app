"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

async function postJson(url: string, method: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  return { ok: response.ok, error: payload.error };
}

export function TeacherLoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <form
      className="form-stack"
      action={async (formData) => {
        setPending(true);
        setError(null);
        const result = await postJson("/api/teacher/login", "POST", {
          password: formData.get("password"),
        });
        setPending(false);
        if (!result.ok) {
          setError(result.error ?? "Sign-in failed.");
          return;
        }
        router.refresh();
      }}
    >
      <label>
        Teacher password
        <input name="password" type="password" required autoComplete="current-password" />
      </label>
      {error ? <p className="error">{error}</p> : null}
      <button type="submit" disabled={pending}>
        {pending ? "Checking…" : "Sign in"}
      </button>
    </form>
  );
}

export function TeacherLogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="secondary chip-button"
      onClick={async () => {
        await postJson("/api/teacher/logout", "POST");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}

export function TeacherCreateClassForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="form-stack"
      action={async (formData) => {
        setError(null);
        const result = await postJson("/api/teacher/classes", "POST", {
          name: formData.get("name"),
        });
        if (!result.ok) {
          setError(result.error ?? "Could not create the class.");
          return;
        }
        router.refresh();
      }}
    >
      <label>
        New class name
        <input name="name" required maxLength={120} placeholder="Period 3 Molecular Bio" />
      </label>
      {error ? <p className="error">{error}</p> : null}
      <button type="submit">Generate class code</button>
    </form>
  );
}

export function TeacherClassActions({ code, active }: { code: string; active: boolean }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="secondary chip-button"
      onClick={async () => {
        await postJson(`/api/teacher/classes/${encodeURIComponent(code)}`, "PATCH", {
          active: !active,
        });
        router.refresh();
      }}
    >
      {active ? "Deactivate" : "Reactivate"}
    </button>
  );
}
