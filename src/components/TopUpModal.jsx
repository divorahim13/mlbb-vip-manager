import React, { useState, useEffect } from 'react';
import { calculatePricing, formatRupiah, isGloryOrder, RATE_GLORY } from '../utils/pricing';
import { PlusCircle, Sparkles, DollarSign, Heart, Tag, Plus, Minus } from 'lucide-react';

function TopUpModal({ isOpen, order, onClose, onConfirm }) {
  if (!isOpen || !order) return null;

  const [addMatches, setAddMatches] = useState(5);
  const [isGloryTopUp, setIsGloryTopUp] = useState(isGloryOrder(order));
  const [isFreeTopUp, setIsFreeTopUp] = useState(order.isFree || order.paymentStatus === 'GRATIS');
  const [additionalPayment, setAdditionalPayment] = useState(30000);
  const [paymentMethod, setPaymentMethod] = useState(
    order.isFree || order.paymentStatus === 'GRATIS' ? '🎁 Khusus Pacar / Gratis' : (order.paymentMethod || 'DANA')
  );

  // Pricing for the new additional matches
  const pricing = calculatePricing(addMatches, null, isFreeTopUp, isGloryTopUp ? 'GLORY' : 'STANDARD');

  useEffect(() => {
    if (isFreeTopUp) {
      setAdditionalPayment(0);
      setPaymentMethod('🎁 Khusus Pacar / Gratis');
    } else {
      setAdditionalPayment(pricing.total);
      if (paymentMethod === '🎁 Khusus Pacar / Gratis') {
        setPaymentMethod(order.paymentMethod || 'DANA');
      }
    }
  }, [isFreeTopUp, isGloryTopUp, pricing.total]);

  const handleMatchChange = (delta) => {
    setAddMatches(prev => Math.max(1, prev + delta));
  };

  const handleConfirm = (e) => {
    e.preventDefault();
    onConfirm({
      orderId: order.id,
      addMatches: pricing.count,
      additionalPrice: isFreeTopUp ? 0 : pricing.total,
      additionalPaid: isFreeTopUp ? 0 : (Number(additionalPayment) || 0),
      paymentMethod,
      isFree: isFreeTopUp,
      tier: isGloryTopUp ? 'GLORY' : 'STANDARD'
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 gpu-layer">
      <div className="bg-slate-900 border border-amber-500/40 rounded-2xl max-w-md w-full p-5 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <PlusCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Top Up Match VIP & Joki</h3>
              <p className="text-[11px] text-slate-400">
                Pemain: <strong className="text-amber-300">@{order.username}</strong> ({order.orderType === 'JOKI' ? 'Joki ' + order.role : 'VIP ' + order.role})
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg font-bold">
            ✕
          </button>
        </div>

        <form onSubmit={handleConfirm} className="mt-4 space-y-4">
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs flex justify-between items-center">
            <span className="text-slate-400">Sisa Match Saat Ini:</span>
            <span className="font-extrabold text-amber-400 text-sm">
              {order.matchesRemaining} Match
            </span>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-300">
                Tambah Berapa Match? (Bebas Diisi)
              </label>
              <span className="text-[10px] text-slate-400">Ketik bebas</span>
            </div>

            {/* Free Match Direct Input with Step Buttons */}
            <div className="flex items-center gap-2 mb-2">
              <button
                type="button"
                onClick={() => handleMatchChange(-1)}
                className="w-8 h-8 bg-slate-950 border border-slate-700 hover:border-amber-400 text-white rounded-lg flex items-center justify-center font-bold transition-colors"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>

              <div className="flex-1 relative">
                <input
                  type="number"
                  min="1"
                  value={addMatches}
                  onChange={(e) => setAddMatches(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full bg-slate-950 border border-amber-500/40 text-amber-300 font-extrabold text-base py-1.5 px-3 rounded-lg text-center focus:outline-none"
                />
                <span className="absolute right-3 top-2 text-xs text-slate-400 font-semibold pointer-events-none">
                  Match
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleMatchChange(1)}
                className="w-8 h-8 bg-slate-950 border border-slate-700 hover:border-amber-400 text-white rounded-lg flex items-center justify-center font-bold transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2 mb-2">
              {[1, 3, 5, 10].map((num) => (
                <button
                  type="button"
                  key={num}
                  onClick={() => setAddMatches(num)}
                  className={`py-1.5 px-1 rounded-lg text-xs font-bold border transition-all text-center ${
                    addMatches === num
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-extrabold shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  +{num} Match
                </button>
              ))}
            </div>
          </div>

          {/* Tarif Glory: Rp 10.000 / match, tanpa paket */}
          <div className="bg-violet-950/20 p-2.5 rounded-xl border border-violet-500/30">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isGloryTopUp}
                disabled={isFreeTopUp}
                onChange={(e) => setIsGloryTopUp(e.target.checked)}
                className="w-4 h-4 rounded text-violet-500 bg-slate-900 border-slate-700"
              />
              <span className="text-xs font-bold text-violet-300">
                👑 Tarif Glory ({formatRupiah(RATE_GLORY)} / match, tanpa paket)
              </span>
            </label>
          </div>

          {/* Special Toggle for Free / Pacar Top Up */}
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isFreeTopUp}
                onChange={(e) => setIsFreeTopUp(e.target.checked)}
                className="w-4 h-4 rounded text-pink-500 bg-slate-900 border-slate-700"
              />
              <span className="text-xs font-bold text-pink-300 flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5 fill-pink-500 text-pink-500" />
                <span>Top Up Gratis (Rp 0 - Khusus Pacar / Bonus)</span>
              </span>
            </label>
          </div>

          {/* Pricing detail */}
          {isFreeTopUp ? (
            <div className="bg-pink-950/30 border border-pink-500/40 p-3 rounded-xl space-y-1 text-xs">
              <div className="flex justify-between text-pink-300 font-bold">
                <span>Tambahan Biaya:</span>
                <span className="font-extrabold">Rp 0 (GRATIS 💖)</span>
              </div>
              <div className="flex justify-between text-slate-400 pt-1 border-t border-pink-500/20">
                <span>Total Match Baru:</span>
                <span className="text-white font-bold">{order.matchesRemaining + addMatches} Match</span>
              </div>
            </div>
          ) : (
            <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl space-y-1 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Tambahan Biaya:</span>
                <span className="text-amber-400 font-bold">{formatRupiah(pricing.total)}</span>
              </div>
              {pricing.savings > 0 && !isGloryTopUp && (
                <div className="flex justify-between text-emerald-400 text-[11px]">
                  <span>Hemat Diskon Kelipatan:</span>
                  <span>{formatRupiah(pricing.savings)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-400 pt-1 border-t border-slate-800">
                <span>Total Match Baru:</span>
                <span className="text-white font-bold">{order.matchesRemaining + pricing.count} Match</span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Nominal Transfer Diterima (Rp)
            </label>
            <input
              type="number"
              disabled={isFreeTopUp}
              value={additionalPayment}
              onChange={(e) => setAdditionalPayment(e.target.value)}
              className={`w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white font-mono ${
                isFreeTopUp ? 'opacity-50 cursor-not-allowed text-pink-300' : ''
              }`}
            />
          </div>

          <div className="pt-2 border-t border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
            >
              Batal
            </button>
            <button
              type="submit"
              className={`font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-md ${
                isFreeTopUp
                  ? 'bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-400 hover:to-rose-400 text-white shadow-pink-500/30'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-glow-gold'
              }`}
            >
              {isFreeTopUp ? '💖 Konfirmasi Top Up Gratis' : 'Konfirmasi Top Up'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default React.memo(TopUpModal);
