import { ArrowRight, Calculator, Settings2 } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DoorMark } from "@/components/door-mark";
import { LOGIN_ENABLED } from "@/lib/auth-mode";
import { enterAs } from "./login/actions";

export const metadata: Metadata = { title: "Pilih peran" };

const ROLES = [
  {
    role: "field" as const,
    title: "Petugas lapangan",
    desc: "Ukur pintu, hitung kebutuhan batang, kaca, skrup, engsel, lalu cetak untuk konsumen dan bengkel.",
    icon: Calculator,
  },
  {
    role: "admin" as const,
    title: "Admin",
    desc: "Kelola batang frame, gagang, kelompok skrup, engsel, pengaturan, dan lihat riwayat hitungan.",
    icon: Settings2,
  },
];

export default function RolePickerPage() {
  if (LOGIN_ENABLED) redirect("/login");
  return (
    <main className="flex min-h-dvh items-center justify-center bg-paper px-4 py-10">
      <div className="w-full max-w-2xl">
        <div className="mb-8 flex flex-col items-center text-center">
          <DoorMark className="mb-3 h-14 w-10" />
          <h1 className="text-2xl font-semibold">Pintu Custom</h1>
          <p className="mt-1 text-sm text-muted">Masuk sebagai</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {ROLES.map(({ role, title, desc, icon: Icon }) => (
            <form key={role} action={enterAs.bind(null, role)}>
              <button className="card group flex h-full w-full flex-col items-start gap-3 p-6 text-left shadow-sm transition hover:border-accent hover:shadow-md">
                <span className="flex size-11 items-center justify-center rounded-lg bg-accent-soft text-accent">
                  <Icon className="size-6" />
                </span>
                <span className="text-lg font-semibold">{title}</span>
                <span className="flex-1 text-sm text-muted">{desc}</span>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
                  Masuk <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
                </span>
              </button>
            </form>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-muted">Login dengan password sedang dinonaktifkan.</p>
      </div>
    </main>
  );
}
