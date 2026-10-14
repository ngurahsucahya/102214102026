"use client";

import { useId, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { clampToRanges, doorGeometry, handleSides, hingeSide, mirrorSpec, screwJoints } from "@/lib/engine";
import type { DoorSpec, FrameProfile, GlassPanel, HandleProfile, Segment } from "@/lib/engine/types";
import { useUnit } from "@/components/unit-context";
import type { PieceInfo } from "./bar-plan-view";
import { detailPadding, DoorDimensions } from "./door-dimensions";

export type CanvasMode = "view" | "divider" | "handle" | "hinge";
export type DividerRef = { axis: "h" | "v"; index: number };

/** Warna penanda per jenis skrup (urutan kemunculan). */
export const SCREW_COLORS = ["#dc2626", "#2563eb", "#059669", "#9333ea", "#0891b2", "#be185d"];

type Props = {
  spec: DoorSpec;
  frame: FrameProfile;
  handle: HandleProfile;
  mode: CanvasMode;
  handleRanges?: Segment[];
  /** Tinggi daun engsel; tanpa ini engsel tidak digambar. */
  hingeLength?: number;
  selected?: DividerRef | null;
  onSelect?: (ref: DividerRef | null) => void;
  onChange?: (patch: Partial<DoorSpec>) => void;
  /** Gambar kerja: semua ukuran (tebal frame, bukaan, divider, kaca, gagang, engsel). */
  detail?: boolean;
  glass?: GlassPanel[];
  /** Tampak belakang: dicerminkan dan menampilkan titik skrup. */
  back?: boolean;
  /** Urutan jenis skrup untuk warna penanda (tampak belakang). */
  screwTypes?: string[];
  /** Warnai tiap bagian pintu sesuai potongan di rencana potong, dengan label batang asalnya. */
  pieces?: Record<string, PieceInfo>;
  /** Tampilkan label batang asal (G1, F1, …) di tiap potongan. */
  pieceTags?: boolean;
  highlight?: string | null;
  /** Sorotan sementara (kursor di atas potongan). */
  onHighlight?: (pieceId: string | null) => void;
  /** Klik/ketuk potongan: sorotan disematkan. */
  onPick?: (pieceId: string) => void;
  className?: string;
};

const snap = (v: number, step = 5) => Math.round(v / step) * step;

export function DoorCanvas({
  spec: frontSpec,
  frame,
  handle,
  mode: requestedMode,
  handleRanges = [],
  hingeLength,
  selected,
  onSelect,
  onChange,
  detail: requestedDetail = false,
  glass,
  back = false,
  screwTypes = [],
  pieces,
  pieceTags = true,
  highlight = null,
  onHighlight,
  onPick,
  className,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  // ID gradasi unik per gambar: beberapa gambar di satu halaman (sebagian tersembunyi saat cetak).
  const glassId = `glass${useId().replace(/:/g, "")}`;
  const { fmt, unit } = useUnit();
  const [drag, setDrag] = useState<
    null | { kind: "handle" } | { kind: "divider"; ref: DividerRef } | { kind: "hinge"; index: number }
  >(null);

  // Tampak belakang hanya untuk dilihat: dicerminkan dan tanpa interaksi.
  const spec = back ? mirrorSpec(frontSpec) : frontSpec;
  const mode = back ? "view" : requestedMode;
  const detail = requestedDetail;

  const W = spec.width;
  const H = spec.height;
  const g = doorGeometry(spec, frame, handle);
  const wF = g.frameWidth;
  const big = Math.max(W, H);
  const pad = big * 0.14;
  const font = big * (detail ? 0.026 : 0.034);
  const hSide = hingeSide(spec);
  const showHinges = hSide !== null && hingeLength !== undefined;
  const dp = detailPadding(spec, font, showHinges);
  const viewBox = detail
    ? `${-dp.left} ${-dp.top} ${W + dp.left + dp.right} ${H + dp.top + dp.bottom}`
    : `${-pad} ${-pad * 0.5} ${W + pad * 2} ${H + pad * 1.4}`;
  const y = (fromBottom: number) => H - fromBottom;
  const zoneLen = handle.zones[0]?.length ?? 150;
  const sides = handleSides(spec);
  const stile = (side: "left" | "right") =>
    side === "left" ? { x: 0, w: g.leftWidth } : { x: W - g.rightWidth, w: g.rightWidth };

  const toDoor = (e: ReactPointerEvent) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: p.x, fromBottom: H - p.y };
  };

  const onMove = (e: ReactPointerEvent) => {
    if (!drag || !onChange) return;
    const p = toDoor(e);
    if (drag.kind === "handle") {
      // Jari memegang tengah gagang; yang disimpan ujung bawahnya.
      const v = clampToRanges(snap(p.fromBottom - zoneLen / 2), handleRanges);
      if (v !== null && v !== spec.handleHeight) onChange({ handleHeight: v });
      return;
    }
    if (drag.kind === "hinge") {
      const half = (hingeLength ?? 0) / 2;
      const v = Math.min(Math.max(snap(p.fromBottom), half), H - half);
      onChange({ hinges: spec.hinges.map((h, i) => (i === drag.index ? v : h)) });
      return;
    }
    const { axis, index } = drag.ref;
    if (axis === "h") {
      const v = Math.min(Math.max(snap(p.fromBottom), g.inner.bottom + wF), g.inner.top - wF);
      onChange({ hDividers: spec.hDividers.map((d, i) => (i === index ? v : d)) });
    } else {
      const v = Math.min(Math.max(snap(p.x), g.inner.left + wF), g.inner.right - wF);
      onChange({ vDividers: spec.vDividers.map((d, i) => (i === index ? v : d)) });
    }
  };

  const startDrag = (e: ReactPointerEvent, next: NonNullable<typeof drag>) => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    setDrag(next);
    if (next.kind === "divider") onSelect?.(next.ref);
  };

  const framePoly = (pts: number[][]) => pts.map((p) => p.join(",")).join(" ");
  const frameFill = frame.color;
  const handleFill = handle.color;
  const isSel = (axis: "h" | "v", index: number) => selected?.axis === axis && selected.index === index;
  const joints = back ? screwJoints(spec, frame, handle) : [];
  const screwColor = (type: string) => SCREW_COLORS[Math.max(0, screwTypes.indexOf(type)) % SCREW_COLORS.length];

  return (
    <svg
      ref={svgRef}
      viewBox={viewBox}
      className={`touch-none select-none ${className ?? ""}`}
      onPointerMove={onMove}
      onPointerUp={() => setDrag(null)}
      onPointerCancel={() => setDrag(null)}
      onPointerDown={() => mode === "divider" && onSelect?.(null)}
      role="img"
      aria-label={`Pintu ${fmt(W)} × ${fmt(H)} ${unit}, tampak ${back ? "belakang" : "depan"}`}
    >
      <defs>
        <linearGradient id={glassId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#dbeafe" />
          <stop offset="55%" stopColor="#f0f7ff" />
          <stop offset="100%" stopColor="#e0e7ff" />
        </linearGradient>
      </defs>

      {/* lantai */}
      {!detail && <line x1={-pad} x2={W + pad} y1={H} y2={H} stroke="#d1d5db" strokeWidth={big * 0.006} />}

      {/* kaca */}
      <rect
        x={g.inner.left}
        y={wF}
        width={g.inner.right - g.inner.left}
        height={H - 2 * wF}
        fill={`url(#${glassId})`}
      />
      {!back && (
        <line
          x1={g.inner.left + (g.inner.right - g.inner.left) * 0.15}
          y1={wF + (H - 2 * wF) * 0.3}
          x2={g.inner.left + (g.inner.right - g.inner.left) * 0.35}
          y2={wF + (H - 2 * wF) * 0.1}
          stroke="#fff"
          strokeOpacity="0.9"
          strokeWidth={big * 0.008}
          strokeLinecap="round"
        />
      )}

      {/* frame dengan sambungan 45° */}
      <g stroke="#0003" strokeWidth={big * 0.002}>
        <polygon
          points={framePoly([
            [0, 0],
            [W, 0],
            [W - g.rightWidth, wF],
            [g.leftWidth, wF],
          ])}
          fill={frameFill}
        />
        <polygon
          points={framePoly([
            [0, H],
            [W, H],
            [W - g.rightWidth, H - wF],
            [g.leftWidth, H - wF],
          ])}
          fill={frameFill}
        />
        <polygon
          points={framePoly([
            [0, 0],
            [g.leftWidth, wF],
            [g.leftWidth, H - wF],
            [0, H],
          ])}
          fill={sides.includes("left") ? handleFill : frameFill}
        />
        <polygon
          points={framePoly([
            [W, 0],
            [W - g.rightWidth, wF],
            [W - g.rightWidth, H - wF],
            [W, H],
          ])}
          fill={sides.includes("right") ? handleFill : frameFill}
        />
      </g>

      {/* divider */}
      {spec.vDividers.map((x, i) => (
        <rect
          key={`v${i}`}
          x={x - wF / 2}
          y={wF}
          width={wF}
          height={H - 2 * wF}
          fill={frameFill}
          stroke={isSel("v", i) ? "#1e40af" : "#0006"}
          strokeWidth={isSel("v", i) ? big * 0.008 : big * 0.002}
          className={mode === "divider" ? "cursor-ew-resize" : undefined}
          onPointerDown={
            mode === "divider" ? (e) => startDrag(e, { kind: "divider", ref: { axis: "v", index: i } }) : undefined
          }
        />
      ))}
      {spec.hDividers.map((h, i) => (
        <rect
          key={`h${i}`}
          x={g.inner.left}
          y={y(h) - wF / 2}
          width={g.inner.right - g.inner.left}
          height={wF}
          fill={frameFill}
          stroke={isSel("h", i) ? "#1e40af" : "#0006"}
          strokeWidth={isSel("h", i) ? big * 0.008 : big * 0.002}
          className={mode === "divider" ? "cursor-ns-resize" : undefined}
          onPointerDown={
            mode === "divider" ? (e) => startDrag(e, { kind: "divider", ref: { axis: "h", index: i } }) : undefined
          }
        />
      ))}
      {/* area sentuh lebih besar untuk divider di layar HP */}
      {mode === "divider" &&
        spec.hDividers.map((h, i) => (
          <rect
            key={`hh${i}`}
            x={g.inner.left}
            y={y(h) - big * 0.03}
            width={g.inner.right - g.inner.left}
            height={big * 0.06}
            fill="transparent"
            className="cursor-ns-resize"
            onPointerDown={(e) => startDrag(e, { kind: "divider", ref: { axis: "h", index: i } })}
          />
        ))}
      {mode === "divider" &&
        spec.vDividers.map((x, i) => (
          <rect
            key={`vv${i}`}
            x={x - big * 0.03}
            y={wF}
            width={big * 0.06}
            height={H - 2 * wF}
            fill="transparent"
            className="cursor-ew-resize"
            onPointerDown={(e) => startDrag(e, { kind: "divider", ref: { axis: "v", index: i } })}
          />
        ))}

      {pieces && (
        <PieceOverlay
          spec={spec}
          g={g}
          back={back}
          pieces={pieces}
          tags={pieceTags}
          highlight={highlight}
          onHighlight={mode === "view" ? onHighlight : undefined}
          onPick={mode === "view" ? onPick : undefined}
          lengthText={(mm) => `${fmt(mm)} ${unit}`}
          font={font}
          big={big}
        />
      )}

      {/* gagang di satu atau kedua sisi */}
      {sides.map((side) => {
        const s = stile(side);
        return (
          <g key={side}>
            {mode === "handle" &&
              handleRanges.map((r, i) => (
                <rect
                  key={i}
                  x={s.x - big * 0.012}
                  y={y(r.start + r.length + zoneLen)}
                  width={s.w + big * 0.024}
                  height={r.length + zoneLen}
                  rx={big * 0.01}
                  fill="#16a34a"
                  opacity="0.18"
                />
              ))}
            <g
              className={mode === "handle" ? "cursor-ns-resize" : undefined}
              onPointerDown={mode === "handle" ? (e) => startDrag(e, { kind: "handle" }) : undefined}
            >
              {mode === "handle" && (
                <rect
                  x={s.x - big * 0.05}
                  y={y(spec.handleHeight + zoneLen / 2) - big * 0.08}
                  width={s.w + big * 0.1}
                  height={big * 0.16}
                  fill="transparent"
                />
              )}
              <rect
                x={s.x + s.w * 0.2}
                y={y(spec.handleHeight + zoneLen)}
                width={s.w * 0.6}
                height={zoneLen}
                rx={s.w * 0.3}
                fill="#d97706"
              />
            </g>
          </g>
        );
      })}

      {/* engsel: setengah menonjol di tepi luar sisi engsel */}
      {showHinges &&
        spec.hinges.map((h, i) => {
          const s = stile(hSide!);
          const w = Math.max(s.w * 0.7, big * 0.012);
          const x = hSide === "left" ? -w / 2 : W - w / 2;
          return (
            <g
              key={i}
              className={mode === "hinge" ? "cursor-ns-resize" : undefined}
              onPointerDown={mode === "hinge" ? (e) => startDrag(e, { kind: "hinge", index: i }) : undefined}
            >
              {mode === "hinge" && (
                <rect
                  x={x - big * 0.04}
                  y={y(h) - Math.max(hingeLength! / 2, big * 0.05)}
                  width={w + big * 0.08}
                  height={Math.max(hingeLength!, big * 0.1)}
                  fill="transparent"
                />
              )}
              <rect
                x={x}
                y={y(h + hingeLength! / 2)}
                width={w}
                height={hingeLength}
                rx={w * 0.2}
                fill="#4b5563"
                stroke={mode === "hinge" ? "#1e40af" : "none"}
                strokeWidth={big * 0.004}
              />
              <line
                x1={x + w / 2}
                x2={x + w / 2}
                y1={y(h + hingeLength! / 2)}
                y2={y(h - hingeLength! / 2)}
                stroke="#e5e7eb"
                strokeWidth={big * 0.002}
              />
            </g>
          );
        })}

      {/* tampak belakang: titik skrup per sambungan */}
      {back &&
        joints.map((j, i) => (
          <g key={i}>
            <circle
              cx={j.x}
              cy={y(j.y)}
              r={font * 0.62}
              fill="#fff"
              stroke={screwColor(j.type)}
              strokeWidth={font * 0.14}
            />
            <text
              x={j.x}
              y={y(j.y) + font * 0.27}
              textAnchor="middle"
              fontSize={font * 0.72}
              fontWeight="700"
              fill={screwColor(j.type)}
            >
              {j.qty}
            </text>
          </g>
        ))}

      {detail && (
        <DoorDimensions
          spec={spec}
          g={g}
          glass={glass}
          hinges={showHinges ? spec.hinges : []}
          hingeLength={hingeLength}
          mirrored={back}
          unit={unit}
          font={font}
          stroke={big * 0.0016}
        />
      )}

      {/* ukuran sederhana */}
      {!detail && (
        <g fill="#6b7280" fontSize={font} fontWeight="600">
          <line x1={0} x2={W} y1={H + pad * 0.4} y2={H + pad * 0.4} stroke="#6b7280" strokeWidth={big * 0.003} />
          <line x1={0} x2={0} y1={H + pad * 0.3} y2={H + pad * 0.5} stroke="#6b7280" strokeWidth={big * 0.003} />
          <line x1={W} x2={W} y1={H + pad * 0.3} y2={H + pad * 0.5} stroke="#6b7280" strokeWidth={big * 0.003} />
          <text x={W / 2} y={H + pad * 0.4 + font * 1.3} textAnchor="middle">
            {fmt(W)} {unit}
          </text>
          <line x1={-pad * 0.4} x2={-pad * 0.4} y1={0} y2={H} stroke="#6b7280" strokeWidth={big * 0.003} />
          <line x1={-pad * 0.5} x2={-pad * 0.3} y1={0} y2={0} stroke="#6b7280" strokeWidth={big * 0.003} />
          <line x1={-pad * 0.5} x2={-pad * 0.3} y1={H} y2={H} stroke="#6b7280" strokeWidth={big * 0.003} />
          <text
            x={-pad * 0.4 - font * 0.6}
            y={H / 2}
            textAnchor="middle"
            transform={`rotate(-90 ${-pad * 0.4 - font * 0.6} ${H / 2})`}
          >
            {fmt(H)} {unit}
          </text>
        </g>
      )}
    </svg>
  );
}

