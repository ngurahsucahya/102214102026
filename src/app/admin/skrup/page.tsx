import { Suspense } from "react";
import { PageHeader, Skeleton } from "@/components/admin-ui";
import { requireUser } from "@/lib/auth";
import { listFrames, listHandles, listScrewGroups, listMaterialOptions } from "@/lib/data";
import { ScrewGroupForm } from "./screw-group-form";

export default function ScrewGroupsPage() {
  return (
    <>
      <PageHeader
        title="Kelompok Skrup"
        description="Jenis dan jumlah skrup per sambungan. Pilih kelompok ini di tiap batang frame atau gagang. Jenis skrup yang sama dengan nama material skrup otomatis masuk BOM dengan harganya."
      />
      <Suspense fallback={<Skeleton rows={4} />}>
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  await requireUser("admin");
  const [groups, frames, handles, screwMaterials] = await Promise.all([
    listScrewGroups(),
    listFrames(),
    listHandles(),
    listMaterialOptions("skrup"),
  ]);
  const usedBy = (id: number) => [...frames, ...handles].filter((p) => p.screwGroupId === id).map((p) => p.name);

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      {/* Jenis skrup yang sama persis dengan nama material skrup otomatis masuk BOM dengan harganya. */}
      <datalist id="screw-materials">
        {screwMaterials.map((m) => (
          <option key={m.id} value={m.name} />
        ))}
      </datalist>
      <div className="space-y-3">
        {groups.length === 0 && <div className="card p-6 text-sm text-muted">Belum ada kelompok skrup.</div>}
        {groups.map((g) => (
          <ScrewGroupForm key={g.id} initial={g} usedBy={usedBy(g.id)} />
        ))}
      </div>
      <ScrewGroupForm
        initial={{ id: null, name: "", cornerType: "", cornerQty: 4, jointType: "", jointQty: 2 }}
        usedBy={[]}
      />
    </div>
  );
}
