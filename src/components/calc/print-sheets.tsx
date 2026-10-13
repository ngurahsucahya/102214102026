import type { CalcResult, DoorSpec, FrameProfile, HandleProfile } from "@/lib/engine/types";
import { GlassTable, ScrewTable } from "./accessory-tables";
import { BarPlanView } from "./bar-plan-view";
import { DoorCanvas } from "./door-canvas";

export type PrintMode = "konsumen" | "bengkel";

type SheetProps = {
  spec: DoorSpec;
  frame: FrameProfile;
  handle: HandleProfile;
  result: CalcResult;
  label: string;
};

const fmt = (v: number) => Math.round(v).toLocaleString("id-ID");
const today = () => new Date().toLocaleDateString("id-ID", { dateStyle: "long" });
const side = (s: DoorSpec["handleSide"]) => (s === "left" ? "kiri" : "kanan");

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

function dividerLines(spec: DoorSpec) {
  return [
    ...[...spec.hDividers].sort((a, b) => a - b).map((p) => `Horizontal, ${fmt(p)} mm dari bawah`),
    ...[...spec.vDividers].sort((a, b) => a - b).map((p) => `Vertikal, ${fmt(p)} mm dari kiri`),
  ];
}

/** Lembar untuk konsumen: gambar dan spesifikasi pintu saja, tanpa detail potong atau waste. */
export function CustomerSheet({ spec, frame, handle, label }: SheetProps) {
  const dividers = dividerLines(spec);
  return (
    <article>
      <SheetHeader title="Rincian Pintu" label={label} />
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-8">
        <div className="rounded-lg border border-line p-3">
          <DoorCanvas
            spec={spec}
            frame={frame}
            handle={handle}
            mode="view"
            className="mx-auto block h-[110mm] w-full"
          />
        </div>
        <table className="w-full self-start">
          <tbody>
            <SpecRow k="Ukuran pintu">
              {fmt(spec.width)} × {fmt(spec.height)} mm <span className="text-muted">(lebar × tinggi)</span>
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
            <SpecRow k="Posisi gagang">
              Sisi {side(spec.handleSide)}, {fmt(spec.handleHeight)} mm dari bawah
            </SpecRow>
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
      <p className="mt-4 text-xs text-muted">
        Ukuran adalah ukuran luar pintu termasuk rangka. Semua ukuran dalam milimeter.
      </p>

      <div className="mt-16 grid grid-cols-2 gap-16 text-center text-sm">
        <div>
          <div>Disetujui oleh,</div>
          <div className="mt-20 border-t border-ink pt-1">Konsumen</div>
        </div>
        <div>
          <div>Hormat kami,</div>
          <div className="mt-20 border-t border-ink pt-1">Pintu Custom</div>
        </div>
      </div>
    </article>
  );
}

/** Lembar untuk bengkel: batang yang diambil dan daftar potong per batang. */
export function WorkshopSheet({ spec, frame, handle, result, label }: SheetProps) {
  const dividers = dividerLines(spec);
  return (
    <article>
      <SheetHeader title="Lembar Potong" label={label} />

      <section className="mb-5 grid grid-cols-2 gap-6 text-sm">
        <div>
          <div className="font-semibold">Pintu</div>
          <div>
            Ukuran: {fmt(spec.width)} × {fmt(spec.height)} mm
          </div>
          <div>Frame: {frame.name}</div>
          <div>
            Gagang: {handle.name}, sisi {side(spec.handleSide)}, {fmt(spec.handleHeight)} mm dari bawah
          </div>
          <div>Divider: {dividers.length ? dividers.join("; ") : "tanpa divider"}</div>
        </div>
        <div>
          <div className="font-semibold">Ambil batang</div>
          <ul>
            {result.summary.map((s) => (
              <li key={`${s.kind}${s.profileId}`}>
                ☐ {s.newBars} × {s.profileName} ({fmt(s.barLength)} mm)
              </li>
            ))}
          </ul>
          <div className="mt-1 text-xs text-muted">
            Total {result.stats.totalNewBars} batang · efisiensi {Math.round(result.stats.zeroWasteScore * 100)}% ·
            waste {fmt(result.stats.scrap)} mm
          </div>
        </div>
      </section>

      <div className="space-y-3">
        {result.bars.map((bar) => {
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
                      <td className="py-1.5 text-right font-semibold tabular-nums">{fmt(c.length)} mm</td>
                      <td className="py-1.5 text-right">{c.angle === "miter" ? "45° kedua ujung" : "90°"}</td>
                      <td className="py-1.5 text-right tabular-nums">{fmt(c.start)} mm</td>
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
                  Sisa disimpan: {bar.leftovers.map((l) => `${fmt(l.length)} mm`).join(", ")}
                </p>
              )}
            </section>
          );
        })}
      </div>

      <div className="mt-5 grid break-inside-avoid grid-cols-2 gap-6">
        <section>
          <h2 className="mb-1 text-sm font-semibold">Kaca</h2>
          <GlassTable glass={result.glass} compact />
        </section>
        <section>
          <h2 className="mb-1 text-sm font-semibold">Skrup</h2>
          <ScrewTable screws={result.screws} compact />
        </section>
      </div>

      <p className="mt-3 text-xs text-muted">
        Panjang potongan 45° diukur di sisi terpanjang. Kerf sudah diperhitungkan.
      </p>
    </article>
  );
}
