import { NextResponse, type NextRequest } from "next/server";

/** /panduan membuka PDF panduan penggunaan (file statis di public/Panduan.pdf). */
export function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/Panduan.pdf", request.url));
}
