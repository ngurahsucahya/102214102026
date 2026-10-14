"use client";

import { useActionState, useEffect, useRef } from "react";
import { FieldError, FormAlert } from "@/components/admin-ui";
import { DeleteButton } from "@/components/delete-button";
import { deleteHingeType, saveHingeType, type FormState } from "../actions";

type Values = { id: number | null; name: string; length: number; active: boolean };

export function HingeTypeForm({ initial }: { initial: Values }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveHingeType.bind(null, initial.id), undefined);
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
        {isNew && <h2 className="text-lg font-semibold">Tambah engsel</h2>}
        {!isNew && <DeleteButton action={deleteHingeType.bind(null, initial.id!)} name={initial.name} />}
      </div>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
        <div>
          <label className="label" htmlFor={`name-${key}`}>
            Nama engsel
          </label>
          <input
            id={`name-${key}`}
            name="name"
            defaultValue={initial.name}
            placeholder='mis. Engsel 4" Stainless'
            className="input"
            required
          />
          <FieldError message={fe.name} />
        </div>
        <div>
          <label className="label" htmlFor={`length-${key}`}>
            Tinggi engsel (mm)
          </label>
          <input
            id={`length-${key}`}
            name="length"
            type="number"
            min={20}
            defaultValue={initial.length}
            className="input text-right"
            required
          />
          <FieldError message={fe.length} />
        </div>
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
      <FormAlert state={state} />
      <button className="btn btn-primary" disabled={pending}>
        {pending ? "Menyimpan…" : isNew ? "Tambah" : "Simpan"}
      </button>
    </form>
  );
}
