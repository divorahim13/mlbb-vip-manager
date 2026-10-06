# MLBB VIP Mabar Manager

Aplikasi pencatatan keuangan, bagi hasil 3:2, dompet pribadi, dan antrean party MLBB VIP.

- Frontend: Vite + React + Tailwind
- API & database: Netlify Function `/api/data` + Netlify Blobs (store `mlbb-db`, key `mlbb-live-db.json`)
- Hosting: https://mlbb-vip-manager.netlify.app

## PENTING: hemat kredit Netlify (paket Free = 300 kredit/bulan, batas keras)

Jika kredit habis, **semua situs di akun Netlify berhenti** sampai periode berikutnya. Karena itu:

- **Situs ini TIDAK terhubung ke GitHub.** Push ke GitHub tidak men-deploy apa pun.
- Setiap deploy produksi = **15 kredit**. Deploy hanya saat perlu: `npm run deploy:netlify`.
  (Deploy draf/preview gratis: `netlify deploy --dir=dist --functions=netlify/functions --no-build` tanpa `--prod`.)
- Klien tidak melakukan polling. Penyimpanan ke cloud digabung (debounce 20 dtk, maks 3 mnt), dilewati bila
  isinya sama, dan dibatasi 40 upload / 120 baca per jam (lihat `src/utils/cloudSync.js`).
- Server menolak penulisan beruntun < 2 dtk, membatasi payload 1 MB, dan menyimpan snapshot harian (14 hari
  terakhir) di `backups/` dalam store yang sama (lihat `netlify/lib/dbHandler.mjs`).
- Function dibatasi 60 request/menit per IP (`netlify/functions/data.mjs`).

## Sinkron antar perangkat (aman dipakai dari beberapa perangkat)

- Server menyimpan nomor revisi (`rev`). Setiap simpanan membawa `baseRev` (revisi yang menjadi dasar datanya).
  Jika perangkat lain sudah menulis, server **menggabungkan** data (bukan menimpa): order digabung per id lewat
  `updatedAt`, penghapusan dicatat sebagai tombstone, room dibangun ulang dari order, match/payout digabung per id,
  saldo dompet dihitung ulang dari riwayat transaksi. Logikanya ada di `netlify/lib/merge.mjs`.
- Reset, bersihkan riwayat, dan restore backup adalah penimpaan yang disengaja (`force`); snapshot harian di server
  menyimpan versi sebelumnya. `historyClearedAt` mencegah perangkat basi menghidupkan kembali riwayat yang dibersihkan.
- Perubahan lokal yang belum terkirim ditandai `dirty` (bertahan walau halaman ditutup) dan dikirim saat dibuka lagi.

## Aturan uang

- Kas berjalan = `amountPaid - settledAmount` per order. Bagi hasil menetapkan `settledAmount = amountPaid`, sehingga
  top up / pelunasan setelahnya otomatis masuk kas berikutnya (`src/utils/settlement.js`).
- Match: kuota semua akun di room dipotong 1. Akun berkuota 0 yang masih di room tidak dipotong tetapi ditandai
  "di luar kuota" di riwayat (`src/utils/matchLogic.js`).
- Tarif: Standar (7k / paket 5 = 30k), Glory (10k per match), Gratis, Custom (`src/utils/pricing.js`).
- Pengeluaran dompet yang melebihi saldo ditolak. Hapus order bisa diurungkan 8 detik dan memperingatkan uang
  yang belum dibagi.

## Pengembangan

```bash
npm install
npm run dev      # frontend saja
npm test         # tes API database (store palsu)
npm run build
```

## Cadangan database

Snapshot harian ada di store Blobs (`backups/YYYY-MM-DD.json`). Untuk mengunduh isi saat ini:
`GET https://mlbb-vip-manager.netlify.app/api/data`.
