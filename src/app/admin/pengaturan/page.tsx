import { Suspense } from "react";
import { PageHeader, Skeleton } from "@/components/admin-ui";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { SettingsForm } from "./settings-form";

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Pengaturan" description="Aturan potong yang berlaku untuk semua hitungan." />
      <Suspense fallback={<Skeleton rows={4} />}>
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  await requireUser("admin");
  const s = await getSettings();
  return <SettingsForm initial={s} />;
}
