"use client";

import { useActionState } from "react";
import { FieldError, FormAlert } from "@/components/admin-ui";
import { saveSettings, type FormState } from "../actions";

type Values = { defaultBarLength: number; kerf: number; endTrim: number; minUsableOffcut: number; glassInset: number };

const fields: { name: keyof Values; label: string; hint: string; step?: string }[] = [
  {
    name: "defaultBarLength",
    label: "Panjang batang default (mm)",
    hint: "Dipakai untuk semua jenis batang yang tidak punya panjang sendiri.",
  },
  {
    name: "kerf",
    label: "Tebal mata gergaji / kerf (mm)",
    hint: "Material yang hilang di setiap potongan. Potongan 45° otomatis dihitung ×1,41.",
    step: "0.1",
  },
  {
    name: "endTrim",
    label: "Buang ujung batang (mm)",
    hint: "Ujung pabrik yang dipotong dulu supaya rata. Isi 0 jika tidak perlu.",
  },
  {
    name: "minUsableOffcut",
    label: "Sisa minimum yang masih berguna (mm)",
    hint: "Sisa lebih pendek dari ini dihitung sebagai buangan (waste).",
  },
  {
    name: "glassInset",
    label: "Kaca masuk alur per sisi (mm)",
    hint: "Ukuran kaca = bukaan + 2 × nilai ini. Isi minus jika kaca harus lebih kecil dari bukaan.",
    step: "0.5",
  },
];

export function SettingsForm({ initial }: { initial: Values }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveSettings, undefined);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="card max-w-xl space-y-5 p-5">
      {fields.map((f) => (
        <div key={f.name}>
          <label className="label" htmlFor={f.name}>
            {f.label}
          </label>
          <input
            id={f.name}
            name={f.name}
            type="number"
            step={f.step ?? "1"}
            inputMode="decimal"
            defaultValue={initial[f.name]}
            className="input max-w-48"
            required
          />
          <p className="hint">{f.hint}</p>
          <FieldError message={fe[f.name]} />
        </div>
      ))}
      <FormAlert state={state} />
      <button className="btn btn-primary" disabled={pending}>
        {pending ? "Menyimpan…" : "Simpan pengaturan"}
      </button>
    </form>
  );
}