type Shape = { id: string; points: number[][]; tag: [number, number] };

/**
 * Bentuk tiap potongan pintu dengan ID yang sama seperti decomposeDoor.
 * Untuk tampak belakang, ID dikembalikan ke potongan aslinya (kiri↔kanan, urutan divider vertikal terbalik).
 */
function pieceShapes(spec: DoorSpec, g: ReturnType<typeof doorGeometry>, back: boolean): Shape[] {
  const W = spec.width;
  const H = spec.height;
  const wF = g.frameWidth;
  const half = wF / 2;
  const y = (fromBottom: number) => H - fromBottom;
  const vs = [...spec.vDividers].sort((a, b) => a - b);
  const hs = [...spec.hDividers].sort((a, b) => a - b);
  const nV = vs.length;
  const rect = (x0: number, y0: number, x1: number, y1: number) => [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];
  const side = (id: "left" | "right") => (back ? (id === "left" ? "right" : "left") : id);
  const vId = (i: number) => `v${back ? nV - i : i + 1}`;
  const segSuffix = (j: number) => (nV > 0 ? String.fromCharCode(97 + (back ? nV - j : j)) : "");

  const shapes: Shape[] = [
    {
      id: "top",
      points: [
        [0, 0],
        [W, 0],
        [W - g.rightWidth, wF],
        [g.leftWidth, wF],
      ],
      tag: [W * 0.3, wF / 2],
    },
    {
      id: "bottom",
      points: [
        [0, H],
        [W, H],
        [W - g.rightWidth, H - wF],
        [g.leftWidth, H - wF],
      ],
      tag: [W * 0.3, H - wF / 2],
    },
    {
      id: side("left"),
      points: [
        [0, 0],
        [g.leftWidth, wF],
        [g.leftWidth, H - wF],
        [0, H],
      ],
      tag: [g.leftWidth / 2, H * 0.22],
    },
    {
      id: side("right"),
      points: [
        [W, 0],
        [W - g.rightWidth, wF],
        [W - g.rightWidth, H - wF],
        [W, H],
      ],
      tag: [W - g.rightWidth / 2, H * 0.22],
    },
    ...vs.map((x, i) => ({
      id: vId(i),
      points: rect(x - half, wF, x + half, H - wF),
      tag: [x, H * 0.3] as [number, number],
    })),
  ];
  const bounds = [g.inner.left, ...vs.flatMap((x) => [x - half, x + half]), g.inner.right];
  hs.forEach((h, k) => {
    for (let j = 0; j < bounds.length; j += 2) {
      const [x0, x1] = [bounds[j], bounds[j + 1]];
      shapes.push({
        id: `h${k + 1}${segSuffix(j / 2)}`,
        points: rect(x0, y(h) - half, x1, y(h) + half),
        tag: [(x0 + x1) / 2, y(h)],
      });
    }
  });
  return shapes;
}

