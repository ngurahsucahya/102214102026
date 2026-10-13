import type { DoorSpec, FrameProfile, HandleProfile, Piece, ValidationIssue } from "./types";

export type DoorGeometry = {
  leftWidth: number;
  rightWidth: number;
  frameWidth: number;
  inner: { left: number; right: number; bottom: number; top: number };
};

export function doorGeometry(spec: DoorSpec, frame: FrameProfile, handle: HandleProfile): DoorGeometry {
  const leftWidth = spec.handleSide === "left" ? handle.faceWidth : frame.faceWidth;
  const rightWidth = spec.handleSide === "right" ? handle.faceWidth : frame.faceWidth;
  return {
    leftWidth,
    rightWidth,
    frameWidth: frame.faceWidth,
    inner: {
      left: leftWidth,
      right: spec.width - rightWidth,
      bottom: frame.faceWidth,
      top: spec.height - frame.faceWidth,
    },
  };
}

/** Cek apakah divider (titik tengah) muat di bagian dalam dan tidak saling bertumpuk. */
function checkDividers(
  positions: number[],
  min: number,
  max: number,
  width: number,
  field: string,
  name: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const sorted = [...positions].sort((a, b) => a - b);
  sorted.forEach((p, i) => {
    if (p - width / 2 <= min || p + width / 2 >= max) {
      issues.push({ field, message: `${name} di ${p} mm keluar dari bidang dalam pintu` });
    }
    if (i > 0 && p - sorted[i - 1] <= width) {
      issues.push({ field, message: `${name} di ${sorted[i - 1]} mm dan ${p} mm bertumpuk` });
    }
  });
  return issues;
}

export function validateDoor(spec: DoorSpec, frame: FrameProfile, handle: HandleProfile): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const g = doorGeometry(spec, frame, handle);

  if (!(spec.width > 0)) issues.push({ field: "width", message: "Lebar pintu harus lebih dari 0" });
  if (!(spec.height > 0)) issues.push({ field: "height", message: "Tinggi pintu harus lebih dari 0" });
  if (issues.length) return issues;

  if (g.inner.right - g.inner.left < 50) {
    issues.push({ field: "width", message: "Pintu terlalu sempit untuk profil yang dipilih" });
  }
  if (g.inner.top - g.inner.bottom < 50) {
    issues.push({ field: "height", message: "Pintu terlalu pendek untuk profil yang dipilih" });
  }
  if (spec.width > frame.barLength) {
    issues.push({
      field: "width",
      message: `Lebar ${spec.width} mm melebihi panjang batang ${frame.name} (${frame.barLength} mm)`,
    });
  }
  if (spec.height > frame.barLength) {
    issues.push({
      field: "height",
      message: `Tinggi ${spec.height} mm melebihi panjang batang ${frame.name} (${frame.barLength} mm)`,
    });
  }
  if (spec.height > handle.barLength) {
    issues.push({
      field: "height",
      message: `Tinggi ${spec.height} mm melebihi panjang batang gagang ${handle.name} (${handle.barLength} mm)`,
    });
  }

  issues.push(
    ...checkDividers(spec.vDividers, g.inner.left, g.inner.right, frame.faceWidth, "vDividers", "Divider vertikal"),
    ...checkDividers(spec.hDividers, g.inner.bottom, g.inner.top, frame.faceWidth, "hDividers", "Divider horizontal"),
  );
  return issues;
}

/** Uraikan pintu menjadi daftar potongan batang. */
export function decomposeDoor(spec: DoorSpec, frame: FrameProfile, handle: HandleProfile): Piece[] {
  const g = doorGeometry(spec, frame, handle);
  const frameStock = { kind: "frame" as const, profileId: frame.id };
  const handleStock = { kind: "handle" as const, profileId: handle.id };

  const sideLabel = (side: "left" | "right") => (side === "left" ? "kiri" : "kanan");
  const plainSide = spec.handleSide === "left" ? "right" : "left";

  const pieces: Piece[] = [
    { id: "top", label: "Frame atas", length: spec.width, angle: "miter", stock: frameStock },
    { id: "bottom", label: "Frame bawah", length: spec.width, angle: "miter", stock: frameStock },
    {
      id: plainSide,
      label: `Frame ${sideLabel(plainSide)}`,
      length: spec.height,
      angle: "miter",
      stock: frameStock,
    },
    {
      id: spec.handleSide,
      label: `Frame ${sideLabel(spec.handleSide)} (gagang)`,
      length: spec.height,
      angle: "miter",
      stock: handleStock,
      handleOffset: spec.handleHeight,
    },
  ];

  const vSorted = [...spec.vDividers].sort((a, b) => a - b);
  const hSorted = [...spec.hDividers].sort((a, b) => a - b);
  const half = frame.faceWidth / 2;

  vSorted.forEach((_, i) => {
    pieces.push({
      id: `v${i + 1}`,
      label: `Divider vertikal ${i + 1}`,
      length: g.inner.top - g.inner.bottom,
      angle: "straight",
      stock: frameStock,
    });
  });

  // Divider horizontal terpotong oleh divider vertikal menjadi beberapa ruas.
  const bounds = [g.inner.left, ...vSorted.flatMap((x) => [x - half, x + half]), g.inner.right];
  hSorted.forEach((_, i) => {
    for (let s = 0; s < bounds.length; s += 2) {
      const suffix = bounds.length > 2 ? String.fromCharCode(97 + s / 2) : "";
      pieces.push({
        id: `h${i + 1}${suffix}`,
        label: `Divider horizontal ${i + 1}${suffix}`,
        length: Math.round((bounds[s + 1] - bounds[s]) * 10) / 10,
        angle: "straight",
        stock: frameStock,
      });
    }
  });

  return pieces;
}
