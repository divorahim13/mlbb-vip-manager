import React, { useState, useEffect } from 'react';
import { calculatePricing, formatRupiah, RATE_SINGLE, RATE_BUNDLE_5, BUNDLE_SIZE } from '../utils/pricing';
import { Crown, Sparkles, Check, DollarSign, Smartphone, User, Swords, ShieldCheck, Tag, Info } from 'lucide-react';
import { ROLE_DETAILS } from './RoomParty';

const PAYMENT_METHODS = [
  'DANA',
  'GoPay',
  'OVO',
  'ShopeePay',
  'QRIS',
  'BCA',
  'Mandiri',
  'BRI',
  'BNI',
  'Cash / Tunai'
];

// VIP Roles ONLY: Mid Lane (Myth), Roamer (Room), Exp Lane (Exp), or Any
export const VIP_ROLES = [
  { value: 'Mid Lane', label: 'Mid Lane (Myth)', icon: '🔮' },
  { value: 'Roamer', label: 'Roamer (Room)', icon: '❤️' },
  { value: 'Exp Lane', label: 'Exp Lane (Exp)', icon: '🛡️' },
  { value: 'Any', label: 'Bebas (Mid / Roam / Exp)', icon: '🎮' }
];

export default function OrderModal({ isOpen, onClose, onSave, hasEmptySlot }) {
  const [username, setUsername] = useState('');
  const [userId, setUserId] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('Mid Lane');
  const [matches, setMatches] = useState(5);
  const [paymentMethod, setPaymentMethod] = useState('DANA');
  const [amountPaid, setAmountPaid] = useState('');
  const [transferNote, setTransferNote] = useState('');
  const [directToRoom, setDirectToRoom] = useState(hasEmptySlot);

  // Pricing calculation
  const pricing = calculatePricing(matches);

  // Auto update amountPaid when matches changes (default to Lunas)
  useEffect(() => {
    setAmountPaid(pricing.total.toString());
  }, [pricing.total]);

  if (!isOpen) return null;

  const handleMatchSelect = (num) => {
    setMatches(num);
  };

  const currentPaid = Number(amountPaid) || 0;
  let paymentStatus = 'LUNAS';
  if (currentPaid === 0) {
    paymentStatus = 'BELUM_BAYAR';
  } else if (currentPaid < pricing.total) {
    paymentStatus = 'DP';
  } else {
    paymentStatus = 'LUNAS';
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!username.trim()) {
      alert('Mohon isi Username / IGN MLBB');
      return;
    }

    const orderData = {
      username: username.trim(),
      userId: userId.trim(),
      phone: phone.trim(),
      role,
      matchesOrdered: pricing.count,
      matchesRemaining: pricing.count,
      priceTotal: pricing.total,
      amountPaid: currentPaid,
      paymentMethod,
      paymentStatus,
      transferNote: transferNote.trim(),
      directToRoom: directToRoom && hasEmptySlot
    };

    onSave(orderData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-amber-500/40 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl relative my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Crown className="w-4 h-4 fill-current" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">Order Mabar VIP Baru</h3>
              <p className="text-[11px] text-slate-400">Pencatatan data transfer & paket match VIP</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xl font-bold p-1"
          >
            ✕
          </button>
        </div>

        {/* Info Banner: Role Pilot vs VIP */}
        <div className="mt-3.5 bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 text-xs flex items-start gap-2.5">
          <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <div className="text-slate-300 text-[11px]">
            <span className="font-bold text-blue-300">Struktur Party Mabar VIP:</span> Role <strong>Gold Lane 🏹 & Jungler ⚡</strong> dimainkan tim Pilot (mainin akun). Slot berbayar VIP hanya untuk <strong className="text-amber-300">Mid Lane (Myth)</strong>, <strong className="text-amber-300">Roamer (Room)</strong>, dan <strong className="text-amber-300">Exp Lane (Exp)</strong>.
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Section: Player MLBB Info */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Username / IGN MLBB <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Masukkan Nickname MLBB"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  ID & Server MLBB (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: 12345678 (2021)"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Nomor WhatsApp (Opsional)
                </label>
                <input
                  type="tel"
                  placeholder="08123456789"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Pilihan Role VIP <span className="text-amber-400">*</span>
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                >
                  {VIP_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.icon} {r.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section: Match Calculator with Kelipatan Rules */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" /> Pilih Paket Match & Hitung Harga
              </label>
              <span className="text-[10px] text-slate-400 font-semibold">
                Rp 7.000/match • Tiap 5 match = Rp 30.000 (Rp 6.000/match)
              </span>
            </div>

            {/* Match Quick Preset Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => handleMatchSelect(1)}
                className={`py-2 px-2.5 rounded-lg text-xs font-bold border transition-all text-center ${
                  matches === 1
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-glow-gold'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div>1 Match</div>
                <div className="text-[10px] font-normal opacity-80">Rp 7.000</div>
              </button>

              <button
                type="button"
                onClick={() => handleMatchSelect(3)}
                className={`py-2 px-2.5 rounded-lg text-xs font-bold border transition-all text-center ${
                  matches === 3
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-glow-gold'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div>3 Match</div>
                <div className="text-[10px] font-normal opacity-80">Rp 21.000</div>
              </button>

              <button
                type="button"
                onClick={() => handleMatchSelect(5)}
                className={`py-2 px-2.5 rounded-lg text-xs font-bold border transition-all text-center relative ${
                  matches === 5
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-glow-gold'
                    : 'bg-slate-900 border-amber-500/40 text-amber-300 hover:border-amber-400'
                }`}
              >
                <span className="absolute -top-2 right-1 text-[8px] bg-red-600 text-white font-black px-1 rounded-full uppercase">
                  Hemat 5k
                </span>
                <div>5 Match ⭐</div>
                <div className="text-[10px] font-normal opacity-90">Rp 30.000</div>
              </button>

              <button
                type="button"
                onClick={() => handleMatchSelect(10)}
                className={`py-2 px-2.5 rounded-lg text-xs font-bold border transition-all text-center relative ${
                  matches === 10
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-glow-gold'
                    : 'bg-slate-900 border-amber-500/40 text-amber-300 hover:border-amber-400'
                }`}
              >
                <span className="absolute -top-2 right-1 text-[8px] bg-red-600 text-white font-black px-1 rounded-full uppercase">
                  Hemat 10k
                </span>
                <div>10 Match 👑</div>
                <div className="text-[10px] font-normal opacity-90">Rp 60.000</div>
              </button>
            </div>

            {/* Custom Match Input */}
            <div className="flex items-center gap-3 pt-1">
              <span className="text-xs text-slate-400 whitespace-nowrap">Atau Jumlah Custom:</span>
              <input
                type="number"
                min="1"
                max="100"
                value={matches}
                onChange={(e) => setMatches(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-20 bg-slate-900 border border-slate-700 text-amber-400 font-extrabold text-sm px-2.5 py-1 rounded text-center focus:outline-none"
              />
              <span className="text-xs text-slate-400">Match</span>
            </div>

            {/* Formula Breakdown & Price Result Box */}
            <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-3 text-xs space-y-1.5">
              <div className="flex justify-between text-slate-300">
                <span>Rincian Paket ({matches} Match):</span>
                <span className="text-slate-400 font-mono">
                  {pricing.bundleCount > 0 && `${pricing.bundleCount}x Paket 5 (${formatRupiah(pricing.bundleTotal)}) `}
                  {pricing.remainder > 0 && `+ ${pricing.remainder}x Satuan (${formatRupiah(pricing.remainderTotal)})`}
                </span>
              </div>

              {pricing.savings > 0 && (
                <div className="flex justify-between text-emerald-400 font-semibold text-[11px]">
                  <span>🎉 Diskon Kelipatan 5:</span>
                  <span>Hemat {formatRupiah(pricing.savings)}</span>
                </div>
              )}

              <div className="flex justify-between items-center pt-2 border-t border-slate-800 text-sm font-black">
                <span className="text-white">TOTAL TAGIHAN:</span>
                <span className="text-base text-amber-400 font-extrabold">{formatRupiah(pricing.total)}</span>
              </div>
            </div>
          </div>

          {/* Section: Payment / Transfer Tracking */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Metode Transfer / Pembayaran
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                >
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Nominal Diterima (Rp)
                </label>
                <input
                  type="number"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  placeholder="0"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none"
                />
              </div>
            </div>

            {/* Note & Payment Status Badge */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Catatan Transfer (Atas Nama / No. Ref)
              </label>
              <input
                type="text"
                placeholder="Contoh: a/n Divo BCA jam 19.30"
                value={transferNote}
                onChange={(e) => setTransferNote(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none"
              />
            </div>

            {/* Payment Status Summary */}
            <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-xs">
              <span className="text-slate-400 font-semibold">Status Pembayaran:</span>
              <span
                className={`font-black px-2 py-0.5 rounded text-xs uppercase ${
                  paymentStatus === 'LUNAS'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : paymentStatus === 'DP'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                }`}
              >
                {paymentStatus} {paymentStatus === 'DP' && `(Kurang ${formatRupiah(pricing.total - currentPaid)})`}
              </span>
            </div>

            {/* Option to directly enter room if slot available */}
            {hasEmptySlot && (
              <label className="flex items-center gap-2.5 p-2 bg-slate-950/70 border border-slate-800 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={directToRoom}
                  onChange={(e) => setDirectToRoom(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 bg-slate-900 border-slate-700"
                />
                <span className="text-xs text-slate-300">
                  ⚡ <strong>Langsung masukkan ke Slot VIP kosong</strong> (Lewati antrean)
                </span>
              </label>
            )}
          </div>

          {/* Action buttons */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black px-5 py-2.5 rounded-xl text-xs sm:text-sm shadow-glow-gold transition-all transform active:scale-95"
            >
              Simpan & Daftarkan VIP
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
