"use client";

import { Check, Minus, Plus, Printer, Save, Share2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { saveBulk } from "@/app/lapangan/actions";
import { useUnit } from "@/components/unit-context";
import type { CalcCatalog } from "@/lib/data";
import { bomFromBulk, bulkPrefix, bulkUnitName, calculateBulk, CalcError } from "@/lib/engine";
import type { BulkItem, BulkResult, ValidationIssue } from "@/lib/engine/types";
import { formatLength, type Unit } from "@/lib/units";
import { qtyText } from "@/lib/format";
import { BomTable, BulkGlassTable } from "./accessory-tables";
import { BarPlanView, piecesForUnit } from "./bar-plan-view";
import { useBulk } from "./bulk-store";
import { DoorCanvas } from "./door-canvas";
import { BomSheet, BulkWorkshopSheet } from "./print-sheets";
import { specLine } from "./spec-line";

export function bulkShareText(result: BulkResult, unit: Unit, label?: string) {
  const len = (mm: number) => `${formatLength(mm, unit)} ${unit}`;
  const lines = [`*Bulk${label ? ` ${label}` : ""}*`, ""];
  for (const d of result.doors)
    lines.push(`${d.code} ${d.label ? `${d.label} ` : ""}× ${d.qty}: ${specLine(d.spec, unit)}`);
  lines.push(
    "",
    "*Kebutuhan batang:*",
    ...result.summary.map((s) => `• ${s.profileName}: ${s.newBars} batang (${len(s.barLength)})`),
    `Total ${result.stats.totalNewBars} batang (terpisah ${result.separateBars})`,
    "",
    "*Rencana potong:*",
  );
  for (const bar of result.bars) {
    lines.push(`${bar.id} – ${bar.profileName}`);
    for (const c of bar.cuts) lines.push(`   ${c.label}: ${len(c.length)}${c.angle === "miter" ? " (45°)" : ""}`);
    for (const l of bar.leftovers) lines.push(`   sisa: ${len(l.length)}`);
  }
  if (result.screws.length) {
    lines.push("", "*Skrup:*", ...result.screws.map((l) => `• ${l.type}: ${l.qty} pcs`));
  }
  if (result.hinges.length) lines.push("", "*Engsel:*", ...result.hinges.map((h) => `• ${h.name}: ${h.qty} pcs`));
  if (result.components?.length) {
    lines.push("", "*Komponen:*", ...result.components.map((c) => `• ${c.name}: ${qtyText(c.qty)} ${c.unit}`));
  }
  return lines.join("\n");
}

export function BulkView({ catalog }: { catalog: CalcCatalog }) {
  const { items, update, remove, clear } = useBulk();

  const calc = useMemo((): { result: BulkResult | null; issues: ValidationIssue[] } => {
    if (!items.length) return { result: null, issues: [] };
    try {
      return {
        result: calculateBulk(
          items,
          catalog.frames,
          catalog.handles,
          catalog.settings,
          catalog.hingeTypes,
          catalog.materials,
        ),
        issues: [],
      };
    } catch (e) {
      if (e instanceof CalcError) return { result: null, issues: e.issues };
      return { result: null, issues: [{ field: "", message: (e as Error).message }] };
    }
  }, [items, catalog]);

  const { unit } = useUnit();
  const result = calc.result;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="space-y-5 print:hidden">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Bulk</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              Beberapa pintu dihitung bersama dalam satu pembelian, jadi sisa batang satu pintu dipakai untuk pintu
              lain. Tambahkan pintu dari halaman hasil hitung.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/lapangan" className="btn">
              <Plus className="size-4" /> Tambah pintu
            </Link>
            {items.length > 0 && (
              <button className="btn btn-danger" onClick={() => confirm("Kosongkan bulk?") && clear()}>
                <Trash2 className="size-4" /> Kosongkan
              </button>
            )}
          </div>
        </div>

        {items.length === 0 ? (
          <div className="card p-8 text-center text-sm text-muted">
            Bulk masih kosong. Hitung pintu seperti biasa, lalu tekan <b>Tambah ke bulk</b> di halaman hasil.
          </div>
        ) : (
          <section className="card overflow-hidden">
            <ul className="divide-y divide-line">
              {items.map((it, i) => (
                <li key={it.key} className="flex flex-wrap items-center gap-3 p-3">
                  <span className="rounded-md bg-accent-soft px-2 py-0.5 text-sm font-semibold text-accent">
                    P{i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <input
                      value={it.label}
                      onChange={(e) => update(it.key, { label: e.target.value })}
                      placeholder="Nama pintu (opsional)"
                      aria-label={`Nama pintu P${i + 1}`}
                      className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-muted"
                    />
                    <div className="text-xs text-muted">{specLine(it.spec, unit)}</div>
                  </div>
                  <div className="flex items-center" aria-label={`Jumlah unit P${i + 1}`}>
                    <button
                      className="btn rounded-r-none px-2 py-1"
                      aria-label="Kurangi unit"
                      disabled={it.qty <= 1}
                      onClick={() => update(it.key, { qty: it.qty - 1 })}
                    >
                      <Minus className="size-3.5" />
                    </button>
                    <span className="-mx-px w-12 border-y border-line py-1 text-center text-sm font-semibold tabular-nums">
                      {it.qty}
                    </span>
                    <button
                      className="btn rounded-l-none px-2 py-1"
                      aria-label="Tambah unit"
                      onClick={() => update(it.key, { qty: it.qty + 1 })}
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                  <button className="btn btn-danger px-2" aria-label={`Hapus P${i + 1}`} onClick={() => remove(it.key)}>
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {calc.issues.length > 0 && (
          <ul className="space-y-1 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
            {calc.issues.map((iss, i) => (
              <li key={i}>{iss.message}</li>
            ))}
          </ul>
        )}
      </div>
      {result && (
        <BulkResultPanel
          catalog={catalog}
          result={result}
          items={items.map(({ spec, qty, label }) => ({ spec, qty, label }))}
        />
      )}
    </div>
  );
}

/**
 * Hasil bulk: ringkasan hemat, material, gambar tiap unit dengan warna potongan, rencana potong gabungan,
 * kaca, skrup & engsel, serta simpan/bagikan/cetak. Dipakai di halaman Bulk dan untuk "1 model × beberapa pintu".
 */
export function BulkResultPanel({
  catalog,
  result,
  items,
  initialLabel = "",
  customerSheet,
  readOnly = false,
}: {
  catalog: CalcCatalog;
  result: BulkResult;
  /** Isi bulk yang disimpan ke riwayat. */
  items: BulkItem[];
  initialLabel?: string;
  /** Lembar konsumen opsional; jika ada, muncul tombol cetak untuk konsumen. */
  customerSheet?: (label: string) => ReactNode;
  /** Hanya untuk dilihat (riwayat di admin): tanpa tombol simpan. */
  readOnly?: boolean;
}) {
  const { unit, len, fmt } = useUnit();
  const [label, setLabel] = useState(initialLabel);
  // "Tersimpan" hanya berlaku untuk isi bulk yang sama; berubah sedikit, bisa disimpan lagi.
  const itemsKey = JSON.stringify(items);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const saved = savedKey === itemsKey;
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [printing, setPrinting] = useState<"bengkel" | "konsumen" | "bom" | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const unitRefs = useRef(new Map<string, HTMLElement>());
  const highlight = hovered ?? pinned;

  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(null);
    window.addEventListener("afterprint", done);
    window.print();
    return () => window.removeEventListener("afterprint", done);
  }, [printing]);

  const units =
    result?.doors.flatMap((d) =>
      Array.from({ length: d.qty }, (_, k) => ({
        door: d,
        prefix: bulkPrefix(d.code, k + 1),
        name: bulkUnitName(d.code, k + 1, d.qty),
      })),
    ) ?? [];

  /** Dari rencana potong: tunjukkan potongan di gambar unit pintunya. */
  const showOnDoor = (pieceId: string) => {
    setPinned((p) => (p === pieceId ? null : pieceId));
    const prefix = pieceId.slice(0, pieceId.indexOf(":") + 1);
    unitRefs.current.get(prefix)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const share = async () => {
    const text = bulkShareText(result, unit, label);
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

  const saving = result ? result.separateBars - result.stats.totalNewBars : 0;
  const bom = useMemo(() => bomFromBulk(result, catalog), [result, catalog]);

  return (
    <>
      {printing && (
        <div className="hidden print:block">
          {printing === "konsumen" && customerSheet ? (
            customerSheet(label)
          ) : printing === "bom" ? (
            <BomSheet
              bom={bom}
              label={label}
              doors={result.doors.map(
                (d) => `${d.code}${d.label ? ` ${d.label}` : ""} · ${specLine(d.spec, unit)} · ${d.qty} unit`,
              )}
            />
          ) : (
            <BulkWorkshopSheet catalog={catalog} result={result} label={label} unit={unit} />
          )}
        </div>
      )}
      <div className="space-y-5 print:hidden">
        <section className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="card p-5">
            <div className="text-sm text-muted">Total batang</div>
            <div className="mt-1 flex items-baseline gap-3">
              <span className="text-4xl font-semibold tabular-nums">{result.stats.totalNewBars}</span>
              <span className="text-sm text-muted">kalau dihitung terpisah: {result.separateBars} batang</span>
            </div>
            <p
              className={`mt-3 rounded-lg px-3 py-2 text-sm ${saving > 0 ? "bg-ok/10 text-ok" : "bg-paper text-muted"}`}
            >
              {saving > 0
                ? `Hemat ${saving} batang dengan membeli bersama.`
                : "Tidak ada penghematan batang untuk kombinasi pintu ini."}
            </p>
            <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted">Efisiensi</dt>
                <dd className="font-semibold tabular-nums">{Math.round(result.stats.zeroWasteScore * 100)}%</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Sisa berguna</dt>
                <dd className="font-semibold whitespace-nowrap tabular-nums">{len(result.stats.usableLeftover)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Waste</dt>
                <dd className="font-semibold whitespace-nowrap tabular-nums">{len(result.stats.scrap)}</dd>
              </div>
            </dl>
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Material</th>
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
                      <span className="block pl-5 text-xs text-muted">
                        {s.kind === "handle" ? "Batang gagang" : "Batang frame"}
                      </span>
                    </td>
                    <td className="td text-right whitespace-nowrap tabular-nums">{len(s.barLength)}</td>
                    <td className="td text-right font-semibold whitespace-nowrap tabular-nums">{s.newBars} batang</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">Pintu & potongannya</h2>
            <span className="text-xs text-muted">Warna & label = batang asal di rencana potong</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {units.map((u) => {
              const frame = catalog.frames.find((f) => f.id === u.door.spec.frameProfileId)!;
              const handle = catalog.handles.find((h) => h.id === u.door.spec.handleProfileId)!;
              const mine = highlight?.startsWith(u.prefix) ? highlight.slice(u.prefix.length) : null;
              return (
                <figure
                  key={u.prefix}
                  ref={(el) => {
                    if (el) unitRefs.current.set(u.prefix, el);
                    else unitRefs.current.delete(u.prefix);
                  }}
                  className="card min-w-0 p-3"
                >
                  <figcaption className="mb-1 text-sm">
                    <span className="font-semibold">{u.name}</span>
                    {u.door.label && <span className="text-muted"> · {u.door.label}</span>}
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
                    // Potongan dari unit lain disorot: redupkan seluruh unit ini.
                    highlight={highlight && !mine ? "__lain__" : mine}
                    onHighlight={(id) => setHovered(id ? u.prefix + id : null)}
                    onPick={(id) => setPinned((p) => (p === u.prefix + id ? null : u.prefix + id))}
                    className="mx-auto block h-auto w-full"
                  />
                </figure>
              );
            })}
          </div>
        </section>

        <section className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">Rencana potong gabungan</h2>
            <span className="text-xs text-muted">Ketuk potongan untuk melihat pintunya</span>
          </div>
          {result.bars.map((bar) => (
            <BarPlanView key={bar.id} bar={bar} highlight={highlight} onHighlight={setHovered} onPick={showOnDoor} />
          ))}
        </section>

        <section className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="min-w-0 space-y-2">
            <h2 className="text-lg font-semibold">Kaca</h2>
            <div className="card overflow-x-auto">
              <BulkGlassTable result={result} fmt={fmt} unit={unit} />
            </div>
          </div>
          <div className="min-w-0 space-y-2">
            <h2 className="text-lg font-semibold">Skrup, engsel & komponen</h2>
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  {result.screws.map((l) => (
                    <tr key={l.type}>
                      <td className="td">
                        {l.type}
                        <div className="text-xs text-muted">{l.detail.join(" · ")}</div>
                      </td>
                      <td className="td text-right font-semibold whitespace-nowrap tabular-nums">{l.qty} pcs</td>
                    </tr>
                  ))}
                  {result.hinges.map((h) => (
                    <tr key={h.name}>
                      <td className="td">{h.name}</td>
                      <td className="td text-right font-semibold whitespace-nowrap tabular-nums">{h.qty} pcs</td>
                    </tr>
                  ))}
                  {(result.components ?? []).map((c) => (
                    <tr key={`${c.kind}${c.materialId}`}>
                      <td className="td">
                        {c.name}
                        <div className="text-xs text-muted">{c.detail}</div>
                      </td>
                      <td className="td text-right font-semibold whitespace-nowrap tabular-nums">
                        {qtyText(c.qty)} {c.unit}
                      </td>
                    </tr>
                  ))}
                  {!result.screws.length && !result.hinges.length && !result.components?.length && (
                    <tr>
                      <td className="td text-muted">Tidak ada skrup, engsel, atau komponen.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Bill of material (BOM)</h2>
          <div className="card overflow-x-auto">
            <BomTable bom={bom} />
          </div>
          <p className="text-xs text-muted">
            Material dibeli gabungan untuk semua pintu, jadi pembulatan minimal beli hanya terjadi sekali per barang.
          </p>
        </section>

        <section className="card p-4">
          <label htmlFor="bulk-label" className="label">
            Nama bulk / customer <span className="font-normal text-muted">(opsional)</span>
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="bulk-label"
              value={label}
              onChange={(e) => {
                setLabel(e.target.value);
                setSavedKey(null);
              }}
              placeholder="mis. Rumah Pak Budi – 5 pintu"
              className="input flex-1"
            />
            <div className="flex flex-wrap gap-2">
              {!readOnly && (
                <button
                  className="btn btn-primary"
                  disabled={pending || saved}
                  onClick={() =>
                    start(async () => {
                      setError(null);
                      const r = await saveBulk(items, label);
                      if (r.ok) setSavedKey(itemsKey);
                      else setError(r.error);
                    })
                  }
                >
                  {saved ? <Check className="size-4" /> : <Save className="size-4" />}
                  {saved ? "Tersimpan" : pending ? "Menyimpan…" : "Simpan"}
                </button>
              )}
              <button className="btn" onClick={share}>
                <Share2 className="size-4" /> Bagikan
              </button>
              {customerSheet && (
                <button className="btn" onClick={() => setPrinting("konsumen")}>
                  <Printer className="size-4" /> Untuk konsumen
                </button>
              )}
              <button className="btn" onClick={() => setPrinting("bengkel")}>
                <Printer className="size-4" /> {customerSheet ? "Untuk bengkel" : "Cetak untuk bengkel"}
              </button>
              <button className="btn" onClick={() => setPrinting("bom")}>
                <Printer className="size-4" /> BOM
              </button>
            </div>
          </div>
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        </section>
      </div>
    </>
  );
}

/** Daftar pintu di bulk (hanya-lihat), untuk riwayat di admin. */
export function BulkDoorList({ items }: { items: BulkItem[] }) {
  const { unit } = useUnit();
  return (
    <ul className="card divide-y divide-line">
      {items.map((it, i) => (
        <li key={i} className="flex items-center gap-3 p-3">
          <span className="rounded-md bg-accent-soft px-2 py-0.5 text-sm font-semibold text-accent">P{i + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">{it.label || "Tanpa nama"}</div>
            <div className="text-xs text-muted">{specLine(it.spec, unit)}</div>
          </div>
          <span className="text-sm font-semibold tabular-nums">× {it.qty}</span>
        </li>
      ))}
    </ul>
  );
}
