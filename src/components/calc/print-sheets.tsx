import { sideName } from "@/lib/engine/sides";
import type { CalcCatalog } from "@/lib/data";
import { bomFromBulk, bulkPrefix, bulkUnitName } from "@/lib/engine";
import type { Bom, BulkResult, CalcResult, DoorSpec, FrameProfile, HandleProfile } from "@/lib/engine/types";
import { formatLength, type Unit } from "@/lib/units";
import { BomTable, BulkGlassTable, ComponentTable, GlassTable, HingeTable, ScrewTable } from "./accessory-tables";
import { qtyText } from "@/lib/format";
import { BarPlanView, piecesForUnit, piecesFromResult } from "./bar-plan-view";
import { DoorCanvas } from "./door-canvas";
import { DoorViews } from "./door-views";

export type PrintMode = "konsumen" | "bengkel" | "bom";

type SheetProps = {
  spec: DoorSpec;
  frame: FrameProfile;
  handle: HandleProfile;
  result: CalcResult;
  label: string;
  unit: Unit;
  /** Jumlah pintu dengan model yang sama (lembar konsumen). */
  qty?: number;
};

const today = () => new Date().toLocaleDateString("id-ID", { dateStyle: "long" });
const doorTypeName = (spec: DoorSpec) => (spec.doorType === "swing" ? "Swing (engsel)" : "Slider (geser)");

function SheetHeader({ title, label }: { title: string; label: string }) {
  return (
    <header className="mb-6 flex items-start justify-between border-b-2 border-ink pb-3">
      <div>
        <div className="text-sm font-semibold tracking-wide text-muted uppercase">Pintu Custom</div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {label && <div className="mt-1 text-base">{label}</div>}
      </div>
      <div className="text-right text-sm text-muted">{today()}</div>
    </header>
  );
}

function SpecRow({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <tr>
      <th className="w-40 border-b border-line py-2 pr-4 text-left align-top text-sm font-medium text-muted">{k}</th>
      <td className="border-b border-line py-2 text-sm">{children}</td>
    </tr>
  );
}

function dividerLines(spec: DoorSpec, unit: Unit) {
  return [
    ...[...spec.hDividers].sort((a, b) => a - b).map((p) => `Horizontal, ${formatLength(p, unit)} ${unit} dari bawah`),
    ...[...spec.vDividers].sort((a, b) => a - b).map((p) => `Vertikal, ${formatLength(p, unit)} ${unit} dari kiri`),
  ];
}

