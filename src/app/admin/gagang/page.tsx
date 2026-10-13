import { Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { mm, PageHeader, Skeleton, Swatch } from "@/components/admin-ui";
import { DeleteButton } from "@/components/delete-button";
import { requireUser } from "@/lib/auth";
import { getSettings, listFrames, listHandles } from "@/lib/data";
import { deleteHandle } from "../actions";

export default function HandlePage() {
  return (
    <>
      <PageHeader
        title="Batang Gagang"
        description="Profil frame yang punya gagang menyatu. Atur berapa titik gagang dalam satu batang dan posisinya."
        action={
          <Link href="/admin/gagang/baru" className="btn btn-primary">
            <Plus className="size-4" /> Tambah gagang
          </Link>
        }
      />
      <Suspense fallback={<Skeleton />}>
        <HandleTable />
      </Suspense>
    </>
  );
}

async function HandleTable() {
  await requireUser("admin");
  const [handles, frames, settings] = await Promise.all([listHandles(), listFrames(), getSettings()]);
  if (!handles.length) return <div className="card p-6 text-sm text-muted">Belum ada data gagang.</div>;
  const frameName = new Map(frames.map((f) => [f.id, f.name]));

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {handles.map((h) => {
        const L = h.barLength ?? settings.defaultBarLength;
        return (
          <div key={h.id} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <Link href={`/admin/gagang/${h.id}`} className="min-w-0 hover:text-accent">
                <div className="flex items-center gap-2 font-semibold">
                  <Swatch color={h.color} />
                  <span className="truncate">{h.name}</span>
                </div>
                <div className="mt-0.5 text-xs text-muted">
                  {h.code ?? "Tanpa kode"} · {mm(L)} · {h.zones.length} gagang/batang
                  {!h.active && " · Nonaktif"}
                </div>
              </Link>
              <DeleteButton action={deleteHandle.bind(null, h.id)} name={h.name} />
            </div>
            <svg viewBox="0 0 1000 40" className="mt-3 w-full" aria-hidden>
              <rect x="0" y="12" width="1000" height="16" rx="3" fill={h.color} stroke="#0002" />
              {h.zones.map((z, i) => (
                <rect
                  key={i}
                  x={(z.start / L) * 1000}
                  y="4"
                  width={Math.max((z.length / L) * 1000, 4)}
                  height="32"
                  rx="4"
                  fill="#d97706"
                />
              ))}
            </svg>
            <p className="mt-2 text-xs text-muted">
              Sisa batang:{" "}
              {h.remainderFrameProfileId
                ? `dipakai sebagai ${frameName.get(h.remainderFrameProfileId)}`
                : "tidak dipakai"}
            </p>
          </div>
        );
      })}
    </div>
  );
}
