# Pintu Custom

Web untuk usaha pintu custom: admin mengatur master batang (frame dan gagang), tim lapangan menghitung kebutuhan batang dan menyiapkan rincian untuk penawaran ke konsumen.

## Menjalankan di lokal

Butuh Node.js 24+ dan Docker.

```bash
npm install
cp .env.example .env        # isi SESSION_SECRET dengan string acak panjang
docker compose up -d        # PostgreSQL di port 5433
npm run db:push             # buat tabel
npm run db:seed             # data contoh + akun awal
npm run dev                 # http://localhost:3000
```

**Login sementara dinonaktifkan** (`LOGIN_ENABLED=false` di `.env`). Halaman awal berisi pilihan **Admin** atau **Petugas lapangan**, dan pengguna langsung masuk sebagai akun aktif pertama dengan peran itu. Pembatasan per peran tetap berlaku: petugas lapangan tidak bisa membuka halaman admin.

Untuk menyalakan login lagi, isi `LOGIN_ENABLED=true` lalu restart server. Akun awal: `admin` / `admin123` dan `lapangan` / `lapangan123`. Segera ganti password-nya di menu **Pengguna**.

## Perintah lain

| Perintah | Fungsi |
|---|---|
| `npm test` | Unit test engine hitung |
| `npm run db:studio` | Lihat isi database |
| `npm run build` | Build produksi |

## Cara hitung

Kode engine ada di `src/lib/engine`. Engine ini TypeScript murni, dipakai di browser untuk hitung live dan di server saat menyimpan.

1. **Uraikan pintu** (`decompose.ts`): frame atas/bawah/kiri/kanan dipotong 45°. Satu sisi vertikal adalah frame gagang. Divider vertikal penuh setinggi bidang dalam, sedangkan divider horizontal terpotong di antara divider vertikal (potongan 90°).
2. **Frame gagang** (`handle.ts`): dipotong dari batang gagang sehingga zona gagang jatuh tepat di tinggi pilihan. Potongan boleh dibalik dan tidak boleh ikut memotong zona gagang lain. Rentang tinggi yang mungkin dihitung untuk membatasi slider.
3. **Optimasi potong** (`pack.ts`): exact search (branch & bound) untuk jumlah batang baru paling sedikit. Sisa batang gagang (tanpa zona gagang) dipakai dulu jika admin mengizinkan. Kalau jumlah batangnya sama, dipilih susunan dengan sisa yang paling terkumpul.
4. **Kerf** dihitung per potongan, dengan potongan 45° dikali √2. Ujung batang bisa dibuang (end trim). Sisa di bawah batas minimum dianggap buangan.

5. **Kaca** (`accessories.ts`): bukaan = ukuran pintu dikurangi tebal frame, tebal gagang, dan tebal divider. Ukuran potong kaca = bukaan + 2 × "kaca masuk alur" (pengaturan admin).
6. **Skrup** (`accessories.ts`): tiap batang punya kelompok skrup (jenis + jumlah per sudut frame, jenis + jumlah per ujung divider). 2 sudut di sisi gagang memakai kelompok batang gagang (kalau kosong ikut frame). 2 sudut lain dan semua ujung divider memakai kelompok frame. Hasilnya dijumlahkan per jenis skrup.

7. **Tipe pintu**: *swing* punya gagang di kiri atau kanan, dan engselnya ada di sisi seberang gagang (jenis dari admin; jumlah dan posisi diatur petugas, awalnya dibagi rata 200 mm dari bawah dan atas). *Slider* tidak memakai engsel, dan gagangnya bisa di kiri, kanan, atau keduanya (dua frame gagang).
8. **Tampak belakang** (`screwJoints`): gambar dicerminkan dan menampilkan titik skrup per sambungan. Total titik selalu sama dengan tabel skrup.

9. **Bulk** (`calculateBulk`): beberapa pintu (masing-masing bisa beberapa unit) dihitung bersama. Semua potongan digabung ke satu rencana potong, jadi sisa batang satu pintu dipakai pintu lain. Hasilnya dibandingkan dengan jumlah batang kalau tiap unit dihitung terpisah. Draf bulk disimpan di browser, dan setelah disimpan masuk ke riwayat (`bulk_calculations`).

Efisiensi material = 1 − waste / total panjang batang. Sisa yang masih berguna tidak dihitung sebagai waste.