/** Lembar untuk konsumen: gambar dan spesifikasi pintu saja, tanpa detail potong atau waste. */
export function CustomerSheet({ spec, frame, handle, result, label, unit, qty = 1 }: SheetProps) {
  const fmt = (mm: number) => formatLength(mm, unit);
  const dividers = dividerLines(spec, unit);
  // Gambar pintu diwarnai sesuai rencana potong.
  const pieces = piecesFromResult(result);
  return (
    <article>
      <SheetHeader title="Rincian Pintu" label={label} />
      <div className="grid grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-6">
        <div className="rounded-lg border border-line p-2">
          <DoorCanvas
            spec={spec}
            frame={frame}
            handle={handle}
            mode="view"
            detail
            glass={result.glass.panels}
            hingeLength={result.hinges?.length}
            pieces={pieces}
            pieceTags={false}
            className="mx-auto block h-[150mm] w-full"
          />
        </div>
        <table className="w-full self-start">
          <tbody>
            <SpecRow k="Tipe pintu">{doorTypeName(spec)}</SpecRow>
            {qty > 1 && <SpecRow k="Jumlah">{qty} pintu (model sama)</SpecRow>}
            <SpecRow k="Ukuran pintu">
              {fmt(spec.width)} × {fmt(spec.height)} {unit} <span className="text-muted">(lebar × tinggi)</span>
            </SpecRow>
            <SpecRow k="Rangka">
              <span className="flex items-center gap-2">
                <span className="size-3 shrink-0 rounded-sm ring-1 ring-black/20" style={{ background: frame.color }} />
                {frame.name}
              </span>
            </SpecRow>
            <SpecRow k="Gagang">
              <span className="flex items-center gap-2">
                <span
                  className="size-3 shrink-0 rounded-sm ring-1 ring-black/20"
                  style={{ background: handle.color }}
                />
                {handle.name}
              </span>
            </SpecRow>
            <SpecRow k="Tebal">
              Frame {fmt(frame.faceWidth)} {unit} · gagang {fmt(handle.faceWidth)} {unit}
            </SpecRow>
            <SpecRow k="Posisi gagang">
              Sisi {sideName(spec.handleSide)}, ujung bawah {fmt(spec.handleHeight)} {unit} dari lantai
            </SpecRow>
            {result.hinges && (
              <SpecRow k="Engsel">
                {result.hinges.positions.length} × {result.hinges.name}, sisi {sideName(result.hinges.side)}
              </SpecRow>
            )}
            <SpecRow k="Divider">
              {dividers.length ? (
                <ul>
                  {dividers.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              ) : (
                "Tanpa divider"
              )}
            </SpecRow>
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted">
        Semua ukuran dalam {unit === "cm" ? "sentimeter" : "milimeter"}. Ukuran luar pintu termasuk rangka; K1, K2, …
        adalah ukuran potong kaca.
      </p>

      <div className="mt-10 grid break-inside-avoid grid-cols-2 gap-16 text-center text-sm">
        <div>
          <div>Disetujui oleh,</div>
          <div className="mt-16 border-t border-ink pt-1">Konsumen</div>
        </div>
        <div>
          <div>Hormat kami,</div>
          <div className="mt-16 border-t border-ink pt-1">Pintu Custom</div>
        </div>
      </div>
    </article>
  );
}

/**
 * Lembar BOM: daftar belanja material (butuh, minimal beli, beli, harga) tanpa gambar dan rencana potong.
 * `doors` = baris ringkas pintu yang dihitung.
 */
export function BomSheet({ bom, label, doors }: { bom: Bom; label: string; doors: string[] }) {
  return (
    <article>
      <SheetHeader title="Bill of Material" label={label} />
      <section className="mb-5 text-sm">
        <div className="font-semibold">Pintu</div>
        <ul>
          {doors.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      </section>
      <BomTable bom={bom} compact />
    </article>
  );
}

/** Lembar untuk bengkel: batang yang diambil dan daftar potong per batang. */
export function WorkshopSheet({ spec, frame, handle, result, label, unit, bom }: SheetProps & { bom?: Bom }) {
  const fmt = (mm: number) => formatLength(mm, unit);
  const dividers = dividerLines(spec, unit);
  // Gambar pintu diwarnai sesuai rencana potong.
  const pieces = piecesFromResult(result);
  return (
    <article>
      <SheetHeader title="Lembar Potong" label={label} />

      <div className="mb-4 rounded-lg border border-line p-2">
        <DoorViews
          view="keduanya"
          spec={spec}
          frame={frame}
          handle={handle}
          mode="view"
          detail
          glass={result.glass.panels}
          hingeLength={result.hinges?.length}
          screws={result.screws}
          pieces={pieces}
          pieceMode
          className="mx-auto block h-[115mm] w-full"
        />
      </div>

      <section className="mb-5 grid grid-cols-2 gap-6 text-sm">
        <div>
          <div className="font-semibold">Pintu</div>
          <div>Tipe: {doorTypeName(spec)}</div>
          <div>
            Ukuran: {fmt(spec.width)} × {fmt(spec.height)} {unit}
          </div>
          <div>
            Frame: {frame.name} (tebal {fmt(frame.faceWidth)} {unit})
          </div>
          <div>
            Gagang: {handle.name} (tebal {fmt(handle.faceWidth)} {unit}), sisi {sideName(spec.handleSide)}, ujung bawah{" "}
            {fmt(spec.handleHeight)} {unit} dari lantai
          </div>
          {result.hinges && (
            <div>
              Engsel: {result.hinges.positions.length} × {result.hinges.name}, sisi {sideName(result.hinges.side)}
            </div>
          )}
          <div>Divider: {dividers.length ? dividers.join("; ") : "tanpa divider"}</div>
        </div>
        <div>
          <div className="font-semibold">Ambil batang</div>
          <ul>
            {result.summary.map((s) => (
              <li key={`${s.kind}${s.profileId}`}>
                ☐ {s.newBars} × {s.profileName} ({fmt(s.barLength)} {unit})
              </li>
            ))}
          </ul>
          <div className="mt-1 text-xs text-muted">
            Total {result.stats.totalNewBars} batang · efisiensi {Math.round(result.stats.zeroWasteScore * 100)}% ·
            waste {fmt(result.stats.scrap)} {unit}
          </div>
        </div>
      </section>

      <BarCutSections bars={result.bars} unit={unit} />

      <div className="mt-5 grid break-inside-avoid grid-cols-2 gap-6">
        <section>
          <h2 className="mb-1 text-sm font-semibold">Kaca</h2>
          <GlassTable glass={result.glass} compact />
        </section>
        <section>
          <h2 className="mb-1 text-sm font-semibold">Skrup</h2>
          <ScrewTable screws={result.screws} compact />
          {result.hinges && (
            <>
              <h2 className="mt-4 mb-1 text-sm font-semibold">Engsel</h2>
              <HingeTable hinges={result.hinges} compact />
            </>
          )}
          {!!result.components?.length && (
            <>
              <h2 className="mt-4 mb-1 text-sm font-semibold">Komponen</h2>
              <ComponentTable components={result.components} compact />
            </>
          )}
        </section>
      </div>

      {bom && (
        <section className="mt-5 break-inside-avoid">
          <h2 className="mb-1 text-sm font-semibold">Bill of material</h2>
          <BomTable bom={bom} compact />
        </section>
      )}

      <p className="mt-3 text-xs text-muted">
        Panjang potongan 45° diukur di sisi terpanjang. Kerf sudah diperhitungkan.
      </p>
    </article>
  );
}

/** Rencana potong per batang untuk lembar bengkel: diagram, daftar potong dengan centang, catatan gagang, sisa. */
export function BarCutSections({ bars, unit }: { bars: CalcResult["bars"]; unit: Unit }) {
  const fmt = (mm: number) => formatLength(mm, unit);
  return (
    <div className="space-y-3">
      {bars.map((bar) => {
        const handleCut = bar.cuts.find((c) => c.kind === "handle");
        return (
          <section key={bar.id} className="break-inside-avoid">
            <BarPlanView bar={bar} showList={false} />
            <table className="mt-1 w-full table-fixed text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="w-8 py-1">✓</th>
                  <th className="py-1">Potongan</th>
                  <th className="w-28 py-1 text-right">Panjang</th>
                  <th className="w-36 py-1 text-right">Sudut</th>
                  <th className="w-40 py-1 text-right">Mulai dari ujung kiri</th>
                </tr>
              </thead>
              <tbody>
                {bar.cuts.map((c) => (
                  <tr key={c.pieceId} className="border-t border-line">
                    <td className="py-1.5">☐</td>
                    <td className="py-1.5">{c.label}</td>
                    <td className="py-1.5 text-right font-semibold tabular-nums">
                      {fmt(c.length)} {unit}
                    </td>
                    <td className="py-1.5 text-right">{c.angle === "miter" ? "45° kedua ujung" : "90°"}</td>
                    <td className="py-1.5 text-right tabular-nums">
                      {fmt(c.start)} {unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {handleCut && (
              <p className="mt-1 text-xs">
                Catatan gagang: ujung bawah pintu ada di sisi {handleCut.flipped ? "kanan" : "kiri"} potongan ini.
              </p>
            )}
            {bar.leftovers.length > 0 && (
              <p className="mt-1 text-xs text-muted">
                Sisa disimpan: {bar.leftovers.map((l) => `${fmt(l.length)} ${unit}`).join(", ")}
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}

/** Lembar bengkel untuk bulk: semua pintu, batang yang diambil, gambar tiap unit, dan rencana potong gabungan. */
export function BulkWorkshopSheet({
  catalog,
  result,
  label,
  unit,
}: {
  catalog: CalcCatalog;
  result: BulkResult;
  label: string;
  unit: Unit;
}) {
  const fmt = (mm: number) => formatLength(mm, unit);
  const saving = result.separateBars - result.stats.totalNewBars;
  const units = result.doors.flatMap((d) =>
    Array.from({ length: d.qty }, (_, k) => ({
      door: d,
      prefix: bulkPrefix(d.code, k + 1),
      name: bulkUnitName(d.code, k + 1, d.qty),
    })),
  );

  return (
    <article>
      <SheetHeader title="Lembar Potong Bulk" label={label} />

      <section className="mb-5 grid grid-cols-2 gap-6 text-sm">
        <div>
          <div className="font-semibold">Pintu</div>
          <ul>
            {result.doors.map((d) => (
              <li key={d.code}>
                <b>{d.code}</b> {d.label && `${d.label} · `}
                {fmt(d.spec.width)} × {fmt(d.spec.height)} {unit} · {d.spec.doorType === "swing" ? "swing" : "slider"} ·{" "}
                {d.qty} unit
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="font-semibold">Ambil batang</div>
          <ul>
            {result.summary.map((s) => (
              <li key={`${s.kind}${s.profileId}`}>
                ☐ {s.newBars} × {s.profileName} ({fmt(s.barLength)} {unit})
              </li>
            ))}
          </ul>
          <div className="mt-1 text-xs text-muted">
            Total {result.stats.totalNewBars} batang (terpisah {result.separateBars}
            {saving > 0 && `, hemat ${saving}`}) · efisiensi {Math.round(result.stats.zeroWasteScore * 100)}%
          </div>
        </div>
      </section>

      <div className="mb-5 grid grid-cols-2 gap-3">
        {units.map((u) => {
          const frame = catalog.frames.find((f) => f.id === u.door.spec.frameProfileId)!;
          const handle = catalog.handles.find((h) => h.id === u.door.spec.handleProfileId)!;
          return (
            <figure key={u.prefix} className="break-inside-avoid rounded-lg border border-line p-2">
              <figcaption className="mb-1 text-center text-xs">
                <b>{u.name}</b>
                {u.door.label && ` · ${u.door.label}`}
              </figcaption>
              <DoorCanvas
                spec={u.door.spec}
                frame={frame}
                handle={handle}
                mode="view"
                detail
                glass={u.door.single.glass.panels}
                hingeLength={u.door.single.hinges?.length}
                pieces={piecesForUnit(result.bars, u.prefix)}
                className="mx-auto block h-[95mm] w-full"
              />
            </figure>
          );
        })}
      </div>
      <p className="mb-4 text-xs text-muted">
        Warna dan label di gambar = batang asal di rencana potong (G = gagang, F = frame).
      </p>

      <BarCutSections bars={result.bars} unit={unit} />

      <div className="mt-5 grid break-inside-avoid grid-cols-2 gap-6">
        <section>
          <h2 className="mb-1 text-sm font-semibold">Kaca</h2>
          <BulkGlassTable result={result} fmt={fmt} unit={unit} compact />
        </section>
        <section className="text-sm">
          <h2 className="mb-1 font-semibold">Skrup, engsel & komponen</h2>
          <ul>
            {result.screws.map((l) => (
              <li key={l.type} className="flex justify-between border-t border-line py-1.5">
                <span>{l.type}</span>
                <b className="tabular-nums">{l.qty} pcs</b>
              </li>
            ))}
            {result.hinges.map((h) => (
              <li key={h.name} className="flex justify-between border-t border-line py-1.5">
                <span>{h.name}</span>
                <b className="tabular-nums">{h.qty} pcs</b>
              </li>
            ))}
            {(result.components ?? []).map((c) => (
              <li key={`${c.kind}${c.materialId}`} className="flex justify-between border-t border-line py-1.5">
                <span>{c.name}</span>
                <b className="tabular-nums">
                  {qtyText(c.qty)} {c.unit}
                </b>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-5 break-inside-avoid">
        <h2 className="mb-1 text-sm font-semibold">Bill of material</h2>
        <BomTable bom={bomFromBulk(result, catalog)} compact />
      </section>

      <p className="mt-3 text-xs text-muted">
        Panjang potongan 45° diukur di sisi terpanjang. Kerf sudah diperhitungkan.
      </p>
    </article>
  );
}
