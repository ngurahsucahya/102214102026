import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader, Skeleton } from "@/components/admin-ui";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { getSettings, listScrewGroups } from "@/lib/data";
import { FrameForm } from "../frame-form";

export default function EditFramePage({ params }: PageProps<"/admin/frame/[id]">) {
  return (
    <>
      <PageHeader title="Ubah Batang Frame" />
      <Suspense fallback={<Skeleton rows={5} />}>
        <Content params={params} />
      </Suspense>
    </>
  );
}

async function Content({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("admin");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [frame, settings, screwGroups] = await Promise.all([
    db.query.frameProfiles.findFirst({ where: eq(schema.frameProfiles.id, id) }),
    getSettings(),
    listScrewGroups(),
  ]);
  if (!frame) notFound();
  return <FrameForm defaultBarLength={settings.defaultBarLength} screwGroups={screwGroups} initial={frame} />;
}
