/** Satuan tampilan. Semua perhitungan tetap dalam milimeter; ini hanya untuk tampilan dan isian. */
export type Unit = "cm" | "mm";

export const DEFAULT_UNIT: Unit = "cm";

/** Angka panjang (dari mm) dalam satuan tampilan, tanpa nama satuan. */
export function formatLength(mm: number, unit: Unit): string {
  // Ketelitian tampilan 1 mm untuk kedua satuan.
  const whole = Math.round(mm);
  return unit === "cm"
    ? (whole / 10).toLocaleString("id-ID", { maximumFractionDigits: 1 })
    : whole.toLocaleString("id-ID");
}

/** Nilai mm ke angka isian (tanpa pemisah ribuan). */
export const toInput = (mm: number, unit: Unit) => (unit === "cm" ? Math.round(mm) / 10 : Math.round(mm));

/** Angka isian ke mm. */
export const fromInput = (value: number, unit: Unit) => (unit === "cm" ? Math.round(value * 10) : Math.round(value));
