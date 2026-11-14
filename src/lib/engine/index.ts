import { computeComponents, computeGlass, computeScrews } from "./accessories";
import { decomposeDoor, validateDoor, validateHinges } from "./decompose";
import { planCuts } from "./plan";
import { hingeSide } from "./sides";
import {
  CalcError,
  type BulkItem,
  type BulkResult,
  type CalcResult,
  type ComponentLine,
  type CalcSettings,
  type DoorSpec,
  type FrameProfile,
  type HandleProfile,
  type HingeType,
  type Material,
  type ScrewLine,
} from "./types";

export * from "./types";
export { decomposeDoor, doorGeometry, validateDoor, validateHinges } from "./decompose";
export * from "./sides";
export { dividerEnds, screwJoints } from "./accessories";
export { buildBom, bomFromBulk, bomFromResult, type BomCatalog } from "./bom";
export { clampToRanges, feasibleHandleRanges } from "./handle";
export { cutAllowance } from "./plan";

function hingeResult(spec: DoorSpec, hingeTypes: HingeType[]): CalcResult["hinges"] {
  const side = hingeSide(spec);
  const type = hingeTypes.find((t) => t.id === spec.hingeTypeId);
  if (!side || !type) return null;
  return {
    typeId: type.id,
    name: type.name,
    length: type.length,
    side,
    positions: [...spec.hinges].sort((a, b) => a - b),
  };
}

function resolveProfiles(spec: DoorSpec, frames: FrameProfile[], handles: HandleProfile[]) {
  const frame = frames.find((f) => f.id === spec.frameProfileId);
  const handle = handles.find((h) => h.id === spec.handleProfileId);
  if (!frame) throw new CalcError([{ field: "frameProfileId", message: "Pilih jenis frame" }]);
  if (!handle) throw new CalcError([{ field: "handleProfileId", message: "Pilih jenis gagang" }]);
  return { frame, handle };
}

export function calculate(
  spec: DoorSpec,
  frames: FrameProfile[],
  handles: HandleProfile[],
  settings: CalcSettings,
  hingeTypes: HingeType[] = [],
  materials: Material[] = [],
): CalcResult {
  const { frame, handle } = resolveProfiles(spec, frames, handles);
  const issues = [...validateDoor(spec, frame, handle), ...validateHinges(spec, hingeTypes)];
  if (issues.length) throw new CalcError(issues);

  const pieces = decomposeDoor(spec, frame, handle);
  const glass = computeGlass(spec, frame, handle, settings);
  return {
    pieces,
    ...planCuts(pieces, frames, handles, settings),
    glass,
    hinges: hingeResult(spec, hingeTypes),
    screws: computeScrews(spec, frame, handle),
    components: computeComponents(spec, glass, materials),
  };
}

/** Awalan ID potongan untuk satu unit pintu di bulk, mis. "P2-1:". */
export const bulkPrefix = (code: string, unit: number) => `${code}-${unit}:`;

/** Nama satu unit pintu di bulk, mis. "P2" atau "P2 (1/3)". */
export const bulkUnitName = (code: string, unit: number, qty: number) => (qty > 1 ? `${code} (${unit}/${qty})` : code);

/**
 * Beberapa pintu dihitung bersama dalam satu pembelian, supaya sisa batang satu pintu
 * bisa dipakai pintu lain. Setiap unit tetap divalidasi seperti dihitung sendiri.
 */
export function calculateBulk(
  items: BulkItem[],
  frames: FrameProfile[],
  handles: HandleProfile[],
  settings: CalcSettings,
  hingeTypes: HingeType[] = [],
  materials: Material[] = [],
): BulkResult {
  if (!items.length) throw new CalcError([{ field: "bulk", message: "Bulk masih kosong" }]);

  const doors = items.map((item, i) => {
    const code = `P${i + 1}`;
    let single: CalcResult;
    try {
      single = calculate(item.spec, frames, handles, settings, hingeTypes, materials);
    } catch (e) {
      if (e instanceof CalcError) {
        throw new CalcError(e.issues.map((iss) => ({ ...iss, message: `${code}: ${iss.message}` })));
      }
      throw e;
    }
    return { code, label: item.label, spec: item.spec, qty: Math.max(1, Math.round(item.qty)), single };
  });

  // Semua potongan dari semua unit, ID diberi awalan supaya tetap unik.
  const pieces = doors.flatMap((d) =>
    Array.from({ length: d.qty }, (_, k) => {
      const name = bulkUnitName(d.code, k + 1, d.qty);
      return d.single.pieces.map((p) => ({
        ...p,
        id: `${bulkPrefix(d.code, k + 1)}${p.id}`,
        label: `${name} · ${p.label}`,
        door: name,
      }));
    }).flat(),
  );

  const screwMap = new Map<string, ScrewLine>();
  const hingeMap = new Map<string, { name: string; qty: number; typeId: number }>();
  const compMap = new Map<string, ComponentLine>();
  for (const d of doors) {
    for (const l of d.single.screws) {
      const line = screwMap.get(l.type) ?? { type: l.type, qty: 0, detail: [] };
      line.qty += l.qty * d.qty;
      line.detail.push(`${d.code}: ${l.qty}${d.qty > 1 ? ` × ${d.qty}` : ""}`);
      screwMap.set(l.type, line);
    }
    if (d.single.hinges) {
      const h = d.single.hinges;
      const row = hingeMap.get(h.name) ?? { name: h.name, qty: 0, typeId: h.typeId };
      row.qty += h.positions.length * d.qty;
      hingeMap.set(h.name, row);
    }
    for (const c of d.single.components ?? []) {
      const key = `${c.kind}:${c.materialId}`;
      const row = compMap.get(key) ?? { ...c, qty: 0, detail: "" };
      row.qty = Math.round((row.qty + c.qty * d.qty) * 10) / 10;
      row.detail = [row.detail, `${d.code}: ${c.qty}${d.qty > 1 ? ` × ${d.qty}` : ""}`].filter(Boolean).join(" · ");
      compMap.set(key, row);
    }
  }

  return {
    ...planCuts(pieces, frames, handles, settings),
    doors,
    separateBars: doors.reduce((s, d) => s + d.single.stats.totalNewBars * d.qty, 0),
    screws: [...screwMap.values()],
    hinges: [...hingeMap.values()],
    components: [...compMap.values()],
  };
}
