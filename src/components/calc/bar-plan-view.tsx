import type { CSSProperties } from "react";
import type { BarPlan, PlacedCut } from "@/lib/engine/types";

export const pieceColor = (cut: Pick<PlacedCut, "pieceId" | "kind">) => {
  if (cut.kind === "handle") return "#fcd34d";
  if (cut.pieceId === "top" || cut.pieceId === "bottom") return "#93c5fd";
  if (cut.pieceId === "left" || cut.pieceId === "right") return "#a5b4fc";
  if (cut.pieceId.startsWith("v")) return "#99f6e4";
  return "#c4b5fd";
};

const fmt = (v: number) => Math.round(v).toLocaleString("id-ID");

const LEFTOVER_BG = "repeating-linear-gradient(135deg, #f0fdf4 0 5px, #bbf7d0 5px 7px)";
const SCRAP_BG = "repeating-linear-gradient(135deg, #fef2f2 0 4px, #fecaca 4px 6px)";
// Ujung potongan 45° digambar miring.
const MITER_CLIP = "polygon(0 0, 100% 0, calc(100% - 6px) 100%, 6px 100%)";

/** Diagram satu batang: posisi tiap potongan, sisa berguna, dan waste. Skala mengikuti lebar, teks tetap ukuran normal. */
export function BarPlanView({ bar, showList = true }: { bar: BarPlan; showList?: boolean }) {
  const pct = (v: number) => `${(v / bar.barLength) * 100}%`;
  const span = (start: number, length: number): CSSProperties => ({ left: pct(start), width: pct(length) });

  return (
    <div className="card p-3">
      <div className="mb-2 flex items-center justify-between gap-2 text-sm">
        <div className="flex min-w-0 items-center gap-2">
          <span className="rounded-md bg-paper px-2 py-0.5 text-xs font-semibold ring-1 ring-line">{bar.id}</span>
          <span className="truncate">{bar.profileName}</span>
        </div>
        <span className="shrink-0 text-muted tabular-nums">{fmt(bar.barLength)} mm</span>
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
              className="absolute inset-y-0 flex items-center justify-center overflow-hidden bg-gray-600 text-xs font-semibold whitespace-nowrap tabular-nums"
              style={{ ...span(c.start, c.length), clipPath: c.angle === "miter" ? MITER_CLIP : undefined }}
            >
              <span
                className="absolute inset-px flex items-center justify-center"
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
            <li key={c.pieceId} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm ring-1 ring-black/20" style={{ background: pieceColor(c) }} />
              <span className="text-ink">{c.label}</span> {fmt(c.length)} mm{c.angle === "miter" && " · 45°"}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
