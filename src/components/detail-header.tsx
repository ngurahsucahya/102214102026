import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { UnitToggle } from "@/components/unit-context";

/** Kepala halaman detail riwayat: kembali, siapa & kapan, pilihan satuan. */
export function DetailHeader({
  by,
  at,
  note,
  backHref = "/admin",
  backLabel = "Kembali ke dashboard",
  unitToggle = true,
}: {
  by: string;
  at: Date;
  note: string;
  backHref?: string;
  backLabel?: string;
  /** Sembunyikan kalau layout sudah punya pilihan satuan. */
  unitToggle?: boolean;
}) {
  return (
    <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 print:hidden">
      <div className="flex items-center gap-3">
        <Link href={backHref} className="btn px-2.5" aria-label={backLabel}>
          <ArrowLeft className="size-4" />
        </Link>
        <div className="text-sm">
          <div className="font-medium">
            {by} · {at.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
          </div>
          <div className="text-xs text-muted">{note}</div>
        </div>
      </div>
      {unitToggle && <UnitToggle />}
    </div>
  );
}
