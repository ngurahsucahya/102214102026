import { History, LogOut } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { DoorMark } from "@/components/door-mark";
import { BulkLink } from "@/components/calc/bulk-link";
import { UnitToggle } from "@/components/unit-context";
import { getCurrentUser } from "@/lib/auth";
import { logout } from "../login/actions";

export default function FieldLayout({ children }: LayoutProps<"/lapangan">) {
  return (
    <div className="flex min-h-dvh flex-col bg-paper print:bg-surface">
      <header className="border-b border-line bg-surface print:hidden">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/lapangan" className="flex items-center gap-2">
            <DoorMark className="h-7 w-5" />
            <span className="font-semibold">Pintu Custom</span>
          </Link>
          <nav className="flex items-center gap-1">
            <UnitToggle />
            <Suspense fallback={null}>
              <UserName />
            </Suspense>
            <BulkLink />
            <Link href="/lapangan/riwayat" className="btn border-transparent px-2.5">
              <History className="size-4" />
              <span className="hidden sm:inline">Riwayat</span>
            </Link>
            <form action={logout}>
              <button className="btn border-transparent px-2.5" aria-label="Keluar">
                <LogOut className="size-4" />
                <span className="hidden sm:inline">Keluar</span>
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-10">{children}</main>
    </div>
  );
}

async function UserName() {
  const user = await getCurrentUser();
  if (!user) return null;
  return <span className="mr-2 hidden text-sm text-muted sm:inline">{user.name}</span>;
}
