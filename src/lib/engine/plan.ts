import { feasibleHandleRanges, handlePlacements, subtractIntervals, type HandlePlacement } from "./handle";
import { packItems } from "./pack";
import {
  CalcError,
  type BarPlan,
  type CalcResult,
  type CalcSettings,
  type FrameProfile,
  type HandleProfile,
  type Piece,
  type PlacedCut,
  type ProfileSummary,
  type Segment,
} from "./types";

/** Material yang hilang di batang untuk satu potongan, termasuk mata gergaji. */
export function cutAllowance(piece: Pick<Piece, "angle">, settings: CalcSettings): number {
  // Potongan miring 45° memakan kerf lebih panjang di sepanjang batang (kerf / sin 45°).
  return piece.angle === "miter" ? settings.kerf * Math.SQRT2 : settings.kerf;
}

const blockedByCuts = (cuts: PlacedCut[], kerf: number): Segment[] =>
  cuts.map((c) => ({ start: c.start - kerf, length: c.length + 2 * kerf }));

function finishBar(bar: Omit<BarPlan, "leftovers" | "scraps">, settings: CalcSettings): BarPlan {
  const a = settings.endTrim;
  const b = bar.barLength - settings.endTrim;
  const free = subtractIntervals(a, b, blockedByCuts(bar.cuts, settings.kerf * Math.SQRT2));
  const leftovers = free.filter((f) => f.length >= settings.minUsableOffcut);
  const scraps = free.filter((f) => f.length < settings.minUsableOffcut);
  if (settings.endTrim > 0) {
    scraps.unshift({ start: 0, length: a });
    scraps.push({ start: b, length: settings.endTrim });
  }
  return { ...bar, leftovers, scraps };
}

export type CutPlan = Pick<CalcResult, "bars" | "summary" | "stats">;

type OpenBar = Omit<BarPlan, "leftovers" | "scraps">;

/**
 * Rencana potong untuk sekumpulan potongan, boleh dari banyak pintu dengan profil berbeda.
 * 1. Frame gagang ditempatkan di batang gagang (zona gagang di tinggi yang diminta).
 * 2. Sisa batang gagang tanpa zona gagang menjadi stok untuk frame yang cocok.
 * 3. Potongan frame dioptimasi per jenis profil, memakai sisa batang gagang lebih dulu.
 */
