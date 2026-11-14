"use client";

import { useUnit } from "@/components/unit-context";
import { hingeBottom, sideName } from "@/lib/engine/sides";
import { qtyText, rupiah } from "@/lib/format";
import type { Bom, BulkResult, CalcResult, ComponentLine } from "@/lib/engine/types";
import type { Unit } from "@/lib/units";

/** Ukuran potong kaca per panel. */
export function GlassTable({ glass, compact = false }: { glass: CalcResult["glass"]; compact?: boolean }) {
  const { fmt, unit } = useUnit();
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
                {fmt(p.width)} × {fmt(p.height)} {unit}
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

/** Jenis, jumlah, dan posisi engsel (titik tengah dari bawah). */
export function HingeTable({
  hinges,
  compact = false,
}: {
  hinges: NonNullable<CalcResult["hinges"]>;
  compact?: boolean;
}) {
  const { fmt, unit } = useUnit();
  const pad = compact ? "py-1.5" : "td";
  return (
    <table className="w-full text-sm">
      <thead>
        <tr>
          <th className={compact ? "py-1 text-left text-xs text-muted" : "th"}>Jenis engsel</th>
          <th className={compact ? "py-1 text-right text-xs text-muted" : "th text-right"}>Jumlah</th>
        </tr>
      </thead>
      <tbody>
        <tr className={compact ? "border-t border-line" : undefined}>
          <td className={pad}>
            <div>{hinges.name}</div>
            <div className="text-xs text-muted">
              Sisi {sideName(hinges.side)} · tinggi {fmt(hinges.length)} {unit} · ujung bawah dari lantai:{" "}
              {hinges.positions.map((p) => fmt(hingeBottom(p, hinges.length))).join(", ")} {unit}
            </div>
          </td>
          <td className={`${pad} text-right align-top font-semibold whitespace-nowrap tabular-nums`}>
            {hinges.positions.length} pcs
          </td>
        </tr>
      </tbody>
    </table>
  );
}

/** Kaca semua pintu di bulk, jumlah lembar mengikuti jumlah unit. */
export function BulkGlassTable({
  result,
  fmt,
  unit,
  compact = false,
}: {
  result: BulkResult;
  fmt: (mm: number) => string;
  unit: Unit;
  compact?: boolean;
}) {
  const th = compact ? "py-1 text-xs text-muted" : "th";
  const td = compact ? "py-1.5 border-t border-line" : "td";
  return (
    <table className="w-full text-sm">
      <thead>
        <tr>
          <th className={`${th} text-left`}>Pintu</th>
          <th className={`${th} text-left`}>Kaca</th>
          <th className={`${th} text-right`}>Ukuran potong (L × T)</th>
          <th className={`${th} text-right`}>Jumlah</th>
        </tr>
      </thead>
      <tbody>
        {result.doors.flatMap((d) =>
          d.single.glass.panels.map((p) => (
            <tr key={`${d.code}${p.id}`}>
              <td className={td}>{d.code}</td>
              <td className={td}>{p.id}</td>
              <td className={`${td} text-right font-semibold whitespace-nowrap tabular-nums`}>
                {fmt(p.width)} × {fmt(p.height)} {unit}
              </td>
              <td className={`${td} text-right tabular-nums`}>{d.qty} lembar</td>
            </tr>
          )),
        )}
      </tbody>
    </table>
  );
}

const COMPONENT_NAME: Record<ComponentLine["kind"], string> = {
  seal: "Seal",
  corner: "Corner connector",
  pin: "Pin ambalan",
};

/** Seal, corner connector, dan pin ambalan dari katalog material. */
export function ComponentTable({ components, compact = false }: { components: ComponentLine[]; compact?: boolean }) {
  if (!components.length) {
    return <p className={`text-sm text-muted ${compact ? "" : "p-4"}`}>Tidak ada komponen yang dipilih.</p>;
  }
  const th = compact ? "py-1 text-xs text-muted" : "th";
  const td = compact ? "py-1.5 border-t border-line" : "td";
  return (
    <table className="w-full text-sm">
      <thead>
        <tr>
          <th className={`${th} text-left`}>Komponen</th>
          <th className={`${th} text-right`}>Jumlah</th>
        </tr>
      </thead>
      <tbody>
        {components.map((c) => (
          <tr key={`${c.kind}${c.materialId}`}>
            <td className={td}>
              <div className="text-xs text-muted">{COMPONENT_NAME[c.kind]}</div>
              <div>{c.name}</div>
              <div className="text-xs text-muted">{c.detail}</div>
            </td>
            <td className={`${td} text-right align-top font-semibold whitespace-nowrap tabular-nums`}>
              {qtyText(c.qty)} {c.unit}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Bill of material: kebutuhan per barang katalog, dibulatkan ke minimal beli,
 * dengan harga satuan dan subtotal.
 */
export function BomTable({ bom, compact = false }: { bom: Bom; compact?: boolean }) {
  if (!bom.lines.length) return <p className="p-4 text-sm text-muted">Belum ada material.</p>;
  const th = compact ? "py-1 text-xs text-muted" : "th";
  const td = compact ? "py-1.5 border-t border-line" : "td";
  return (
    <div>
      <table className={`w-full text-sm ${compact ? "" : "min-w-[640px]"}`}>
        <thead>
          <tr>
            <th className={`${th} text-left`}>Material</th>
            <th className={`${th} text-right`}>Butuh</th>
            <th className={`${th} text-right`}>Min. beli</th>
            <th className={`${th} text-right`}>Beli</th>
            <th className={`${th} text-right`}>Harga</th>
            <th className={`${th} text-right`}>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {bom.lines.map((l) => {
            const rounded = l.buy > l.need;
            return (
              <tr key={l.key}>
                <td className={td}>
                  <div className="text-xs text-muted">
                    {l.group}
                    {l.code && ` · ${l.code}`}
                  </div>
                  <div>{l.name}</div>
                  {l.materialId == null && (
                    <div className="text-xs text-danger">Belum terhubung ke katalog material</div>
                  )}
                </td>
                <td className={`${td} text-right align-top whitespace-nowrap tabular-nums`}>
                  {qtyText(l.need)} {l.unit}
                </td>
                <td className={`${td} text-right align-top whitespace-nowrap text-muted tabular-nums`}>
                  {l.materialId == null ? "–" : qtyText(l.minPurchase)}
                </td>
                <td
                  className={`${td} text-right align-top font-semibold whitespace-nowrap tabular-nums ${rounded ? "text-accent" : ""}`}
                >
                  {qtyText(l.buy)} {l.unit}
                </td>
                <td className={`${td} text-right align-top whitespace-nowrap text-muted tabular-nums`}>
                  {l.materialId == null ? "–" : rupiah(l.price)}
                </td>
                <td className={`${td} text-right align-top whitespace-nowrap tabular-nums`}>
                  {l.materialId == null ? "–" : rupiah(l.subtotal)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={5} className={`${td} text-right font-semibold`}>
              Total material
            </td>
            <td className={`${td} text-right font-semibold whitespace-nowrap tabular-nums`}>{rupiah(bom.total)}</td>
          </tr>
        </tfoot>
      </table>
      <p className={`text-xs text-muted ${compact ? "mt-1" : "px-4 py-2"}`}>
        Jumlah beli dibulatkan ke kelipatan minimal beli (mis. butuh 10, minimal 20 → beli 20). Kaca belum termasuk.
        {bom.unlinked > 0 && ` ${bom.unlinked} baris belum punya harga karena belum terhubung ke katalog material.`}
      </p>
    </div>
  );
}
