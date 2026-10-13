"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { FieldError, FormAlert, ScrewGroupSelect, type GroupOption } from "@/components/admin-ui";
import { saveFrame, type FormState } from "../actions";

export type FrameFormValues = {
  id: number | null;
  name: string;
  code: string | null;
  color: string;
  barLength: number | null;
  faceWidth: number;
  screwGroupId: number | null;
  active: boolean;
};

export function FrameForm({
  initial,
  defaultBarLength,
  screwGroups,
}: {
  initial: FrameFormValues;
  defaultBarLength: number;
  screwGroups: GroupOption[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveFrame.bind(null, initial.id), undefined);
  const [color, setColor] = useState(initial.color);
  const fe = state?.fieldErrors ?? {};

  return (
    <form action={action} className="card max-w-xl space-y-5 p-5">
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
            defaultValue={initial.barLength ?? ""}
            placeholder={`Default ${defaultBarLength}`}
            className="input"
          />
          <p className="hint">Kosongkan untuk ikut panjang default.</p>
          <FieldError message={fe.barLength} />
        </div>
        <div>
          <label className="label" htmlFor="faceWidth">
            Tebal frame (mm)
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
          <p className="hint">Lebar batang dilihat dari depan. Mengurangi ukuran kaca dan panjang divider.</p>
          <FieldError message={fe.faceWidth} />
        </div>
      </div>

      <ScrewGroupSelect groups={screwGroups} value={initial.screwGroupId} />

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="active"
          defaultChecked={initial.active}
          className="size-4 accent-[var(--accent)]"
        />
        Aktif (bisa dipilih tim lapangan)
      </label>

      <FormAlert state={state} />
      <div className="flex gap-2">
        <button className="btn btn-primary" disabled={pending}>
          {pending ? "Menyimpan…" : "Simpan"}
        </button>
        <Link href="/admin/frame" className="btn">
          Batal
        </Link>
      </div>
    </form>
  );
}