function PieceOverlay({
  spec,
  g,
  back,
  pieces,
  tags,
  highlight,
  onHighlight,
  onPick,
  lengthText,
  font,
  big,
}: {
  spec: DoorSpec;
  g: ReturnType<typeof doorGeometry>;
  back: boolean;
  pieces: Record<string, PieceInfo>;
  tags: boolean;
  highlight: string | null;
  onHighlight?: (pieceId: string | null) => void;
  onPick?: (pieceId: string) => void;
  lengthText: (mm: number) => string;
  font: number;
  big: number;
}) {
  const shapes = pieceShapes(spec, g, back);
  const tagH = font * 0.95;
  return (
    <g className={onHighlight || onPick ? undefined : "pointer-events-none"}>
      {shapes.map((s) => {
        const info = pieces[s.id];
        if (!info) return null;
        const dimmed = highlight && highlight !== s.id;
        const active = highlight === s.id;
        return (
          <polygon
            key={s.id}
            points={s.points.map((p) => p.join(",")).join(" ")}
            fill={info.color}
            stroke={active ? "#1e40af" : "#374151"}
            strokeWidth={active ? big * 0.006 : big * 0.0015}
            opacity={dimmed ? 0.35 : 1}
            className={onHighlight || onPick ? "cursor-pointer" : undefined}
            onMouseEnter={() => onHighlight?.(s.id)}
            onMouseLeave={() => onHighlight?.(null)}
            onClick={() => onPick?.(s.id)}
          >
            <title>{`${info.label} · ${lengthText(info.length)} · batang ${info.barId}`}</title>
          </polygon>
        );
      })}
      {/* label batang asal di tiap potongan */}
      {tags &&
        shapes.map((s) => {
          const info = pieces[s.id];
          if (!info) return null;
          const w = info.barId.length * font * 0.62 + font * 0.5;
          const active = highlight === s.id;
          return (
            <g key={`t${s.id}`} opacity={highlight && !active ? 0.35 : 1} className="pointer-events-none">
              <rect
                x={s.tag[0] - w / 2}
                y={s.tag[1] - tagH / 2}
                width={w}
                height={tagH}
                rx={tagH * 0.3}
                fill={active ? "#1e40af" : "#fff"}
                stroke="#374151"
                strokeWidth={big * 0.0012}
              />
              <text
                x={s.tag[0]}
                y={s.tag[1] + font * 0.3}
                textAnchor="middle"
                fontSize={font * 0.78}
                fontWeight="700"
                fill={active ? "#fff" : "#111827"}
              >
                {info.barId}
              </text>
            </g>
          );
        })}
    </g>
  );
}
