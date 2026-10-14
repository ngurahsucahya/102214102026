"use client";

import { DoorOpen, Gauge, Grip, PanelsTopLeft, Settings, Users, Wrench } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin", label: "Dashboard", icon: Gauge },
  { href: "/admin/frame", label: "Batang Frame", icon: PanelsTopLeft },
  { href: "/admin/gagang", label: "Batang Gagang", icon: Grip },
  { href: "/admin/skrup", label: "Kelompok Skrup", icon: Wrench },
  { href: "/admin/engsel", label: "Engsel", icon: DoorOpen },
  { href: "/admin/pengaturan", label: "Pengaturan", icon: Settings },
  { href: "/admin/pengguna", label: "Pengguna", icon: Users },
] as const;

export function AdminNav() {
  return <NavLinks pathname={usePathname()} />;
}

/** Tanpa pathname (saat prerender) semua link tampil tidak aktif. */
export function NavLinks({ pathname }: { pathname: string | null }) {
  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:px-3">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/admin" ? pathname === href : !!pathname?.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
              active ? "bg-accent/10 text-accent" : "text-muted hover:bg-paper hover:text-ink"
            }`}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
