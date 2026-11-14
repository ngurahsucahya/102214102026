/** Jumlah material, maksimal 2 angka desimal (mis. 3,5 m). */
export const qtyText = (v: number) => v.toLocaleString("id-ID", { maximumFractionDigits: 2 });

export const rupiah = (v: number) => `Rp ${Math.round(v).toLocaleString("id-ID")}`;
