import type { Metadata } from "next";
import { Suspense } from "react";
import { DoorCalculator } from "@/components/calc/door-calculator";
import { requireUser } from "@/lib/auth";
import { getCalcCatalog } from "@/lib/data";

export const metadata: Metadata = { title: "Hitung Pintu" };

export default function FieldPage() {
  return (
    <Suspense fallback={<p className="mt-16 text-center text-muted">Memuat…</p>}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  await requireUser();
  const catalog = await getCalcCatalog();
  if (!catalog.frames.length || !catalog.handles.length) {
    return (
      <div className="card mx-auto mt-12 max-w-md p-6 text-center">
        <p className="font-semibold">Belum ada material</p>
        <p className="mt-1 text-sm text-muted">Minta admin menambahkan minimal 1 batang frame dan 1 batang gagang.</p>
      </div>
    );
  }
  return <DoorCalculator catalog={catalog} />;
}
