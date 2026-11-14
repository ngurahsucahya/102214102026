import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/admin-ui";
import { CalculationDetail } from "@/components/history/history-detail";
import { requireUser } from "@/lib/auth";

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
  return <CalculationDetail id={id} backHref="/admin" backLabel="Kembali ke dashboard" />;
}
