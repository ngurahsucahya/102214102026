import { computeGlass, computeScrews } from "./accessories";
import { decomposeDoor, validateDoor } from "./decompose";
import { feasibleHandleRanges, handlePlacements, subtractIntervals, type HandlePlacement } from "./handle";
import { packItems } from "./pack";
import {
  CalcError,
  type BarPlan,
  type CalcResult,
  type CalcSettings,
  type DoorSpec,
  type FrameProfile,
  type HandleProfile,
  type Piece,
  type PlacedCut,
  type ProfileSummary,
  type Segment,
} from "./types";

export * from "./types";
export { decomposeDoor, doorGeometry, validateDoor } from "./decompose";
export { clampToRanges, feasibleHandleRanges } from "./handle";

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

export function calculate(
  spec: DoorSpec,
  frames: FrameProfile[],
  handles: HandleProfile[],
  settings: CalcSettings,
): CalcResult {
  const frame = frames.find((f) => f.id === spec.frameProfileId);
  const handle = handles.find((h) => h.id === spec.handleProfileId);
  if (!frame) throw new CalcError([{ field: "frameProfileId", message: "Pilih jenis frame" }]);
  if (!handle) throw new CalcError([{ field: "handleProfileId", message: "Pilih jenis gagang" }]);

  const issues = validateDoor(spec, frame, handle);
  if (issues.length) throw new CalcError(issues);

  const pieces = decomposeDoor(spec, frame, handle);
  const a = settings.endTrim;

  // 1. Frame gagang: cari posisi potong di batang gagang.
  type HandleBar = Omit<BarPlan, "leftovers" | "scraps">;
  const handleBars: HandleBar[] = [];
  for (const piece of pieces.filter((p) => p.stock.kind === "handle")) {
    const placements = handlePlacements(handle, settings, piece.length, piece.handleOffset!, frame.faceWidth);
    if (!placements.length) {
      const ranges = feasibleHandleRanges(handle, settings, piece.length, frame.faceWidth);
      const hint = ranges.length
        ? `Tinggi gagang yang bisa: ${ranges.map((r) => `${r.start}–${r.start + r.length} mm`).join(", ")}`
        : `Batang ${handle.name} tidak bisa dipakai untuk pintu setinggi ${piece.length} mm`;
      throw new CalcError([{ field: "handleHeight", message: hint }]);
    }

    const kerf = settings.kerf * Math.SQRT2;
    const fits = (bar: HandleBar, p: HandlePlacement) =>
      bar.cuts.every((c) => p.start + piece.length + kerf <= c.start || c.start + c.length + kerf <= p.start);
    const largestFree = (bar: HandleBar, p: HandlePlacement) => {
      const cuts = [...bar.cuts, { start: p.start, length: piece.length } as PlacedCut];
      const free = subtractIntervals(a, handle.barLength - a, blockedByCuts(cuts, kerf));
      return Math.max(0, ...free.map((f) => f.length));
    };

    let chosen: { bar: HandleBar; p: HandlePlacement } | null = null;
    for (const bar of handleBars) {
      for (const p of placements.filter((pl) => fits(bar, pl))) {
        if (!chosen || largestFree(bar, p) > largestFree(chosen.bar, chosen.p)) chosen = { bar, p };
      }
    }
    if (!chosen) {
      const bar: HandleBar = {
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

  // 2. Sisa batang gagang (tanpa zona gagang) bisa dipakai sebagai frame.
  const kerfMiter = settings.kerf * Math.SQRT2;
  const offcuts: { bar: HandleBar; seg: Segment }[] = [];
  if (handle.remainderFrameProfileId === frame.id) {
    for (const bar of handleBars) {
      const blocked = [
        ...blockedByCuts(bar.cuts, kerfMiter),
        ...handle.zones.map((z) => ({ start: z.start - kerfMiter, length: z.length + 2 * kerfMiter })),
      ];
      for (const seg of subtractIntervals(a, bar.barLength - a, blocked)) offcuts.push({ bar, seg });
    }
  }

  // 3. Optimasi potongan frame.
  const framePieces = pieces.filter((p) => p.stock.kind === "frame");
  const usable = frame.barLength - 2 * a;
  let packed;
  try {
    packed = packItems(
      framePieces.map((p) => ({ weight: p.length + cutAllowance(p, settings), data: p })),
      offcuts.map((o) => o.seg.length + settings.kerf),
      usable + settings.kerf,
    );
  } catch (e) {
    throw new CalcError([{ field: "width", message: (e as Error).message }]);
  }

  const place = (target: { cuts: PlacedCut[] }, from: number, list: Piece[]) => {
    let pos = from;
    for (const p of list) {
      target.cuts.push({ pieceId: p.id, label: p.label, length: p.length, angle: p.angle, kind: "frame", start: pos });
      pos += p.length + cutAllowance(p, settings);
    }
  };
  packed.freeBins.forEach((list, i) => place(offcuts[i].bar, offcuts[i].seg.start, list));

  const frameBars: HandleBar[] = packed.newBins.map((list, i) => {
    const bar: HandleBar = {
      id: `F${i + 1}`,
      kind: "frame",
      profileId: frame.id,
      profileName: frame.name,
      color: frame.color,
      barLength: frame.barLength,
      cuts: [],
    };
    place(bar, a, list);
    return bar;
  });

  const bars = [...handleBars, ...frameBars].map((bar) => {
    bar.cuts.sort((x, y) => x.start - y.start);
    return finishBar(bar, settings);
  });

  // 4. Ringkasan dan statistik.
  const summary: ProfileSummary[] = [
    {
      kind: "handle",
      profileId: handle.id,
      profileName: handle.name,
      color: handle.color,
      barLength: handle.barLength,
      newBars: handleBars.length,
    },
    {
      kind: "frame",
      profileId: frame.id,
      profileName: frame.name,
      color: frame.color,
      barLength: frame.barLength,
      newBars: frameBars.length,
    },
  ].filter((s) => s.newBars > 0) as ProfileSummary[];

  const materialLength = bars.reduce((s, b) => s + b.barLength, 0);
  const piecesLength = pieces.reduce((s, p) => s + p.length, 0);
  const usableLeftover = bars.reduce((s, b) => s + b.leftovers.reduce((t, l) => t + l.length, 0), 0);
  const scrap = materialLength - piecesLength - usableLeftover;

  return {
    pieces,
    bars,
    summary,
    glass: computeGlass(spec, frame, handle, settings),
    screws: computeScrews(spec, frame, handle),
    stats: {
      totalNewBars: bars.length,
      materialLength,
      piecesLength,
      usableLeftover,
      scrap,
      efficiency: materialLength ? piecesLength / materialLength : 0,
      zeroWasteScore: materialLength ? 1 - scrap / materialLength : 0,
      optimal: packed.optimal,
    },
  };
}
