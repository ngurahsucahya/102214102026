import { doorGeometry } from "./decompose";
import type { CalcSettings, DoorSpec, FrameProfile, GlassPanel, HandleProfile, ScrewGroup, ScrewLine } from "./types";

const round1 = (v: number) => Math.round(v * 10) / 10;

/** Pasangan batas [awal, akhir] bidang kaca setelah dipotong divider (posisi = titik tengah divider). */
function spans(min: number, max: number, dividers: number[], width: number) {
  const half = width / 2;
  const bounds = [min, ...[...dividers].sort((a, b) => a - b).flatMap((p) => [p - half, p + half]), max];
  const out: [number, number][] = [];
  for (let i = 0; i < bounds.length; i += 2) out.push([bounds[i], bounds[i + 1]]);
  return out;
}

/**
 * Ukuran kaca per panel. Bukaan dibatasi tebal frame, tebal gagang, dan tebal divider;
 * kaca ditambah `glassInset` di tiap sisi karena masuk ke alur profil.
 */
export function computeGlass(spec: DoorSpec, frame: FrameProfile, handle: HandleProfile, settings: CalcSettings) {
  const g = doorGeometry(spec, frame, handle);
  const cols = spans(g.inner.left, g.inner.right, spec.vDividers, frame.faceWidth);
  // Baris diurutkan dari atas supaya penomoran mengikuti cara membaca gambar.
  const rows = spans(g.inner.bottom, g.inner.top, spec.hDividers, frame.faceWidth).reverse();

  const panels: GlassPanel[] = [];
  for (const [bottom, top] of rows) {
    for (const [left, right] of cols) {
      const openingWidth = round1(right - left);
      const openingHeight = round1(top - bottom);
      panels.push({
        id: `K${panels.length + 1}`,
        openingWidth,
        openingHeight,
        width: round1(openingWidth + 2 * settings.glassInset),
        height: round1(openingHeight + 2 * settings.glassInset),
      });
    }
  }
  const totalArea = panels.reduce((s, p) => s + (p.width * p.height) / 1e6, 0);
  return { panels, totalArea };
}

/**
 * Skrup per sambungan. Sudut di sisi gagang memakai kelompok batang gagang
 * (kalau kosong ikut kelompok frame); sudut lain dan ujung divider memakai kelompok frame.
 */
export function computeScrews(spec: DoorSpec, frame: FrameProfile, handle: HandleProfile): ScrewLine[] {
  const lines = new Map<string, ScrewLine>();
  const add = (type: string, joints: number, perJoint: number, what: string, group: ScrewGroup) => {
    const name = type.trim();
    if (!name || joints <= 0 || perJoint <= 0) return;
    const key = name.toLowerCase();
    const line = lines.get(key) ?? { type: name, qty: 0, detail: [] };
    line.qty += joints * perJoint;
    line.detail.push(`${joints} ${what} × ${perJoint} (${group.name})`);
    lines.set(key, line);
  };

  const frameGroup = frame.screwGroup;
  const handleGroup = handle.screwGroup ?? frameGroup;
  if (frameGroup) add(frameGroup.cornerType, 2, frameGroup.cornerQty, "sudut sisi biasa", frameGroup);
  if (handleGroup) add(handleGroup.cornerType, 2, handleGroup.cornerQty, "sudut sisi gagang", handleGroup);

  // Tiap ruas divider punya 2 ujung. Divider horizontal terpotong oleh divider vertikal.
  const v = spec.vDividers.length;
  const hSegments = spec.hDividers.length * (v + 1);
  const dividerEnds = 2 * (v + hSegments);
  if (frameGroup) add(frameGroup.jointType, dividerEnds, frameGroup.jointQty, "ujung divider", frameGroup);

  return [...lines.values()];
}
