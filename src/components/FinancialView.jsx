import React, { useState, useMemo } from 'react';
import { formatRupiah } from '../utils/pricing';
import { DollarSign, Search, Filter, Download, Upload, CheckCircle, AlertTriangle, FileSpreadsheet, Trash2, PlusCircle, CreditCard, Inbox } from 'lucide-react';

export default function FinancialView({
  orders,
  onMarkPaid,
  onTopUpOrder,
  onDeleteOrder,
  onExportCSV,
  onExportJSON,
  onImportJSON,
  onOpenNewOrder
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [methodFilter, setMethodFilter] = useState('ALL');

  // Financial calculations
  const totalRevenue = useMemo(() => {
    return orders.reduce((sum, o) => sum + (Number(o.amountPaid) || 0), 0);
  }, [orders]);

  const totalBilled = useMemo(() => {
    return orders.reduce((sum, o) => sum + (Number(o.priceTotal) || 0), 0);
  }, [orders]);

  const totalOutstanding = useMemo(() => {
    return Math.max(0, totalBilled - totalRevenue);
  }, [totalBilled, totalRevenue]);

  const totalMatchesOrdered = useMemo(() => {
    return orders.reduce((sum, o) => sum + (Number(o.matchesOrdered) || 0), 0);
  }, [orders]);

  // Breakdown by payment method
  const methodBreakdown = useMemo(() => {
    const acc = {};
    orders.forEach(o => {
      const m = o.paymentMethod || 'Lainnya';
      if (!acc[m]) {
        acc[m] = { count: 0, amount: 0 };
      }
      acc[m].count += 1;
      acc[m].amount += (Number(o.amountPaid) || 0);
    });
    return acc;
  }, [orders]);

  const methodEntries = Object.entries(methodBreakdown);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const matchSearch =
        o.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (o.transferNote && o.transferNote.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (o.userId && o.userId.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (o.phone && o.phone.includes(searchTerm));

      const matchStatus = statusFilter === 'ALL' || o.paymentStatus === statusFilter;
      const matchMethod = methodFilter === 'ALL' || o.paymentMethod === methodFilter;

      return matchSearch && matchStatus && matchMethod;
    });
  }, [orders, searchTerm, statusFilter, methodFilter]);

  return (
    <div className="space-y-6">
      {/* 4 Financial Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Omset */}
        <div className="bg-slate-900/90 border border-emerald-500/30 rounded-2xl p-4 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Omzet Diterima</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-400 mt-2">
            {formatRupiah(totalRevenue)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Uang riil yang sudah ditransfer VIP</p>
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
          <p className="text-[11px] text-slate-400 mt-1">Sisa tagihan yang belum lunas</p>
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
          <p className="text-[11px] text-slate-400 mt-1">Akumulasi nilai seluruh pesanan</p>
        </div>

        {/* Total Match Terjual */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Match Terjual</span>
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

      {/* Payment Method Breakdown & Export Action Bar */}
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
                  className="flex items-center gap-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Download Excel/CSV</span>
                </button>
                <button
                  onClick={onExportJSON}
                  className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Backup</span>
                </button>
              </>
            )}
            <label className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>Restore</span>
              <input type="file" accept=".json" onChange={onImportJSON} className="hidden" />
            </label>
          </div>
        </div>

        {/* Breakdown chips */}
        {methodEntries.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 mt-3">
            {methodEntries.map(([method, data]) => (
              <div key={method} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <div className="text-[11px] font-bold text-slate-400 truncate">{method}</div>
                <div className="text-xs font-black text-amber-400 mt-0.5">{formatRupiah(data.amount)}</div>
                <div className="text-[10px] text-slate-400">{data.count} transaksi</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-xs text-slate-500">
            Belum ada transaksi pembayaran masuk. Pemasukan akan dikelompokkan di sini secara otomatis.
          </div>
        )}
      </div>

      {/* Main Financial Ledger / Transaction Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-lg font-black text-white">Buku Kas & Riwayat Transaksi</h3>
            <p className="text-xs text-slate-400">Daftar semua pembayaran pesanan mabar VIP</p>
          </div>

          {/* Filters */}
          {orders.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {/* Search */}
              <div className="relative min-w-[180px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari user / catatan..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
              >
                <option value="ALL">Semua Status</option>
                <option value="LUNAS">Lunas</option>
                <option value="DP">DP (Kurang)</option>
                <option value="BELUM_BAYAR">Belum Bayar</option>
              </select>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider font-extrabold">
              <tr>
                <th className="py-3 px-3 rounded-l-lg">Tanggal / Waktu</th>
                <th className="py-3 px-3">Player VIP</th>
                <th className="py-3 px-3">Paket Match</th>
                <th className="py-3 px-3">Metode Transfer</th>
                <th className="py-3 px-3">Total Tagihan</th>
                <th className="py-3 px-3">Nominal Masuk</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 rounded-r-lg text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-10 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-500">
                      <Inbox className="w-8 h-8 text-slate-600 mb-2" />
                      <p className="font-semibold text-slate-400">Belum ada transaksi pembayaran tercatat</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Daftarkan pemain pertama lewat tombol Order VIP</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((ord) => {
                  const underpaid = Math.max(0, (ord.priceTotal || 0) - (ord.amountPaid || 0));

                  return (
                    <tr key={ord.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3 text-[11px] whitespace-nowrap text-slate-400">
                        {new Date(ord.createdAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-extrabold text-white text-xs">{ord.username}</div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[120px]">
                          {ord.userId || '-'}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span className="font-bold text-amber-300">
                          {ord.matchesOrdered} Match
                        </span>
                        <div className="text-[10px] text-slate-400">
                          Sisa: {ord.matchesRemaining}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-200">{ord.paymentMethod}</div>
                        {ord.transferNote && (
                          <div className="text-[10px] text-slate-400 italic truncate max-w-[140px]" title={ord.transferNote}>
                            {ord.transferNote}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3 font-semibold text-slate-200">
                        {formatRupiah(ord.priceTotal)}
                      </td>

                      <td className="py-3 px-3 font-black text-emerald-400">
                        {formatRupiah(ord.amountPaid)}
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            ord.paymentStatus === 'LUNAS'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : ord.paymentStatus === 'DP'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {ord.paymentStatus}
                        </span>
                        {underpaid > 0 && (
                          <div className="text-[10px] text-amber-400 font-bold mt-0.5">
                            - {formatRupiah(underpaid)}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {ord.paymentStatus !== 'LUNAS' && (
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
