import { sideName } from "@/lib/engine/sides";
import type { DoorSpec } from "@/lib/engine/types";
import { formatLength, type Unit } from "@/lib/units";

/** Ringkasan satu baris spesifikasi pintu, mis. "Swing · 90 × 210 cm · gagang kanan (ujung bawah 90 cm) · …". */
export function specLine(spec: DoorSpec, unit: Unit) {
  const len = (mm: number) => `${formatLength(mm, unit)} ${unit}`;
  const dividers = spec.hDividers.length + spec.vDividers.length;
  return [
    spec.doorType === "swing" ? "Swing" : "Slider",
    `${formatLength(spec.width, unit)} × ${len(spec.height)}`,
    `gagang ${sideName(spec.handleSide)} (ujung bawah ${len(spec.handleHeight)})`,
    spec.doorType === "swing" ? `${spec.hinges.length} engsel` : null,
    dividers ? `${dividers} divider` : "tanpa divider",
  ]
    .filter(Boolean)
    .join(" · ");
}
