import type { Metadata } from "next";
import { Suspense } from "react";
import { BulkView } from "@/components/calc/bulk-view";
import { requireUser } from "@/lib/auth";
import { getCalcCatalog } from "@/lib/data";

export const metadata: Metadata = { title: "Bulk" };

export default function BulkPage() {
  return (
    <Suspense fallback={<p className="mt-16 text-center text-muted">Memuat…</p>}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  await requireUser();
  return <BulkView catalog={await getCalcCatalog()} />;
}
