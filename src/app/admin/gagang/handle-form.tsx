"use client";

import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { FieldError, FormAlert, ScrewGroupSelect, type GroupOption } from "@/components/admin-ui";
import type { HandleZone } from "@/lib/engine/types";
import { saveHandle, type FormState } from "../actions";

export type HandleFormValues = {
  id: number | null;
  name: string;
  code: string | null;
  color: string;
  barLength: number | null;
  faceWidth: number;
  screwGroupId: number | null;
  zones: HandleZone[];
  remainderFrameProfileId: number | null;
  active: boolean;
};

type FrameOption = { id: number; name: string; color: string };

const round = (v: number) => Math.round(v);

export function HandleForm({
  initial,
  defaultBarLength,
  frames,
  screwGroups,
}: {
  initial: HandleFormValues;
  defaultBarLength: number;
  frames: FrameOption[];
  screwGroups: GroupOption[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveHandle.bind(null, initial.id), undefined);
  const [color, setColor] = useState(initial.color);
  const [barInput, setBarInput] = useState(initial.barLength?.toString() ?? "");
  const [zones, setZones] = useState<HandleZone[]>(initial.zones);
  const [count, setCount] = useState(Math.max(1, initial.zones.length));
  const [zoneLength, setZoneLength] = useState(initial.zones[0]?.length ?? 200);
  const fe = state?.fieldErrors ?? {};

  const barLength = Number(barInput) > 0 ? Number(barInput) : defaultBarLength;

  const distribute = () => {
    const n = Math.max(1, count);
    setZones(
      Array.from({ length: n }, (_, i) => ({
        start: round((barLength * (i + 0.5)) / n - zoneLength / 2),
        length: zoneLength,
      })),
    );
  };

  const updateZone = (i: number, patch: Partial<HandleZone>) =>
    setZones((zs) => zs.map((z, j) => (j === i ? { ...z, ...patch } : z)));

  return (
    <form action={action} className="grid max-w-5xl gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="card space-y-5 p-5">
        <div>
          <label className="label" htmlFor="name">
            Nama
          </label>
          <input id="name" name="name" defaultValue={initial.name} className="input" required />
          <FieldError message={fe.name} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="code">
              Kode (opsional)
            </label>
            <input id="code" name="code" defaultValue={initial.code ?? ""} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="color">
              Warna
            </label>
            <div className="flex gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded-lg border border-line bg-surface p-1"
                aria-label="Pilih warna"
              />
              <input
                id="color"
                name="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="input font-mono"
              />
            </div>
            <FieldError message={fe.color} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="barLength">
              Panjang per batang (mm)
            </label>
            <input
              id="barLength"
              name="barLength"
              type="number"
              inputMode="numeric"
              value={barInput}
              onChange={(e) => setBarInput(e.target.value)}
              placeholder={`Default ${defaultBarLength}`}
              className="input"
            />
            <FieldError message={fe.barLength} />
          </div>
          <div>
            <label className="label" htmlFor="faceWidth">
              Tebal gagang (mm)
            </label>
            <input
              id="faceWidth"
              name="faceWidth"
              type="number"
              inputMode="numeric"
              defaultValue={initial.faceWidth}
              className="input"
              required
            />
            <p className="hint">Lebar dilihat dari depan, mengurangi ukuran kaca.</p>
            <FieldError message={fe.faceWidth} />
          </div>
        </div>
        <ScrewGroupSelect groups={screwGroups} value={initial.screwGroupId} />
        <div>
          <label className="label" htmlFor="remainderFrameProfileId">
            Sisa batang bisa dipakai jadi frame
          </label>
          <select
            id="remainderFrameProfileId"
            name="remainderFrameProfileId"
            defaultValue={initial.remainderFrameProfileId ?? ""}
            className="input"
          >
            <option value="">Tidak bisa dipakai</option>
            {frames.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <p className="hint">Bagian batang tanpa gagang akan dipakai dulu untuk frame jenis ini.</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="active"
            defaultChecked={initial.active}
            className="size-4 accent-[var(--accent)]"
          />
          Aktif (bisa dipilih tim lapangan)
        </label>
      </div>

      <div className="card space-y-5 p-5">
        <div>
          <h2 className="text-lg font-semibold">Posisi gagang di batang</h2>
          <p className="text-sm text-muted">
            Satu batang bisa punya beberapa titik gagang. Geser blok gagang di gambar, atau isi angkanya.
          </p>
        </div>

        <BarPreview barLength={barLength} color={color} zones={zones} onChange={setZones} />

        <div className="flex flex-wrap items-end gap-3 rounded-lg bg-paper p-3">
          <div className="w-28">
            <label className="label text-xs" htmlFor="count">
              Jumlah gagang
            </label>
            <input
              id="count"
              type="number"
              min={1}
              max={10}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="input"
            />
          </div>
          <div className="w-32">
            <label className="label text-xs" htmlFor="zoneLength">
              Panjang gagang
            </label>
            <input
              id="zoneLength"
              type="number"
              min={10}
              value={zoneLength}
              onChange={(e) => setZoneLength(Number(e.target.value))}
              className="input"
            />
          </div>
          <button type="button" className="btn" onClick={distribute}>
            Bagi rata
          </button>
        </div>

        <div className="space-y-2">
          {zones.map((z, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-sm font-medium">Gagang {i + 1}</span>
              <label className="sr-only" htmlFor={`zs${i}`}>
                Mulai
              </label>
              <input
                id={`zs${i}`}
                type="number"
                value={z.start}
                onChange={(e) => updateZone(i, { start: Number(e.target.value) })}
                className="input"
              />
              <span className="text-xs text-muted">mulai</span>
              <label className="sr-only" htmlFor={`zl${i}`}>
                Panjang
              </label>
              <input
                id={`zl${i}`}
                type="number"
                value={z.length}
                onChange={(e) => updateZone(i, { length: Number(e.target.value) })}
                className="input"
              />
              <span className="text-xs text-muted">mm</span>
              <button
                type="button"
                aria-label={`Hapus gagang ${i + 1}`}
                className="btn btn-danger px-2"
                onClick={() => setZones((zs) => zs.filter((_, j) => j !== i))}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn"
            onClick={() =>
              setZones((zs) => [...zs, { start: round(barLength / 2 - zoneLength / 2), length: zoneLength }])
            }
          >
            <Plus className="size-4" /> Tambah titik gagang
          </button>
          <FieldError message={fe.zones} />
        </div>

        <input type="hidden" name="zones" value={JSON.stringify(zones)} />
        <FormAlert state={state} />
        <div className="flex gap-2">
          <button className="btn btn-primary" disabled={pending}>
            {pending ? "Menyimpan…" : "Simpan"}
          </button>
          <Link href="/admin/gagang" className="btn">
            Batal
          </Link>
        </div>
      </div>
    </form>
  );
}

function BarPreview({
  barLength,
  color,
  zones,
  onChange,
}: {
  barLength: number;
  color: string;
  zones: HandleZone[];
  onChange: (zones: HandleZone[]) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ index: number; offset: number } | null>(null);
  const W = 1000;
  const scale = W / barLength;

  const toMm = (clientX: number) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return ((clientX - rect.left) / rect.width) * barLength;
  };

  return (
    <div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} 90`}
        className="w-full touch-none select-none"
        onPointerMove={(e) => {
          if (!drag.current) return;
          const { index, offset } = drag.current;
          const z = zones[index];
          const start = Math.min(Math.max(0, round(toMm(e.clientX) - offset)), barLength - z.length);
          onChange(zones.map((zz, j) => (j === index ? { ...zz, start } : zz)));
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerLeave={() => (drag.current = null)}
      >
        <rect x="0" y="30" width={W} height="30" rx="4" fill={color} stroke="#0002" />
        {zones.map((z, i) => (
          <g
            key={i}
            className="cursor-grab active:cursor-grabbing"
            onPointerDown={(e) => {
              (e.target as Element).setPointerCapture?.(e.pointerId);
              drag.current = { index: i, offset: toMm(e.clientX) - z.start };
            }}
          >
            <rect x={z.start * scale} y="22" width={Math.max(z.length * scale, 6)} height="46" rx="6" fill="#d97706" />
            <rect x={(z.start + z.length / 2) * scale - 1} y="28" width="2" height="34" fill="#fff" opacity="0.8" />
            <text
              x={(z.start + z.length / 2) * scale}
              y="14"
              textAnchor="middle"
              fontSize="13"
              fontWeight="600"
              fill="#1c1d21"
            >
              G{i + 1} · {round(z.start + z.length / 2)}
            </text>
          </g>
        ))}
        <text x="0" y="84" fontSize="12" fill="#6b6f78">
          0
        </text>
        <text x={W} y="84" fontSize="12" fill="#6b6f78" textAnchor="end">
          {barLength} mm
        </text>
      </svg>
      <p className="hint">Angka di atas blok = titik tengah gagang dari ujung kiri batang.</p>
    </div>
  );
}
