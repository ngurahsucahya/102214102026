"use client";

import { Layers } from "lucide-react";
import Link from "next/link";
import { useBulk } from "./bulk-store";

/** Tautan ke halaman bulk dengan jumlah pintu yang sedang disusun. */
export function BulkLink() {
  const { items } = useBulk();
  return (
    <Link href="/lapangan/bulk" className="btn border-transparent px-2.5">
      <Layers className="size-4" />
      <span className="hidden sm:inline">Bulk</span>
      {items.length > 0 && (
        <span className="rounded-full bg-accent px-1.5 text-xs font-semibold text-accent-ink tabular-nums">
          {items.length}
        </span>
      )}
    </Link>
  );
}
