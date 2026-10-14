import { count, desc, eq } from "drizzle-orm";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { PageHeader, Skeleton } from "@/components/admin-ui";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/data";

export default function AdminDashboard() {
  return (
    <>
      <PageHeader title="Dashboard" description="Ringkasan data master dan hitungan terbaru dari tim lapangan." />
      <Suspense fallback={<Skeleton rows={6} />}>
        <DashboardContent />
      </Suspense>
    </>
  );
}

async function DashboardContent() {
  await requireUser("admin");
  const [[frames], [handles], [users], settings, recent, recentBulks] = await Promise.all([
    db.select({ n: count() }).from(schema.frameProfiles),
    db.select({ n: count() }).from(schema.handleProfiles),
    db.select({ n: count() }).from(schema.users),
    getSettings(),
    db
      .select({
        id: schema.calculations.id,
        label: schema.calculations.label,
        spec: schema.calculations.spec,
        totalBars: schema.calculations.totalBars,
        score: schema.calculations.score,
        createdAt: schema.calculations.createdAt,
        userName: schema.users.name,
      })
      .from(schema.calculations)
      .innerJoin(schema.users, eq(schema.users.id, schema.calculations.userId))
      .orderBy(desc(schema.calculations.createdAt))
      .limit(15),
    db
      .select({
        id: schema.bulkCalculations.id,
        label: schema.bulkCalculations.label,
        items: schema.bulkCalculations.items,
        totalBars: schema.bulkCalculations.totalBars,
        separateBars: schema.bulkCalculations.separateBars,
        score: schema.bulkCalculations.score,
        createdAt: schema.bulkCalculations.createdAt,
        userName: schema.users.name,
      })
      .from(schema.bulkCalculations)
      .innerJoin(schema.users, eq(schema.users.id, schema.bulkCalculations.userId))
      .orderBy(desc(schema.bulkCalculations.createdAt))
      .limit(10),
  ]);

  const stats = [
    { label: "Jenis frame", value: frames.n, href: "/admin/frame" },
    { label: "Jenis gagang", value: handles.n, href: "/admin/gagang" },
    { label: "Pengguna", value: users.n, href: "/admin/pengguna" },
    { label: "Panjang batang default", value: `${settings.defaultBarLength} mm`, href: "/admin/pengaturan" },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="card p-4 transition hover:border-accent/50">
            <div className="text-xs font-medium text-muted">{s.label}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</div>
          </Link>
        ))}
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Hitungan terbaru</h2>
        {recent.length === 0 ? (
          <div className="card p-6 text-sm text-muted">Belum ada hitungan dari tim lapangan.</div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr>
                  <th className="th">Waktu</th>
                  <th className="th">Petugas</th>
                  <th className="th">Pintu</th>
                  <th className="th text-right">Batang</th>
                  <th className="th text-right">Efisiensi</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <LinkRow
                    key={r.id}
                    href={`/admin/riwayat/${r.id}`}
                    cells={[
                      <span key="t" className="whitespace-nowrap text-muted">
                        {r.createdAt.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                      </span>,
                      r.userName,
                      <>
                        <span className="font-medium">{r.label || "Tanpa nama"}</span>
                        <span className="ml-2 text-muted tabular-nums">
                          {r.spec.width} × {r.spec.height}
                        </span>
                      </>,
                      <span key="b" className="block text-right tabular-nums">
                        {r.totalBars}
                      </span>,
                      <span key="e" className="block text-right tabular-nums">
                        {Math.round(r.score * 100)}%
                      </span>,
                    ]}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Bulk terbaru</h2>
        {recentBulks.length === 0 ? (
          <div className="card p-6 text-sm text-muted">Belum ada bulk dari tim lapangan.</div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr>
                  <th className="th">Waktu</th>
                  <th className="th">Petugas</th>
                  <th className="th">Bulk</th>
                  <th className="th text-right">Batang</th>
                  <th className="th text-right">Efisiensi</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody>
                {recentBulks.map((b) => {
                  const units = b.items.reduce((s, it) => s + it.qty, 0);
                  const saving = b.separateBars - b.totalBars;
                  return (
                    <LinkRow
                      key={b.id}
                      href={`/admin/riwayat/bulk/${b.id}`}
                      cells={[
                        <span key="t" className="whitespace-nowrap text-muted">
                          {b.createdAt.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                        </span>,
                        b.userName,
                        <>
                          <span className="font-medium">{b.label || "Bulk tanpa nama"}</span>
                          <span className="ml-2 text-muted">
                            {b.items.length} jenis · {units} unit
                          </span>
                        </>,
                        <span key="b" className="block text-right tabular-nums">
                          {b.totalBars}
                          {saving > 0 && <span className="ml-1 text-xs text-ok">hemat {saving}</span>}
                        </span>,
                        <span key="e" className="block text-right tabular-nums">
                          {Math.round(b.score * 100)}%
                        </span>,
                      ]}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/** Baris tabel yang seluruhnya bisa diklik (tiap sel berisi tautan ke halaman detail). */
function LinkRow({ href, cells }: { href: string; cells: ReactNode[] }) {
  return (
    <tr className="group transition hover:bg-paper">
      {[...cells, <ChevronRight key="go" className="ml-auto size-4 text-muted group-hover:text-accent" />].map(
        (c, i) => (
          <td key={i} className="border-t border-line p-0 text-sm">
            <Link href={href} className="block px-4 py-3" tabIndex={i === 0 ? 0 : -1}>
              {c}
            </Link>
          </td>
        ),
      )}
    </tr>
  );
}
