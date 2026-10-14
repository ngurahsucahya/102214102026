"use client";

import { useSyncExternalStore } from "react";
import type { BulkItem, DoorSpec } from "@/lib/engine/types";

/** Draf bulk yang sedang disusun petugas, disimpan di browser sampai disimpan ke riwayat. */
export type BulkDraftItem = BulkItem & { key: string };

const KEY = "pintu-bulk";
const EVENT = "pintu-bulk-change";
const EMPTY: BulkDraftItem[] = [];

let cache: { raw: string | null; items: BulkDraftItem[] } = { raw: null, items: EMPTY };

function read(): BulkDraftItem[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return cache.items;
  }
  // Snapshot harus stabil selama isi penyimpanan tidak berubah.
  if (raw === cache.raw) return cache.items;
  let items: BulkDraftItem[] = EMPTY;
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) items = parsed;
  } catch {
    items = EMPTY;
  }
  cache = { raw, items };
  return items;
}

function write(items: BulkDraftItem[]) {
  const raw = JSON.stringify(items);
  try {
    window.localStorage.setItem(KEY, raw);
  } catch {
    // penyimpanan diblokir: tetap berlaku sampai halaman dimuat ulang
  }
  cache = { raw, items };
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useBulk() {
  const items = useSyncExternalStore(subscribe, read, () => EMPTY);
  return {
    items,
    add: (spec: DoorSpec, label: string, qty = 1) =>
      write([...read(), { key: crypto.randomUUID(), spec, qty: Math.max(1, qty), label: label.trim() }]),
    update: (key: string, patch: Partial<Pick<BulkDraftItem, "qty" | "label">>) =>
      write(read().map((it) => (it.key === key ? { ...it, ...patch } : it))),
    remove: (key: string) => write(read().filter((it) => it.key !== key)),
    clear: () => write([]),
  };
}
