"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { clampToRanges, doorGeometry } from "@/lib/engine";
import type { DoorSpec, FrameProfile, HandleProfile, Segment } from "@/lib/engine/types";

export type CanvasMode = "view" | "divider" | "handle";
export type DividerRef = { axis: "h" | "v"; index: number };

type Props = {
  spec: DoorSpec;
  frame: FrameProfile;
  handle: HandleProfile;
  mode: CanvasMode;
  handleRanges?: Segment[];
  selected?: DividerRef | null;
  onSelect?: (ref: DividerRef | null) => void;
  onChange?: (patch: Partial<DoorSpec>) => void;
  className?: string;
};

const snap = (v: number, step = 5) => Math.round(v / step) * step;

export function DoorCanvas({
  spec,
  frame,
  handle,
  mode,
  handleRanges = [],
  selected,
  onSelect,
  onChange,
  className,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<null | { kind: "handle" } | { kind: "divider"; ref: DividerRef }>(null);

  const W = spec.width;
  const H = spec.height;
  const g = doorGeometry(spec, frame, handle);
  const wF = g.frameWidth;
  const big = Math.max(W, H);
  const pad = big * 0.14;
  const font = big * 0.034;
  const y = (fromBottom: number) => H - fromBottom;
  const handleX = spec.handleSide === "left" ? 0 : W - g.rightWidth;
  const handleW = spec.handleSide === "left" ? g.leftWidth : g.rightWidth;
  const zoneLen = handle.zones[0]?.length ?? 150;

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
      const v = clampToRanges(snap(p.fromBottom), handleRanges);
      if (v !== null && v !== spec.handleHeight) onChange({ handleHeight: v });
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

  return (
    <svg
      ref={svgRef}
      viewBox={`${-pad} ${-pad * 0.5} ${W + pad * 2} ${H + pad * 1.4}`}
      className={`touch-none select-none ${className ?? ""}`}
      onPointerMove={onMove}
      onPointerUp={() => setDrag(null)}
      onPointerCancel={() => setDrag(null)}
      onPointerDown={() => mode === "divider" && onSelect?.(null)}
      role="img"
      aria-label={`Pintu ${W} × ${H} mm`}
    >
      <defs>
        <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#dbeafe" />
          <stop offset="55%" stopColor="#f0f7ff" />
          <stop offset="100%" stopColor="#e0e7ff" />
        </linearGradient>
      </defs>

      {/* lantai */}
      <line x1={-pad} x2={W + pad} y1={H} y2={H} stroke="#d1d5db" strokeWidth={big * 0.006} />

      {/* kaca */}
      <rect x={g.inner.left} y={wF} width={g.inner.right - g.inner.left} height={H - 2 * wF} fill="url(#glass)" />
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
          fill={spec.handleSide === "left" ? handleFill : frameFill}
        />
        <polygon
          points={framePoly([
            [W, 0],
            [W - g.rightWidth, wF],
            [W - g.rightWidth, H - wF],
            [W, H],
          ])}
          fill={spec.handleSide === "right" ? handleFill : frameFill}
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

      {/* area tinggi gagang yang memungkinkan */}
      {mode === "handle" &&
        handleRanges.map((r, i) => (
          <rect
            key={i}
            x={handleX - big * 0.012}
            y={y(r.start + r.length)}
            width={handleW + big * 0.024}
            height={Math.max(r.length, big * 0.004)}
            rx={big * 0.01}
            fill="#16a34a"
            opacity="0.18"
          />
        ))}

      {/* gagang */}
      <g
        className={mode === "handle" ? "cursor-ns-resize" : undefined}
        onPointerDown={mode === "handle" ? (e) => startDrag(e, { kind: "handle" }) : undefined}
      >
        {mode === "handle" && (
          <rect
            x={handleX - big * 0.05}
            y={y(spec.handleHeight) - big * 0.08}
            width={handleW + big * 0.1}
            height={big * 0.16}
            fill="transparent"
          />
        )}
        <rect
          x={handleX + handleW * 0.2}
          y={y(spec.handleHeight + zoneLen / 2)}
          width={handleW * 0.6}
          height={zoneLen}
          rx={handleW * 0.3}
          fill="#d97706"
        />
      </g>
      {mode === "handle" && (
        <g>
          <line
            x1={spec.handleSide === "left" ? handleW : handleX}
            x2={spec.handleSide === "left" ? handleW + big * 0.08 : handleX - big * 0.08}
            y1={y(spec.handleHeight)}
            y2={y(spec.handleHeight)}
            stroke="#d97706"
            strokeWidth={big * 0.004}
            strokeDasharray={`${big * 0.01} ${big * 0.008}`}
          />
          <text
            x={spec.handleSide === "left" ? handleW + big * 0.09 : handleX - big * 0.09}
            y={y(spec.handleHeight) + font * 0.35}
            textAnchor={spec.handleSide === "left" ? "start" : "end"}
            fontSize={font * 1.1}
            fontWeight="700"
            fill="#d97706"
          >
            {spec.handleHeight} mm
          </text>
        </g>
      )}

      {/* ukuran */}
      <g fill="#6b7280" fontSize={font} fontWeight="600">
        <line x1={0} x2={W} y1={H + pad * 0.4} y2={H + pad * 0.4} stroke="#6b7280" strokeWidth={big * 0.003} />
        <line x1={0} x2={0} y1={H + pad * 0.3} y2={H + pad * 0.5} stroke="#6b7280" strokeWidth={big * 0.003} />
        <line x1={W} x2={W} y1={H + pad * 0.3} y2={H + pad * 0.5} stroke="#6b7280" strokeWidth={big * 0.003} />
        <text x={W / 2} y={H + pad * 0.4 + font * 1.3} textAnchor="middle">
          {W} mm
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
          {H} mm
        </text>
      </g>
    </svg>
  );
}
