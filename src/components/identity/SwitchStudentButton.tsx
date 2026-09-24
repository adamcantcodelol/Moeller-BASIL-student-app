"use client";

import { useRouter } from "next/navigation";

export function SwitchStudentButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="secondary chip-button"
      onClick={async () => {
        await fetch("/api/identity", { method: "DELETE" });
        router.push("/");
        router.refresh();
      }}
    >
      switch
    </button>
  );
}
