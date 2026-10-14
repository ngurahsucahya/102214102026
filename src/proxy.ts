import { NextResponse, type NextRequest } from "next/server";
import { ENTRY_PATH, LOGIN_ENABLED } from "@/lib/auth-mode";
import { decryptSession, homeFor, SESSION_COOKIE } from "@/lib/session";

// Pengecekan cepat berdasarkan cookie. Pengecekan penuh tetap dilakukan di halaman (requireUser).
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await decryptSession(request.cookies.get(SESSION_COOKIE)?.value);
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url));

  if (!LOGIN_ENABLED) {
    // Halaman awal = pilih peran (selalu bisa dibuka untuk ganti peran); form login tidak dipakai.
    if (pathname === "/login") return to("/");
    if (pathname === "/") return NextResponse.next();
  } else if (pathname === "/login" || pathname === "/") {
    if (session) return to(homeFor(session.role));
    if (pathname === "/") return to("/login");
    return NextResponse.next();
  }

  if (!session) return to(ENTRY_PATH);
  if (pathname.startsWith("/admin") && session.role !== "admin") return to("/lapangan");
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/admin/:path*", "/lapangan/:path*"],
};
