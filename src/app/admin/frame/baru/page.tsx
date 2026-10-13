import { Suspense } from "react";
import { PageHeader, Skeleton } from "@/components/admin-ui";
import { requireUser } from "@/lib/auth";
import { getSettings, listScrewGroups } from "@/lib/data";
import { FrameForm } from "../frame-form";

export default function NewFramePage() {
  return (
    <>
      <PageHeader title="Tambah Batang Frame" />
      <Suspense fallback={<Skeleton rows={5} />}>
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  await requireUser("admin");
  const [settings, screwGroups] = await Promise.all([getSettings(), listScrewGroups()]);
  return (
    <FrameForm
      defaultBarLength={settings.defaultBarLength}
      screwGroups={screwGroups}
      initial={{
        id: null,
        name: "",
        code: null,
        color: "#c0c7d1",
        barLength: null,
        faceWidth: 40,
        screwGroupId: null,
        active: true,
      }}
    />
  );
}
