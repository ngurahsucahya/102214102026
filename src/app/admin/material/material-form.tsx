"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { FieldError, FormAlert } from "@/components/admin-ui";
import { MATERIAL_CATEGORIES, type MaterialCategory } from "@/lib/engine/types";
import { saveMaterial, type FormState } from "../actions";

export type MaterialFormValues = {
  id: number | null;
  name: string;
  sku: string | null;
  code: string | null;
  category: MaterialCategory;
  unit: string;
  minPurchase: number;
  price: number;
  usagePerPoint: number;
  glassDeduction: number;
  intersectionCutback: number;
  note: string | null;
  active: boolean;
};

const PER_POINT: Partial<Record<MaterialCategory, { label: string; hint: string }>> = {
  seal: {
    label: "Jalur per sisi kaca",
    hint: "Kebutuhan = keliling kaca × angka ini. Isi 2 kalau seal dipasang di depan dan belakang kaca.",
  },
  corner: { label: "Jumlah per sudut", hint: "Kebutuhan = 4 sudut frame × angka ini." },
  pin: { label: "Jumlah per ujung divider", hint: "Kebutuhan = jumlah ujung divider × angka ini." },
};

export function MaterialForm({ initial }: { initial: MaterialFormValues }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveMaterial.bind(null, initial.id), undefined);
  const [category, setCategory] = useState<MaterialCategory>(initial.category);
  const fe = state?.fieldErrors ?? {};
  const perPoint = PER_POINT[category];

  return (
    <form action={action} className="card max-w-2xl space-y-5 p-5">
      <div>
        <label className="label" htmlFor="name">
          Nama barang
        </label>
        <input id="name" name="name" defaultValue={initial.name} className="input" required />
        <FieldError message={fe.name} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="category">
            Kategori
          </label>
          <select
            id="category"
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value as MaterialCategory)}
            className="input"
          >
            {(Object.keys(MATERIAL_CATEGORIES) as MaterialCategory[]).map((c) => (
              <option key={c} value={c}>
                {MATERIAL_CATEGORIES[c]}
              </option>
            ))}
          </select>
          <FieldError message={fe.category} />
        </div>
        <div>
          <label className="label" htmlFor="sku">
            SKU (opsional)
          </label>
          <input id="sku" name="sku" defaultValue={initial.sku ?? ""} className="input font-mono" />
          <FieldError message={fe.sku} />
        </div>
        <div>
          <label className="label" htmlFor="code">
            Kode (opsional)
          </label>
          <input id="code" name="code" defaultValue={initial.code ?? ""} placeholder="mis. A202-40" className="input" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="unit">
            Satuan
          </label>
          <input
            id="unit"
            name="unit"
            defaultValue={initial.unit}
            placeholder="pcs, batang, m, set"
            className="input"
            required
          />
          <FieldError message={fe.unit} />
        </div>
        <div>
          <label className="label" htmlFor="price">
            Harga per satuan (Rp)
          </label>
          <input
            id="price"
            name="price"
            type="number"
            step="any"
            min={0}
            defaultValue={initial.price}
            className="input text-right"
            required
          />
          <FieldError message={fe.price} />
        </div>
        <div>
          <label className="label" htmlFor="minPurchase">
            Minimal beli
          </label>
          <input
            id="minPurchase"
            name="minPurchase"
            type="number"
            step="any"
            min={0}
            defaultValue={initial.minPurchase}
            className="input text-right"
            required
          />
          <FieldError message={fe.minPurchase} />
        </div>
      </div>
      <p className="hint -mt-3">
        Pembelian dibulatkan ke kelipatan minimal beli. Contoh: minimal 20 pcs, butuh 10 → beli 20; butuh 25 → beli 40.
      </p>

      {perPoint ? (
        <div className="max-w-xs">
          <label className="label" htmlFor="usagePerPoint">
            {perPoint.label}
          </label>
          <input
            id="usagePerPoint"
            name="usagePerPoint"
            type="number"
            step="any"
            min={0}
            defaultValue={initial.usagePerPoint}
            className="input text-right"
          />
          <p className="hint">{perPoint.hint}</p>
          <FieldError message={fe.usagePerPoint} />
        </div>
      ) : (
        <input type="hidden" name="usagePerPoint" value={initial.usagePerPoint || 1} />
      )}

      {category === "profil" ? (
        <fieldset className="grid gap-4 rounded-lg border border-line p-4 sm:grid-cols-2">
          <legend className="px-1 text-sm font-semibold">Profil batang</legend>
          <div>
            <label className="label" htmlFor="glassDeduction">
              Glass deduction (mm)
            </label>
            <input
              id="glassDeduction"
              name="glassDeduction"
              type="number"
              step="any"
              defaultValue={initial.glassDeduction}
              className="input text-right"
            />
            <p className="hint">Kaca dipotong lebih kecil sebanyak ini di tiap sisi yang ditutup profil ini.</p>
            <FieldError message={fe.glassDeduction} />
          </div>
          <div>
            <label className="label" htmlFor="intersectionCutback">
              Intersection cutback (mm)
            </label>
            <input
              id="intersectionCutback"
              name="intersectionCutback"
              type="number"
              step="any"
              min={0}
              defaultValue={initial.intersectionCutback}
              className="input text-right"
            />
            <p className="hint">Divider dari profil ini dipotong lebih pendek sebanyak ini di tiap ujung pertemuan.</p>
            <FieldError message={fe.intersectionCutback} />
          </div>
          <p className="hint sm:col-span-2">
            Hubungkan material ini ke batang di menu Batang Frame atau Batang Gagang.
          </p>
        </fieldset>
      ) : (
        <>
          <input type="hidden" name="glassDeduction" value={initial.glassDeduction} />
          <input type="hidden" name="intersectionCutback" value={initial.intersectionCutback} />
        </>
      )}

      <div>
        <label className="label" htmlFor="note">
          Catatan (opsional)
        </label>
        <input
          id="note"
          name="note"
          defaultValue={initial.note ?? ""}
          placeholder="mis. 1 CASE = 10 PC"
          className="input"
        />
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
      <div className="flex gap-2">
        <button className="btn btn-primary" disabled={pending}>
          {pending ? "Menyimpan…" : "Simpan"}
        </button>
        <Link href="/admin/material" className="btn">
          Batal
        </Link>
      </div>
    </form>
  );
}
