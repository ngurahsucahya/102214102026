"use client";

import { ArrowLeft, ArrowRight, Calculator, Columns2, Minus, Plus, Rows2, Trash2 } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import type { CalcCatalog } from "@/lib/data";
import { calculate, CalcError, clampToRanges, doorGeometry, feasibleHandleRanges } from "@/lib/engine";
import type { CalcResult, DoorSpec, Segment, ValidationIssue } from "@/lib/engine/types";
import { DoorCanvas, type DividerRef } from "./door-canvas";
import { ResultView } from "./result-view";

const STEPS = [
  { key: "ukuran", title: "Ukuran" },
  { key: "frame", title: "Frame" },
  { key: "divider", title: "Divider" },
  { key: "gagang", title: "Gagang" },
] as const;

const STEP_FIELDS = [
  ["width", "height"],
  ["frameProfileId"],
  ["hDividers", "vDividers"],
  ["handleHeight", "handleProfileId"],
];

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
  const [spec, setSpec] = useState<DoorSpec>(() => {
    const base: DoorSpec = {
      width: 900,
      height: 2100,
      // Utamakan frame yang cocok dengan sisa batang gagang, supaya sisanya terpakai.
      frameProfileId:
        catalog.frames.find((f) => f.id === catalog.handles[0].remainderFrameProfileId)?.id ?? catalog.frames[0].id,
      handleProfileId: catalog.handles[0].id,
      handleSide: "right",
      handleHeight: 1000,
      hDividers: [],
      vDividers: [],
    };
    return { ...base, handleHeight: clampToRanges(1000, rangesFor(catalog, base)) ?? 1000 };
  });

  const update = (patch: Partial<DoorSpec>) => {
    setSpec((prev) => {
      const next = { ...prev, ...patch };
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
      return { result: calculate(deferred, catalog.frames, catalog.handles, catalog.settings), issues: [] };
    } catch (e) {
      if (e instanceof CalcError) return { result: null, issues: e.issues };
      return { result: null, issues: [{ field: "", message: (e as Error).message }] };
    }
  }, [deferred, catalog]);

  const geometry = spec.width > 0 && spec.height > 0 ? doorGeometry(spec, frame, handle) : null;
  const canvasReady = geometry !== null && geometry.inner.right > geometry.inner.left;
  const issuesFor = (i: number) => calc.issues.filter((iss) => STEP_FIELDS[i].includes(iss.field));
  const currentIssues = issuesFor(step);

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
        onBack={() => setShowResult(false)}
        onNew={() => {
          setShowResult(false);
          setStep(0);
          update({ hDividers: [], vDividers: [] });
        }}
      />
    );
  }

  const isLast = step === STEPS.length - 1;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
      <section className="card p-4 lg:sticky lg:top-5 lg:self-start">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted">Pratinjau</h2>
          <span className="text-xs text-muted">
            {step === 2 ? "Geser divider pada gambar" : step === 3 ? "Geser gagang pada gambar" : ""}
          </span>
        </div>
        {canvasReady ? (
          <DoorCanvas
            spec={spec}
            frame={frame}
            handle={handle}
            mode={step === 2 ? "divider" : step === 3 ? "handle" : "view"}
            handleRanges={handleRanges}
            selected={selected}
            onSelect={setSelected}
            onChange={update}
            className="mx-auto block h-[36dvh] w-full lg:h-[60dvh]"
          />
        ) : (
          <div className="flex h-[36dvh] items-center justify-center text-sm text-muted lg:h-[60dvh]">
            Isi ukuran pintu
          </div>
        )}
        <LiveSummary result={calc.result} />
      </section>

      <section className="flex flex-col">
        <div className="card overflow-hidden">
          <nav className="flex overflow-x-auto border-b border-line" aria-label="Langkah">
            {STEPS.map((s, i) => {
              const hasIssue = issuesFor(i).length > 0;
              return (
                <button
                  key={s.key}
                  onClick={() => go(i)}
                  aria-current={i === step ? "step" : undefined}
                  className={`-mb-px flex-1 border-b-2 px-3 py-3 text-sm font-medium whitespace-nowrap transition ${
                    i === step ? "border-accent text-accent" : "border-transparent text-muted hover:text-ink"
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
            {step === 0 && <SizeStep spec={spec} update={update} />}
            {step === 1 && <FrameStep catalog={catalog} spec={spec} update={update} />}
            {step === 2 && (
              <DividerStep
                spec={spec}
                update={update}
                selected={selected}
                setSelected={setSelected}
                catalog={catalog}
              />
            )}
            {step === 3 && <HandleStep catalog={catalog} spec={spec} update={update} ranges={handleRanges} />}

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
          <button className="btn" disabled={step === 0} onClick={() => go(step - 1)} aria-label="Sebelumnya">
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
              onClick={() => go(step + 1)}
            >
              Lanjut <ArrowRight className="size-4" />
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function LiveSummary({ result }: { result: CalcResult | null }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-line pt-3 text-sm">
      <div>
        <span className="text-muted">Kebutuhan </span>
        <span className="font-semibold tabular-nums">{result ? `${result.stats.totalNewBars} batang` : "–"}</span>
      </div>
      {result && (
        <div>
          <span className="text-muted">Efisiensi </span>
          <span className="font-semibold tabular-nums">{Math.round(result.stats.zeroWasteScore * 100)}%</span>
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
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  const id = `num-${label}`;
  return (
    <div>
      <label htmlFor={id} className="label">
        {label} <span className="font-normal text-muted">(mm)</span>
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
          inputMode="numeric"
          value={Number.isFinite(value) && value > 0 ? value : ""}
          onChange={(e) => onChange(Number(e.target.value))}
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

function SizeStep({ spec, update }: StepProps) {
  return (
    <div className="space-y-4">
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
                {w} × {h}
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
  return (
    <div className="grid gap-2">
      {catalog.frames.map((f) => (
        <OptionCard
          key={f.id}
          active={spec.frameProfileId === f.id}
          onClick={() => update({ frameProfileId: f.id })}
          color={f.color}
          title={f.name}
          subtitle={`Batang ${f.barLength} mm · tebal ${f.faceWidth} mm`}
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
                <input
                  type="number"
                  inputMode="numeric"
                  aria-label="Posisi divider (mm)"
                  value={d.pos}
                  onChange={(e) =>
                    update({ [key]: spec[key].map((p, i) => (i === d.index ? Number(e.target.value) : p)) })
                  }
                  className="input w-24 text-right tabular-nums"
                />
                <span className="text-xs text-muted">mm</span>
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
            subtitle={`${h.zones.length} gagang per batang ${h.barLength} mm · tebal ${h.faceWidth} mm`}
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
          {(["left", "right"] as const).map((side) => (
            <button
              key={side}
              type="button"
              onClick={() => update({ handleSide: side })}
              aria-pressed={spec.handleSide === side}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
                spec.handleSide === side ? "bg-accent text-accent-ink" : "text-muted hover:text-ink"
              }`}
            >
              {side === "left" ? "Kiri" : "Kanan"}
            </button>
          ))}
        </div>
      </div>

      {ranges.length === 0 ? (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          Batang gagang ini tidak bisa dipakai untuk pintu setinggi {spec.height} mm. Pilih jenis gagang lain.
        </p>
      ) : (
        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <label htmlFor="handle-height" className="label mb-0">
              Tinggi gagang dari bawah
            </label>
            <span className="text-sm font-semibold tabular-nums">{spec.handleHeight} mm</span>
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
            <span>{min} mm</span>
            <span>{max} mm</span>
          </div>
          <p className="hint">Area hijau pada gambar menunjukkan tinggi yang bisa dibuat dari batang ini.</p>
        </div>
      )}
    </div>
  );
}
