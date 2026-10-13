import { NextResponse, type NextRequest } from "next/server";
import { decryptSession, homeFor, SESSION_COOKIE } from "@/lib/session";

// Pengecekan cepat berdasarkan cookie. Pengecekan penuh tetap dilakukan di halaman (requireUser).
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await decryptSession(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === "/login" || pathname === "/") {
    if (session) return NextResponse.redirect(new URL(homeFor(session.role), request.url));
    if (pathname === "/") return NextResponse.redirect(new URL("/login", request.url));
    return NextResponse.next();
  }

  if (!session) return NextResponse.redirect(new URL("/login", request.url));
  if (pathname.startsWith("/admin") && session.role !== "admin") {
    return NextResponse.redirect(new URL("/lapangan", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/admin/:path*", "/lapangan/:path*"],
};
