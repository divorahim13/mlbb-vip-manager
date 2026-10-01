# 👑 MLBB VIP MABAR - Pencatatan Keuangan & Antrean Party

Aplikasi web modern, ringan, dan cepat khusus untuk manajemen antrean dan pembukuan keuangan mabar VIP Mobile Legends: Bang Bang (MLBB).

![MLBB VIP Mabar Banner](https://img.shields.io/badge/MLBB-VIP_Party_Manager-amber?style=for-the-badge&logo=shield)
![Vite](https://img.shields.io/badge/Vite-Fast-blue?style=for-the-badge&logo=vite)
![React](https://img.shields.io/badge/React-18-cyan?style=for-the-badge&logo=react)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-Cyber_Gamer-teal?style=for-the-badge&logo=tailwindcss)

---

## ⚡ Fitur Utama

### 1. 💰 Perhitungan Tarif Otomatis & Kelipatan (Smart Pricing)
- **Tarif Satuan:** Rp 7.000 / match
- **Tarif Paket Hemat (Kelipatan 5):** Rp 30.000 per 5 match (Rp 6.000 / match)
- **Formula Otomatis:**
  `Total = Math.floor(n / 5) * 30000 + (n % 5) * 7000`
  *Contoh:*
  - 1 Match: Rp 7.000
  - 5 Match: Rp 30.000 (Hemat Rp 5.000)
  - 6 Match: Rp 37.000 (1 paket 5 + 1 satuan)
  - 10 Match: Rp 60.000 (Hemat Rp 10.000)
- Menampilkan rincian hemat diskon dan status bayar (LUNAS, DP, BELUM BAYAR).

### 2. 🎮 Live Room 5v5 & Manajemen Slot
- Tampilan formasi lobby party Mobile Legends (1 Host / Carry + 4 Slot VIP).
- Visual progress sisa match tiap pemain secara real-time.
- Tombol **Selesaikan 1 Match (VICTORY 🏆)** dan **(DEFEAT 💀)** dengan sound feedback synth.
- Otomatis mengurangi kuota match semua VIP yang ada di room.
- Notifikasi instan saat kuota match pemain habis beserta tombol **Top Up** atau **Auto-Rotate (Panggil Antrean #1)**.

### 3. ⏳ Antrean Menunggu Terstruktur (Waiting Queue)
- Urutan antrean otomatis FIFO (First In First Out) dengan badge prioritas (#1, #2, dst).
- Tombol atur prioritas antrean (Naikkan / Turunkan urutan).
- Quick Action: Panggil masuk room, edit/top up, lunasi DP, dan hapus.

### 4. 📲 Salin Format WhatsApp 1-Klik
- Tombol khusus untuk mengekspor status room, sisa match, daftar antrean, dan daftar harga ke dalam format chat WhatsApp yang rapi dan siap dikirim ke grup mabar!

### 5. 📊 Buku Kas & Laporan Finansial
- Total omzet riil diterima, sisa piutang/DP, dan total match terjual.
- Distribusi pemasukan berdasarkan saluran pembayaran (DANA, BCA, Mandiri, BRI, GoPay, QRIS, dll).
- Tabel pembukuan lengkap dengan filter pencarian dan status pembayaran.
- Ekspor laporan ke **Excel / CSV** dan backup/restore JSON.

### 6. 🏆 Riwayat Match & Winrate Tracker
- Catatan hasil pertandingan, durasi, partisipan VIP, MVP, dan kalkulasi Win Rate tim.

---

## 🚀 Cara Menjalankan Secara Lokal

```bash
# Clone repository
git clone https://github.com/divorahim13/mlbb-vip-manager.git

# Masuk direktori
cd mlbb-vip-manager

# Install dependensi
npm install

# Jalankan server development
npm run dev
```

Buka `http://localhost:5173` di browser Anda.

---

## 🛠️ Tech Stack
- **Framework:** React + Vite
- **Styling:** Tailwind CSS (Dark Gamer Theme)
- **Icons:** Lucide React
- **Audio:** Native Web Audio API (Zero external assets)
- **Storage:** Browser LocalStorage Sync (Otomatis tersimpan & offline ready)
- **Deployment:** Vercel
