import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs font-medium text-danger">{message}</p>;
}

export function FormAlert({ state }: { state?: { error?: string; ok?: boolean } }) {
  if (state?.error) {
    return (
      <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
        {state.error}
      </p>
    );
  }
  if (state?.ok) {
    return (
      <p role="status" className="rounded-lg bg-ok/10 px-3 py-2 text-sm text-ok">
        Tersimpan
      </p>
    );
  }
  return null;
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="card space-y-3 p-4">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-8 animate-pulse rounded bg-paper" />
      ))}
    </div>
  );
}

export function Swatch({ color }: { color: string }) {
  return <span className="inline-block size-4 shrink-0 rounded border border-black/10" style={{ background: color }} />;
}

export type GroupOption = { id: number; name: string };

/** Pilihan kelompok skrup untuk form batang (name="screwGroupId"). */
export function ScrewGroupSelect({ groups, value }: { groups: GroupOption[]; value: number | null }) {
  return (
    <div>
      <label className="label" htmlFor="screwGroupId">
        Kelompok skrup
      </label>
      <select id="screwGroupId" name="screwGroupId" defaultValue={value ?? ""} className="input">
        <option value="">Tanpa skrup</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>
      <p className="hint">Atur jenis dan jumlahnya di menu Kelompok Skrup.</p>
    </div>
  );
}

/** Pilihan material katalog (name="materialId") untuk dihubungkan ke batang atau engsel. */
export function MaterialSelect({
  materials,
  value,
  hint = "Dipakai untuk harga dan minimal beli di BOM.",
}: {
  materials: GroupOption[];
  value: number | null;
  hint?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor="materialId">
        Material katalog
      </label>
      <select id="materialId" name="materialId" defaultValue={value ?? ""} className="input">
        <option value="">Tidak terhubung</option>
        {materials.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      <p className="hint">{hint}</p>
    </div>
  );
}

export const mm = (v: number) => `${v.toLocaleString("id-ID")} mm`;
