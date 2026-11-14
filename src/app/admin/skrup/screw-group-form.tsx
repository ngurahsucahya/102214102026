"use client";

import { useActionState, useEffect, useRef } from "react";
import { FieldError, FormAlert } from "@/components/admin-ui";
import { DeleteButton } from "@/components/delete-button";
import { deleteScrewGroup, saveScrewGroup, type FormState } from "../actions";

type Values = {
  id: number | null;
  name: string;
  cornerType: string;
  cornerQty: number;
  jointType: string;
  jointQty: number;
};

export function ScrewGroupForm({ initial, usedBy }: { initial: Values; usedBy: string[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    saveScrewGroup.bind(null, initial.id),
    undefined,
  );
  const ref = useRef<HTMLFormElement>(null);
  const fe = state?.fieldErrors ?? {};
  const isNew = initial.id === null;
  const key = initial.id ?? "baru";

  useEffect(() => {
    if (isNew && state?.ok) ref.current?.reset();
  }, [isNew, state]);

  return (
    <form ref={ref} action={action} className="card space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        {isNew ? (
          <h2 className="text-lg font-semibold">Tambah kelompok</h2>
        ) : (
          <p className="text-xs text-muted">
            {usedBy.length ? `Dipakai: ${usedBy.join(", ")}` : "Belum dipakai batang mana pun"}
          </p>
        )}
        {!isNew && <DeleteButton action={deleteScrewGroup.bind(null, initial.id!)} name={initial.name} />}
      </div>

      <div>
        <label className="label" htmlFor={`name-${key}`}>
          Nama kelompok
        </label>
        <input
          id={`name-${key}`}
          name="name"
          defaultValue={initial.name}
          placeholder="mis. Kelompok 1"
          className="input"
          required
        />
        <FieldError message={fe.name} />
      </div>

      <fieldset className="grid grid-cols-[minmax(0,1fr)_6rem] gap-3">
        <legend className="label">Per sudut frame</legend>
        <div>
          <input
            name="cornerType"
            aria-label="Jenis skrup sudut"
            defaultValue={initial.cornerType}
            list="screw-materials"
            placeholder='Jenis, mis. Skrup 8 × 1"'
            className="input"
          />
          <FieldError message={fe.cornerType} />
        </div>
        <div>
          <input
            name="cornerQty"
            type="number"
            min={0}
            aria-label="Jumlah skrup per sudut"
            defaultValue={initial.cornerQty}
            className="input text-right"
          />
          <FieldError message={fe.cornerQty} />
        </div>
      </fieldset>

      <fieldset className="grid grid-cols-[minmax(0,1fr)_6rem] gap-3">
        <legend className="label">Per ujung divider</legend>
        <div>
          <input
            name="jointType"
            aria-label="Jenis skrup divider"
            defaultValue={initial.jointType}
            list="screw-materials"
            placeholder='Jenis, mis. Skrup 8 × 3/4"'
            className="input"
          />
          <FieldError message={fe.jointType} />
        </div>
        <div>
          <input
            name="jointQty"
            type="number"
            min={0}
            aria-label="Jumlah skrup per ujung divider"
            defaultValue={initial.jointQty}
            className="input text-right"
          />
          <FieldError message={fe.jointQty} />
        </div>
      </fieldset>
      <p className="hint -mt-2">Jumlah = skrup untuk satu sambungan. Isi 0 jika tidak dipakai.</p>

      <FormAlert state={state} />
      <button className="btn btn-primary" disabled={pending}>
        {pending ? "Menyimpan…" : isNew ? "Tambah" : "Simpan"}
      </button>
    </form>
  );
}
