import React, { useState, useEffect } from 'react';
import { calculatePricing, formatRupiah } from '../utils/pricing';
import { Crown, Sparkles, Check, DollarSign, Smartphone, User, Swords, ShieldCheck, Tag, Info, Gamepad2, UserCheck, KeyRound } from 'lucide-react';

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

export const JOKI_ROLES = [
  { value: 'Gold Lane', label: 'Gold Lane 🏹 (Dimainin Saya)', icon: '🏹', pilot: 'Saya' },
  { value: 'Jungler', label: 'Jungler ⚡ (Dimainin Teman)', icon: '⚡', pilot: 'Teman' }
];

export const VIP_MABAR_ROLES = [
  { value: 'Mid Lane', label: 'Mid Lane (Myth) 🔮', icon: '🔮' },
  { value: 'Roamer', label: 'Roamer (Room) ❤️', icon: '❤️' },
  { value: 'Exp Lane', label: 'Exp Lane (Exp) 🛡️', icon: '🛡️' },
  { value: 'Any', label: 'Bebas (Mid / Roam / Exp) 🎮', icon: '🎮' }
];

export default function OrderModal({ isOpen, onClose, onSave, hasEmptySlot, defaultOrderType = 'VIP_MABAR' }) {
  const [orderType, setOrderType] = useState(defaultOrderType); // 'JOKI' | 'VIP_MABAR'
  const [username, setUsername] = useState('');
  const [userId, setUserId] = useState('');
  const [phone, setPhone] = useState('');
  const [accountLogin, setAccountLogin] = useState(''); // Catatan login untuk Joki Akun
  const [role, setRole] = useState(defaultOrderType === 'JOKI' ? 'Gold Lane' : 'Mid Lane');
  const [matches, setMatches] = useState(5);
  const [paymentMethod, setPaymentMethod] = useState('DANA');
  const [amountPaid, setAmountPaid] = useState('');
  const [transferNote, setTransferNote] = useState('');
  const [directToRoom, setDirectToRoom] = useState(hasEmptySlot);

  // Auto-switch default role when orderType changes
  useEffect(() => {
    if (orderType === 'JOKI') {
      if (role !== 'Gold Lane' && role !== 'Jungler') {
        setRole('Gold Lane');
      }
    } else {
      if (role === 'Gold Lane' || role === 'Jungler') {
        setRole('Mid Lane');
      }
    }
  }, [orderType]);

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
      alert('Mohon isi Username / IGN Akun Customer');
      return;
    }

    const orderData = {
      orderType, // 'JOKI' | 'VIP_MABAR'
      username: username.trim(),
      userId: userId.trim(),
      phone: phone.trim(),
      accountLogin: accountLogin.trim(),
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
              <h3 className="text-lg font-black text-white">Input Pesanan Customer</h3>
              <p className="text-[11px] text-slate-400">Pilih tipe: Joki Akun (Pilot) atau VIP Mabar (Main Sendiri)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xl font-bold p-1"
          >
            ✕
          </button>
        </div>

        {/* Tipe Layanan Selector: Joki Akun vs VIP Mabar */}
        <div className="mt-4 grid grid-cols-2 gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setOrderType('JOKI')}
            className={`py-2 px-3 rounded-lg text-xs font-black flex items-center justify-center gap-2 transition-all ${
              orderType === 'JOKI'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-glow-blue'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Gamepad2 className="w-4 h-4" />
            <span>🎮 Joki Akun (Dimainin Pilot)</span>
          </button>

          <button
            type="button"
            onClick={() => setOrderType('VIP_MABAR')}
            className={`py-2 px-3 rounded-lg text-xs font-black flex items-center justify-center gap-2 transition-all ${
              orderType === 'VIP_MABAR'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-glow-gold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Crown className="w-4 h-4" />
            <span>🌟 VIP Mabar (Main Sendiri)</span>
          </button>
        </div>

        {/* Info Banner per tipe */}
        <div className="mt-3">
          {orderType === 'JOKI' ? (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-2.5 text-xs text-blue-300 flex items-start gap-2">
              <Gamepad2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div className="text-[11px]">
                <strong className="text-white">Akun Customer Dijokiin:</strong> Akun ini akan dimainkan langsung oleh Anda (<strong>Gold Lane 🏹</strong>) atau teman Anda (<strong>Jungler ⚡</strong>).
              </div>
            </div>
          ) : (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5 text-xs text-amber-300 flex items-start gap-2">
              <Crown className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-[11px]">
                <strong className="text-white">Customer Ikut Main Bareng:</strong> Customer login ke akunnya sendiri dan mengisi slot <strong>Mid Lane (Myth)</strong>, <strong>Roamer (Room)</strong>, atau <strong>Exp Lane (Exp)</strong>.
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="mt-3.5 space-y-4">
          {/* Section: Player / Customer Info */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  IGN / Nickname Akun Customer <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Nickname Game"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Pilihan Role / Slot <span className="text-amber-400">*</span>
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                >
                  {orderType === 'JOKI' ? (
                    JOKI_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))
                  ) : (
                    VIP_MABAR_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Nomor WhatsApp Customer
                </label>
                <input
                  type="tel"
                  placeholder="08123456789"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none"
                />
              </div>
            </div>

            {/* Login Note khusus untuk Joki Akun */}
            {orderType === 'JOKI' && (
              <div>
                <label className="block text-xs font-bold text-blue-300 mb-1 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5" /> Catatan Akun / Data Login Joki (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Akun Moonton / Login VK / Request Hero Fanny"
                  value={accountLogin}
                  onChange={(e) => setAccountLogin(e.target.value)}
                  className="w-full bg-slate-950 border border-blue-500/40 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none"
                />
              </div>
            )}
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
                  ⚡ <strong>Langsung masukkan ke Slot Room kosong</strong> (Lewati antrean)
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
              Simpan & Daftarkan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
