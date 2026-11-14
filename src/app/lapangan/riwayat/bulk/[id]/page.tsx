import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BulkDetail } from "@/components/history/history-detail";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Riwayat" };

export default function FieldBulkPage({ params }: PageProps<"/lapangan/riwayat/bulk/[id]">) {
  return (
    <Suspense fallback={<p className="mt-16 text-center text-muted">Memuat…</p>}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  // Petugas hanya bisa membuka bulk miliknya sendiri.
  return (
    <BulkDetail
      id={id}
      ownerId={user.id}
      backHref="/lapangan/riwayat"
      backLabel="Kembali ke riwayat"
      unitToggle={false}
    />
  );
}
