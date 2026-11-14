"use client";

import { ArrowLeft, ArrowRight, Calculator, Columns2, Minus, Plus, RotateCcw, Rows2, Trash2 } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import type { CalcCatalog } from "@/lib/data";
import {
  calculate,
  calculateBulk,
  CalcError,
  clampToRanges,
  distributeHinges,
  doorGeometry,
  feasibleHandleRanges,
  hingeBottom,
  hingeSide,
} from "@/lib/engine";
import type {
  BulkResult,
  CalcResult,
  ComponentKind,
  DoorSpec,
  DoorType,
  MaterialCategory,
  Segment,
  ValidationIssue,
} from "@/lib/engine/types";
import { qtyText, rupiah } from "@/lib/format";
import { piecesFromResult } from "./bar-plan-view";
import type { DividerRef } from "./door-canvas";
import { DoorViews } from "./door-views";
import { useUnit } from "@/components/unit-context";
import { ResultView } from "./result-view";

const ALL_STEPS = [
  { key: "ukuran", title: "Ukuran", fields: ["width", "height", "doorType"] },
  { key: "frame", title: "Frame", fields: ["frameProfileId"] },
  { key: "divider", title: "Divider", fields: ["hDividers", "vDividers"] },
  { key: "gagang", title: "Gagang", fields: ["handleHeight", "handleProfileId", "handleSide"] },
  { key: "engsel", title: "Engsel", fields: ["hingeTypeId", "hinges"] },
  { key: "komponen", title: "Komponen", fields: ["sealMaterialId", "cornerMaterialId", "pinMaterialId"] },
] as const;

type StepKey = (typeof ALL_STEPS)[number]["key"];

/** Langkah engsel hanya untuk pintu swing. */
const stepsFor = (doorType: DoorType) => ALL_STEPS.filter((s) => s.key !== "engsel" || doorType === "swing");

const HINT: Partial<Record<StepKey, string>> = {
  divider: "Geser divider pada gambar",
  gagang: "Geser gagang pada gambar",
  engsel: "Geser engsel pada gambar",
};

const PRESETS = [
  [800, 2100],
  [900, 2100],
  [1000, 2200],
  [700, 2000],
] as const;

function rangesFor(catalog: CalcCatalog, spec: DoorSpec): Segment[] {
  const frame = catalog.frames.find((f) => f.id === spec.frameProfileId);
  const handle = catalog.handles.find((h) => h.id === spec.handleProfileId);
  if (!frame || !handle || !(spec.height > 0)) return [];
  return feasibleHandleRanges(handle, catalog.settings, spec.height, frame.faceWidth);
}

/** Letakkan divider baru di tengah celah terbesar. */
function largestGapCenter(existing: number[], min: number, max: number) {
  const pts = [min, ...[...existing].sort((a, b) => a - b), max];
  let best = { gap: -1, center: (min + max) / 2 };
  for (let i = 1; i < pts.length; i++) {
    const gap = pts[i] - pts[i - 1];
    if (gap > best.gap) best = { gap, center: Math.round((pts[i] + pts[i - 1]) / 2 / 5) * 5 };
  }
  return best.center;
}

