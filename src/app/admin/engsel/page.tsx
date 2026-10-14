import { Suspense } from "react";
import { PageHeader, Skeleton } from "@/components/admin-ui";
import { requireUser } from "@/lib/auth";
import { listHingeTypes } from "@/lib/data";
import { HingeTypeForm } from "./hinge-type-form";

export default function HingeTypesPage() {
  return (
    <>
      <PageHeader
        title="Engsel"
        description="Jenis engsel untuk pintu swing. Jumlah dan posisi engsel diatur tim lapangan per pintu."
      />
      <Suspense fallback={<Skeleton rows={4} />}>
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  await requireUser("admin");
  const hinges = await listHingeTypes();
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <div className="space-y-3">
        {hinges.length === 0 && <div className="card p-6 text-sm text-muted">Belum ada jenis engsel.</div>}
        {hinges.map((h) => (
          <HingeTypeForm key={h.id} initial={h} />
        ))}
      </div>
      <HingeTypeForm initial={{ id: null, name: "", length: 100, active: true }} />
    </div>
  );
}
