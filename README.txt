# Kas Air Pesona — Vercel

## Isi paket
- `index.html`: tampilan aplikasi yang disesuaikan agar memanggil API Vercel.
- `api/proxy.js`: serverless proxy Vercel ke Google Apps Script.
- `Code.gs`: backend Google Apps Script versi API.
- `vercel.json`: konfigurasi Vercel.

## Langkah 1 — Perbarui Google Apps Script
1. Buka project Apps Script yang terhubung ke Google Sheets KAS AIR.
2. Ganti isi file `Code.gs` dengan isi `Code.gs` dari paket ini.
3. Pastikan nama sheet tetap `Transaksi_Kas`, `Iuran_Warga_2026`, dan `Informasi Warga`.
4. Di Project Settings > Script properties, set `INFO_ADMIN_PIN` dengan PIN admin yang kuat.
5. Deploy > Manage deployments > Edit deployment Web app > pilih versi **New version** > Deploy.
6. Salin URL Web app yang berakhiran `/exec`.

## Langkah 2 — Deploy ke Vercel
1. Upload seluruh isi folder ini ke repository GitHub (root repository harus berisi `index.html`, `vercel.json`, dan folder `api`).
2. Import repository itu di Vercel.
3. Di Project Settings > Environment Variables, tambahkan:
   - Name: `GAS_WEB_APP_URL`
   - Value: URL Web App Apps Script yang berakhiran `/exec`
   - Environment: Production (tambahkan Preview juga jika diperlukan)
4. Redeploy project.

## Langkah 3 — Uji aplikasi
- Buka domain Vercel.
- Dashboard harus memuat data dari Google Sheets.
- Buka Informasi / Catatan untuk menguji baca informasi.
- Uji tambah/hapus informasi dengan PIN admin.

## Catatan penting
- Apps Script Web App harus di-deploy dengan akses yang mengizinkan aplikasi Vercel memanggilnya (umumnya Execute as: Me; Who has access: Anyone). Periksa kebijakan akun Google/organisasi sebelum memilih akses publik.
- Jangan memasukkan PIN admin atau URL backend ke kode frontend.
- Data warga dan keuangan ditampilkan ke publik sesuai desain aplikasi sekarang. Pastikan memang disetujui pengurus sebelum dipublikasikan.
- Paket ini mempertahankan struktur data sheet yang digunakan oleh kode sumber. Tidak membuat atau mengubah isi transaksi/iuran.
