import "server-only";
import { and, eq, type SQL } from "drizzle-orm";
import { notFound } from "next/navigation";
import { BulkDoorList, BulkResultPanel } from "@/components/calc/bulk-view";
import { ResultView } from "@/components/calc/result-view";
import { DetailHeader } from "@/components/detail-header";
import { db, schema } from "@/db";
import { getCalcCatalog } from "@/lib/data";

type Props = {
  id: number;
  /** Isi untuk membatasi ke riwayat milik pengguna ini (petugas lapangan). */
  ownerId?: number;
  backHref: string;
  backLabel: string;
  /** Petugas lapangan sudah punya pilihan satuan di header layout. */
  unitToggle?: boolean;
};

/** Detail hitungan per pintu: tampilan sama seperti hasil hitung, bisa dicetak. */
export async function CalculationDetail({ id, ownerId, backHref, backLabel, unitToggle }: Props) {
  const where: SQL[] = [eq(schema.calculations.id, id)];
  if (ownerId !== undefined) where.push(eq(schema.calculations.userId, ownerId));
  const [row] = await db
    .select({ calc: schema.calculations, userName: schema.users.name })
    .from(schema.calculations)
    .innerJoin(schema.users, eq(schema.users.id, schema.calculations.userId))
    .where(and(...where));
  if (!row) notFound();
  const { calc } = row;

  // Pakai salinan profil saat dihitung; riwayat lama memakai data master sekarang (termasuk yang nonaktif).
  const catalog = await getCalcCatalog({ includeInactive: true });
  const frame = calc.frame ?? catalog.frames.find((f) => f.id === calc.spec.frameProfileId);
  const handle = calc.handle ?? catalog.handles.find((h) => h.id === calc.spec.handleProfileId);

  return (
    <div className="space-y-4">
      <DetailHeader
        by={row.userName}
        at={calc.createdAt}
        note="Hitungan per pintu. Angka sesuai saat disimpan."
        backHref={backHref}
        backLabel={backLabel}
        unitToggle={unitToggle}
      />
      {frame && handle ? (
        <ResultView
          readOnly
          spec={calc.spec}
          frame={frame}
          handle={handle}
          result={calc.result}
          catalog={catalog}
          initialLabel={calc.label ?? ""}
        />
      ) : (
        <div className="card p-6 text-sm text-muted">Profil frame/gagang hitungan ini sudah dihapus dari master.</div>
      )}
    </div>
  );
}

/** Detail bulk: tampilan sama seperti hasil bulk, bisa dicetak. */
export async function BulkDetail({ id, ownerId, backHref, backLabel, unitToggle }: Props) {
  const where: SQL[] = [eq(schema.bulkCalculations.id, id)];
  if (ownerId !== undefined) where.push(eq(schema.bulkCalculations.userId, ownerId));
  const [row] = await db
    .select({ bulk: schema.bulkCalculations, userName: schema.users.name })
    .from(schema.bulkCalculations)
    .innerJoin(schema.users, eq(schema.users.id, schema.bulkCalculations.userId))
    .where(and(...where));
  if (!row) notFound();
  const { bulk } = row;

  // Salinan profil saat dihitung didahulukan di atas data master sekarang.
  const current = await getCalcCatalog({ includeInactive: true });
  const snap = bulk.profiles;
  const catalog = {
    ...current,
    frames: [...(snap?.frames ?? []), ...current.frames.filter((f) => !snap?.frames.some((s) => s.id === f.id))],
    handles: [
      ...(snap?.handles ?? []).map((h) => ({ ...h, code: null })),
      ...current.handles.filter((h) => !snap?.handles.some((s) => s.id === h.id)),
    ],
  };
  const units = bulk.items.reduce((s, it) => s + it.qty, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <DetailHeader
        by={row.userName}
        at={bulk.createdAt}
        note={`Bulk ${bulk.items.length} jenis pintu, ${units} unit. Angka sesuai saat disimpan.`}
        backHref={backHref}
        backLabel={backLabel}
        unitToggle={unitToggle}
      />
      <h1 className="text-2xl font-semibold print:hidden">{bulk.label || "Bulk tanpa nama"}</h1>
      <div className="print:hidden">
        <BulkDoorList items={bulk.items} />
      </div>
      <BulkResultPanel
        readOnly
        catalog={catalog}
        result={bulk.result}
        items={bulk.items}
        initialLabel={bulk.label ?? ""}
      />
    </div>
  );
}
