/**
 * Login dengan username/password. Selama `LOGIN_ENABLED` bukan "true", pengguna cukup memilih
 * peran (admin atau petugas lapangan) di halaman awal. Sesi dan pembatasan per peran tetap berlaku.
 */
export const LOGIN_ENABLED = process.env.LOGIN_ENABLED === "true";

/** Halaman masuk: form login, atau halaman pilih peran saat login nonaktif. */
export const ENTRY_PATH = LOGIN_ENABLED ? "/login" : "/";
