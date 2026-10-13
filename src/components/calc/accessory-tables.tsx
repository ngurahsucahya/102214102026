import type { CalcResult } from "@/lib/engine/types";

const fmt = (v: number) => v.toLocaleString("id-ID", { maximumFractionDigits: 1 });

/** Ukuran potong kaca per panel. */
export function GlassTable({ glass, compact = false }: { glass: CalcResult["glass"]; compact?: boolean }) {
  const pad = compact ? "py-1.5" : "td";
  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className={compact ? "py-1 text-left text-xs text-muted" : "th"}>Kaca</th>
            <th className={compact ? "py-1 text-right text-xs text-muted" : "th text-right"}>Ukuran potong (L × T)</th>
            <th className={compact ? "py-1 text-right text-xs text-muted" : "th text-right"}>Bukaan</th>
          </tr>
        </thead>
        <tbody>
          {glass.panels.map((p) => (
            <tr key={p.id} className={compact ? "border-t border-line" : undefined}>
              <td className={pad}>{p.id}</td>
              <td className={`${pad} text-right font-semibold whitespace-nowrap tabular-nums`}>
                {fmt(p.width)} × {fmt(p.height)} mm
              </td>
              <td className={`${pad} text-right whitespace-nowrap text-muted tabular-nums`}>
                {fmt(p.openingWidth)} × {fmt(p.openingHeight)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={`text-xs text-muted ${compact ? "mt-1" : "px-4 py-2"}`}>
        {glass.panels.length} lembar · total {glass.totalArea.toLocaleString("id-ID", { maximumFractionDigits: 2 })} m²
      </p>
    </div>
  );
}

/** Skrup terkumpul per jenis, dengan asal hitungan per sambungan. */
export function ScrewTable({ screws, compact = false }: { screws: CalcResult["screws"]; compact?: boolean }) {
  if (!screws.length) {
    return (
      <p className={`text-sm text-muted ${compact ? "" : "p-4"}`}>
        Batang yang dipilih belum punya kelompok skrup. Atur di menu admin.
      </p>
    );
  }
  const pad = compact ? "py-1.5" : "td";
  return (
    <table className="w-full text-sm">
      <thead>
        <tr>
          <th className={compact ? "py-1 text-left text-xs text-muted" : "th"}>Jenis skrup</th>
          <th className={compact ? "py-1 text-right text-xs text-muted" : "th text-right"}>Jumlah</th>
        </tr>
      </thead>
      <tbody>
        {screws.map((l) => (
          <tr key={l.type} className={compact ? "border-t border-line" : undefined}>
            <td className={pad}>
              <div>{l.type}</div>
              <div className="text-xs text-muted">{l.detail.join(" + ")}</div>
            </td>
            <td className={`${pad} text-right align-top font-semibold whitespace-nowrap tabular-nums`}>{l.qty} pcs</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
