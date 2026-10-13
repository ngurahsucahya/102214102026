"use client";

import { Trash2 } from "lucide-react";
import { useTransition } from "react";

export function DeleteButton({ action, name }: { action: () => Promise<void>; name: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-label={`Hapus ${name}`}
      className="btn btn-danger px-2 py-1.5"
      onClick={() => {
        if (confirm(`Hapus "${name}"?`)) start(() => action());
      }}
    >
      <Trash2 className="size-4" />
    </button>
  );
}
