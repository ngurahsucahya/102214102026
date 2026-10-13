import { Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { mm, PageHeader, Skeleton, Swatch } from "@/components/admin-ui";
import { DeleteButton } from "@/components/delete-button";
import { requireUser } from "@/lib/auth";
import { getSettings, listFrames } from "@/lib/data";
import { deleteFrame } from "../actions";

export default function FramePage() {
  return (
    <>
      <PageHeader
        title="Batang Frame"
        description="Jenis profil untuk frame dan divider. Panjang batang kosong = ikut panjang default."
        action={
          <Link href="/admin/frame/baru" className="btn btn-primary">
            <Plus className="size-4" /> Tambah frame
          </Link>
        }
      />
      <Suspense fallback={<Skeleton />}>
        <FrameTable />
      </Suspense>
    </>
  );
}

async function FrameTable() {
  await requireUser("admin");
  const [frames, settings] = await Promise.all([listFrames(), getSettings()]);
  if (!frames.length) return <div className="card p-6 text-sm text-muted">Belum ada data frame.</div>;

  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[560px]">
        <thead>
          <tr>
            <th className="th">Nama</th>
            <th className="th">Kode</th>
            <th className="th text-right">Panjang batang</th>
            <th className="th text-right">Tebal</th>
            <th className="th">Status</th>
            <th className="th" />
          </tr>
        </thead>
        <tbody>
          {frames.map((f) => (
            <tr key={f.id}>
              <td className="td">
                <Link href={`/admin/frame/${f.id}`} className="flex items-center gap-2 font-medium hover:text-accent">
                  <Swatch color={f.color} /> {f.name}
                </Link>
              </td>
              <td className="td text-muted">{f.code ?? "–"}</td>
              <td className="td text-right tabular-nums">
                {mm(f.barLength ?? settings.defaultBarLength)}
                {f.barLength == null && <span className="ml-1 text-xs text-muted">(default)</span>}
              </td>
              <td className="td text-right tabular-nums">{mm(f.faceWidth)}</td>
              <td className="td">{f.active ? "Aktif" : <span className="text-muted">Nonaktif</span>}</td>
              <td className="td text-right">
                <DeleteButton action={deleteFrame.bind(null, f.id)} name={f.name} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
