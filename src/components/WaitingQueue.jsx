import React, { useState, useMemo } from 'react';
import { ArrowUp, ArrowDown, UserCheck, Trash2, Clock, Phone, DollarSign, Plus, CheckCircle, Gamepad2, KeyRound, Edit3 } from 'lucide-react';
import { formatRupiah } from '../utils/pricing';
import { getCompletionTime, formatDateTime } from '../utils/orderTime';

function WaitingQueue({
  waitingOrders = [],
  completedOrders = [],
  matchHistory = [],
  roomParty = {},
  onFillNextSlot,
  onMoveOrder,
  onDeleteOrder,
  onTopUpOrder,
  onEditOrder,
  onMarkPaid,
  onOpenNewOrder
}) {
  const [activeTab, setActiveTab] = useState('waiting'); // 'waiting' or 'completed'
  const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'JOKI' | 'VIP_MABAR'

  // Filtered waiting orders
  const displayWaitingOrders = useMemo(() => {
    if (filterType === 'ALL') return waitingOrders;
    return waitingOrders.filter(o => o.orderType === filterType);
  }, [waitingOrders, filterType]);

  const getTargetSlotKey = (order) => {
    if (order.orderType === 'JOKI') {
      if (order.role === 'Gold Lane') return 'jokiGold';
      if (order.role === 'Jungler') return 'jokiJungle';
    } else {
      if (order.role === 'Mid Lane') return 'mid';
      if (order.role === 'Roamer') return 'roam';
      if (order.role === 'Exp Lane') return 'exp';
    }
    return null;
  };

  const getSlotButtonLabel = (order) => {
    const targetKey = getTargetSlotKey(order);
    if (targetKey && !roomParty[targetKey]) {
      if (order.orderType === 'JOKI') {
        return `Masuk Joki ${order.role}`;
      }
      return `Masuk Slot ${order.role}`;
    }
    return 'Masuk Room';
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-amber-400 font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Antrean Mabar & Joki
            </span>
          </div>
          <h3 className="text-base sm:text-lg font-black text-white mt-0.5">
            Daftar Antrean Customer (Joki & VIP Mabar)
          </h3>
          <p className="text-xs text-slate-400">
            Antrean akun joki (Gold/Jungle) yang siap dimainkan pilot & antrean VIP (Mid/Roam/Exp) yang siap mabar bareng.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Filter Tab: Antrean vs Selesai */}
          <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex text-xs font-bold">
            <button
              onClick={() => setActiveTab('waiting')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                activeTab === 'waiting'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Antrean Menunggu ({waitingOrders.length})
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                activeTab === 'completed'
                  ? 'bg-slate-800 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Selesai ({completedOrders.length})
            </button>
          </div>

          {/* Quick Add Order Button */}
          <button
            onClick={onOpenNewOrder}
            className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Tambah Antrean</span>
          </button>
        </div>
      </div>

      {/* Filter by Type (All / Joki / VIP Mabar) */}
      {activeTab === 'waiting' && (
        <div className="flex items-center justify-between gap-2 mt-3 pt-1 pb-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <span className="text-slate-400 text-[11px] mr-1">Filter Kategori:</span>
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                filterType === 'ALL'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              Semua ({waitingOrders.length})
            </button>
            <button
              onClick={() => setFilterType('JOKI')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                filterType === 'JOKI'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              🎮 Akun Joki ({waitingOrders.filter(o => o.orderType === 'JOKI').length})
            </button>
            <button
              onClick={() => setFilterType('VIP_MABAR')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                filterType === 'VIP_MABAR'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              🌟 VIP Mabar ({waitingOrders.filter(o => o.orderType !== 'JOKI').length})
            </button>
          </div>

          <div className="text-[11px] text-slate-400">
            Total Antrean: <strong className="text-white">{displayWaitingOrders.length} Akun</strong>
          </div>
        </div>
      )}

      {/* Content based on Active Tab */}
      {activeTab === 'waiting' ? (
        <div className="mt-3">
          {displayWaitingOrders.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-slate-800 rounded-xl bg-slate-950/40">
              <Clock className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-300">Belum Ada Antrean Menunggu</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Customer baru yang mendaftar mabar VIP atau akun joki akan otomatis masuk ke daftar antrean ini.
              </p>
              <button
                onClick={onOpenNewOrder}
                className="mt-3 inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3.5 py-1.5 rounded-lg text-xs transition-transform active:scale-95 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Pesanan Baru</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {displayWaitingOrders.map((order, index) => {
                const isFirst = index === 0;
                const isLast = index === displayWaitingOrders.length - 1;
                const isJoki = order.orderType === 'JOKI';
                const slotBtnText = getSlotButtonLabel(order);

                return (
                  <div
                    key={order.id}
                    className={`rounded-xl p-3 sm:p-3.5 border transition-colors perf-contain ${
                      isFirst
                        ? 'bg-slate-950/90 border-amber-500/50 shadow-sm'
                        : 'bg-slate-950/70 border-slate-800/90 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Left: Queue Number & Customer Details */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-lg font-black text-xs flex items-center justify-center shrink-0 ${
                            isFirst
                              ? 'bg-amber-500 text-slate-950 shadow-sm'
                              : 'bg-slate-800 text-slate-300 border border-slate-700'
                          }`}
                        >
                          #{index + 1}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-white text-sm truncate">
                              {order.username}
                            </span>

                            {/* Badge Joki vs Mabar */}
                            <span
                              className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                isJoki
                                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              }`}
                            >
                              {isJoki ? `🎮 Joki ${order.role}` : `🌟 VIP ${order.role}`}
                            </span>

                            {isFirst && (
                              <span className="text-[9px] bg-amber-500 text-slate-950 font-black px-2 py-0.2 rounded-full uppercase">
                                SIAP MASUK
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5 flex-wrap">
                            {order.userId && <span>ID: <strong className="text-slate-300">{order.userId}</strong></span>}
                            {order.phone && (
                              <a
                                href={`https://wa.me/${order.phone.replace(/^0/, '62').replace(/[^0-9]/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-400 hover:underline flex items-center gap-1"
                              >
                                <Phone className="w-3 h-3" /> {order.phone}
                              </a>
                            )}
                            {order.accountLogin && (
                              <span className="text-blue-300 flex items-center gap-1 font-mono text-[10px] bg-blue-950/60 px-1.5 py-0.2 rounded border border-blue-800/40">
                                <KeyRound className="w-2.5 h-2.5" /> {order.accountLogin}
                              </span>
                            )}
                            <span>{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      </div>

                      {/* Middle: Matches & Payment Info */}
                      <div className="flex items-center gap-3 sm:gap-4 shrink-0 bg-slate-900/90 px-3 py-1.5 rounded-lg border border-slate-800">
                        {/* Matches */}
                        <div className="text-left">
                          <div className="text-[10px] text-slate-400 font-semibold">Paket Match</div>
                          <div className="text-xs font-black text-amber-400">
                            {order.matchesRemaining} Match
                          </div>
                        </div>

                        {/* Payment */}
                        <div className="text-left border-l border-slate-800 pl-3">
                          <div className="text-[10px] text-slate-400 font-semibold">Pembayaran</div>
                          <div className="text-xs font-bold text-white flex items-center gap-1.5">
                            <span>{formatRupiah(order.amountPaid)}</span>
                            <span
                              className={`text-[9px] font-black px-1.5 py-0.2 rounded uppercase ${
                                order.paymentStatus === 'GRATIS'
                                  ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40'
                                  : order.paymentStatus === 'LUNAS'
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              }`}
                            >
                              {order.paymentStatus === 'GRATIS' ? '💖 GRATIS' : order.paymentStatus}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                        {/* Reorder Up / Down */}
                        <div className="flex flex-col gap-0.5">
                          <button
                            onClick={() => onMoveOrder(index, -1)}
                            disabled={isFirst}
                            title="Naikkan Urutan Antrean"
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-20 text-slate-300 disabled:hover:bg-slate-800 transition-colors"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => onMoveOrder(index, 1)}
                            disabled={isLast}
                            title="Turunkan Urutan Antrean"
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-20 text-slate-300 disabled:hover:bg-slate-800 transition-colors"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Masukkan ke Room */}
                        <button
                          onClick={() => onFillNextSlot(order.id)}
                          className={`flex items-center gap-1.5 font-black text-xs px-3 py-1.5 rounded-lg transition-transform active:scale-95 shadow-sm ${
                            isJoki
                              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white'
                              : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950'
                          }`}
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>{slotBtnText}</span>
                        </button>

                        {/* Quick Pelunasan button if not paid / not free */}
                        {order.paymentStatus !== 'LUNAS' && order.paymentStatus !== 'GRATIS' && (
                          <button
                            onClick={() => onMarkPaid(order.id)}
                            title="Tandai Pembayaran Lunas"
                            className="bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/40 p-1.5 rounded-lg text-xs transition-colors"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Top up */}
                        <button
                          onClick={() => onTopUpOrder(order)}
                          title="Tambah Match (Top Up)"
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/20 text-xs transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>

                        {/* Edit */}
                        <button
                          onClick={() => onEditOrder(order)}
                          title="Edit Data Customer"
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-blue-900/60 text-blue-300 border border-blue-500/30 text-xs transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => onDeleteOrder(order.id)}
                          title="Hapus dari antrean"
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 text-xs transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Completed Orders List */
        <div className="mt-3">
          {completedOrders.length === 0 ? (
            <p className="text-center py-8 text-xs text-slate-400">
              Belum ada riwayat pemain yang selesai mabar / joki.
            </p>
          ) : (
            <div className="space-y-2">
              {completedOrders.map((co) => (
                <div
                  key={co.id}
                  className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-2.5 flex items-center justify-between gap-3 text-xs opacity-80 hover:opacity-100 transition-opacity perf-contain"
                >
                  <div className="flex items-center gap-2.5">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <span>{co.username}</span>
                        <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${co.orderType === 'JOKI' ? 'bg-blue-900/60 text-blue-300' : 'bg-slate-800 text-amber-300'}`}>
                          {co.orderType === 'JOKI' ? `🎮 Joki ${co.role}` : `🌟 VIP ${co.role}`}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {co.matchesOrdered} Match Selesai • Total {formatRupiah(co.priceTotal)} ({co.paymentMethod})
                      </div>
                      {(() => {
                        const doneAt = formatDateTime(getCompletionTime(co, matchHistory));
                        return doneAt ? (
                          <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            <span>Selesai {doneAt}</span>
                          </div>
                        ) : null;
                      })()}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onTopUpOrder(co)}
                      className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-[10px] font-bold px-2 py-1 rounded-md transition-colors"
                    >
                      Order Lagi (+Match)
                    </button>
                    <button
                      onClick={() => onEditOrder(co)}
                      title="Edit Data Customer"
                      className="bg-slate-800 hover:bg-blue-900/60 text-blue-300 border border-blue-500/30 p-1 rounded transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteOrder(co.id)}
                      className="text-slate-400 hover:text-rose-400 p-1 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default React.memo(WaitingQueue);
