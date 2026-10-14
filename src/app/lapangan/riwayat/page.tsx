import { desc, eq } from "drizzle-orm";
import { ChevronDown } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { BarPlanView } from "@/components/calc/bar-plan-view";
import { Length } from "@/components/unit-context";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Riwayat" };

export default function HistoryPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-2xl font-semibold">Riwayat hitungan</h1>
      <Suspense fallback={<p className="text-muted">Memuat…</p>}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const user = await requireUser();
  const rows = await db
    .select()
    .from(schema.calculations)
    .where(eq(schema.calculations.userId, user.id))
    .orderBy(desc(schema.calculations.createdAt))
    .limit(30);

  const bulks = await db
    .select()
    .from(schema.bulkCalculations)
    .where(eq(schema.bulkCalculations.userId, user.id))
    .orderBy(desc(schema.bulkCalculations.createdAt))
    .limit(20);

  if (!rows.length && !bulks.length) return <p className="card p-6 text-muted">Belum ada hitungan tersimpan.</p>;

  return (
    <div className="space-y-6">
      {bulks.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-muted">Bulk</h2>
          <ul className="space-y-2">
            {bulks.map((b) => {
              const units = b.items.reduce((s, it) => s + it.qty, 0);
              return (
                <li key={b.id}>
                  <details className="group card p-4">
                    <summary className="flex cursor-pointer list-none items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">{b.label || "Bulk tanpa nama"}</div>
                        <div className="text-xs text-muted">
                          {b.items.length} jenis pintu · {units} unit ·{" "}
                          {b.createdAt.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <div className="font-semibold tabular-nums">{b.totalBars} batang</div>
                        <div className="text-xs text-muted">
                          {b.separateBars > b.totalBars ? `hemat ${b.separateBars - b.totalBars}` : "tanpa hemat"}
                        </div>
                      </div>
                      <ChevronDown className="size-4 text-muted transition group-open:rotate-180" />
                    </summary>
                    <div className="mt-3 space-y-2">
                      {b.result.bars.map((bar) => (
                        <BarPlanView key={bar.id} bar={bar} />
                      ))}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {rows.length > 0 && (
        <section>
          {bulks.length > 0 && <h2 className="mb-2 text-sm font-semibold text-muted">Per pintu</h2>}
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.id}>
                <details className="group card p-4">
                  <summary className="flex cursor-pointer list-none items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{r.label || "Tanpa nama"}</div>
                      <div className="text-xs text-muted">
                        <Length mm={r.spec.width} suffix={false} /> × <Length mm={r.spec.height} /> ·{" "}
                        {r.createdAt.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="font-semibold tabular-nums">{r.totalBars} batang</div>
                      <div className="text-xs text-muted">Efisiensi {Math.round(r.score * 100)}%</div>
                    </div>
                    <ChevronDown className="size-4 text-muted transition group-open:rotate-180" />
                  </summary>
                  <div className="mt-3 space-y-2">
                    {r.result.bars.map((bar) => (
                      <BarPlanView key={bar.id} bar={bar} />
                    ))}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
