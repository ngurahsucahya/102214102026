"use client";

import { ArrowLeft, Check, Printer, RotateCcw, Save, Share2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { saveCalculation } from "@/app/lapangan/actions";
import type { CalcResult, DoorSpec, FrameProfile, HandleProfile } from "@/lib/engine/types";
import { GlassTable, ScrewTable } from "./accessory-tables";
import { BarPlanView } from "./bar-plan-view";
import { DoorCanvas } from "./door-canvas";
import { CustomerSheet, WorkshopSheet, type PrintMode } from "./print-sheets";

const fmt = (v: number) => Math.round(v).toLocaleString("id-ID");
const kindLabel = (kind: "frame" | "handle") => (kind === "handle" ? "Batang gagang" : "Batang frame");

function specLine(spec: DoorSpec) {
  const dividers = spec.hDividers.length + spec.vDividers.length;
  return [
    `${spec.width} × ${spec.height} mm`,
    `gagang ${spec.handleSide === "left" ? "kiri" : "kanan"} ${spec.handleHeight} mm`,
    dividers ? `${dividers} divider` : "tanpa divider",
  ].join(" · ");
}

export function shareText(spec: DoorSpec, result: CalcResult, label?: string) {
  const lines = [
    `*Pintu${label ? ` ${label}` : ""}*`,
    specLine(spec),
    "",
    "*Kebutuhan batang:*",
    ...result.summary.map((s) => `• ${s.profileName}: ${s.newBars} batang (${s.barLength} mm)`),
    "",
    "*Rencana potong:*",
  ];
  for (const bar of result.bars) {
    lines.push(`${bar.id} – ${bar.profileName}`);
    for (const c of bar.cuts) lines.push(`   ${c.label}: ${fmt(c.length)} mm${c.angle === "miter" ? " (45°)" : ""}`);
    for (const l of bar.leftovers) lines.push(`   sisa: ${fmt(l.length)} mm`);
  }
  lines.push("", "*Kaca:*");
  for (const p of result.glass.panels) lines.push(`• ${p.id}: ${p.width} × ${p.height} mm`);
  if (result.screws.length) {
    lines.push("", "*Skrup:*");
    for (const l of result.screws) lines.push(`• ${l.type}: ${l.qty} pcs`);
  }
  lines.push("", `Efisiensi material: ${Math.round(result.stats.zeroWasteScore * 100)}%`);
  return lines.join("\n");
}

export function ResultView({
  spec,
  frame,
  handle,
  result,
  onBack,
  onNew,
}: {
  spec: DoorSpec;
  frame: FrameProfile;
  handle: HandleProfile;
  result: CalcResult;
  onBack: () => void;
  onNew: () => void;
}) {
  const [label, setLabel] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [printMode, setPrintMode] = useState<PrintMode | null>(null);
  const { stats } = result;

  // Render lembar cetak yang dipilih dulu, baru buka dialog cetak.
  useEffect(() => {
    if (!printMode) return;
    const done = () => setPrintMode(null);
    window.addEventListener("afterprint", done);
    window.print();
    return () => window.removeEventListener("afterprint", done);
  }, [printMode]);

  const share = async () => {
    const text = shareText(spec, result, label);
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        // dibatalkan pengguna, lanjut ke WhatsApp
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  };

  const leftovers = result.bars.flatMap((b) => b.leftovers.map((l) => ({ bar: b.id, profile: b.profileName, ...l })));

  const sheetProps = { spec, frame, handle, result, label };

  return (
    <>
      {printMode && (
        <div className="hidden print:block">
          {printMode === "konsumen" ? <CustomerSheet {...sheetProps} /> : <WorkshopSheet {...sheetProps} />}
        </div>
      )}
      <div className="mx-auto max-w-5xl space-y-5 print:hidden">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Hasil perhitungan{label && ` – ${label}`}</h1>
            <p className="mt-1 text-sm text-muted">{specLine(spec)}</p>
          </div>
          <div className="flex gap-2 print:hidden">
            <button className="btn" onClick={onBack}>
              <ArrowLeft className="size-4" /> Ubah
            </button>
            <button className="btn" onClick={onNew}>
              <RotateCcw className="size-4" /> Pintu baru
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
          <div className="card p-3">
            <DoorCanvas spec={spec} frame={frame} handle={handle} mode="view" className="mx-auto block h-72 w-full" />
          </div>

          <div className="min-w-0 space-y-5">
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
              <Stat label="Total batang" value={String(stats.totalNewBars)} />
              <Stat label="Efisiensi material" value={`${Math.round(stats.zeroWasteScore * 100)}%`} />
              <Stat label="Sisa berguna" value={`${fmt(stats.usableLeftover)} mm`} />
              <Stat label="Waste" value={`${fmt(stats.scrap)} mm`} />
            </dl>

            <section className="card overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="th">Material</th>
                    <th className="th hidden sm:table-cell">Jenis</th>
                    <th className="th text-right">Panjang</th>
                    <th className="th text-right">Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  {result.summary.map((s) => (
                    <tr key={`${s.kind}${s.profileId}`}>
                      <td className="td">
                        <span className="flex items-center gap-2 font-medium">
                          <span
                            className="size-3 shrink-0 rounded-sm ring-1 ring-black/15"
                            style={{ background: s.color }}
                          />
                          {s.profileName}
                        </span>
                        <span className="mt-0.5 block pl-5 text-xs text-muted sm:hidden">{kindLabel(s.kind)}</span>
                      </td>
                      <td className="td hidden text-muted sm:table-cell">{kindLabel(s.kind)}</td>
                      <td className="td text-right whitespace-nowrap tabular-nums">{fmt(s.barLength)} mm</td>
                      <td className="td text-right font-semibold whitespace-nowrap tabular-nums">{s.newBars} batang</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <p className="text-xs text-muted">
              {stats.optimal
                ? "Susunan potong sudah optimal untuk jumlah batang paling sedikit."
                : "Susunan potong terbaik yang ditemukan dalam batas waktu hitung."}{" "}
              Efisiensi = 1 − waste ÷ total panjang batang. Sisa berguna tidak dihitung sebagai waste.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <section className="min-w-0 space-y-2">
            <h2 className="text-lg font-semibold">Kaca</h2>
            <div className="card overflow-x-auto">
              <GlassTable glass={result.glass} />
            </div>
          </section>
          <section className="min-w-0 space-y-2">
            <h2 className="text-lg font-semibold">Skrup</h2>
            <div className="card overflow-x-auto">
              <ScrewTable screws={result.screws} />
            </div>
          </section>
        </div>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Rencana potong</h2>
          {result.bars.map((bar) => (
            <BarPlanView key={bar.id} bar={bar} />
          ))}
          <div className="flex flex-wrap gap-4 text-xs text-muted">
            <Legend color="#bbf7d0" label="Sisa berguna" />
            <Legend color="#fecaca" label="Waste" />
            <Legend color="#d97706" label="Posisi gagang pada batang" />
          </div>
          {leftovers.length > 0 && (
            <div className="rounded-lg border border-line bg-paper p-3 text-sm">
              <div className="font-medium">Sisa yang bisa disimpan</div>
              <ul className="mt-1 text-muted">
                {leftovers.map((l, i) => (
                  <li key={i}>
                    {l.bar} · {l.profile}: {fmt(l.length)} mm
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="card p-4 print:hidden">
          <label htmlFor="calc-label" className="label">
            Nama pintu / customer <span className="font-normal text-muted">(opsional)</span>
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="calc-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="mis. Pak Budi – pintu dapur"
              className="input flex-1"
            />
            <div className="flex gap-2">
              <button
                className="btn btn-primary flex-1 sm:flex-none"
                disabled={pending || saved}
                onClick={() =>
                  start(async () => {
                    setError(null);
                    const r = await saveCalculation(spec, label);
                    if (r.ok) setSaved(true);
                    else setError(r.error);
                  })
                }
              >
                {saved ? <Check className="size-4" /> : <Save className="size-4" />}
                {saved ? "Tersimpan" : pending ? "Menyimpan…" : "Simpan"}
              </button>
              <button className="btn flex-1 sm:flex-none" onClick={share}>
                <Share2 className="size-4" /> Bagikan
              </button>
            </div>
          </div>
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
          <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3 sm:flex-row sm:items-center">
            <span className="text-sm text-muted sm:mr-auto">Cetak:</span>
            <button className="btn" onClick={() => setPrintMode("konsumen")}>
              <Printer className="size-4" /> Untuk konsumen
            </button>
            <button className="btn" onClick={() => setPrintMode("bengkel")}>
              <Printer className="size-4" /> Untuk bengkel
            </button>
          </div>
        </section>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface px-4 py-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="size-3 rounded-sm ring-1 ring-black/10" style={{ background: color }} />
      {label}
    </span>
  );
}
