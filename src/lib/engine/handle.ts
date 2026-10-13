import type { CalcSettings, HandleProfile, HandleZone, Segment } from "./types";

export type HandlePlacement = {
  zoneIndex: number;
  /** Posisi awal potongan di batang. */
  start: number;
  /** true jika ujung bawah pintu berada di sisi kanan batang. */
  flipped: boolean;
};

const zoneCenter = (z: HandleZone) => z.start + z.length / 2;

/**
 * Semua cara memotong frame gagang sepanjang `length` dari satu batang gagang
 * sehingga titik tengah zona gagang jatuh di `offset` mm dari ujung bawah potongan.
 * Zona gagang harus utuh di dalam potongan, tidak menabrak frame atas/bawah,
 * dan tidak boleh ada zona gagang lain yang ikut terpotong.
 */
export function handlePlacements(
  handle: HandleProfile,
  settings: CalcSettings,
  length: number,
  offset: number,
  frameWidth: number,
): HandlePlacement[] {
  const a = settings.endTrim;
  const b = handle.barLength - settings.endTrim;
  const result: HandlePlacement[] = [];

  handle.zones.forEach((zone, zoneIndex) => {
    const halfZone = zone.length / 2;
    if (offset - halfZone < frameWidth || offset + halfZone > length - frameWidth) return;
    const c = zoneCenter(zone);

    for (const flipped of [false, true]) {
      const start = flipped ? c - (length - offset) : c - offset;
      const end = start + length;
      if (start < a - 1e-6 || end > b + 1e-6) continue;
      const hitsOther = handle.zones.some((z, i) => i !== zoneIndex && z.start < end && z.start + z.length > start);
      if (hitsOther) continue;
      result.push({ zoneIndex, start, flipped });
    }
  });

  return result;
}

/** Rentang tinggi gagang (dari bawah pintu) yang bisa dibuat dari batang ini. */
export function feasibleHandleRanges(
  handle: HandleProfile,
  settings: CalcSettings,
  length: number,
  frameWidth: number,
): Segment[] {
  const ranges: Segment[] = [];
  let open: number | null = null;
  for (let h = 0; h <= length; h++) {
    const ok = handlePlacements(handle, settings, length, h, frameWidth).length > 0;
    if (ok && open === null) open = h;
    if (!ok && open !== null) {
      ranges.push({ start: open, length: h - 1 - open });
      open = null;
    }
  }
  if (open !== null) ranges.push({ start: open, length: length - open });
  return ranges;
}

/** Ambil tinggi terdekat yang valid dari rentang yang tersedia. */
export function clampToRanges(value: number, ranges: Segment[]): number | null {
  let best: number | null = null;
  for (const r of ranges) {
    const v = Math.min(Math.max(value, r.start), r.start + r.length);
    if (best === null || Math.abs(v - value) < Math.abs(best - value)) best = v;
  }
  return best;
}

/** Kurangi interval-interval terblokir dari [from, to]. */
export function subtractIntervals(from: number, to: number, blocked: Segment[]): Segment[] {
  const sorted = [...blocked].sort((x, y) => x.start - y.start);
  const free: Segment[] = [];
  let cursor = from;
  for (const blk of sorted) {
    const s = Math.max(blk.start, from);
    const e = Math.min(blk.start + blk.length, to);
    if (e <= cursor) continue;
    if (s > cursor) free.push({ start: cursor, length: s - cursor });
    cursor = Math.max(cursor, e);
  }
  if (to > cursor) free.push({ start: cursor, length: to - cursor });
  return free.filter((f) => f.length > 1e-6);
}
