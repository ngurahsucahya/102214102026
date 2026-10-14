import type { DoorSpec, Side } from "./types";

/** Sisi vertikal yang memakai batang gagang. */
export const handleSides = (spec: Pick<DoorSpec, "handleSide">): Side[] =>
  spec.handleSide === "both" ? ["left", "right"] : [spec.handleSide];

/** Engsel selalu di seberang gagang; slider tidak memakai engsel. */
export const hingeSide = (spec: Pick<DoorSpec, "doorType" | "handleSide">): Side | null => {
  if (spec.doorType !== "swing" || spec.handleSide === "both") return null;
  return spec.handleSide === "left" ? "right" : "left";
};

export const sideName = (side: DoorSpec["handleSide"]) =>
  side === "both" ? "kiri & kanan" : side === "left" ? "kiri" : "kanan";

/**
 * Engsel dibagi rata, diukur dari ujung engsel: ujung bawah engsel terbawah dan ujung atas
 * engsel teratas berjarak `margin` dari bawah/atas pintu. Hasilnya titik tengah tiap engsel.
 */
export function distributeHinges(count: number, height: number, length = 0, margin = 200): number[] {
  if (count <= 0) return [];
  if (count === 1) return [Math.round(height / 2)];
  const m = Math.min(margin, height / 4);
  const firstEdge = m;
  const lastEdge = height - m - length;
  const step = (lastEdge - firstEdge) / (count - 1);
  return Array.from({ length: count }, (_, i) => Math.round((firstEdge + i * step) / 5) * 5 + length / 2);
}

/** Ujung bawah engsel dari lantai, dari titik tengahnya. */
export const hingeBottom = (center: number, length: number) => center - length / 2;

/** Pintu dilihat dari belakang: kiri-kanan tertukar. */
export function mirrorSpec(spec: DoorSpec): DoorSpec {
  const flip = { left: "right", right: "left", both: "both" } as const;
  return { ...spec, handleSide: flip[spec.handleSide], vDividers: spec.vDividers.map((x) => spec.width - x) };
}
