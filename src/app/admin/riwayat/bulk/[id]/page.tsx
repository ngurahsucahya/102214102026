import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/admin-ui";
import { BulkDoorList, BulkResultPanel } from "@/components/calc/bulk-view";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { getCalcCatalog } from "@/lib/data";
import { DetailHeader } from "@/components/detail-header";

export default function BulkDetailPage({ params }: PageProps<"/admin/riwayat/bulk/[id]">) {
  return (
    <Suspense fallback={<Skeleton rows={8} />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("admin");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const [row] = await db
    .select({ bulk: schema.bulkCalculations, userName: schema.users.name })
    .from(schema.bulkCalculations)
    .innerJoin(schema.users, eq(schema.users.id, schema.bulkCalculations.userId))
    .where(eq(schema.bulkCalculations.id, id));
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
