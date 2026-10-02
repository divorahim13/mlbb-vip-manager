import React, { useState, useMemo } from 'react';
import { Crown, Shield, User, UserPlus, CheckCircle2, XCircle, ArrowRightLeft, Sparkles, AlertCircle, Copy, Check, Plus, Swords, Zap, Heart, Wand2, Gamepad2, KeyRound, Edit3 } from 'lucide-react';
import { formatRupiah } from '../utils/pricing';

export const ROLE_DETAILS = {
  'Mid Lane': { label: 'Mid Lane (Myth)', short: 'Mid Lane', icon: '🔮', color: 'text-purple-400' },
  'Roamer': { label: 'Roamer (Room)', short: 'Roamer', icon: '❤️', color: 'text-rose-400' },
  'Exp Lane': { label: 'Exp Lane (Exp)', short: 'Exp Lane', icon: '🛡️', color: 'text-emerald-400' },
  'Gold Lane': { label: 'Gold Lane (Joki)', short: 'Gold Lane', icon: '🏹', color: 'text-amber-400' },
  'Jungler': { label: 'Jungler (Joki)', short: 'Jungler', icon: '⚡', color: 'text-blue-400' },
  'Any': { label: 'Bebas (Mid/Roam/Exp)', short: 'Any Role', icon: '🎮', color: 'text-cyan-400' }
};

export const ALL_5_SLOTS = [
  {
    key: 'jokiGold',
    category: 'JOKI',
    role: 'Gold Lane',
    title: 'AKUN JOKI GOLD LANE',
    pilotTitle: 'Dimainin Saya (Admin)',
    icon: '🏹',
    borderColor: 'border-amber-500/50',
    headerBg: 'bg-amber-500/20 text-amber-300 border-amber-500/30'
  },
  {
    key: 'jokiJungle',
    category: 'JOKI',
    role: 'Jungler',
    title: 'AKUN JOKI JUNGLER',
    pilotTitle: 'Dimainin Teman (Partner)',
    icon: '⚡',
    borderColor: 'border-blue-500/50',
    headerBg: 'bg-blue-500/20 text-blue-300 border-blue-500/30'
  },
  {
    key: 'mid',
    category: 'VIP_MABAR',
    role: 'Mid Lane',
    title: 'VIP MID LANE (MYTH)',
    pilotTitle: 'Main Sendiri',
    icon: '🔮',
    borderColor: 'border-purple-500/40',
    headerBg: 'bg-purple-500/20 text-purple-300 border-purple-500/30'
  },
  {
    key: 'roam',
    category: 'VIP_MABAR',
    role: 'Roamer',
    title: 'VIP ROAMER (ROOM)',
    pilotTitle: 'Main Sendiri',
    icon: '❤️',
    borderColor: 'border-rose-500/40',
    headerBg: 'bg-rose-500/20 text-rose-300 border-rose-500/30'
  },
  {
    key: 'exp',
    category: 'VIP_MABAR',
    role: 'Exp Lane',
    title: 'VIP EXP LANE (EXP)',
    pilotTitle: 'Main Sendiri',
    icon: '🛡️',
    borderColor: 'border-emerald-500/40',
    headerBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
  }
];

