"use client";

import type { CSSProperties } from "react";
import { useUnit } from "@/components/unit-context";
import type { BarPlan, CalcResult, PlacedCut } from "@/lib/engine/types";

export const pieceColor = (cut: Pick<PlacedCut, "pieceId" | "kind">) => {
  if (cut.kind === "handle") return "#fcd34d";
  // Di bulk ID potongan diberi awalan unit pintu, mis. "P1-2:top".
  const id = cut.pieceId.slice(cut.pieceId.indexOf(":") + 1);
  if (id === "top" || id === "bottom") return "#93c5fd";
  if (id === "left" || id === "right") return "#a5b4fc";
  if (id.startsWith("v")) return "#99f6e4";
  return "#c4b5fd";
};

export type PieceInfo = { barId: string; color: string; label: string; length: number };

/** Potongan pintu → batang asal dan warnanya, untuk mewarnai gambar pintu sesuai rencana potong. */
export function piecesFromResult(result: CalcResult): Record<string, PieceInfo> {
  const map: Record<string, PieceInfo> = {};
  for (const bar of result.bars) {
    for (const c of bar.cuts)
      map[c.pieceId] = { barId: bar.id, color: pieceColor(c), label: c.label, length: c.length };
  }
  return map;
}

/** Potongan satu unit pintu di bulk, dengan ID asli (tanpa awalan) untuk mewarnai gambarnya. */
export function piecesForUnit(bars: BarPlan[], prefix: string): Record<string, PieceInfo> {
  const map: Record<string, PieceInfo> = {};
  for (const bar of bars) {
    for (const c of bar.cuts) {
      if (!c.pieceId.startsWith(prefix)) continue;
      map[c.pieceId.slice(prefix.length)] = { barId: bar.id, color: pieceColor(c), label: c.label, length: c.length };
    }
  }
  return map;
}

type Highlight = {
  highlight?: string | null;
  onHighlight?: (pieceId: string | null) => void;
  onPick?: (pieceId: string) => void;
};

const LEFTOVER_BG = "repeating-linear-gradient(135deg, #f0fdf4 0 5px, #bbf7d0 5px 7px)";
const SCRAP_BG = "repeating-linear-gradient(135deg, #fef2f2 0 4px, #fecaca 4px 6px)";
// Ujung potongan 45° digambar miring.
const MITER_CLIP = "polygon(0 0, 100% 0, calc(100% - 6px) 100%, 6px 100%)";

/** Diagram satu batang: posisi tiap potongan, sisa berguna, dan waste. Skala mengikuti lebar, teks tetap ukuran normal. */
export function BarPlanView({
  bar,
  showList = true,
  highlight = null,
  onHighlight,
  onPick,
}: { bar: BarPlan; showList?: boolean } & Highlight) {
  const { fmt, unit } = useUnit();
  const interactive = Boolean(onHighlight || onPick);
  const hoverProps = (pieceId: string) =>
    interactive
      ? {
          role: "button",
          tabIndex: 0,
          "aria-pressed": highlight === pieceId,
          onMouseEnter: () => onHighlight?.(pieceId),
          onMouseLeave: () => onHighlight?.(null),
          onFocus: () => onHighlight?.(pieceId),
          onBlur: () => onHighlight?.(null),
          onClick: () => onPick?.(pieceId),
          onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onPick?.(pieceId);
            }
          },
        }
      : {};
  const dim = (pieceId: string) => (highlight && highlight !== pieceId ? "opacity-40" : "");
  const pct = (v: number) => `${(v / bar.barLength) * 100}%`;
  const span = (start: number, length: number): CSSProperties => ({ left: pct(start), width: pct(length) });

  return (
    <div className="card p-3">
      <div className="mb-2 flex items-center justify-between gap-2 text-sm">
        <div className="flex min-w-0 items-center gap-2">
          <span className="rounded-md bg-paper px-2 py-0.5 text-xs font-semibold ring-1 ring-line">{bar.id}</span>
          <span className="truncate">{bar.profileName}</span>
        </div>
        <span className="shrink-0 text-muted tabular-nums">
          {fmt(bar.barLength)} {unit}
        </span>
      </div>

      <div className="relative pt-2" role="img" aria-label={`Rencana potong ${bar.id}`}>
        {bar.zones?.map((z, i) => (
          <span key={i} className="absolute top-0 h-1 min-w-1 rounded-full bg-handle" style={span(z.start, z.length)} />
        ))}
        <div className="relative h-9 overflow-hidden rounded bg-paper ring-1 ring-line">
          {bar.scraps.map((l, i) => (
            <span
              key={`s${i}`}
              className="absolute inset-y-0 min-w-px"
              style={{ ...span(l.start, l.length), background: SCRAP_BG }}
            />
          ))}
          {bar.leftovers.map((l, i) => (
            <span
              key={`l${i}`}
              className="absolute inset-y-0 flex items-center justify-center overflow-hidden text-xs font-medium whitespace-nowrap text-ok"
              style={{ ...span(l.start, l.length), background: LEFTOVER_BG }}
            >
              sisa {fmt(l.length)}
            </span>
          ))}
          {bar.cuts.map((c) => (
            <span
              key={c.pieceId}
              {...hoverProps(c.pieceId)}
              title={interactive ? `${c.label} — lihat posisinya di gambar pintu` : undefined}
              className={`absolute inset-y-0 flex items-center justify-center overflow-hidden text-xs font-semibold whitespace-nowrap tabular-nums transition ${
                highlight === c.pieceId ? "bg-accent" : "bg-gray-600"
              } ${dim(c.pieceId)} ${interactive ? "cursor-pointer outline-none" : ""}`}
              style={{ ...span(c.start, c.length), clipPath: c.angle === "miter" ? MITER_CLIP : undefined }}
            >
              <span
                className={`absolute flex items-center justify-center ${highlight === c.pieceId ? "inset-0.5" : "inset-px"}`}
                style={{ background: pieceColor(c), clipPath: c.angle === "miter" ? MITER_CLIP : undefined }}
              >
                {fmt(c.length)}
              </span>
            </span>
          ))}
        </div>
      </div>

      {showList && (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {bar.cuts.map((c) => (
            <li
              key={c.pieceId}
              {...hoverProps(c.pieceId)}
              className={`flex items-center gap-1.5 rounded px-1 transition ${dim(c.pieceId)} ${
                highlight === c.pieceId ? "bg-accent-soft" : ""
              } ${interactive ? "cursor-pointer hover:bg-accent-soft" : ""}`}
            >
              <span className="size-2.5 rounded-sm ring-1 ring-black/20" style={{ background: pieceColor(c) }} />
              <span className="text-ink">{c.label}</span> {fmt(c.length)} {unit}
              {c.angle === "miter" && " · 45°"}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
