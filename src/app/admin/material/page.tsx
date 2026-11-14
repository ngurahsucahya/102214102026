import { Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader, Skeleton } from "@/components/admin-ui";
import { qtyText, rupiah } from "@/lib/format";
import { DeleteButton } from "@/components/delete-button";
import { requireUser } from "@/lib/auth";
import { listMaterials } from "@/lib/data";
import { MATERIAL_CATEGORIES, type MaterialCategory } from "@/lib/engine/types";
import { deleteMaterial } from "../actions";

export default function MaterialPage() {
  return (
    <>
      <PageHeader
        title="Material"
        description="Katalog barang untuk BOM: harga, satuan, dan minimal beli. Profil batang juga punya glass deduction dan intersection cutback."
        action={
          <Link href="/admin/material/baru" className="btn btn-primary">
            <Plus className="size-4" /> Tambah material
          </Link>
        }
      />
      <Suspense fallback={<Skeleton rows={8} />}>
        <MaterialTable />
      </Suspense>
    </>
  );
}

async function MaterialTable() {
  await requireUser("admin");
  const materials = await listMaterials();
  if (!materials.length) return <div className="card p-6 text-sm text-muted">Belum ada material.</div>;

  const groups = (Object.keys(MATERIAL_CATEGORIES) as MaterialCategory[])
    .map((cat) => ({ cat, items: materials.filter((m) => m.category === cat) }))
    .filter((g) => g.items.length);

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap gap-2 text-sm">
        {groups.map((g) => (
          <a
            key={g.cat}
            href={`#${g.cat}`}
            className="rounded-md border border-line px-2.5 py-1 text-muted hover:text-ink"
          >
            {MATERIAL_CATEGORIES[g.cat]} <span className="tabular-nums">({g.items.length})</span>
          </a>
        ))}
      </nav>
      {groups.map(({ cat, items }) => (
        <section key={cat} id={cat} className="scroll-mt-4 space-y-2">
          <h2 className="text-lg font-semibold">{MATERIAL_CATEGORIES[cat]}</h2>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr>
                  <th className="th">Nama</th>
                  <th className="th">SKU / kode</th>
                  <th className="th text-right">Harga</th>
                  <th className="th text-right">Min. beli</th>
                  {cat === "profil" && <th className="th text-right">Glass ded.</th>}
                  {cat === "profil" && <th className="th text-right">Cutback</th>}
                  {(cat === "seal" || cat === "corner" || cat === "pin") && (
                    <th className="th text-right">Per titik</th>
                  )}
                  <th className="th">Status</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody>
                {items.map((m) => (
                  <tr key={m.id}>
                    <td className="td">
                      <Link href={`/admin/material/${m.id}`} className="font-medium hover:text-accent">
                        {m.name}
                      </Link>
                      {m.note && <div className="text-xs text-muted">{m.note}</div>}
                    </td>
                    <td className="td text-muted">
                      <div className="font-mono text-xs">{m.sku ?? "–"}</div>
                      <div className="text-xs">{m.code ?? ""}</div>
                    </td>
                    <td className="td text-right whitespace-nowrap tabular-nums">
                      {rupiah(m.price)}
                      <span className="text-xs text-muted">/{m.unit}</span>
                    </td>
                    <td className="td text-right whitespace-nowrap tabular-nums">
                      {qtyText(m.minPurchase)} {m.unit}
                    </td>
                    {cat === "profil" && <td className="td text-right tabular-nums">{qtyText(m.glassDeduction)} mm</td>}
                    {cat === "profil" && (
                      <td className="td text-right tabular-nums">{qtyText(m.intersectionCutback)} mm</td>
                    )}
                    {(cat === "seal" || cat === "corner" || cat === "pin") && (
                      <td className="td text-right tabular-nums">{qtyText(m.usagePerPoint)}</td>
                    )}
                    <td className="td">{m.active ? "Aktif" : <span className="text-muted">Nonaktif</span>}</td>
                    <td className="td text-right">
                      <DeleteButton action={deleteMaterial.bind(null, m.id)} name={m.name} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
