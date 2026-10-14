import type { DoorGeometry } from "@/lib/engine/decompose";
import { hingeSide } from "@/lib/engine/sides";
import type { DoorSpec, GlassPanel, Side } from "@/lib/engine/types";
import { formatLength, type Unit } from "@/lib/units";

const INK = "#374151";

/** Batas-batas berurutan: tepi luar, tebal frame, bukaan, tebal divider, ..., tepi luar. */
function chainBounds(outer: number, startWidth: number, endWidth: number, dividers: number[], dividerWidth: number) {
  const half = dividerWidth / 2;
  return [
    0,
    startWidth,
    ...[...dividers].sort((a, b) => a - b).flatMap((p) => [p - half, p + half]),
    outer - endWidth,
    outer,
  ];
}

/** Sisi tempat garis ukur tinggi gagang; untuk gagang di kedua sisi dipakai sisi kanan. */
const handleDimSide = (spec: DoorSpec): Side => (spec.handleSide === "left" ? "left" : "right");

/** Ruang gambar yang dibutuhkan di luar pintu untuk garis ukur. */
export function detailPadding(spec: DoorSpec, font: number, withHinges = false) {
  const hinge = withHinges ? hingeSide(spec) : null;
  const outer = (side: Side) => handleDimSide(spec) === side || hinge === side;
  return {
    left: font * (outer("left") ? 7.6 : 3.8),
    right: font * (outer("right") ? 8.6 : 4.8),
    top: font * 3.6,
    bottom: font * 3.6,
  };
}

type Props = {
  spec: DoorSpec;
  g: DoorGeometry;
  glass?: GlassPanel[];
  /** Titik tengah engsel dari bawah; kosong jika tidak ada engsel. */
  hinges?: number[];
  hingeLength?: number;
  /** Tampak belakang: kolom kaca terbalik, nomor kaca tetap mengikuti tampak depan. */
  mirrored?: boolean;
  unit: Unit;
  font: number;
  stroke: number;
};

/**
 * Gambar kerja: rantai ukuran horizontal (atas) dan vertikal (kanan) berisi tebal frame,
 * bukaan kaca, dan tebal divider; ukuran total; tinggi gagang; posisi engsel; serta ukuran potong tiap kaca.
 */
