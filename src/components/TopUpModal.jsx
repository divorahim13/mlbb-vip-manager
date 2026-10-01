import React, { useState } from 'react';
import { calculatePricing, formatRupiah } from '../utils/pricing';
import { PlusCircle, Sparkles, DollarSign } from 'lucide-react';

export default function TopUpModal({ isOpen, order, onClose, onConfirm }) {
  if (!isOpen || !order) return null;

  const [addMatches, setAddMatches] = useState(5);
  const [additionalPayment, setAdditionalPayment] = useState(30000);
  const [paymentMethod, setPaymentMethod] = useState(order.paymentMethod || 'DANA');

  // Pricing for the new additional matches
  const pricing = calculatePricing(addMatches);

  const handleMatchesChange = (num) => {
    setAddMatches(num);
    const p = calculatePricing(num);
    setAdditionalPayment(p.total);
  };

  const handleConfirm = (e) => {
    e.preventDefault();
    onConfirm({
      orderId: order.id,
      addMatches: pricing.count,
      additionalPrice: pricing.total,
      additionalPaid: Number(additionalPayment) || 0,
      paymentMethod
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-amber-500/40 rounded-2xl max-w-md w-full p-5 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <PlusCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Top Up Match VIP</h3>
              <p className="text-[11px] text-slate-400">Pemain: <strong className="text-amber-300">@{order.username}</strong></p>
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
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Tambah Berapa Match?
            </label>
            <div className="grid grid-cols-4 gap-2 mb-2">
              {[1, 3, 5, 10].map((num) => (
                <button
                  type="button"
                  key={num}
                  onClick={() => handleMatchesChange(num)}
                  className={`py-2 px-1 rounded-lg text-xs font-bold border transition-all text-center ${
                    addMatches === num
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-glow-gold'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  +{num} Match
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Custom:</span>
              <input
                type="number"
                min="1"
                max="50"
                value={addMatches}
                onChange={(e) => handleMatchesChange(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-20 bg-slate-950 border border-slate-700 text-amber-400 font-bold text-xs p-1.5 rounded text-center"
              />
              <span className="text-xs text-slate-400">Match</span>
            </div>
          </div>

          {/* Pricing detail */}
          <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl space-y-1 text-xs">
            <div className="flex justify-between text-slate-300">
              <span>Tambahan Biaya:</span>
              <span className="text-amber-400 font-bold">{formatRupiah(pricing.total)}</span>
            </div>
            {pricing.savings > 0 && (
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

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Nominal Transfer Diterima (Rp)
            </label>
            <input
              type="number"
              value={additionalPayment}
              onChange={(e) => setAdditionalPayment(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white font-mono"
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
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-glow-gold"
            >
              Konfirmasi Top Up
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
