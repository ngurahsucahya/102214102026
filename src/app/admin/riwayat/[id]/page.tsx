import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/admin-ui";
import { ResultView } from "@/components/calc/result-view";
import { DetailHeader } from "@/components/detail-header";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { getCalcCatalog } from "@/lib/data";

export default function CalculationDetailPage({ params }: PageProps<"/admin/riwayat/[id]">) {
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
    .select({ calc: schema.calculations, userName: schema.users.name })
    .from(schema.calculations)
    .innerJoin(schema.users, eq(schema.users.id, schema.calculations.userId))
    .where(eq(schema.calculations.id, id));
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
        note="Hitungan per pintu dari tim lapangan. Angka sesuai saat disimpan."
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
