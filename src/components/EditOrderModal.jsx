import React, { useState, useEffect } from 'react';
import { calculatePricing, formatRupiah } from '../utils/pricing';
import { Edit3, User, Gamepad2, Crown, Tag, DollarSign, KeyRound, Phone, Heart, Check, Plus, Minus, X, AlertCircle } from 'lucide-react';
import { JOKI_ROLES, VIP_MABAR_ROLES } from './OrderModal';

const PAYMENT_METHODS = [
  '🎁 Khusus Pacar / Gratis',
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

function EditOrderModal({ isOpen, order, onClose, onSave }) {
  if (!isOpen || !order) return null;

  const [orderType, setOrderType] = useState(order.orderType || 'VIP_MABAR');
  const [username, setUsername] = useState(order.username || '');
  const [userId, setUserId] = useState(order.userId || '');
  const [phone, setPhone] = useState(order.phone || '');
  const [accountLogin, setAccountLogin] = useState(order.accountLogin || '');
  const [role, setRole] = useState(order.role || 'Mid Lane');
  const [matchesOrdered, setMatchesOrdered] = useState(order.matchesOrdered || 1);
  const [matchesRemaining, setMatchesRemaining] = useState(order.matchesRemaining || 0);
  const [priceTotal, setPriceTotal] = useState(order.priceTotal ?? 0);
  const [amountPaid, setAmountPaid] = useState(order.amountPaid ?? 0);
  const [paymentMethod, setPaymentMethod] = useState(order.paymentMethod || 'DANA');
  const [paymentStatus, setPaymentStatus] = useState(order.paymentStatus || 'LUNAS');
  const [transferNote, setTransferNote] = useState(order.transferNote || '');

  // Reset values whenever order prop changes
  useEffect(() => {
    if (order) {
      setOrderType(order.orderType || 'VIP_MABAR');
      setUsername(order.username || '');
      setUserId(order.userId || '');
      setPhone(order.phone || '');
      setAccountLogin(order.accountLogin || '');
      setRole(order.role || 'Mid Lane');
      setMatchesOrdered(order.matchesOrdered || 1);
      setMatchesRemaining(order.matchesRemaining ?? 0);
      setPriceTotal(order.priceTotal ?? 0);
      setAmountPaid(order.amountPaid ?? 0);
      setPaymentMethod(order.paymentMethod || 'DANA');
      setPaymentStatus(order.paymentStatus || 'LUNAS');
      setTransferNote(order.transferNote || '');
    }
  }, [order]);

  // Auto-switch role if orderType changes and current role is incompatible
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

  const handleMatchRemainingChange = (delta) => {
    setMatchesRemaining(prev => Math.max(0, prev + delta));
  };

  const handleRecalculateStandardPrice = () => {
    const p = calculatePricing(matchesOrdered);
    setPriceTotal(p.total);
    setAmountPaid(p.total);
    setPaymentStatus('LUNAS');
  };

  const handleSetFree = () => {
    setPriceTotal(0);
    setAmountPaid(0);
    setPaymentStatus('GRATIS');
    setPaymentMethod('🎁 Khusus Pacar / Gratis');
    if (!transferNote) {
      setTransferNote('💖 Khusus Pacar / Promo Gratis');
    }
  };

  const handleSetPaid = () => {
    setAmountPaid(priceTotal);
    setPaymentStatus('LUNAS');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!username.trim()) {
      alert('Nama / IGN customer tidak boleh kosong');
      return;
    }

    const updatedOrder = {
      ...order,
      orderType,
      username: username.trim(),
      userId: userId.trim(),
      phone: phone.trim(),
      accountLogin: accountLogin.trim(),
      role,
      matchesOrdered: Number(matchesOrdered) || 1,
      matchesRemaining: Number(matchesRemaining) || 0,
      priceTotal: Number(priceTotal) || 0,
      amountPaid: Number(amountPaid) || 0,
      paymentMethod,
      paymentStatus,
      isFree: paymentStatus === 'GRATIS' || Number(priceTotal) === 0,
      transferNote: transferNote.trim(),
      // Update status if matchesRemaining became 0 or was 0 and now > 0
      status: Number(matchesRemaining) <= 0 
        ? 'COMPLETED' 
        : (order.roomSlot ? 'IN_ROOM' : 'WAITING')
    };

    onSave(updatedOrder);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 overflow-y-auto gpu-layer">
      <div className="bg-slate-900 border border-blue-500/50 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl relative my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>Edit Data Customer</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  @{order.username}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">Ubah detail akun, sisa match, role, atau nominal pembayaran</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xl font-bold p-1"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Tipe Layanan Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Tipe Layanan:
            </label>
            <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setOrderType('JOKI')}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  orderType === 'JOKI'
                    ? 'bg-blue-600 text-white shadow-glow-blue'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Gamepad2 className="w-3.5 h-3.5" />
                <span>🎮 Joki Akun</span>
              </button>

              <button
                type="button"
                onClick={() => setOrderType('VIP_MABAR')}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  orderType === 'VIP_MABAR'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-glow-gold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Crown className="w-3.5 h-3.5" />
                <span>🌟 VIP Mabar</span>
              </button>
            </div>
          </div>

          {/* Player Info Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                IGN / Nickname <span className="text-amber-400">*</span>
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-blue-400 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Role / Slot <span className="text-amber-400">*</span>
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-blue-400 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
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
                ID & Server MLBB
              </label>
              <input
                type="text"
                placeholder="12345678 (2021)"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-blue-400 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                WhatsApp Customer
              </label>
              <input
                type="tel"
                placeholder="08123456789"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-blue-400 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
              />
            </div>
          </div>

          {orderType === 'JOKI' && (
            <div>
              <label className="block text-xs font-bold text-blue-300 mb-1 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5" /> Catatan Login / Akun Joki
              </label>
              <input
                type="text"
                placeholder="Data login / hero request"
                value={accountLogin}
                onChange={(e) => setAccountLogin(e.target.value)}
                className="w-full bg-slate-950 border border-blue-500/40 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
              />
            </div>
          )}

          {/* Match Quota Controls */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" /> Edit Kuota Match
              </label>
              <span className="text-[10px] text-slate-400">
                Ubah sisa match atau total pesanan
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Sisa Match (Remaining) */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Sisa Match Saat Ini:
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleMatchRemainingChange(-1)}
                    className="w-8 h-8 bg-slate-900 border border-slate-700 hover:border-amber-400 text-white rounded-lg flex items-center justify-center font-bold text-sm transition-colors"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="number"
                    min="0"
                    value={matchesRemaining}
                    onChange={(e) => setMatchesRemaining(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full bg-slate-900 border border-amber-500/50 text-amber-400 font-black text-center text-sm py-1.5 rounded-lg focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleMatchRemainingChange(1)}
                    className="w-8 h-8 bg-slate-900 border border-slate-700 hover:border-amber-400 text-white rounded-lg flex items-center justify-center font-bold text-sm transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Total Match Ordered */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Total Match Dipesan:
                </label>
                <input
                  type="number"
                  min="1"
                  value={matchesOrdered}
                  onChange={(e) => setMatchesOrdered(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full bg-slate-900 border border-slate-700 focus:border-amber-400 text-white font-extrabold text-center text-sm py-1.5 rounded-lg focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Payment & Price Controls */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5" /> Edit Biaya & Pembayaran
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleSetFree}
                  className="text-[10px] font-bold px-2 py-0.5 rounded bg-pink-950/50 hover:bg-pink-900/60 text-pink-300 border border-pink-500/30 flex items-center gap-1"
                >
                  <Heart className="w-2.5 h-2.5 fill-current" />
                  <span>Set Gratis</span>
                </button>
                <button
                  type="button"
                  onClick={handleSetPaid}
                  className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-500/30"
                >
                  Set Lunas
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Total Tagihan (Rp):
                </label>
                <input
                  type="number"
                  min="0"
                  value={priceTotal}
                  onChange={(e) => setPriceTotal(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-400 text-white font-mono text-xs py-1.5 px-2.5 rounded-lg focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Nominal Diterima (Rp):
                </label>
                <input
                  type="number"
                  min="0"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-400 text-emerald-400 font-mono text-xs py-1.5 px-2.5 rounded-lg focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Status Pembayaran:
                </label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-400 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                >
                  <option value="LUNAS">LUNAS</option>
                  <option value="GRATIS">💖 GRATIS / PACAR</option>
                  <option value="DP">DP (Kurang Bayar)</option>
                  <option value="BELUM_BAYAR">BELUM BAYAR</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Metode Pembayaran:
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-400 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                Catatan Transfer:
              </label>
              <input
                type="text"
                placeholder="Catatan rekening, promo, atau atas nama transfer"
                value={transferNote}
                onChange={(e) => setTransferNote(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-400 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
              />
            </div>
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
              className="bg-blue-600 hover:bg-blue-500 text-white font-black px-5 py-2.5 rounded-xl text-xs sm:text-sm shadow-glow-blue transition-all transform active:scale-95 flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Simpan Perubahan</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default React.memo(EditOrderModal);
