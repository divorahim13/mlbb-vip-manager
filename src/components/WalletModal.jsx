import React, { useState } from 'react';
import { Wallet, X, ArrowUpRight, ArrowDownRight, Edit3, Plus, Minus, History, Check, DollarSign } from 'lucide-react';
import { formatRupiah } from '../utils/pricing';

function WalletModal({
  isOpen,
  onClose,
  myWallet = { balance: 0, history: [] },
  onUpdateBalance,
  onAddTransaction
}) {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState('adjust'); // 'adjust' | 'transaction' | 'history'
  
  // State for Adjust Balance
  const [newBalanceInput, setNewBalanceInput] = useState(myWallet.balance.toString());
  const [adjustNote, setAdjustNote] = useState('');

  // State for Add Transaction (Pemasukan / Pengeluaran)
  const [txType, setTxType] = useState('INCOME'); // 'INCOME' | 'EXPENSE'
  const [txAmount, setTxAmount] = useState('');
  const [txDescription, setTxDescription] = useState('');

  const handleAdjustSubmit = (e) => {
    e.preventDefault();
    const val = Number(newBalanceInput.replace(/[^0-9]/g, '')) || 0;
    onUpdateBalance(val, adjustNote.trim() || 'Penyesuaian saldo manual');
    onClose();
  };

  const handleTransactionSubmit = (e) => {
    e.preventDefault();
    const amt = Number(txAmount.replace(/[^0-9]/g, '')) || 0;
    if (amt <= 0) return;
    onAddTransaction({
      type: txType,
      amount: amt,
      description: txDescription.trim() || (txType === 'INCOME' ? 'Pemasukan pribadi' : 'Pengeluaran pribadi')
    });
    setTxAmount('');
    setTxDescription('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 overflow-y-auto gpu-layer">
      <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl relative my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white">Dompet Uang Saya</h3>
              <p className="text-[11px] text-slate-400">Catatan jumlah uang riil yang Anda miliki saat ini</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xl font-bold p-1"
          >
            ✕
          </button>
        </div>

        {/* Current Balance Card */}
        <div className="bg-slate-950 border border-emerald-500/30 rounded-xl p-4 my-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Saldo Uang Saya Sekarang</div>
            <div className="text-2xl font-black text-emerald-400 mt-0.5">
              {formatRupiah(myWallet.balance)}
            </div>
          </div>
          <div className="text-[10px] text-slate-500 text-right">
            <span>Hak Milik Saya</span>
            <div className="text-emerald-500 font-bold">100% Admin</div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold gap-1 mb-4">
          <button
            type="button"
            onClick={() => setActiveTab('adjust')}
            className={`flex-1 py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'adjust'
                ? 'bg-emerald-500 text-slate-950 font-black shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Ubah Saldo Riil</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('transaction')}
            className={`flex-1 py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'transaction'
                ? 'bg-emerald-500 text-slate-950 font-black shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Pemasukan / Pengeluaran</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-emerald-500 text-slate-950 font-black shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Riwayat Mutasi</span>
          </button>
        </div>

        {/* Tab 1: Adjust Balance */}
        {activeTab === 'adjust' && (
          <form onSubmit={handleAdjustSubmit} className="space-y-4">
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-xs text-slate-300">
              💡 Gunakan fitur ini jika Anda ingin langsung <strong>menyamakan angka saldo</strong> dengan uang fisik / saldo rekening yang Anda pegang saat ini.
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Jumlah Uang yang Saya Miliki Sekarang (Rp)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">Rp</span>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={newBalanceInput}
                  onChange={(e) => setNewBalanceInput(e.target.value)}
                  placeholder="655800"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 pl-10 pr-3 text-sm font-black text-white focus:outline-none focus:border-emerald-400"
                  required
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Terbaca: <strong className="text-emerald-400">{formatRupiah(Number(newBalanceInput) || 0)}</strong>
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Keterangan Penyesuaian (Opsional)
              </label>
              <input
                type="text"
                value={adjustNote}
                onChange={(e) => setAdjustNote(e.target.value)}
                placeholder="Contoh: Update saldo setelah belanja / cek rekening"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-emerald-400"
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
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-5 py-2 rounded-xl text-xs transition-transform active:scale-95 shadow-sm"
              >
                Simpan Saldo Baru
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Pemasukan / Pengeluaran Pribadi */}
        {activeTab === 'transaction' && (
          <form onSubmit={handleTransactionSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Jenis Transaksi
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTxType('INCOME')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                    txType === 'INCOME'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60 font-black'
                      : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  <ArrowDownRight className="w-4 h-4 text-emerald-400" />
                  <span>+ Pemasukan Pribadi</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTxType('EXPENSE')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                    txType === 'EXPENSE'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/60 font-black'
                      : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  <ArrowUpRight className="w-4 h-4 text-rose-400" />
                  <span>- Pengeluaran Pribadi</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Nominal {txType === 'INCOME' ? 'Pemasukan' : 'Pengeluaran'} (Rp)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">Rp</span>
                <input
                  type="number"
                  min="1000"
                  step="1000"
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  placeholder="50000"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 pl-10 pr-3 text-sm font-black text-white focus:outline-none focus:border-emerald-400"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Keterangan
              </label>
              <input
                type="text"
                value={txDescription}
                onChange={(e) => setTxDescription(e.target.value)}
                placeholder={txType === 'INCOME' ? 'Contoh: Bonus customer / tips' : 'Contoh: Beli kuota / jajan / diamond'}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-emerald-400"
                required
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
                className={`font-black px-5 py-2 rounded-xl text-xs transition-transform active:scale-95 shadow-sm text-slate-950 ${
                  txType === 'INCOME' ? 'bg-emerald-500 hover:bg-emerald-400' : 'bg-rose-500 hover:bg-rose-400'
                }`}
              >
                {txType === 'INCOME' ? '+ Simpan Pemasukan' : '- Simpan Pengeluaran'}
              </button>
            </div>
          </form>
        )}

        {/* Tab 3: History */}
        {activeTab === 'history' && (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {(!myWallet.history || myWallet.history.length === 0) ? (
              <p className="text-center py-8 text-xs text-slate-500">
                Belum ada riwayat mutasi dompet.
              </p>
            ) : (
              myWallet.history.map((h, idx) => {
                const isPlus = h.type === 'INCOME' || h.type === 'PAYOUT_SHARE' || (h.type === 'ADJUST' && h.amount >= 0);
                return (
                  <div
                    key={h.id || idx}
                    className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <span className={`text-[10px] font-black px-1.5 py-0.2 rounded ${
                          isPlus ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                        }`}>
                          {isPlus ? '+ MASUK' : '- KELUAR'}
                        </span>
                        <span>{h.description || 'Mutasi Dompet'}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(h.timestamp).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })} • Saldo: {formatRupiah(h.balanceAfter)}
                      </div>
                    </div>
                    <div className={`font-black text-sm shrink-0 ${isPlus ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isPlus ? '+' : '-'}{formatRupiah(Math.abs(h.amount))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(WalletModal);
