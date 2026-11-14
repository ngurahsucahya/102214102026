/**
 * /panduan membuka PDF panduan penggunaan (file statis di public/Panduan.pdf).
 * Location relatif supaya browser tetap di domain yang sedang dibuka; request.url
 * bisa berisi localhost kalau aplikasi berjalan di belakang reverse proxy.
 */
export function GET() {
  return new Response(null, { status: 307, headers: { Location: "/Panduan.pdf" } });
}
