import { handleSides, hingeSide } from "./sides";
import type { DoorSpec, FrameProfile, HandleProfile, HingeType, Piece, ValidationIssue } from "./types";

export type DoorGeometry = {
  leftWidth: number;
  rightWidth: number;
  frameWidth: number;
  inner: { left: number; right: number; bottom: number; top: number };
};

export function doorGeometry(spec: DoorSpec, frame: FrameProfile, handle: HandleProfile): DoorGeometry {
  const sides = handleSides(spec);
  const leftWidth = sides.includes("left") ? handle.faceWidth : frame.faceWidth;
  const rightWidth = sides.includes("right") ? handle.faceWidth : frame.faceWidth;
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
  const cutback = frame.intersectionCutback ?? 0;
  if (cutback > 0 && (spec.vDividers.length || spec.hDividers.length)) {
    const half = frame.faceWidth / 2;
    const xs = [
      g.inner.left,
      ...[...spec.vDividers].sort((a, b) => a - b).flatMap((x) => [x - half, x + half]),
      g.inner.right,
    ];
    const shortest = Math.min(
      ...(spec.vDividers.length ? [g.inner.top - g.inner.bottom] : []),
      ...(spec.hDividers.length ? xs.flatMap((x, i) => (i % 2 === 0 ? [xs[i + 1] - x] : [])) : []),
    );
    if (shortest - 2 * cutback < 20) {
      issues.push({
        field: "vDividers",
        message: `Ruas divider terlalu pendek setelah intersection cutback ${cutback} mm`,
      });
    }
  }
  if (spec.doorType === "swing" && spec.handleSide === "both") {
    issues.push({ field: "handleSide", message: "Pintu swing hanya bisa satu sisi gagang (kiri atau kanan)" });
  }
  return issues;
}

/** Engsel harus utuh di dalam tinggi pintu dan tidak saling bertumpuk. */
export function validateHinges(spec: DoorSpec, hingeTypes: HingeType[]): ValidationIssue[] {
  if (!hingeSide(spec)) return [];
  const type = hingeTypes.find((t) => t.id === spec.hingeTypeId);
  if (!type) return [{ field: "hingeTypeId", message: "Pilih jenis engsel" }];
  if (spec.hinges.length < 1) return [{ field: "hinges", message: "Minimal 1 engsel" }];

  const issues: ValidationIssue[] = [];
  const half = type.length / 2;
  const sorted = [...spec.hinges].sort((a, b) => a - b);
  sorted.forEach((p, i) => {
    if (p - half < 0 || p + half > spec.height) {
      issues.push({ field: "hinges", message: `Engsel di ${p} mm keluar dari tinggi pintu` });
    }
    if (i > 0 && p - sorted[i - 1] < type.length) {
      issues.push({ field: "hinges", message: `Engsel di ${sorted[i - 1]} mm dan ${p} mm bertumpuk` });
    }
  });
  return issues;
}

/** Uraikan pintu menjadi daftar potongan batang. */
export function decomposeDoor(spec: DoorSpec, frame: FrameProfile, handle: HandleProfile): Piece[] {
  const g = doorGeometry(spec, frame, handle);
  const frameStock = { kind: "frame" as const, profileId: frame.id };
  const handleStock = { kind: "handle" as const, profileId: handle.id };

  const sideLabel = (side: "left" | "right") => (side === "left" ? "kiri" : "kanan");
  const withHandle = handleSides(spec);

  const pieces: Piece[] = [
    { id: "top", label: "Frame atas", length: spec.width, angle: "miter", stock: frameStock },
    { id: "bottom", label: "Frame bawah", length: spec.width, angle: "miter", stock: frameStock },
    ...(["left", "right"] as const).map((side): Piece =>
      withHandle.includes(side)
        ? {
            id: side,
            label: `Frame ${sideLabel(side)} (gagang)`,
            length: spec.height,
            angle: "miter",
            stock: handleStock,
            handleOffset: spec.handleHeight,
            handleFrameWidth: frame.faceWidth,
          }
        : { id: side, label: `Frame ${sideLabel(side)}`, length: spec.height, angle: "miter", stock: frameStock },
    ),
  ];

  const vSorted = [...spec.vDividers].sort((a, b) => a - b);
  const hSorted = [...spec.hDividers].sort((a, b) => a - b);
  const half = frame.faceWidth / 2;
  // Divider dipendekkan di kedua ujung pertemuan (intersection cutback material frame).
  const cut2 = 2 * (frame.intersectionCutback ?? 0);

  vSorted.forEach((_, i) => {
    pieces.push({
      id: `v${i + 1}`,
      label: `Divider vertikal ${i + 1}`,
      length: g.inner.top - g.inner.bottom - cut2,
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
        length: Math.round((bounds[s + 1] - bounds[s] - cut2) * 10) / 10,
        angle: "straight",
        stock: frameStock,
      });
    }
  });

  return pieces;
}
