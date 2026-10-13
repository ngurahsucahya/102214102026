import { Suspense } from "react";
import { DoorMark } from "@/components/door-mark";
import { getCurrentUser } from "@/lib/auth";
import { logout } from "../login/actions";
import { AdminNav, NavLinks } from "./nav";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex min-h-dvh flex-col bg-paper md:flex-row">
      <aside className="border-b border-line bg-surface md:sticky md:top-0 md:h-dvh md:w-60 md:shrink-0 md:border-r md:border-b-0">
        <div className="flex items-center gap-2.5 px-4 py-4 md:px-5 md:py-6">
          <DoorMark className="h-8 w-6" />
          <div className="leading-tight">
            <div className="text-lg font-semibold">Pintu Custom</div>
            <div className="text-xs text-muted">Panel admin</div>
          </div>
        </div>
        <Suspense fallback={<NavLinks pathname={null} />}>
          <AdminNav />
        </Suspense>
        <div className="hidden px-5 pb-5 md:absolute md:bottom-0 md:block md:w-60">
          <Suspense fallback={<div className="h-10" />}>
            <UserBadge />
          </Suspense>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-10 md:py-8">{children}</main>
    </div>
  );
}

async function UserBadge() {
  const user = await getCurrentUser();
  if (!user) return null;
  return (
    <form action={logout} className="flex items-center justify-between gap-2 border-t border-line pt-4">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{user.name}</div>
        <div className="text-xs text-muted">@{user.username}</div>
      </div>
      <button className="btn px-2.5 py-1.5 text-xs">Keluar</button>
    </form>
  );
}
