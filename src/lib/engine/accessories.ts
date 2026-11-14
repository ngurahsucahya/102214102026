import { doorGeometry } from "./decompose";
import { handleSides } from "./sides";
import type {
  CalcSettings,
  ComponentLine,
  DoorSpec,
  FrameProfile,
  GlassPanel,
  HandleProfile,
  Material,
  ScrewGroup,
  ScrewLine,
} from "./types";

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
 * kaca ditambah `glassInset` di tiap sisi karena masuk ke alur profil, lalu dikurangi
 * glass deduction dari material profil yang menutup sisi itu (divider = material frame).
 */
export function computeGlass(spec: DoorSpec, frame: FrameProfile, handle: HandleProfile, settings: CalcSettings) {
  const g = doorGeometry(spec, frame, handle);
  const withHandle = handleSides(spec);
  const frameDed = frame.glassDeduction ?? 0;
  const sideDed = (side: "left" | "right") => (withHandle.includes(side) ? (handle.glassDeduction ?? 0) : frameDed);
  const cols = spans(g.inner.left, g.inner.right, spec.vDividers, frame.faceWidth);
  // Baris diurutkan dari atas supaya penomoran mengikuti cara membaca gambar.
  const rows = spans(g.inner.bottom, g.inner.top, spec.hDividers, frame.faceWidth).reverse();

  const panels: GlassPanel[] = [];
  for (const [bottom, top] of rows) {
    cols.forEach(([left, right], i) => {
      const openingWidth = round1(right - left);
      const openingHeight = round1(top - bottom);
      const dedLeft = i === 0 ? sideDed("left") : frameDed;
      const dedRight = i === cols.length - 1 ? sideDed("right") : frameDed;
      panels.push({
        id: `K${panels.length + 1}`,
        openingWidth,
        openingHeight,
        width: round1(openingWidth + 2 * settings.glassInset - dedLeft - dedRight),
        height: round1(openingHeight + 2 * settings.glassInset - 2 * frameDed),
      });
    });
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
  const handleCorners = spec.handleSide === "both" ? 4 : 2;
  if (frameGroup) add(frameGroup.cornerType, 4 - handleCorners, frameGroup.cornerQty, "sudut sisi biasa", frameGroup);
  if (handleGroup) add(handleGroup.cornerType, handleCorners, handleGroup.cornerQty, "sudut sisi gagang", handleGroup);

  if (frameGroup) add(frameGroup.jointType, dividerEnds(spec), frameGroup.jointQty, "ujung divider", frameGroup);

  return [...lines.values()];
}

/** Jumlah ujung ruas divider (tiap ruas punya 2 ujung; divider horizontal terpotong divider vertikal). */
export function dividerEnds(spec: DoorSpec) {
  const v = spec.vDividers.length;
  return 2 * (v + spec.hDividers.length * (v + 1));
}

const ceil1 = (v: number) => Math.ceil(v * 10 - 1e-9) / 10;

/**
 * Komponen dari katalog material:
 * - seal: keliling semua kaca × jalur per sisi kaca (m)
 * - corner connector: 4 sudut frame × jumlah per sudut
 * - pin ambalan: ujung divider × jumlah per ujung
 */
export function computeComponents(
  spec: DoorSpec,
  glass: { panels: GlassPanel[] },
  materials: Material[],
): ComponentLine[] {
  const find = (id: number | null | undefined) => (id == null ? undefined : materials.find((m) => m.id === id));
  const lines: ComponentLine[] = [];
  const per = (m: Material) => (m.usagePerPoint > 0 ? m.usagePerPoint : 1);

  const seal = find(spec.sealMaterialId);
  if (seal && glass.panels.length) {
    const perimeter = glass.panels.reduce((s, p) => s + 2 * (p.width + p.height), 0) / 1000;
    const qty = ceil1(perimeter * per(seal));
    lines.push({
      kind: "seal",
      materialId: seal.id,
      name: seal.name,
      qty,
      unit: seal.unit,
      detail: `keliling ${glass.panels.length} kaca ${round1(perimeter).toLocaleString("id-ID")} m × ${per(seal)} jalur`,
    });
  }

  const corner = find(spec.cornerMaterialId);
  if (corner) {
    lines.push({
      kind: "corner",
      materialId: corner.id,
      name: corner.name,
      qty: 4 * per(corner),
      unit: corner.unit,
      detail: `4 sudut frame × ${per(corner)}`,
    });
  }

  const pin = find(spec.pinMaterialId);
  const ends = dividerEnds(spec);
  if (pin && ends > 0) {
    lines.push({
      kind: "pin",
      materialId: pin.id,
      name: pin.name,
      qty: ends * per(pin),
      unit: pin.unit,
      detail: `${ends} ujung divider × ${per(pin)}`,
    });
  }
  return lines;
}

export type ScrewJoint = {
  /** Posisi titik skrup: x dari kiri, y dari bawah pintu (tampak depan). */
  x: number;
  y: number;
  kind: "corner" | "divider";
  type: string;
  qty: number;
};

/** Titik-titik skrup per sambungan, dengan aturan kelompok yang sama seperti computeScrews. */
export function screwJoints(spec: DoorSpec, frame: FrameProfile, handle: HandleProfile): ScrewJoint[] {
  const g = doorGeometry(spec, frame, handle);
  const W = spec.width;
  const H = spec.height;
  const wF = g.frameWidth;
  const frameGroup = frame.screwGroup;
  const handleGroup = handle.screwGroup ?? frameGroup;
  const withHandle = handleSides(spec);
  const joints: ScrewJoint[] = [];

  const push = (x: number, y: number, kind: ScrewJoint["kind"], group: ScrewGroup | null) => {
    if (!group) return;
    const type = (kind === "corner" ? group.cornerType : group.jointType).trim();
    const qty = kind === "corner" ? group.cornerQty : group.jointQty;
    if (type && qty > 0) joints.push({ x, y, kind, type, qty });
  };

  for (const side of ["left", "right"] as const) {
    const x = side === "left" ? g.leftWidth / 2 : W - g.rightWidth / 2;
    const group = withHandle.includes(side) ? handleGroup : frameGroup;
    push(x, wF / 2, "corner", group);
    push(x, H - wF / 2, "corner", group);
  }

  const vSorted = [...spec.vDividers].sort((a, b) => a - b);
  for (const x of vSorted) {
    push(x, wF / 2, "divider", frameGroup);
    push(x, H - wF / 2, "divider", frameGroup);
  }
  // Ujung ruas divider horizontal menempel ke frame samping atau ke divider vertikal.
  const ends = [g.leftWidth / 2, ...vSorted, W - g.rightWidth / 2];
  for (const y of spec.hDividers) {
    for (let i = 0; i < ends.length - 1; i++) {
      push(ends[i], y, "divider", frameGroup);
      push(ends[i + 1], y, "divider", frameGroup);
    }
  }
  return joints;
}
