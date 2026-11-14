import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader, Skeleton } from "@/components/admin-ui";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { MaterialForm } from "../material-form";

export default function EditMaterialPage({ params }: PageProps<"/admin/material/[id]">) {
  return (
    <>
      <PageHeader title="Ubah Material" />
      <Suspense fallback={<Skeleton rows={6} />}>
        <Content params={params} />
      </Suspense>
    </>
  );
}

async function Content({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("admin");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const material = await db.query.materials.findFirst({ where: eq(schema.materials.id, id) });
  if (!material) notFound();
  return <MaterialForm initial={material} />;
}