export function planCuts(
  pieces: Piece[],
  frames: FrameProfile[],
  handles: HandleProfile[],
  settings: CalcSettings,
): CutPlan {
  const a = settings.endTrim;
  const kerfMiter = settings.kerf * Math.SQRT2;
  const handleBars: OpenBar[] = [];

  // 1. Frame gagang.
  for (const piece of pieces.filter((p) => p.stock.kind === "handle")) {
    const handle = handles.find((h) => h.id === piece.stock.profileId)!;
    const frameWidth = piece.handleFrameWidth ?? 0;
    const placements = handlePlacements(handle, settings, piece.length, piece.handleOffset!, frameWidth);
    if (!placements.length) {
      const ranges = feasibleHandleRanges(handle, settings, piece.length, frameWidth);
      const who = piece.door ? `${piece.door}: ` : "";
      const hint = ranges.length
        ? `${who}Tinggi gagang yang bisa: ${ranges.map((r) => `${r.start}–${r.start + r.length} mm`).join(", ")}`
        : `${who}Batang ${handle.name} tidak bisa dipakai untuk pintu setinggi ${piece.length} mm`;
      throw new CalcError([{ field: "handleHeight", message: hint }]);
    }

    const fits = (bar: OpenBar, p: HandlePlacement) =>
      bar.cuts.every((c) => p.start + piece.length + kerfMiter <= c.start || c.start + c.length + kerfMiter <= p.start);
    const largestFree = (bar: OpenBar, p: HandlePlacement) => {
      const cuts = [...bar.cuts, { start: p.start, length: piece.length } as PlacedCut];
      const free = subtractIntervals(a, handle.barLength - a, blockedByCuts(cuts, kerfMiter));
      return Math.max(0, ...free.map((f) => f.length));
    };

    let chosen: { bar: OpenBar; p: HandlePlacement } | null = null;
    for (const bar of handleBars.filter((b) => b.profileId === handle.id)) {
      for (const p of placements.filter((pl) => fits(bar, pl))) {
        if (!chosen || largestFree(bar, p) > largestFree(chosen.bar, chosen.p)) chosen = { bar, p };
      }
    }
    if (!chosen) {
      const bar: OpenBar = {
        id: `G${handleBars.length + 1}`,
        kind: "handle",
        profileId: handle.id,
        profileName: handle.name,
        color: handle.color,
        barLength: handle.barLength,
        zones: handle.zones,
        cuts: [],
      };
      const best = placements.reduce((x, y) => (largestFree(bar, y) > largestFree(bar, x) ? y : x));
      handleBars.push(bar);
      chosen = { bar, p: best };
    }
    chosen.bar.cuts.push({
      pieceId: piece.id,
      label: piece.label,
      length: piece.length,
      angle: piece.angle,
      kind: "handle",
      start: chosen.p.start,
      flipped: chosen.p.flipped,
    });
  }

  // 2 & 3. Frame per jenis profil, sisa batang gagang yang cocok dipakai lebih dulu.
  const place = (target: { cuts: PlacedCut[] }, from: number, list: Piece[]) => {
    let pos = from;
    for (const p of list) {
      target.cuts.push({ pieceId: p.id, label: p.label, length: p.length, angle: p.angle, kind: "frame", start: pos });
      pos += p.length + cutAllowance(p, settings);
    }
  };

  const frameBars: OpenBar[] = [];
  let optimal = true;
  const frameIds = [...new Set(pieces.filter((p) => p.stock.kind === "frame").map((p) => p.stock.profileId))];
  for (const frameId of frameIds) {
    const frame = frames.find((f) => f.id === frameId)!;
    const framePieces = pieces.filter((p) => p.stock.kind === "frame" && p.stock.profileId === frameId);

    const offcuts: { bar: OpenBar; seg: Segment }[] = [];
    for (const bar of handleBars) {
      const handle = handles.find((h) => h.id === bar.profileId)!;
      if (handle.remainderFrameProfileId !== frameId) continue;
      const blocked = [
        ...blockedByCuts(bar.cuts, kerfMiter),
        ...handle.zones.map((z) => ({ start: z.start - kerfMiter, length: z.length + 2 * kerfMiter })),
      ];
      for (const seg of subtractIntervals(a, bar.barLength - a, blocked)) offcuts.push({ bar, seg });
    }

    let packed;
    try {
      packed = packItems(
        framePieces.map((p) => ({ weight: p.length + cutAllowance(p, settings), data: p })),
        offcuts.map((o) => o.seg.length + settings.kerf),
        frame.barLength - 2 * a + settings.kerf,
      );
    } catch (e) {
      throw new CalcError([{ field: "width", message: (e as Error).message }]);
    }
    optimal &&= packed.optimal;

    packed.freeBins.forEach((list, i) => place(offcuts[i].bar, offcuts[i].seg.start, list));
    for (const list of packed.newBins) {
      const bar: OpenBar = {
        id: `F${frameBars.length + 1}`,
        kind: "frame",
        profileId: frame.id,
        profileName: frame.name,
        color: frame.color,
        barLength: frame.barLength,
        cuts: [],
      };
      place(bar, a, list);
      frameBars.push(bar);
    }
  }

  const bars = [...handleBars, ...frameBars].map((bar) => {
    bar.cuts.sort((x, y) => x.start - y.start);
    return finishBar(bar, settings);
  });

  // Ringkasan per jenis batang, gagang dulu lalu frame.
  const summary: ProfileSummary[] = [];
  for (const bar of bars) {
    const s = summary.find((x) => x.kind === bar.kind && x.profileId === bar.profileId);
    if (s) s.newBars++;
    else {
      summary.push({
        kind: bar.kind,
        profileId: bar.profileId,
        profileName: bar.profileName,
        color: bar.color,
        barLength: bar.barLength,
        newBars: 1,
      });
    }
  }

  const materialLength = bars.reduce((s, b) => s + b.barLength, 0);
  const piecesLength = pieces.reduce((s, p) => s + p.length, 0);
  const usableLeftover = bars.reduce((s, b) => s + b.leftovers.reduce((t, l) => t + l.length, 0), 0);
  const scrap = materialLength - piecesLength - usableLeftover;

  return {
    bars,
    summary,
    stats: {
      totalNewBars: bars.length,
      materialLength,
      piecesLength,
      usableLeftover,
      scrap,
      efficiency: materialLength ? piecesLength / materialLength : 0,
      zeroWasteScore: materialLength ? 1 - scrap / materialLength : 0,
      optimal,
    },
  };
}
