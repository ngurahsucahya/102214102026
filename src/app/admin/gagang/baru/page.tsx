import { Suspense } from "react";
import { PageHeader, Skeleton } from "@/components/admin-ui";
import { requireUser } from "@/lib/auth";
import { getSettings, listFrames, listScrewGroups } from "@/lib/data";
import { HandleForm } from "../handle-form";

export default function NewHandlePage() {
  return (
    <>
      <PageHeader title="Tambah Batang Gagang" />
      <Suspense fallback={<Skeleton rows={6} />}>
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  await requireUser("admin");
  const [settings, frames, screwGroups] = await Promise.all([getSettings(), listFrames(), listScrewGroups()]);
  return (
    <HandleForm
      defaultBarLength={settings.defaultBarLength}
      frames={frames}
      screwGroups={screwGroups}
      initial={{
        id: null,
        name: "",
        code: null,
        color: "#9aa4b1",
        barLength: null,
        faceWidth: 45,
        screwGroupId: null,
        zones: [{ start: settings.defaultBarLength / 2 - 100, length: 200 }],
        remainderFrameProfileId: null,
        active: true,
      }}
    />
  );
}
