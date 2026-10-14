"use client";

import { useCallback, useSyncExternalStore } from "react";
import { DEFAULT_UNIT, formatLength, fromInput, toInput, type Unit } from "@/lib/units";

const KEY = "pintu-unit";
const EVENT = "pintu-unit-change";

function read(): Unit {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === "mm" || v === "cm" ? v : DEFAULT_UNIT;
  } catch {
    return DEFAULT_UNIT;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * Satuan tampilan pilihan pengguna (disimpan di browser). Server selalu merender cm,
 * lalu browser beralih ke pilihan tersimpan setelah hydration.
 */
export function useUnit() {
  const unit = useSyncExternalStore(subscribe, read, () => DEFAULT_UNIT);
  const setUnit = useCallback((u: Unit) => {
    try {
      window.localStorage.setItem(KEY, u);
    } catch {
      // penyimpanan diblokir: pilihan berlaku sampai halaman dimuat ulang
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return {
    unit,
    setUnit,
    /** Angka saja, mis. "90" (cm) atau "900" (mm). */
    fmt: (mm: number) => formatLength(mm, unit),
    /** Angka dengan satuan, mis. "90 cm". */
    len: (mm: number) => `${formatLength(mm, unit)} ${unit}`,
    toInput: (mm: number) => toInput(mm, unit),
    fromInput: (v: number) => fromInput(v, unit),
  };
}

export function UnitToggle() {
  const { unit, setUnit } = useUnit();
  return (
    <div className="inline-flex rounded-lg border border-line p-0.5" role="group" aria-label="Satuan ukuran">
      {(["cm", "mm"] as const).map((u) => (
        <button
          key={u}
          type="button"
          onClick={() => setUnit(u)}
          aria-pressed={unit === u}
          className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
            unit === u ? "bg-accent text-accent-ink" : "text-muted hover:text-ink"
          }`}
        >
          {u}
        </button>
      ))}
    </div>
  );
}

/** Teks panjang untuk komponen server, mis. ringkasan ukuran di riwayat. */
export function Length({ mm, suffix = true }: { mm: number; suffix?: boolean }) {
  const { fmt, unit } = useUnit();
  return (
    <>
      {fmt(mm)}
      {suffix && ` ${unit}`}
    </>
  );
}
