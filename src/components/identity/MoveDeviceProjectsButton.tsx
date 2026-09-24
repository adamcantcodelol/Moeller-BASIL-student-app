"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MoveDeviceProjectsButton({ count }: { count: number }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <p>
      You have {count} project{count === 1 ? "" : "s"} saved only on this
      computer.{" "}
      <button
        type="button"
        className="secondary"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          await fetch("/api/identity/claim", { method: "POST" });
          setPending(false);
          router.refresh();
        }}
      >
        {pending ? "Moving…" : "Move them to my class account"}
      </button>
    </p>
  );
}
