/**
 * Optimasi pemotongan 1D (cutting stock / bin packing).
 *
 * Tujuan utama: jumlah batang baru sesedikit mungkin, dengan memakai sisa
 * yang sudah ada (bin "free") lebih dulu. Jika jumlah batang sama, pilih
 * susunan yang sisanya paling terkumpul (satu sisa panjang lebih berguna
 * daripada banyak sisa pendek).
 */

export type PackItem<T> = { weight: number; data: T };

export type PackResult<T> = {
  /** Isi tiap bin gratis sesuai urutan input. */
  freeBins: T[][];
  /** Isi tiap batang baru yang dibuka. */
  newBins: T[][];
  optimal: boolean;
};

const EPS = 1e-6;
const NODE_BUDGET = 300_000;

export function packItems<T>(items: PackItem<T>[], freeCapacities: number[], newCapacity: number): PackResult<T> {
  const sorted = [...items].sort((a, b) => b.weight - a.weight);
  for (const it of sorted) {
    if (it.weight > newCapacity + EPS) {
      throw new Error(`Potongan ${it.weight} mm lebih panjang dari batang (${newCapacity} mm)`);
    }
  }

  type Bin = { cap: number; rem: number; items: number[]; isNew: boolean };
  const bins: Bin[] = freeCapacities.map((cap) => ({ cap, rem: cap, items: [], isNew: false }));
  const suffix: number[] = new Array(sorted.length + 1).fill(0);
  for (let i = sorted.length - 1; i >= 0; i--) suffix[i] = suffix[i + 1] + sorted[i].weight;

  let best: { newCount: number; score: number; assign: number[]; caps: Bin[] } | null = null;
  const assign: number[] = new Array(sorted.length).fill(-1);
  let nodes = 0;
  let exhausted = true;

  const lowerBound = Math.max(
    0,
    Math.ceil((suffix[0] - freeCapacities.reduce((s, c) => s + c, 0) - EPS) / newCapacity),
  );

  const scoreOf = () => bins.reduce((s, b) => s + b.rem * b.rem, 0);
  const newCount = () => bins.filter((b) => b.isNew).length;

  const record = () => {
    const count = newCount();
    const score = scoreOf();
    if (!best || count < best.newCount || (count === best.newCount && score > best.score + EPS)) {
      best = {
        newCount: count,
        score,
        assign: [...assign],
        caps: bins.map((b) => ({ ...b, items: [...b.items] })),
      };
    }
  };

  const dfs = (i: number) => {
    if (++nodes > NODE_BUDGET) {
      exhausted = false;
      return;
    }
    if (i === sorted.length) {
      record();
      return;
    }
    const opened = newCount();
    const freeRem = bins.reduce((s, b) => s + b.rem, 0);
    const need = Math.max(0, Math.ceil((suffix[i] - freeRem - EPS) / newCapacity));
    if (best && opened + need > best.newCount) return;
    if (best && best.newCount === lowerBound && nodes > NODE_BUDGET / 10) return;

    const w = sorted[i].weight;
    const tried = new Set<string>();
    for (let b = 0; b < bins.length; b++) {
      const bin = bins[b];
      if (bin.rem + EPS < w) continue;
      const key = `${bin.isNew}:${bin.rem.toFixed(3)}`;
      if (tried.has(key)) continue;
      tried.add(key);
      bin.rem -= w;
      bin.items.push(i);
      assign[i] = b;
      dfs(i + 1);
      bin.items.pop();
      bin.rem += w;
      assign[i] = -1;
      if (nodes > NODE_BUDGET) return;
    }

    if (!best || opened + 1 <= best.newCount) {
      bins.push({ cap: newCapacity, rem: newCapacity - w, items: [i], isNew: true });
      assign[i] = bins.length - 1;
      dfs(i + 1);
      bins.pop();
      assign[i] = -1;
    }
  };

  dfs(0);

  const final = best as { caps: Bin[]; newCount: number } | null;
  if (!final) throw new Error("Tidak menemukan susunan potongan");

  const toData = (b: Bin) => b.items.map((i) => sorted[i].data);
  return {
    freeBins: final.caps.filter((b) => !b.isNew).map(toData),
    newBins: final.caps.filter((b) => b.isNew).map(toData),
    optimal: exhausted || final.newCount === lowerBound,
  };
}
