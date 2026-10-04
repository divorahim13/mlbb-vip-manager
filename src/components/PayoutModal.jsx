import React, { useState } from 'react';
import { Scale, Coins, Check, AlertCircle, ArrowRight, Wallet } from 'lucide-react';
import { formatRupiah } from '../utils/pricing';

function PayoutModal({
  isOpen,
  onClose,
  unsettledRevenue = 0,
  unsettledOrderCount = 0,
  onConfirmPayout
}) {
  if (!isOpen) return null;

  const [ratioAdmin, setRatioAdmin] = useState(3);
  const [ratioPartner, setRatioPartner] = useState(2);
  const [addToWallet, setAddToWallet] = useState(true);
  const [note, setNote] = useState('');

  const totalParts = Math.max(1, (Number(ratioAdmin) || 1) + (Number(ratioPartner) || 1));
  const myShare = Math.round((unsettledRevenue * (Number(ratioAdmin) || 1)) / totalParts);
  const friendShare = unsettledRevenue - myShare;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (unsettledRevenue <= 0) return;

    onConfirmPayout({
      ratioAdmin: Number(ratioAdmin) || 3,
      ratioPartner: Number(ratioPartner) || 2,
      myShare,
      friendShare,
      totalAmount: unsettledRevenue,
      addToWallet,
      note: note.trim() || `Bagi hasil ${ratioAdmin}:${ratioPartner} (Admin: ${formatRupiah(myShare)}, Teman: ${formatRupiah(friendShare)})`
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 overflow-y-auto gpu-layer">
      <div className="bg-slate-900 border border-amber-500/40 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl relative my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white">Bagi Hasil Kas Berjalan</h3>
              <p className="text-[11px] text-slate-400">Tarik dan bagi keuntungan party ke teman, saldo kas kembali ke Rp 0</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xl font-bold p-1"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Amount to distribute */}
          <div className="bg-slate-950 border border-amber-500/30 rounded-xl p-4 text-center">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Total Uang Kas yang Siap Dibagi ({unsettledOrderCount} Pesanan)
            </div>
            <div className="text-2xl font-black text-amber-400 mt-1">
              {formatRupiah(unsettledRevenue)}
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Setelah konfirmasi, kas berjalan ini akan di-reset menjadi <strong>Rp 0</strong>.
            </p>
          </div>

          {/* Ratio Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Rasio Pembagian (Default 3 : 2)
            </label>
            <div className="grid grid-cols-2 gap-3 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <div>
                <span className="text-[10px] font-bold text-amber-400 block mb-1">👑 Jatah Saya (Admin)</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={ratioAdmin}
                    onChange={(e) => setRatioAdmin(Number(e.target.value) || 1)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg py-1 px-2 text-center text-sm font-black text-white"
                  />
                  <span className="text-xs text-slate-400 font-bold">Bagian</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-blue-400 block mb-1">⚡ Jatah Teman (Partner)</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={ratioPartner}
                    onChange={(e) => setRatioPartner(Number(e.target.value) || 1)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg py-1 px-2 text-center text-sm font-black text-white"
                  />
                  <span className="text-xs text-slate-400 font-bold">Bagian</span>
                </div>
              </div>
            </div>
          </div>

          {/* Split Calculation Result */}
          <div className="space-y-2">
            <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/40 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-black text-amber-300 flex items-center gap-1">
                  <span>👑 Jatah Saya ({Math.round((ratioAdmin / totalParts) * 100)}%)</span>
                </div>
                <div className="text-[10px] text-slate-400">Bagian Admin / Pilot Gold</div>
              </div>
              <div className="text-base font-black text-amber-400">
                {formatRupiah(myShare)}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-blue-950/20 border border-blue-500/40 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-black text-blue-300 flex items-center gap-1">
                  <span>⚡ Jatah Teman ({Math.round((ratioPartner / totalParts) * 100)}%)</span>
                </div>
                <div className="text-[10px] text-slate-400">Bagian Partner / Pilot Jungle</div>
              </div>
              <div className="text-base font-black text-blue-400">
                {formatRupiah(friendShare)}
              </div>
            </div>
          </div>

          {/* Option: Add to My Wallet */}
          <label className="flex items-center gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={addToWallet}
              onChange={(e) => setAddToWallet(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-400 bg-slate-900 border-slate-700"
            />
            <div className="text-xs">
              <span className="font-bold text-white block">
                Otomatis Masukkan Jatah Saya ({formatRupiah(myShare)}) ke Dompet Saya
              </span>
              <span className="text-[10px] text-slate-400 block">
                Saldo dompet pribadi Anda akan bertambah secara otomatis
              </span>
            </div>
          </label>

          {/* Note */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Catatan Bagi Hasil (Opsional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Contoh: Bagi hasil match malam ini via transfer BCA"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={unsettledRevenue <= 0}
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-30 disabled:cursor-not-allowed text-slate-950 font-black px-5 py-2.5 rounded-xl text-xs transition-transform active:scale-95 shadow-sm"
            >
              💰 Selesaikan & Reset Kas ke Rp 0
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default React.memo(PayoutModal);
