import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader, Skeleton } from "@/components/admin-ui";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { getSettings, listFrames, listMaterialOptions, listScrewGroups } from "@/lib/data";
import { HandleForm } from "../handle-form";

export default function EditHandlePage({ params }: PageProps<"/admin/gagang/[id]">) {
  return (
    <>
      <PageHeader title="Ubah Batang Gagang" />
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
  const [handle, settings, frames, screwGroups] = await Promise.all([
    db.query.handleProfiles.findFirst({ where: eq(schema.handleProfiles.id, id) }),
    getSettings(),
    listFrames(),
    listScrewGroups(),
  ]);
  if (!handle) notFound();
  const materials = await listMaterialOptions("profil", handle.materialId);
  return (
    <HandleForm
      defaultBarLength={settings.defaultBarLength}
      frames={frames}
      screwGroups={screwGroups}
      materials={materials}
      initial={handle}
    />
  );
}
