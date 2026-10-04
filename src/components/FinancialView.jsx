import React, { useState, useMemo } from 'react';
import { formatRupiah } from '../utils/pricing';
import {
  DollarSign,
  Search,
  Filter,
  Download,
  Upload,
  CheckCircle,
  AlertTriangle,
  FileSpreadsheet,
  Trash2,
  PlusCircle,
  CreditCard,
  Inbox,
  Gamepad2,
  Heart,
  Edit3,
  Wallet,
  Scale,
  Coins,
  History,
  CheckCheck,
  ArrowRight,
  TrendingUp,
  UserCheck
} from 'lucide-react';

function FinancialView({
  orders = [],
  payouts = [],
  myWallet = { balance: 0, history: [] },
  settledOrderIds = [],
  unsettledRevenue = 0,
  unsettledOrderCount = 0,
  onOpenWalletModal,
  onOpenPayoutModal,
  onMarkPaid,
  onTopUpOrder,
  onEditOrder,
  onDeleteOrder,
  onExportCSV,
  onExportJSON,
  onImportJSON,
  onOpenNewOrder
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL'); // 'ALL' | 'JOKI' | 'VIP_MABAR'
  const [payoutFilter, setPayoutFilter] = useState('ALL'); // 'ALL' | 'SETTLED' | 'UNSETTLED'
  const [showPayoutHistory, setShowPayoutHistory] = useState(true);

  const settledSet = useMemo(() => new Set(settledOrderIds || []), [settledOrderIds]);

  // Single-pass financial calculations (O(N))
  const {
    totalRevenue,
    totalBilled,
    totalOutstanding,
    totalMatchesOrdered,
    jokiRevenue,
    vipRevenue,
    freeOrdersCount,
    methodBreakdown
  } = useMemo(() => {
    let rev = 0;
    let billed = 0;
    let out = 0;
    let matches = 0;
    let jokiRev = 0;
    let vipRev = 0;
    let freeCount = 0;
    const methods = {};

    for (let i = 0; i < orders.length; i++) {
      const o = orders[i];
      const paid = Number(o.amountPaid) || 0;
      const price = Number(o.priceTotal) || 0;
      const isFree = o.paymentStatus === 'GRATIS' || o.isFree;
      const isJoki = o.orderType === 'JOKI';

      rev += paid;
      billed += price;
      if (!isFree) {
        out += Math.max(0, price - paid);
      } else {
        freeCount++;
      }
      matches += Number(o.matchesOrdered) || 0;

      if (isJoki) {
        jokiRev += paid;
      } else {
        vipRev += paid;
      }

      const m = o.paymentMethod || 'Lainnya';
      if (!methods[m]) {
        methods[m] = { count: 0, amount: 0 };
      }
      methods[m].count++;
      methods[m].amount += paid;
    }

    return {
      totalRevenue: rev,
      totalBilled: billed,
      totalOutstanding: out,
      totalMatchesOrdered: matches,
      jokiRevenue: jokiRev,
      vipRevenue: vipRev,
      freeOrdersCount: freeCount,
      methodBreakdown: methods
    };
  }, [orders]);

  // Total accumulated payouts
  const { totalPayoutsAmount, totalMyPayoutShares, totalFriendPayoutShares } = useMemo(() => {
    let totalAmt = 0;
    let myShares = 0;
    let friendShares = 0;
    for (let i = 0; i < payouts.length; i++) {
      totalAmt += Number(payouts[i].totalAmount) || 0;
      myShares += Number(payouts[i].myShare) || 0;
      friendShares += Number(payouts[i].friendShare) || 0;
    }
    return {
      totalPayoutsAmount: totalAmt,
      totalMyPayoutShares: myShares,
      totalFriendPayoutShares: friendShares
    };
  }, [payouts]);

  const methodEntries = Object.entries(methodBreakdown);

  // Current unsettled simulation (3:2)
  const myShareEstimate = Math.round((unsettledRevenue * 3) / 5);
  const friendShareEstimate = unsettledRevenue - myShareEstimate;

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const matchSearch =
        o.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (o.transferNote && o.transferNote.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (o.userId && o.userId.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (o.accountLogin && o.accountLogin.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (o.phone && o.phone.includes(searchTerm));

      const matchStatus = statusFilter === 'ALL' || o.paymentStatus === statusFilter;
      const matchMethod = methodFilter === 'ALL' || o.paymentMethod === methodFilter;
      const matchType = typeFilter === 'ALL' || (typeFilter === 'JOKI' ? o.orderType === 'JOKI' : o.orderType !== 'JOKI');

      const isSettled = settledSet.has(o.id);
      const matchPayout =
        payoutFilter === 'ALL' ||
        (payoutFilter === 'SETTLED' ? isSettled : !isSettled);

      return matchSearch && matchStatus && matchMethod && matchType && matchPayout;
    });
  }, [orders, searchTerm, statusFilter, methodFilter, typeFilter, payoutFilter, settledSet]);

  return (
    <div className="space-y-6">
      {/* ============================================================== */}
      {/* SECTION 1: DOMPET UANG SAYA & KAS BAGI HASIL 3:2 (FITUR UTAMA) */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* KARTU 1: DOMPET UANG SAYA */}
        <div className="bg-slate-900/90 border-2 border-emerald-500/50 rounded-2xl p-4 sm:p-5 shadow-lg relative flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-400 text-xs font-black tracking-wide border border-emerald-500/40">
                <Wallet className="w-3.5 h-3.5" /> DOMPET UANG SAYA
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-emerald-300 border border-slate-700">
                👑 100% Milik Saya (Admin)
              </span>
            </div>

            <div className="mt-3">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Saldo Uang Saya Saat Ini
              </div>
              <div className="text-3xl font-black text-emerald-400 mt-0.5 tracking-tight">
                {formatRupiah(myWallet?.balance || 0)}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Catatan jumlah uang riil yang Anda miliki saat ini (termasuk jatah bagi hasil 3/5 bagian).
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap gap-2">
            <button
              onClick={onOpenWalletModal}
              className="flex-1 min-w-[120px] bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-3 py-2 rounded-xl text-xs transition-transform active:scale-95 shadow-sm text-center flex items-center justify-center gap-1"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Sesuaikan Saldo</span>
            </button>
            <button
              onClick={onOpenWalletModal}
              className="bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 font-bold px-3 py-2 rounded-xl text-xs transition-colors text-center flex items-center justify-center gap-1"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Mutasi Dompet ({myWallet?.history?.length || 0})</span>
            </button>
          </div>
        </div>

        {/* KARTU 2: KAS BERJALAN & BAGI HASIL (3 : 2) */}
        <div className="bg-slate-900/90 border-2 border-amber-500/50 rounded-2xl p-4 sm:p-5 shadow-lg relative flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-400 text-xs font-black tracking-wide border border-amber-500/40">
                <Scale className="w-3.5 h-3.5" /> BAGI HASIL KAS (RASIO 3 : 2)
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 border border-slate-700">
                60% Saya • 40% Teman
              </span>
            </div>

            <div className="mt-3">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Kas Berjalan (Belum Dibagi)</span>
                <span className="text-[10px] font-normal text-slate-500">{unsettledOrderCount} Pesanan Baru</span>
              </div>
              <div className="text-3xl font-black text-amber-400 mt-0.5 tracking-tight">
                {formatRupiah(unsettledRevenue)}
              </div>

              {unsettledRevenue === 0 ? (
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 mt-2 text-xs text-slate-400">
                  <span className="text-emerald-400 font-bold">✅ Kas Sudah Menjadi Rp 0.</span> Uang sebelumnya telah dibagi 3:2 ke teman. Pesanan customer baru selanjutnya akan masuk ke sini.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 mt-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-xs">
                  <div>
                    <div className="text-[10px] text-amber-400 font-bold">👑 Jatah Saya (60%):</div>
                    <div className="text-sm font-black text-white">{formatRupiah(myShareEstimate)}</div>
                  </div>
                  <div className="border-l border-slate-800 pl-2">
                    <div className="text-[10px] text-blue-400 font-bold">⚡ Jatah Teman (40%):</div>
                    <div className="text-sm font-black text-white">{formatRupiah(friendShareEstimate)}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center gap-2">
            <button
              onClick={onOpenPayoutModal}
              disabled={unsettledRevenue <= 0}
              className={`w-full py-2.5 px-3 rounded-xl text-xs font-black transition-transform active:scale-95 shadow-sm flex items-center justify-center gap-1.5 ${
                unsettledRevenue > 0
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 cursor-pointer'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/60'
              }`}
            >
              <Coins className="w-4 h-4" />
              <span>
                {unsettledRevenue > 0
                  ? `Bagi Hasil Sekarang & Tarik ke Rp 0`
                  : `Kas Sudah Bersih (Rp 0)`}
              </span>
            </button>
          </div>
        </div>

        {/* KARTU 3: AKUMULASI BAGI HASIL ALL-TIME */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-500/20 text-blue-300 text-xs font-black tracking-wide border border-blue-500/40">
                <TrendingUp className="w-3.5 h-3.5" /> REKAP BAGI HASIL ALL-TIME
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                {payouts.length} Kali Selesai
              </span>
            </div>

            <div className="mt-3 space-y-2.5">
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-bold">Total Uang yang Telah Dibagikan</div>
                <div className="text-lg font-black text-white">{formatRupiah(totalPayoutsAmount)}</div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-950 p-2 rounded-xl border border-amber-500/20">
                  <div className="text-[9px] text-amber-400 uppercase font-bold">Total Diterima Saya</div>
                  <div className="text-xs sm:text-sm font-black text-amber-300">{formatRupiah(totalMyPayoutShares)}</div>
                </div>
                <div className="bg-slate-950 p-2 rounded-xl border border-blue-500/20">
                  <div className="text-[9px] text-blue-400 uppercase font-bold">Total Diterima Teman</div>
                  <div className="text-xs sm:text-sm font-black text-blue-300">{formatRupiah(totalFriendPayoutShares)}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Omzet Masuk Sepanjang Masa:</span>
            <strong className="text-emerald-400 font-black">{formatRupiah(totalRevenue)}</strong>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* SECTION 2: RIWAYAT PEMBAGIAN HASIL (PAYOUT LOGS) */}
      {/* ============================================================== */}
      {payouts.length > 0 && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-400" />
              <h3 className="font-extrabold text-white text-base">Riwayat Selesai Bagi Hasil (3 : 2)</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-amber-300">
                {payouts.length} Riwayat
              </span>
            </div>
            <button
              onClick={() => setShowPayoutHistory(prev => !prev)}
              className="text-xs text-slate-400 hover:text-white"
            >
              {showPayoutHistory ? 'Sembunyikan' : 'Tampilkan'}
            </button>
          </div>

          {showPayoutHistory && (
            <div className="mt-3 space-y-2.5">
              {payouts.map((p, idx) => (
                <div
                  key={p.id || idx}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 font-black text-xs flex items-center justify-center shrink-0">
                      #{payouts.length - idx}
                    </div>
                    <div>
                      <div className="font-extrabold text-white flex items-center gap-2 flex-wrap">
                        <span>Total Bagi Hasil: {formatRupiah(p.totalAmount)}</span>
                        <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 rounded font-black">
                          Rasio {p.ratio || '3:2'}
                        </span>
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded">
                          SELESAI (Rp 0)
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {new Date(p.timestamp).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                        {p.note && ` • ${p.note}`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 bg-slate-900/90 px-3 py-1.5 rounded-lg border border-slate-800/80 shrink-0">
                    <div>
                      <div className="text-[10px] text-amber-400 font-bold">👑 Saya (3/5):</div>
                      <div className="text-xs font-black text-amber-300">{formatRupiah(p.myShare)}</div>
                    </div>
                    <div className="border-l border-slate-800 pl-3">
                      <div className="text-[10px] text-blue-400 font-bold">⚡ Teman (2/5):</div>
                      <div className="text-xs font-black text-blue-300">{formatRupiah(p.friendShare)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* SECTION 3: 4 FINANCIAL STAT CARDS (ALL-TIME) */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Omset */}
        <div className="bg-slate-900/90 border border-emerald-500/30 rounded-2xl p-4 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Omzet Masuk</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-400 mt-2">
            {formatRupiah(totalRevenue)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Joki: {formatRupiah(jokiRevenue)} • VIP: {formatRupiah(vipRevenue)}
          </p>
        </div>

        {/* Total Piutang */}
        <div className="bg-slate-900/90 border border-amber-500/30 rounded-2xl p-4 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Kurang Bayar (DP / Piutang)</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-400 mt-2">
            {formatRupiah(totalOutstanding)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Sisa tagihan yang belum lunas (Gratis Rp 0 tidak dihitung piutang)</p>
        </div>

        {/* Total Tagihan */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Nilai Pesanan</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white mt-2">
            {formatRupiah(totalBilled)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Akumulasi seluruh pesanan • {freeOrdersCount} Gratis/Pacar 💖
          </p>
        </div>

        {/* Total Match Terjual */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Match Terdaftar</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
              🎮
            </div>
          </div>
          <div className="text-2xl font-black text-purple-400 mt-2">
            {totalMatchesOrdered} Match
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Rata-rata: {totalMatchesOrdered > 0 ? formatRupiah(Math.round(totalRevenue / totalMatchesOrdered)) : 'Rp 0'}/match
          </p>
        </div>
      </div>

      {/* ============================================================== */}
      {/* SECTION 4: DISTRIBUSI SALURAN PEMBAYARAN & EXPORT */}
      {/* ============================================================== */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h3 className="font-extrabold text-white text-base">Distribusi Saluran Pembayaran</h3>
            <p className="text-xs text-slate-400">Pemasukan berdasarkan saluran transfer / bank / e-wallet</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {orders.length > 0 && (
              <>
                <button
                  onClick={onExportCSV}
                  className="flex items-center gap-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Download Excel/CSV</span>
                </button>
                <button
                  onClick={onExportJSON}
                  className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Backup</span>
                </button>
              </>
            )}
            <label className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>Restore</span>
              <input type="file" accept=".json" onChange={onImportJSON} className="hidden" />
            </label>
          </div>
        </div>

        {/* Breakdown chips */}
        {methodEntries.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 mt-3">
            {methodEntries.map(([method, data]) => {
              const isFreeMethod = method.includes('Pacar') || method.includes('Gratis');
              return (
                <div
                  key={method}
                  className={`p-2.5 rounded-xl border ${
                    isFreeMethod
                      ? 'bg-pink-950/30 border-pink-500/40 text-pink-300'
                      : 'bg-slate-950 border-slate-800'
                  }`}
                >
                  <div className="text-[11px] font-bold text-slate-400 truncate flex items-center gap-1">
                    {isFreeMethod && <Heart className="w-3 h-3 fill-pink-500 text-pink-500 shrink-0" />}
                    <span className="truncate">{method}</span>
                  </div>
                  <div className="text-xs font-black text-amber-400 mt-0.5">{formatRupiah(data.amount)}</div>
                  <div className="text-[10px] text-slate-400">{data.count} pesanan</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6 text-xs text-slate-500">
            Belum ada transaksi pembayaran masuk.
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* SECTION 5: BUKU KAS & RIWAYAT TRANSAKSI CUSTOMER */}
      {/* ============================================================== */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-lg font-black text-white">Buku Kas & Riwayat Transaksi</h3>
            <p className="text-xs text-slate-400">Daftar semua pembayaran pesanan Joki & VIP Mabar (dengan status Bagi Hasil)</p>
          </div>

          {/* Filters */}
          {orders.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {/* Search */}
              <div className="relative min-w-[170px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari user / akun / catatan..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none"
              >
                <option value="ALL">Semua Pembayaran</option>
                <option value="LUNAS">Lunas</option>
                <option value="DP">DP (Kurang)</option>
                <option value="BELUM_BAYAR">Belum Bayar</option>
                <option value="GRATIS">Gratis (Pacar)</option>
              </select>

              {/* Payout Status Filter */}
              <select
                value={payoutFilter}
                onChange={(e) => setPayoutFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none"
              >
                <option value="ALL">Semua Status Kas</option>
                <option value="UNSETTLED">Kas Berjalan (Belum Dibagi)</option>
                <option value="SETTLED">Sudah Dibagi Hasil 3:2</option>
              </select>

              {/* Type Filter */}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none"
              >
                <option value="ALL">Semua Tipe</option>
                <option value="JOKI">Joki Akun</option>
                <option value="VIP_MABAR">VIP Mabar</option>
              </select>
            </div>
          )}
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto mt-4 perf-contain">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 uppercase text-[10px] text-slate-400 tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-3">Tanggal</th>
                <th className="py-3 px-3">Customer</th>
                <th className="py-3 px-3">Kategori</th>
                <th className="py-3 px-3">Paket</th>
                <th className="py-3 px-3">Saluran</th>
                <th className="py-3 px-3">Status Bagi Hasil</th>
                <th className="py-3 px-3 text-right">Sudah Dibayar</th>
                <th className="py-3 px-3 text-right">Kurang</th>
                <th className="py-3 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500 italic">
                    Tidak ada transaksi yang cocok dengan filter.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((ord) => {
                  const underpaid = Math.max(0, (Number(ord.priceTotal) || 0) - (Number(ord.amountPaid) || 0));
                  const isJoki = ord.orderType === 'JOKI';
                  const isSettled = settledSet.has(ord.id);

                  return (
                    <tr key={ord.id} className="hover:bg-slate-950/50 transition-colors">
                      <td className="py-3 px-3 whitespace-nowrap text-slate-400">
                        {new Date(ord.createdAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-extrabold text-white flex items-center gap-1.5">
                          <span>{ord.username}</span>
                          {ord.paymentStatus === 'GRATIS' && (
                            <span className="text-[9px] bg-pink-500/20 text-pink-300 border border-pink-500/40 px-1 py-0.2 rounded font-black">
                              💖 PACAR
                            </span>
                          )}
                        </div>
                        {ord.userId && <div className="text-[10px] text-slate-400">ID: {ord.userId}</div>}
                        {ord.accountLogin && (
                          <div className="text-[10px] text-blue-300 font-mono">🔑 {ord.accountLogin}</div>
                        )}
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isJoki
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          }`}
                        >
                          {isJoki ? `🎮 Joki ${ord.role}` : `🌟 VIP ${ord.role}`}
                        </span>
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="font-bold text-white">{ord.matchesOrdered} Match</span>
                        <div className="text-[10px] text-slate-400">Sisa: {ord.matchesRemaining}</div>
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="text-slate-300">{ord.paymentMethod}</span>
                        {ord.transferNote && (
                          <div className="text-[10px] text-slate-500 max-w-[120px] truncate" title={ord.transferNote}>
                            {ord.transferNote}
                          </div>
                        )}
                      </td>

                      {/* Status Bagi Hasil 3:2 */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {isSettled ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md border border-slate-700">
                            <CheckCheck className="w-3 h-3 text-emerald-400" /> Sudah Dibagi 3:2
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-md border border-amber-500/40">
                            <Coins className="w-3 h-3 text-amber-400" /> Kas Berjalan
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="font-black text-emerald-400">
                          {formatRupiah(ord.amountPaid)}
                        </div>
                        <span
                          className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded ${
                            ord.paymentStatus === 'GRATIS'
                              ? 'bg-pink-500/20 text-pink-300'
                              : ord.paymentStatus === 'LUNAS'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {ord.paymentStatus === 'GRATIS' ? 'GRATIS' : ord.paymentStatus}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        {ord.paymentStatus === 'GRATIS' ? (
                          <span className="text-[10px] text-pink-400 font-bold">Rp 0 (Gratis)</span>
                        ) : underpaid === 0 ? (
                          <span className="text-[10px] text-emerald-400 font-bold">Lunas</span>
                        ) : (
                          <div className="font-extrabold text-amber-400">
                            - {formatRupiah(underpaid)}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {ord.paymentStatus !== 'LUNAS' && ord.paymentStatus !== 'GRATIS' && (
                            <button
                              onClick={() => onMarkPaid(ord.id)}
                              title="Set Lunas"
                              className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold px-2 py-1 rounded"
                            >
                              Lunasi
                            </button>
                          )}
                          <button
                            onClick={() => onTopUpOrder(ord)}
                            title="Top Up Match"
                            className="bg-slate-800 hover:bg-slate-700 text-amber-300 p-1 rounded"
                          >
                            <PlusCircle className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onEditOrder(ord)}
                            title="Edit Data Customer"
                            className="bg-slate-800 hover:bg-blue-900/60 text-blue-300 border border-blue-500/30 p-1 rounded transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteOrder(ord.id)}
                            title="Hapus Transaksi"
                            className="bg-slate-800 hover:bg-rose-900 text-slate-400 hover:text-white p-1 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default React.memo(FinancialView);