function RoomParty({
  roomParty = {},
  orders = [],
  onFillSlot,
  onRemoveFromSlot,
  onFinishMatch,
  onTopUpOrder,
  onEditOrder,
  onAutoRotate,
  waitingOrders = [],
  onOpenNewOrder
}) {
  const [slotPicker, setSlotPicker] = useState(null); // 'jokiGold' | 'jokiJungle' | 'mid' | 'roam' | 'exp'

  // Fast O(1) hash map lookup for slot orders
  const slotOrders = useMemo(() => {
    const orderMap = new Map();
    for (let i = 0; i < orders.length; i++) {
      orderMap.set(orders[i].id, orders[i]);
    }
    return {
      jokiGold: orderMap.get(roomParty.jokiGold) || null,
      jokiJungle: orderMap.get(roomParty.jokiJungle) || null,
      mid: orderMap.get(roomParty.mid) || null,
      roam: orderMap.get(roomParty.roam) || null,
      exp: orderMap.get(roomParty.exp) || null,
    };
  }, [orders, roomParty]);

  const occupiedCount = useMemo(() => {
    return Object.values(slotOrders).filter(Boolean).length;
  }, [slotOrders]);

  const expiredPlayers = useMemo(() => {
    return Object.entries(slotOrders)
      .filter(([_, order]) => order && order.matchesRemaining <= 0)
      .map(([slotKey, order]) => ({ slotKey, order }));
  }, [slotOrders]);

  return (
    <div className="space-y-6">
      {/* Alert if any account in room has 0 matches remaining */}
      {expiredPlayers.length > 0 && (
        <div className="bg-amber-500/10 border-2 border-amber-500/70 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-extrabold text-amber-300 text-sm sm:text-base">
                KUOTA MATCH SELESAI ({expiredPlayers.length} Akun Customer)
              </h4>
              <p className="text-xs text-slate-300">
                {expiredPlayers.map(p => `@${p.order.username} (${p.order.orderType === 'JOKI' ? 'Joki ' + p.order.role : 'VIP ' + p.order.role})`).join(', ')} telah menyelesaikan semua match pesanan!
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {waitingOrders.length > 0 && (
              <button
                onClick={() => onAutoRotate(expiredPlayers[0].slotKey)}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-4 py-2 rounded-lg text-xs transition-colors shadow-sm"
              >
                🔄 Gantikan dengan Antrean #{waitingOrders[0]?.username}
              </button>
            )}
            <button
              onClick={() => onTopUpOrder(expiredPlayers[0].order)}
              className="bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 font-bold px-3 py-2 rounded-lg text-xs transition-colors"
            >
              + Top Up Match
            </button>
          </div>
        </div>
      )}

      {/* Main Room Lobby Header & Action Center */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg relative">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-400 text-xs font-black tracking-wide border border-amber-500/40">
                <Crown className="w-3.5 h-3.5 fill-current" /> LOBBY 5v5 (2 JOKI + 3 VIP)
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/30">
                2 Akun Joki (Gold & Jungle)
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                3 Akun VIP Mabar (Mid, Roam, Exp)
              </span>
              <span className="text-xs font-bold text-slate-400">
                Total Akun Terisi: <strong className="text-white">{occupiedCount} / 5 Slot</strong>
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-white mt-1 tracking-tight">
              Party Mabar & Joki Mobile Legends
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              2 akun customer dijokiin (Gold Lane dimainin Saya, Jungler dimainin Teman) + 3 akun customer mabar bareng (Mid, Roam, Exp). Selesai 1 match otomatis memotong kuota semua akun!
            </p>
          </div>

          {/* Action Center: Finish Match Controls */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => onFinishMatch('WIN')}
              disabled={occupiedCount === 0}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 disabled:opacity-30 disabled:cursor-not-allowed text-white font-extrabold px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm shadow-sm transition-transform active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Selesai 1 Match (VICTORY 🏆)</span>
            </button>

            <button
              onClick={() => onFinishMatch('LOSE')}
              disabled={occupiedCount === 0}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-gradient-to-r from-rose-700 to-red-600 hover:from-rose-600 hover:to-red-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-extrabold px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm shadow-sm transition-transform active:scale-95"
            >
              <XCircle className="w-4 h-4" />
              <span>Selesai 1 Match (DEFEAT 💀)</span>
            </button>
          </div>
        </div>

        {/* 5-Slot Grid: 2 Joki + 3 VIP Mabar */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5 mt-4">
          {ALL_5_SLOTS.map((slotDef) => {
            const slotKey = slotDef.key;
            const order = slotOrders[slotKey];
            const isJoki = slotDef.category === 'JOKI';

            if (order) {
              const isExpired = order.matchesRemaining <= 0;
              const playedMatches = Math.max(0, order.matchesOrdered - order.matchesRemaining);
              const progressPct = Math.min(100, Math.round((playedMatches / order.matchesOrdered) * 100));

              return (
                <div
                  key={slotKey}
                  className={`relative rounded-xl p-3 flex flex-col justify-between border-2 transition-colors ${
                    isExpired
                      ? 'bg-rose-950/20 border-rose-500/70 shadow-sm'
                      : isJoki
                      ? 'bg-slate-950/90 border-blue-500/40 shadow-sm'
                      : 'bg-slate-950/90 border-slate-700/80 hover:border-amber-400/60 shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${slotDef.headerBg}`}>
                      {isJoki ? `🎮 JOKI • ${slotDef.role}` : `🌟 VIP • ${slotDef.role}`}
                    </span>
                    <span
                      className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                        order.paymentStatus === 'GRATIS'
                          ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40'
                          : order.paymentStatus === 'LUNAS'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      }`}
                    >
                      {order.paymentStatus === 'GRATIS' ? '💖 GRATIS' : order.paymentStatus}
                    </span>
                  </div>

                  <div className="my-2">
                    <div className="text-[10px] text-amber-400 font-bold mb-1 flex items-center gap-1">
                      <span>{slotDef.icon}</span>
                      <span>{slotDef.pilotTitle}</span>
                    </div>

                    <div className="flex items-center gap-2 mb-1">
                      <div className="min-w-0">
                        <h4 className="font-extrabold text-white text-sm truncate" title={order.username}>
                          {order.username}
                        </h4>
                        <p className="text-[10px] text-slate-400 truncate">
                          {order.userId || 'No Server ID'}
                        </p>
                      </div>
                    </div>

                    {/* Catatan login jika ada */}
                    {order.accountLogin && (
                      <div className="bg-slate-900/90 border border-blue-500/30 rounded px-2 py-0.5 my-1 text-[10px] text-blue-300 truncate" title={order.accountLogin}>
                        🔑 {order.accountLogin}
                      </div>
                    )}

                    {/* Match Quota Visual Progress */}
                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-2 mt-1.5">
                      <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                        <span className="text-slate-400">Sisa Match:</span>
                        <span className={`text-xs font-black ${isExpired ? 'text-rose-400 font-extrabold' : 'text-amber-400'}`}>
                          {order.matchesRemaining} / {order.matchesOrdered}
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            isExpired
                              ? 'bg-rose-500'
                              : isJoki
                              ? 'bg-blue-500'
                              : 'bg-amber-400'
                          }`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                      <span>{order.paymentMethod}</span>
                      <span className="font-bold text-slate-300">{formatRupiah(order.amountPaid)}</span>
                    </div>
                  </div>

                  {/* Actions for this slot */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center gap-1.5">
                    <button
                      onClick={() => onTopUpOrder(order)}
                      title="Tambah / Top Up Match Customer Ini"
                      className="flex-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] font-bold py-1 px-1 rounded transition-colors text-center"
                    >
                      + Top Up
                    </button>

                    <button
                      onClick={() => onEditOrder(order)}
                      title="Edit Data Pesanan Akun Ini"
                      className="bg-blue-900/40 hover:bg-blue-800/60 text-blue-300 border border-blue-600/40 p-1 rounded transition-colors"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>

                    <button
                      onClick={() => onRemoveFromSlot(slotKey)}
                      title="Keluarkan dari Slot ke Antrean"
                      className="bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 p-1 rounded transition-colors"
                    >
                      <XCircle className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            }

            // Empty Slot State
            return (
              <div
                key={slotKey}
                className="rounded-xl p-3 flex flex-col justify-between border-2 border-dashed border-slate-800 bg-slate-950/40 hover:border-slate-700 transition-colors min-h-[220px]"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${slotDef.headerBg}`}>
                      {isJoki ? `🎮 JOKI • ${slotDef.role}` : `🌟 VIP • ${slotDef.role}`}
                    </span>
                    <span className="text-[9px] text-slate-500 font-bold uppercase">
                      KOSONG
                    </span>
                  </div>

                  <div className="my-5 text-center">
                    <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-lg mx-auto mb-1.5 shadow-sm">
                      {slotDef.icon}
                    </div>
                    <div className="text-xs font-bold text-white mb-0.5">{slotDef.title}</div>
                    <div className="text-[10px] text-amber-400 font-semibold">{slotDef.pilotTitle}</div>
                  </div>
                </div>

                {waitingOrders.length > 0 ? (
                  <div className="space-y-1.5">
                    <button
                      onClick={() => setSlotPicker(slotKey)}
                      className="w-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold py-1.5 px-2 rounded-lg transition-colors flex items-center justify-center gap-1 shadow-sm"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Pilih dari Antrean</span>
                    </button>
                    <button
                      onClick={() => onOpenNewOrder(slotDef.category)}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 text-[10px] font-bold py-1 px-2 rounded transition-colors text-center"
                    >
                      + Order Baru ({isJoki ? 'Joki' : 'VIP'})
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-[10px] text-slate-500 mb-2 text-center">
                      Slot {slotDef.role} Kosong
                    </p>
                    <button
                      onClick={() => onOpenNewOrder(slotDef.category)}
                      className="w-full bg-slate-900 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 border border-slate-800 hover:border-amber-500/30 text-xs font-bold py-1.5 px-2 rounded-lg transition-colors flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isJoki ? `Input Joki ${slotDef.role}` : `Input VIP ${slotDef.role}`}</span>
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal / Selector if picking player for slot */}
      {slotPicker !== null && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 gpu-layer">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                <span>Pilih Akun untuk</span>
                <span className="text-amber-400 uppercase">
                  {ALL_5_SLOTS.find(s => s.key === slotPicker)?.title || slotPicker}
                </span>
              </h3>
              <button
                onClick={() => setSlotPicker(null)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="mt-3 space-y-2 max-h-72 overflow-y-auto">
              {waitingOrders.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">
                  Tidak ada akun di antrean. Silakan tambah pesanan baru.
                </p>
              ) : (
                waitingOrders.map((wo, idx) => (
                  <div
                    key={wo.id}
                    onClick={() => {
                      onFillSlot(slotPicker, wo.id);
                      setSlotPicker(null);
                    }}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 hover:bg-amber-500/10 border border-slate-800 hover:border-amber-500/40 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-slate-800 text-[10px] font-black flex items-center justify-center text-amber-400">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="font-bold text-xs text-white flex items-center gap-1.5">
                          <span>{wo.username}</span>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${wo.orderType === 'JOKI' ? 'bg-blue-900/60 text-blue-300' : 'bg-slate-800 text-amber-300'}`}>
                            {wo.orderType === 'JOKI' ? `🎮 Joki ${wo.role}` : `🌟 VIP ${wo.role}`}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {wo.matchesRemaining} Match • {wo.paymentMethod} ({wo.paymentStatus})
                        </div>
                      </div>
                    </div>
                    <button className="text-[10px] font-bold bg-amber-500 text-slate-950 px-2 py-1 rounded">
                      Pilih
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSlotPicker(null)}
                className="px-4 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(RoomParty);
