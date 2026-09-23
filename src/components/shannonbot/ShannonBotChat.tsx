"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ShannonBotMessage } from "@/ai/shannonBot";

export function ShannonBotChat({
  projectId,
  initialMessages,
  blocker,
}: {
  projectId: string;
  initialMessages: ShannonBotMessage[];
  blocker: string | null;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const response = await fetch(
      `/api/projects/${projectId}/modules/shannonbot-review`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input }),
      },
    );
    const payload = (await response.json()) as {
      error?: string;
      messages?: ShannonBotMessage[];
    };
    setPending(false);
    if (!response.ok) {
      setError(payload.error ?? "ShannonBot request failed.");
      return;
    }
    setMessages(payload.messages ?? []);
    setInput("");
    router.refresh();
  }

  return (
    <div className="card form-stack">
      <h3>ShannonBot</h3>
      <p className="muted">
        Socratic mentor grounded in recorded evidence. It will not invent
        residues or tool results.
      </p>
      {blocker ? <p className="muted">{blocker}</p> : null}
      <div className="chat-log">
        {messages.length === 0 ? (
          <p className="muted">Ask ShannonBot about your evidence or hypothesis.</p>
        ) : (
          messages.map((message, index) => (
            <p key={`${message.createdAt}-${index}`}>
              <strong>
                {message.role === "student" ? "You" : "ShannonBot"}:
              </strong>{" "}
              {message.content}
            </p>
          ))
        )}
      </div>
      <form className="form-stack" onSubmit={(event) => void onSubmit(event)}>
        <label>
          Message
          <textarea
            rows={3}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            required
          />
        </label>
        <button type="submit" disabled={pending}>
          {pending ? "Thinking…" : "Send"}
        </button>
      </form>
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