export function DoorCalculator({ catalog }: { catalog: CalcCatalog }) {
  const [step, setStep] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [selected, setSelected] = useState<DividerRef | null>(null);
  /** Jumlah pintu dengan model yang sama; lebih dari 1 dihitung bersama seperti bulk. */
  const [qty, setQty] = useState(1);
  const [hovered, setHovered] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [spec, setSpec] = useState<DoorSpec>(() => {
    const base: DoorSpec = {
      doorType: "swing",
      hingeTypeId: catalog.hingeTypes[0]?.id ?? null,
      hinges: distributeHinges(3, 2100, catalog.hingeTypes[0]?.length ?? 0),
      width: 900,
      height: 2100,
      // Utamakan frame yang cocok dengan sisa batang gagang, supaya sisanya terpakai.
      frameProfileId:
        catalog.frames.find((f) => f.id === catalog.handles[0].remainderFrameProfileId)?.id ?? catalog.frames[0].id,
      handleProfileId: catalog.handles[0].id,
      handleSide: "right",
      handleHeight: 900,
      hDividers: [],
      vDividers: [],
      sealMaterialId: null,
      cornerMaterialId: null,
      pinMaterialId: null,
    };
    return { ...base, handleHeight: clampToRanges(900, rangesFor(catalog, base)) ?? 900 };
  });

  const update = (patch: Partial<DoorSpec>) => {
    setSpec((prev) => {
      const next = { ...prev, ...patch };
      // Swing hanya boleh satu sisi gagang.
      if (next.doorType === "swing" && next.handleSide === "both") next.handleSide = "right";
      // Engsel dibagi rata lagi saat tinggi pintu atau jenis engsel (tinggi engsel) berubah.
      if (
        (patch.height !== undefined || patch.hingeTypeId !== undefined) &&
        patch.hinges === undefined &&
        next.height > 0
      ) {
        const length = catalog.hingeTypes.find((t) => t.id === next.hingeTypeId)?.length ?? 0;
        next.hinges = distributeHinges(next.hinges.length, next.height, length);
      }
      // Tinggi gagang ikut menyesuaikan saat batang atau tinggi pintu berubah.
      if (patch.handleHeight === undefined) {
        const v = clampToRanges(next.handleHeight, rangesFor(catalog, next));
        if (v !== null) next.handleHeight = v;
      }
      return next;
    });
  };

  const frame = catalog.frames.find((f) => f.id === spec.frameProfileId)!;
  const handle = catalog.handles.find((h) => h.id === spec.handleProfileId)!;
  const handleRanges = useMemo(() => rangesFor(catalog, spec), [catalog, spec]);

  const deferred = useDeferredValue(spec);
  const calc = useMemo((): { result: CalcResult | null; issues: ValidationIssue[] } => {
    try {
      return {
        result: calculate(
          deferred,
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
  }, [deferred, catalog]);

  const multi = useMemo(() => {
    if (qty <= 1 || !calc.result) return null;
    try {
      return calculateBulk(
        [{ spec: deferred, qty, label: "" }],
        catalog.frames,
        catalog.handles,
        catalog.settings,
        catalog.hingeTypes,
        catalog.materials,
      );
    } catch {
      return null;
    }
  }, [qty, deferred, calc.result, catalog]);

  const geometry = spec.width > 0 && spec.height > 0 ? doorGeometry(spec, frame, handle) : null;
  const canvasReady = geometry !== null && geometry.inner.right > geometry.inner.left;
  const steps = stepsFor(spec.doorType);
  const stepIdx = Math.min(step, steps.length - 1);
  const stepKey = steps[stepIdx].key;
  const hingeType = catalog.hingeTypes.find((t) => t.id === spec.hingeTypeId);
  const issuesFor = (i: number) =>
    calc.issues.filter((iss) => (steps[i].fields as readonly string[]).includes(iss.field));
  const currentIssues = issuesFor(stepIdx);

  const go = (i: number) => {
    setSelected(null);
    setStep(i);
  };

  if (showResult && calc.result) {
    return (
      <ResultView
        spec={spec}
        frame={frame}
        handle={handle}
        result={calc.result}
        qty={qty}
        catalog={catalog}
        onBack={() => setShowResult(false)}
        onNew={() => {
          setShowResult(false);
          setStep(0);
          update({ hDividers: [], vDividers: [] });
          setQty(1);
        }}
      />
    );
  }

  const isLast = stepIdx === steps.length - 1;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
      <section className="card min-w-0 p-4 lg:sticky lg:top-5 lg:self-start">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted">Pratinjau</h2>
          <span className="text-xs text-muted">{HINT[stepKey] ?? ""}</span>
        </div>
        {canvasReady ? (
          <DoorViews
            spec={spec}
            frame={frame}
            handle={handle}
            mode={
              stepKey === "divider"
                ? "divider"
                : stepKey === "gagang"
                  ? "handle"
                  : stepKey === "engsel"
                    ? "hinge"
                    : "view"
            }
            handleRanges={handleRanges}
            hingeLength={hingeType?.length}
            selected={selected}
            onSelect={setSelected}
            onChange={update}
            detail
            glass={calc.result?.glass.panels}
            screws={calc.result?.screws ?? []}
            pieces={calc.result ? piecesFromResult(calc.result) : undefined}
            highlight={hovered ?? pinned}
            onHighlight={setHovered}
            onPick={(id) => setPinned((p) => (p === id ? null : id))}
            className="mx-auto block h-[52dvh] w-full lg:h-[60dvh]"
          />
        ) : (
          <div className="flex h-[52dvh] items-center justify-center text-sm text-muted lg:h-[64dvh]">
            Isi ukuran pintu
          </div>
        )}
        <LiveSummary result={calc.result} multi={multi} qty={qty} />
      </section>

      <section className="flex min-w-0 flex-col">
        <div className="card overflow-hidden">
          <nav className="flex overflow-x-auto border-b border-line" aria-label="Langkah">
            {steps.map((s, i) => {
              const hasIssue = issuesFor(i).length > 0;
              return (
                <button
                  key={s.key}
                  onClick={() => go(i)}
                  aria-current={i === stepIdx ? "step" : undefined}
                  className={`-mb-px flex-1 border-b-2 px-2 py-3 text-sm font-medium whitespace-nowrap transition ${
                    i === stepIdx ? "border-accent text-accent" : "border-transparent text-muted hover:text-ink"
                  }`}
                >
                  <span className="mr-1 tabular-nums">{i + 1}.</span>
                  {s.title}
                  {hasIssue && <span className="ml-1 inline-block size-1.5 rounded-full bg-danger align-middle" />}
                </button>
              );
            })}
          </nav>

          <div className="p-5">
            {stepKey === "ukuran" && <SizeStep spec={spec} update={update} qty={qty} setQty={setQty} />}
            {stepKey === "frame" && <FrameStep catalog={catalog} spec={spec} update={update} />}
            {stepKey === "divider" && (
              <DividerStep
                spec={spec}
                update={update}
                selected={selected}
                setSelected={setSelected}
                catalog={catalog}
              />
            )}
            {stepKey === "gagang" && <HandleStep catalog={catalog} spec={spec} update={update} ranges={handleRanges} />}
            {stepKey === "engsel" && <HingeStep catalog={catalog} spec={spec} update={update} />}
            {stepKey === "komponen" && (
              <ComponentStep catalog={catalog} spec={spec} update={update} result={calc.result} />
            )}

            {currentIssues.length > 0 && (
              <ul className="mt-4 space-y-1 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
                {currentIssues.map((iss, i) => (
                  <li key={i}>{iss.message}</li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 -mx-4 mt-4 flex gap-2 border-t border-line bg-surface px-4 py-3 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0">
          <button className="btn" disabled={stepIdx === 0} onClick={() => go(stepIdx - 1)} aria-label="Sebelumnya">
            <ArrowLeft className="size-4" />
          </button>
          {isLast ? (
            <button
              className="btn btn-primary flex-1 py-2.5"
              disabled={!calc.result}
              onClick={() => {
                setShowResult(true);
                window.scrollTo({ top: 0 });
              }}
            >
              <Calculator className="size-4" /> Hitung kebutuhan
            </button>
          ) : (
            <button
              className="btn btn-primary flex-1 py-2.5"
              disabled={currentIssues.length > 0}
              onClick={() => go(stepIdx + 1)}
            >
              Lanjut <ArrowRight className="size-4" />
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function LiveSummary({ result, multi, qty }: { result: CalcResult | null; multi: BulkResult | null; qty: number }) {
  const stats = multi?.stats ?? result?.stats;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-line pt-3 text-sm">
      <div>
        <span className="text-muted">Kebutuhan </span>
        <span className="font-semibold tabular-nums">{stats ? `${stats.totalNewBars} batang` : "–"}</span>
        {qty > 1 && <span className="text-muted"> untuk {qty} pintu</span>}
      </div>
      {stats && (
        <div>
          <span className="text-muted">Efisiensi </span>
          <span className="font-semibold tabular-nums">{Math.round(stats.zeroWasteScore * 100)}%</span>
        </div>
      )}
      {multi && multi.separateBars > multi.stats.totalNewBars && (
        <div className="text-ok">
          Hemat {multi.separateBars - multi.stats.totalNewBars} batang dibanding satu per satu
        </div>
      )}
    </div>
  );
}

type StepProps = { spec: DoorSpec; update: (p: Partial<DoorSpec>) => void };

function NumberField({
  label,
  value,
  onChange,
  step = 10,
  isLength = true,
}: {
  label: string;
  /** Untuk panjang: nilai dalam mm. */
  value: number;
  onChange: (v: number) => void;
  /** Langkah tombol −/+ (mm untuk panjang). */
  step?: number;
  isLength?: boolean;
}) {
  const { unit, toInput, fromInput } = useUnit();
  const id = `num-${label}`;
  const shown = isLength ? toInput(value) : value;
  return (
    <div>
      <label htmlFor={id} className="label">
        {label} {isLength && <span className="font-normal text-muted">({unit})</span>}
      </label>
      <div className="flex">
        <button
          type="button"
          className="btn rounded-r-none px-3"
          aria-label={`Kurangi ${label}`}
          onClick={() => onChange(Math.max(0, value - step))}
        >
          <Minus className="size-4" />
        </button>
        <input
          id={id}
          type="number"
          inputMode={isLength && unit === "cm" ? "decimal" : "numeric"}
          step={isLength && unit === "cm" ? 0.1 : 1}
          value={Number.isFinite(shown) && shown > 0 ? shown : ""}
          onChange={(e) => onChange(isLength ? fromInput(Number(e.target.value)) : Number(e.target.value))}
          className="input -mx-px rounded-none text-center text-base font-semibold tabular-nums"
        />
        <button
          type="button"
          className="btn rounded-l-none px-3"
          aria-label={`Tambah ${label}`}
          onClick={() => onChange(value + step)}
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}

/** Isian panjang kecil (posisi divider, engsel) dalam satuan pilihan; nilai tetap mm. */
function LengthInput({ value, onChange, label }: { value: number; onChange: (mm: number) => void; label: string }) {
  const { unit, toInput, fromInput } = useUnit();
  return (
    <>
      <input
        type="number"
        inputMode={unit === "cm" ? "decimal" : "numeric"}
        step={unit === "cm" ? 0.1 : 1}
        aria-label={`${label} (${unit})`}
        value={toInput(value)}
        onChange={(e) => onChange(fromInput(Number(e.target.value)))}
        className="input w-24 text-right tabular-nums"
      />
      <span className="w-6 text-xs text-muted">{unit}</span>
    </>
  );
}

function SizeStep({ spec, update, qty, setQty }: StepProps & { qty: number; setQty: (n: number) => void }) {
  const { fmt } = useUnit();
  return (
    <div className="space-y-4">
      <div>
        <div className="label">Tipe pintu</div>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["swing", "Swing", "Buka-tutup dengan engsel"],
              ["slider", "Slider", "Digeser, tanpa engsel"],
            ] as const
          ).map(([type, title, desc]) => (
            <button
              key={type}
              type="button"
              onClick={() => update({ doorType: type })}
              aria-pressed={spec.doorType === type}
              className={`option ${spec.doorType === type ? "option-on" : "option-off"}`}
            >
              <div className="text-sm font-semibold">{title}</div>
              <div className="text-xs text-muted">{desc}</div>
            </button>
          ))}
        </div>
      </div>
      <div className="max-w-56">
        <NumberField
          label="Jumlah pintu (model sama)"
          value={qty}
          step={1}
          isLength={false}
          onChange={(n) => setQty(Math.min(Math.max(Math.round(n) || 1, 1), 50))}
        />
      </div>
      <p className="text-sm text-muted">Ukuran luar pintu, termasuk frame.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <NumberField label="Lebar" value={spec.width} onChange={(width) => update({ width })} />
        <NumberField label="Tinggi" value={spec.height} onChange={(height) => update({ height })} />
      </div>
      <div>
        <div className="mb-1.5 text-xs font-medium text-muted">Ukuran umum</div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(([w, h]) => {
            const on = spec.width === w && spec.height === h;
            return (
              <button
                key={`${w}x${h}`}
                type="button"
                onClick={() => update({ width: w, height: h })}
                className={`rounded-md border px-2.5 py-1 text-sm tabular-nums transition ${
                  on ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:text-ink"
                }`}
              >
                {fmt(w)} × {fmt(h)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function OptionCard({
  active,
  onClick,
  color,
  title,
  subtitle,
  children,
}: {
  active: boolean;
  onClick: () => void;
  color: string;
  title: string;
  subtitle: string;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`option ${active ? "option-on" : "option-off"}`}
    >
      <div className="flex items-center gap-3">
        <span className="h-8 w-2.5 shrink-0 rounded-sm ring-1 ring-black/15" style={{ background: color }} />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{title}</div>
          <div className="text-xs text-muted">{subtitle}</div>
        </div>
      </div>
      {children}
    </button>
  );
}

function FrameStep({ catalog, spec, update }: StepProps & { catalog: CalcCatalog }) {
  const { len } = useUnit();
  return (
    <div className="grid gap-2">
      {catalog.frames.map((f) => (
        <OptionCard
          key={f.id}
          active={spec.frameProfileId === f.id}
          onClick={() => update({ frameProfileId: f.id })}
          color={f.color}
          title={f.name}
          subtitle={`Batang ${len(f.barLength)} · tebal ${len(f.faceWidth)}`}
        />
      ))}
    </div>
  );
}

function DividerStep({
  catalog,
  spec,
  update,
  selected,
  setSelected,
}: StepProps & {
  catalog: CalcCatalog;
  selected: DividerRef | null;
  setSelected: (r: DividerRef | null) => void;
}) {
  const frame = catalog.frames.find((f) => f.id === spec.frameProfileId)!;
  const handle = catalog.handles.find((h) => h.id === spec.handleProfileId)!;
  const g = doorGeometry(spec, frame, handle);

  const add = (axis: "h" | "v") => {
    if (axis === "h") {
      update({ hDividers: [...spec.hDividers, largestGapCenter(spec.hDividers, g.inner.bottom, g.inner.top)] });
      setSelected({ axis, index: spec.hDividers.length });
    } else {
      update({ vDividers: [...spec.vDividers, largestGapCenter(spec.vDividers, g.inner.left, g.inner.right)] });
      setSelected({ axis, index: spec.vDividers.length });
    }
  };

  const remove = (ref: DividerRef) => {
    const key = ref.axis === "h" ? "hDividers" : "vDividers";
    update({ [key]: spec[key].filter((_, i) => i !== ref.index) });
    setSelected(null);
  };

  const all: (DividerRef & { pos: number })[] = [
    ...spec.hDividers.map((pos, index) => ({ axis: "h" as const, index, pos })),
    ...spec.vDividers.map((pos, index) => ({ axis: "v" as const, index, pos })),
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Opsional. Posisi diukur ke titik tengah divider.</p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn" onClick={() => add("h")}>
          <Rows2 className="size-4" /> Tambah horizontal
        </button>
        <button type="button" className="btn" onClick={() => add("v")}>
          <Columns2 className="size-4" /> Tambah vertikal
        </button>
      </div>

      {all.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line p-4 text-center text-sm text-muted">Tanpa divider</p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {all.map((d) => {
            const active = selected?.axis === d.axis && selected.index === d.index;
            const key = d.axis === "h" ? "hDividers" : "vDividers";
            return (
              <li
                key={`${d.axis}${d.index}`}
                className={`flex items-center gap-2 p-2 pl-3 ${active ? "bg-accent-soft" : ""}`}
              >
                <button type="button" onClick={() => setSelected(d)} className="flex-1 text-left text-sm">
                  <span className="font-medium">
                    {d.axis === "h" ? "Horizontal" : "Vertikal"} {d.index + 1}
                  </span>
                  <span className="block text-xs text-muted">{d.axis === "h" ? "dari bawah" : "dari kiri"}</span>
                </button>
                <LengthInput
                  label="Posisi divider"
                  value={d.pos}
                  onChange={(mm) => update({ [key]: spec[key].map((p, i) => (i === d.index ? mm : p)) })}
                />
                <button
                  type="button"
                  onClick={() => remove(d)}
                  aria-label="Hapus divider"
                  className="btn btn-danger px-2"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function HandleStep({ catalog, spec, update, ranges }: StepProps & { catalog: CalcCatalog; ranges: Segment[] }) {
  const { len } = useUnit();
  const min = ranges.length ? ranges[0].start : 0;
  const max = ranges.length ? ranges[ranges.length - 1].start + ranges[ranges.length - 1].length : 0;
  const setHeight = (v: number) => {
    const c = clampToRanges(v, ranges);
    if (c !== null) update({ handleHeight: c });
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-2">
        {catalog.handles.map((h) => (
          <OptionCard
            key={h.id}
            active={spec.handleProfileId === h.id}
            onClick={() => update({ handleProfileId: h.id })}
            color={h.color}
            title={h.name}
            subtitle={`${h.zones.length} gagang per batang ${len(h.barLength)} · tebal ${len(h.faceWidth)}`}
          >
            <svg viewBox="0 0 1000 14" className="mt-2 w-full" aria-hidden>
              <rect x="0" y="4" width="1000" height="6" rx="2" fill={h.color} stroke="#0002" />
              {h.zones.map((z, i) => (
                <rect
                  key={i}
                  x={(z.start / h.barLength) * 1000}
                  y="0"
                  width={Math.max((z.length / h.barLength) * 1000, 6)}
                  height="14"
                  rx="3"
                  fill="#d97706"
                />
              ))}
            </svg>
          </OptionCard>
        ))}
      </div>

      <div>
        <div className="label">Sisi gagang</div>
        <div className="inline-flex rounded-lg border border-line p-0.5">
          {(spec.doorType === "slider" ? (["left", "right", "both"] as const) : (["left", "right"] as const)).map(
            (side) => (
              <button
                key={side}
                type="button"
                onClick={() => update({ handleSide: side })}
                aria-pressed={spec.handleSide === side}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
                  spec.handleSide === side ? "bg-accent text-accent-ink" : "text-muted hover:text-ink"
                }`}
              >
                {side === "left" ? "Kiri" : side === "right" ? "Kanan" : "Keduanya"}
              </button>
            ),
          )}
        </div>
      </div>

      {ranges.length === 0 ? (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          Batang gagang ini tidak bisa dipakai untuk pintu setinggi {len(spec.height)}. Pilih jenis gagang lain.
        </p>
      ) : (
        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <label htmlFor="handle-height" className="label mb-0">
              Ujung bawah gagang dari lantai
            </label>
            <span className="text-sm font-semibold tabular-nums">{len(spec.handleHeight)}</span>
          </div>
          <input
            id="handle-height"
            type="range"
            min={min}
            max={max}
            step={5}
            value={spec.handleHeight}
            onChange={(e) => setHeight(Number(e.target.value))}
            className="w-full accent-[var(--accent)]"
          />
          <div className="flex justify-between text-xs text-muted tabular-nums">
            <span>{len(min)}</span>
            <span>{len(max)}</span>
          </div>
          <p className="hint">Area hijau pada gambar = daerah yang bisa ditempati gagang dari batang ini.</p>
        </div>
      )}
    </div>
  );
}

function HingeStep({ catalog, spec, update }: StepProps & { catalog: CalcCatalog }) {
  const { len } = useUnit();
  const type = catalog.hingeTypes.find((t) => t.id === spec.hingeTypeId);
  const side = hingeSide(spec);
  const length = type?.length ?? 0;
  const setCount = (n: number) =>
    update({ hinges: distributeHinges(Math.min(Math.max(n, 1), 8), spec.height, length) });

  if (!catalog.hingeTypes.length) {
    return (
      <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
        Belum ada jenis engsel. Minta admin menambahkan di menu Engsel.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-2">
        {catalog.hingeTypes.map((t) => (
          <OptionCard
            key={t.id}
            active={spec.hingeTypeId === t.id}
            onClick={() => update({ hingeTypeId: t.id })}
            color="#4b5563"
            title={t.name}
            subtitle={`Tinggi engsel ${len(t.length)}`}
          />
        ))}
      </div>

      <p className="text-sm text-muted">
        Engsel dipasang di sisi <span className="font-medium text-ink">{side === "left" ? "kiri" : "kanan"}</span>{" "}
        (seberang gagang).
      </p>

      <div className="flex items-end gap-3">
        <div className="w-40">
          <NumberField label="Jumlah engsel" value={spec.hinges.length} step={1} onChange={setCount} isLength={false} />
        </div>
        <button type="button" className="btn" onClick={() => setCount(spec.hinges.length)}>
          <RotateCcw className="size-4" /> Bagi rata
        </button>
      </div>

      <ul className="divide-y divide-line rounded-lg border border-line">
        {spec.hinges.map((h, i) => (
          <li key={i} className="flex items-center gap-2 p-2 pl-3">
            <span className="flex-1 text-sm">
              <span className="font-medium">Engsel {i + 1}</span>
              <span className="block text-xs text-muted">
                ujung bawah dari lantai · ujung atas {len(hingeBottom(h, length) + length)}
              </span>
            </span>
            <LengthInput
              label={`Ujung bawah engsel ${i + 1} dari lantai`}
              value={hingeBottom(h, length)}
              onChange={(mm) => update({ hinges: spec.hinges.map((p, j) => (j === i ? mm + length / 2 : p)) })}
            />
          </li>
        ))}
      </ul>
      {type && (
        <p className="hint">
          Posisi awal dibagi rata: ujung engsel {len(200)} dari bawah dan dari atas. Geser engsel di gambar bila perlu.
        </p>
      )}
    </div>
  );
}

const COMPONENT_FIELDS: {
  kind: ComponentKind;
  category: MaterialCategory;
  field: "sealMaterialId" | "cornerMaterialId" | "pinMaterialId";
  title: string;
  hint: string;
}[] = [
  { kind: "seal", category: "seal", field: "sealMaterialId", title: "Seal", hint: "Dihitung dari keliling kaca." },
  {
    kind: "corner",
    category: "corner",
    field: "cornerMaterialId",
    title: "Corner connector",
    hint: "Dipasang di 4 sudut frame.",
  },
  {
    kind: "pin",
    category: "pin",
    field: "pinMaterialId",
    title: "Pin ambalan",
    hint: "Dipasang di tiap ujung divider. Tanpa divider = 0.",
  },
];

function ComponentStep({
  catalog,
  spec,
  update,
  result,
}: StepProps & { catalog: CalcCatalog; result: CalcResult | null }) {
  return (
    <div className="space-y-6">
      {COMPONENT_FIELDS.map(({ kind, category, field, title, hint }) => {
        const options = catalog.materials.filter((m) => m.category === category);
        const value = spec[field] ?? null;
        const line = result?.components?.find((c) => c.kind === kind);
        return (
          <div key={kind}>
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <div className="label mb-0">{title}</div>
              {line && (
                <span className="text-sm font-semibold tabular-nums">
                  {qtyText(line.qty)} {line.unit}
                </span>
              )}
            </div>
            <p className="mb-2 text-xs text-muted">{line ? line.detail : hint}</p>
            {options.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line p-3 text-sm text-muted">
                Belum ada material kategori {title.toLowerCase()}. Minta admin menambahkan di menu Material.
              </p>
            ) : (
              <div className="grid gap-2">
                {options.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => update({ [field]: m.id })}
                    aria-pressed={value === m.id}
                    className={`option ${value === m.id ? "option-on" : "option-off"}`}
                  >
                    <div className="text-sm font-semibold">{m.name}</div>
                    <div className="text-xs text-muted">
                      {m.code && `${m.code} · `}
                      {rupiah(m.price)}/{m.unit} · min. beli {qtyText(m.minPurchase)} {m.unit}
                    </div>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => update({ [field]: null })}
                  aria-pressed={value === null}
                  className={`option ${value === null ? "option-on" : "option-off"}`}
                >
                  <div className="text-sm font-semibold">Tanpa {title.toLowerCase()}</div>
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
