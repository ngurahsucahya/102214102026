import { count, desc, eq } from "drizzle-orm";
import Link from "next/link";
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
  const [[frames], [handles], [users], settings, recent] = await Promise.all([
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
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id}>
                    <td className="td whitespace-nowrap text-muted">
                      {r.createdAt.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                    </td>
                    <td className="td">{r.userName}</td>
                    <td className="td">
                      <span className="font-medium">{r.label || "Tanpa nama"}</span>
                      <span className="ml-2 text-muted tabular-nums">
                        {r.spec.width} × {r.spec.height}
                      </span>
                    </td>
                    <td className="td text-right tabular-nums">{r.totalBars}</td>
                    <td className="td text-right tabular-nums">{Math.round(r.score * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
