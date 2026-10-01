import React, { useState, useMemo } from 'react';
import { ArrowUp, ArrowDown, UserCheck, Trash2, Clock, Phone, DollarSign, Zap, Plus, CheckCircle, ShieldAlert, Gamepad2, KeyRound } from 'lucide-react';
import { formatRupiah } from '../utils/pricing';
import { ROLE_DETAILS } from './RoomParty';

export default function WaitingQueue({
  waitingOrders,
  completedOrders,
  roomParty,
  onFillNextSlot,
  onMoveOrder,
  onDeleteOrder,
  onTopUpOrder,
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
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-amber-400 font-extrabold text-sm uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-4 h-4" /> Antrean Mabar & Joki
            </span>
          </div>
          <h3 className="text-lg font-black text-white mt-0.5">
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
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'waiting'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Menunggu ({waitingOrders.length})
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'completed'
                  ? 'bg-slate-800 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Selesai ({completedOrders.length})
            </button>
          </div>

          <button
            onClick={() => onOpenNewOrder()}
            className="flex items-center gap-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold px-3 py-2 rounded-xl transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Antrean</span>
          </button>
        </div>
      </div>

      {/* Sub-filter: Semua vs Joki vs VIP Mabar */}
      {activeTab === 'waiting' && waitingOrders.length > 0 && (
        <div className="flex items-center gap-2 pt-3 pb-1">
          <span className="text-[11px] text-slate-400 font-semibold">Filter:</span>
          <button
            onClick={() => setFilterType('ALL')}
            className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-all ${
              filterType === 'ALL'
                ? 'bg-slate-800 text-amber-300 border border-slate-700'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Semua ({waitingOrders.length})
          </button>
          <button
            onClick={() => setFilterType('JOKI')}
            className={`text-xs px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all ${
              filterType === 'JOKI'
                ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Gamepad2 className="w-3.5 h-3.5" />
            <span>Joki Akun ({waitingOrders.filter(o => o.orderType === 'JOKI').length})</span>
          </button>
          <button
            onClick={() => setFilterType('VIP_MABAR')}
            className={`text-xs px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all ${
              filterType === 'VIP_MABAR'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>🌟 VIP Mabar ({waitingOrders.filter(o => o.orderType !== 'JOKI').length})</span>
          </button>
        </div>
      )}

      {/* Content based on tab */}
      {activeTab === 'waiting' ? (
        <div className="mt-4">
          {displayWaitingOrders.length === 0 ? (
            <div className="text-center py-12 px-4 border border-dashed border-slate-800 rounded-xl bg-slate-950/40">
              <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Clock className="w-6 h-6 text-slate-400" />
              </div>
              <h4 className="text-sm font-bold text-white">Tidak ada antrean aktif</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Semua akun customer sudah berada di dalam room atau belum ada pendaftaran baru.
              </p>
              <button
                onClick={() => onOpenNewOrder()}
                className="mt-4 inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs transition-all shadow-glow-gold"
              >
                <Plus className="w-4 h-4" />
                <span>Input Pesanan Baru (Joki / Mabar)</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {displayWaitingOrders.map((order, index) => {
                const isFirst = index === 0;
                const isLast = index === displayWaitingOrders.length - 1;
                const isJoki = order.orderType === 'JOKI';
                const roleMeta = ROLE_DETAILS[order.role] || { label: order.role, icon: '🎮' };
                const slotBtnText = getSlotButtonLabel(order);

                return (
                  <div
                    key={order.id}
                    className={`rounded-xl p-3.5 border transition-all ${
                      isFirst
                        ? 'bg-gradient-to-r from-amber-500/10 via-slate-900 to-slate-950 border-amber-500/50 shadow-glow-gold'
                        : isJoki
                        ? 'bg-slate-950/90 border-blue-900/40 hover:border-blue-700/60'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Left: Queue Number & Player info */}
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Queue Position Badge */}
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                            isFirst
                              ? 'bg-amber-500 text-slate-950 shadow-md ring-2 ring-amber-400/40'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          #{index + 1}
                        </div>

                        {/* Role Icon */}
                        <span className="text-2xl shrink-0" title={order.role}>
                          {roleMeta.icon}
                        </span>

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
                              <span className="text-[10px] bg-amber-500 text-slate-950 font-black px-2 py-0.5 rounded-full uppercase">
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
                      <div className="flex items-center gap-3 sm:gap-4 shrink-0 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800/80">
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
                                order.paymentStatus === 'LUNAS'
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              }`}
                            >
                              {order.paymentStatus}
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
                          className={`flex items-center gap-1.5 font-black text-xs px-3 py-2 rounded-lg transition-all ${
                            isJoki
                              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-glow-blue'
                              : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-glow-gold'
                          }`}
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>{slotBtnText}</span>
                        </button>

                        {/* If DP or Belum Bayar, Quick Pelunasan button */}
                        {order.paymentStatus !== 'LUNAS' && (
                          <button
                            onClick={() => onMarkPaid(order.id)}
                            title="Tandai Pembayaran Lunas"
                            className="bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/40 p-2 rounded-lg text-xs"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Top up */}
                        <button
                          onClick={() => onTopUpOrder(order)}
                          title="Tambah Match (Top Up)"
                          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/20 text-xs transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => onDeleteOrder(order.id)}
                          title="Hapus dari antrean"
                          className="p-2 rounded-lg bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 text-xs transition-colors"
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
        <div className="mt-4">
          {completedOrders.length === 0 ? (
            <p className="text-center py-8 text-xs text-slate-400">
              Belum ada riwayat pemain yang selesai mabar / joki.
            </p>
          ) : (
            <div className="space-y-2">
              {completedOrders.map((co) => (
                <div
                  key={co.id}
                  className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between gap-3 text-xs opacity-80 hover:opacity-100 transition-opacity"
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
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onTopUpOrder(co)}
                      className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-[10px] font-bold px-2.5 py-1 rounded-md"
                    >
                      Order Lagi (+Match)
                    </button>
                    <button
                      onClick={() => onDeleteOrder(co.id)}
                      className="text-slate-400 hover:text-rose-400 p-1"
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