export function DoorDimensions({
  spec,
  g,
  glass = [],
  hinges = [],
  hingeLength = 0,
  mirrored = false,
  unit,
  font,
  stroke,
}: Props) {
  const fmt = (mm: number) => formatLength(mm, unit);
  const W = spec.width;
  const H = spec.height;
  const y = (fromBottom: number) => H - fromBottom;
  const tick = font * 0.35;
  const textW = (s: string) => s.length * font * 0.58;

  const hBounds = chainBounds(W, g.leftWidth, g.rightWidth, spec.vDividers, g.frameWidth);
  const vBounds = chainBounds(H, g.frameWidth, g.frameWidth, spec.hDividers, g.frameWidth);

  // ---- rantai horizontal di atas pintu ----
  const topY = -font * 1.4;
  const hLabels: { x: number; tier: number; text: string }[] = [];
  let lastRight = -Infinity;
  for (let i = 1; i < hBounds.length; i++) {
    const len = hBounds[i] - hBounds[i - 1];
    if (len <= 0) continue;
    const text = fmt(len);
    const cx = (hBounds[i] + hBounds[i - 1]) / 2;
    let tier = len >= textW(text) + font * 0.3 ? 0 : 1;
    // Label kecil yang berdekatan dinaikkan satu tingkat lagi supaya tidak bertumpuk.
    if (tier === 1 && cx - textW(text) / 2 < lastRight + font * 0.3) tier = 2;
    if (tier > 0) lastRight = cx + textW(text) / 2;
    hLabels.push({ x: cx, tier, text });
  }

  // ---- rantai vertikal di kanan pintu ----
  const rightX = W + font * 1.4;
  const vLabels = verticalLabels(fmt, vBounds, y, textW, font);

  // ---- ukuran total ----
  const bottomY = H + font * 1.6;
  const leftX = -font * 1.5;

  // ---- slot terluar tiap sisi: tinggi gagang dan rantai engsel ----
  const slotX = (side: Side) => (side === "right" ? W + font * 5.4 : -font * 4.4);
  const edgeX = (side: Side) => (side === "right" ? W : 0);
  const outward = (side: Side) => (side === "right" ? 1 : -1);
  const hSide = handleDimSide(spec);
  const handleX = slotX(hSide);
  const handleY = y(spec.handleHeight);

  const hingeSideNow = hinges.length ? hingeSide(spec) : null;
  const hingeX = hingeSideNow ? slotX(hingeSideNow) : 0;
  // Rantai engsel diukur dari ujung engsel: lantai → ujung bawah → ujung atas → ... → atas pintu.
  const hingeBounds = [
    0,
    ...[...hinges].sort((a, b) => a - b).flatMap((c) => [c - hingeLength / 2, c + hingeLength / 2]),
    H,
  ];
  const hingeLabels = hingeSideNow ? verticalLabels(fmt, hingeBounds, y, textW, font) : [];

  // Label tinggi total di kiri dihindarkan dari garis bantu yang melintas di sisi kiri.
  const leftCrossings = [
    ...(hSide === "left" ? [handleY] : []),
    ...(hingeSideNow === "left" ? hingeBounds.slice(1, -1).map(y) : []),
  ];
  const clearance = textW(fmt(H)) / 2 + font;
  const heightLabelY =
    [H / 2, H * 0.35, H * 0.65, H * 0.25, H * 0.75, H * 0.15, H * 0.85].find((c) =>
      leftCrossings.every((cy) => Math.abs(c - cy) >= clearance),
    ) ?? H / 2;

  // ---- label kaca, urutan sama dengan computeGlass: baris dari atas, kolom dari kiri ----
  const cols: [number, number][] = [];
  for (let i = 1; i < hBounds.length - 1; i += 2) cols.push([hBounds[i], hBounds[i + 1]]);
  const rows: [number, number][] = [];
  for (let i = 1; i < vBounds.length - 1; i += 2) rows.push([vBounds[i], vBounds[i + 1]]);
  rows.reverse();
  const cells = rows.flatMap(([b, t], r) =>
    cols.map(([l, rr], c) => ({ l, r: rr, b, t, index: r * cols.length + (mirrored ? cols.length - 1 - c : c) })),
  );

  const line = (x1: number, y1: number, x2: number, y2: number, key?: string) => (
    <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} />
  );
  const slash = (x: number, yy: number, key: string) => line(x - tick, yy + tick, x + tick, yy - tick, key);

  return (
    <g>
      <g stroke={INK} strokeWidth={stroke}>
        {/* horizontal atas */}
        {hBounds.map((x, i) => line(x, -font * 0.3, x, topY - font * 0.3, `he${i}`))}
        {line(0, topY, W, topY)}
        {hBounds.map((x, i) => slash(x, topY, `ht${i}`))}

        {/* vertikal kanan */}
        {vBounds.map((v, i) => line(W + font * 0.3, y(v), rightX + font * 0.3, y(v), `ve${i}`))}
        {line(rightX, 0, rightX, H)}
        {vBounds.map((v, i) => slash(rightX, y(v), `vt${i}`))}

        {/* total lebar dan tinggi */}
        {line(0, H + font * 0.3, 0, bottomY + font * 0.3)}
        {line(W, H + font * 0.3, W, bottomY + font * 0.3)}
        {line(0, bottomY, W, bottomY)}
        {slash(0, bottomY, "bl")}
        {slash(W, bottomY, "br")}
        {line(-font * 0.3, 0, leftX - font * 0.3, 0)}
        {line(-font * 0.3, H, leftX - font * 0.3, H)}
        {line(leftX, 0, leftX, H)}
        {slash(leftX, 0, "lt")}
        {slash(leftX, H, "lb")}

        {/* tinggi gagang */}
        {line(edgeX(hSide), handleY, handleX + outward(hSide) * font * 0.3, handleY)}
        {line(handleX, handleY, handleX, H)}
        {slash(handleX, handleY, "gt")}
        {slash(handleX, H, "gb")}

        {/* rantai engsel: lantai → engsel 1 → engsel 2 → ... → atas */}
        {hingeSideNow && (
          <>
            {hingeBounds.map((v, i) =>
              line(edgeX(hingeSideNow), y(v), hingeX + outward(hingeSideNow) * font * 0.3, y(v), `ee${i}`),
            )}
            {line(hingeX, 0, hingeX, H)}
            {hingeBounds.map((v, i) => slash(hingeX, y(v), `et${i}`))}
          </>
        )}
      </g>

      <g fill={INK} fontSize={font} fontWeight="500">
        {hLabels.map((l, i) => (
          <text key={`hl${i}`} x={l.x} y={topY - font * 0.35 - l.tier * font * 1.05} textAnchor="middle">
            {l.text}
          </text>
        ))}
        {vLabels.map((l, i) => {
          const x = rightX + font * 1.05 + l.tier * font * 1.05;
          return (
            <text key={`vl${i}`} x={x} y={l.y} textAnchor="middle" transform={`rotate(-90 ${x} ${l.y})`}>
              {l.text}
            </text>
          );
        })}
        <text x={W / 2} y={bottomY + font * 1.25} textAnchor="middle" fontWeight="700">
          {fmt(W)}
        </text>
        <text
          x={leftX - font * 0.35}
          y={heightLabelY}
          textAnchor="middle"
          fontWeight="700"
          transform={`rotate(-90 ${leftX - font * 0.35} ${heightLabelY})`}
        >
          {fmt(H)}
        </text>
        {(() => {
          const x = handleX + (hSide === "right" ? font * 1.05 : -font * 0.35);
          const cy = y(spec.handleHeight / 2);
          return (
            <text x={x} y={cy} textAnchor="middle" fill="#b45309" transform={`rotate(-90 ${x} ${cy})`}>
              gagang {fmt(spec.handleHeight)}
            </text>
          );
        })()}
        {hingeSideNow &&
          hingeLabels.map((l, i) => {
            const base = hingeX + (hingeSideNow === "right" ? font * 1.05 : -font * 0.35);
            const x = base + outward(hingeSideNow) * l.tier * font * 1.05;
            return (
              <text
                key={`el${i}`}
                x={x}
                y={l.y}
                textAnchor="middle"
                fill="#4b5563"
                transform={`rotate(-90 ${x} ${l.y})`}
              >
                {l.text}
              </text>
            );
          })}
      </g>

      {/* ukuran potong kaca di tengah panel */}
      {cells.map((c) => {
        const panel = glass[c.index];
        if (!panel) return null;
        const size = `${fmt(panel.width)} × ${fmt(panel.height)}`;
        const w = c.r - c.l;
        const h = c.t - c.b;
        const f = Math.min(font * 0.95, w / (size.length * 0.62), h / 3.2);
        const cx = (c.l + c.r) / 2;
        const cy = y((c.b + c.t) / 2);
        return (
          <g key={panel.id} textAnchor="middle">
            <text x={cx} y={cy - f * 0.35} fontSize={f} fontWeight="700" fill="#1e40af">
              {panel.id}
            </text>
            <text x={cx} y={cy + f * 0.95} fontSize={f} fill="#111827">
              {size}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/** Label rantai vertikal; ruas pendek digeser keluar satu/dua tingkat supaya tidak bertumpuk. */
function verticalLabels(
  fmt: (mm: number) => string,
  bounds: number[],
  y: (fromBottom: number) => number,
  textW: (s: string) => number,
  font: number,
) {
  const labels: { y: number; tier: number; text: string }[] = [];
  let lastTop = Infinity;
  for (let i = 1; i < bounds.length; i++) {
    const len = bounds[i] - bounds[i - 1];
    if (len <= 0) continue;
    const text = fmt(len);
    const cy = y((bounds[i] + bounds[i - 1]) / 2);
    let tier = len >= textW(text) + font * 0.3 ? 0 : 1;
    if (tier === 1 && cy + textW(text) / 2 > lastTop - font * 0.3) tier = 2;
    if (tier > 0) lastTop = cy - textW(text) / 2;
    labels.push({ y: cy, tier, text });
  }
  return labels;
}
