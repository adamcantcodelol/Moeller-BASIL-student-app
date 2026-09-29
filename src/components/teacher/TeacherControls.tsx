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
        window.location.reload();
      }}
    >
      <label>
        Teacher password
        <input name="password" type="password" required autoComplete="off" autoCapitalize="none" spellCheck={false} />
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

type AiProvider = "groq" | "openrouter";

export interface TeacherAiKeyStatus {
  provider: AiProvider;
  saved: boolean;
  masked: string | null;
  updatedAt: string | null;
  readable: boolean;
  envKeyConfigured: boolean;
}

const PROVIDER_INFO: Record<AiProvider, { label: string; hint: string; url: string }> = {
  groq: { label: "Groq", hint: "starts with gsk_", url: "https://console.groq.com/keys" },
  openrouter: {
    label: "OpenRouter",
    hint: "starts with sk-or-",
    url: "https://openrouter.ai/keys",
  },
};

export function TeacherAiKeyForm({ initial }: { initial: TeacherAiKeyStatus[] }) {
  const [statuses, setStatuses] = useState(initial);
  const [provider, setProvider] = useState<AiProvider>("groq");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  async function call(url: string, method: string, body?: unknown) {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      keys?: TeacherAiKeyStatus[];
      ok?: boolean;
      message?: string;
    };
    if (payload.keys) setStatuses(payload.keys);
    return { ok: response.ok, payload };
  }

  return (
    <div className="form-stack">
      <ul className="ai-key-status">
        {statuses.map((s) => (
          <li key={s.provider}>
            <strong>{PROVIDER_INFO[s.provider].label}:</strong>{" "}
            {s.saved ? (
              s.readable ? (
                <>
                  key saved <code>{s.masked}</code>
                  {s.updatedAt ? (
                    <span className="muted"> (updated {s.updatedAt.slice(0, 10)})</span>
                  ) : null}
                </>
              ) : (
                <span className="error">
                  saved key can&apos;t be read (teacher password changed?) — paste it again
                </span>
              )
            ) : (
              <span className="muted">no key saved</span>
            )}
            {s.envKeyConfigured ? (
              <span className="muted"> · server fallback key present</span>
            ) : null}{" "}
            <button
              type="button"
              className="secondary chip-button"
              disabled={pending !== null || (!s.saved && !s.envKeyConfigured)}
              onClick={async () => {
                setPending(`test-${s.provider}`);
                setMessage({ ok: true, text: `Testing ${PROVIDER_INFO[s.provider].label}…` });
                const { ok, payload } = await call("/api/teacher/ai-key/test", "POST", {
                  provider: s.provider,
                });
                setPending(null);
                setMessage({
                  ok: ok && payload.ok === true,
                  text: payload.message ?? payload.error ?? "Test failed.",
                });
              }}
            >
              {pending === `test-${s.provider}` ? "Testing…" : "Test key"}
            </button>
            {s.saved ? (
              <button
                type="button"
                className="secondary chip-button"
                disabled={pending !== null}
                onClick={async () => {
                  if (!window.confirm(`Remove the saved ${PROVIDER_INFO[s.provider].label} key?`)) return;
                  setPending(`remove-${s.provider}`);
                  const { ok, payload } = await call(
                    `/api/teacher/ai-key?provider=${s.provider}`,
                    "DELETE",
                  );
                  setPending(null);
                  setMessage({
                    ok,
                    text: ok ? "Key removed." : (payload.error ?? "Could not remove the key."),
                  });
                }}
              >
                Remove
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      <form
        className="form-stack"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const apiKey = String(new FormData(form).get("apiKey") ?? "");
          setPending("save");
          const { ok, payload } = await call("/api/teacher/ai-key", "PUT", { provider, apiKey });
          setPending(null);
          if (ok) form.reset();
          setMessage({
            ok,
            text: ok
              ? `${PROVIDER_INFO[provider].label} key saved. Use “Test key” to check it works.`
              : (payload.error ?? "Could not save the key."),
          });
        }}
      >
        <label>
          Provider
          <select value={provider} onChange={(e) => setProvider(e.target.value as AiProvider)}>
            <option value="groq">Groq (free tier)</option>
            <option value="openrouter">OpenRouter (free models)</option>
          </select>
        </label>
        <label>
          API key ({PROVIDER_INFO[provider].hint}) —{" "}
          <a href={PROVIDER_INFO[provider].url} target="_blank" rel="noreferrer">
            get one
          </a>
          <input
            name="apiKey"
            type="password"
            required
            autoComplete="off"
            spellCheck={false}
            placeholder="Paste key (saving replaces any existing key)"
          />
        </label>
        <button type="submit" disabled={pending !== null}>
          {pending === "save" ? "Saving…" : "Save key"}
        </button>
      </form>
      {message ? <p className={message.ok ? "success-text" : "error"}>{message.text}</p> : null}
    </div>
  );
}
