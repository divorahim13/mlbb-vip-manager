import React, { useState } from 'react';
import { Crown, Shield, User, UserPlus, Play, CheckCircle2, XCircle, ArrowRightLeft, Sparkles, AlertCircle, Copy, Check, Plus, Swords, Zap, Heart, Wand2 } from 'lucide-react';
import { formatRupiah } from '../utils/pricing';

export const ROLE_DETAILS = {
  'Mid Lane': { label: 'Mid Lane (Myth)', short: 'Mid Lane', icon: '🔮', color: 'text-purple-400', bg: 'bg-purple-500/20', border: 'border-purple-500/40' },
  'Roamer': { label: 'Roamer (Room)', short: 'Roamer', icon: '❤️', color: 'text-rose-400', bg: 'bg-rose-500/20', border: 'border-rose-500/40' },
  'Exp Lane': { label: 'Exp Lane (Exp)', short: 'Exp Lane', icon: '🛡️', color: 'text-emerald-400', bg: 'bg-emerald-500/20', border: 'border-emerald-500/40' },
  'Gold Lane': { label: 'Gold Lane', short: 'Gold Lane', icon: '🏹', color: 'text-amber-400', bg: 'bg-amber-500/20', border: 'border-amber-500/40' },
  'Jungler': { label: 'Jungler', short: 'Jungler', icon: '⚡', color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/40' },
  'Any': { label: 'Bebas (Mid/Roam/Exp)', short: 'Any Role', icon: '🎮', color: 'text-cyan-400', bg: 'bg-cyan-500/20', border: 'border-cyan-500/40' }
};

export const VIP_SLOT_DEFS = [
  { key: 'mid', role: 'Mid Lane', name: 'Mid Lane (Myth)', icon: '🔮', desc: 'Mage / High Burst Damage' },
  { key: 'roam', role: 'Roamer', name: 'Roamer (Room)', icon: '❤️', desc: 'Tank / Support / Inisiator' },
  { key: 'exp', role: 'Exp Lane', name: 'Exp Lane (Exp)', icon: '🛡️', desc: 'Fighter / Offlaner Tebal' }
];

export default function RoomParty({
  roomParty,
  orders,
  pilotsInfo,
  onUpdatePilots,
  onFillSlot,
  onRemoveFromSlot,
  onFinishMatch,
  onTopUpOrder,
  onAutoRotate,
  waitingOrders,
  onOpenNewOrder
}) {
  const [editingPilots, setEditingPilots] = useState(false);
  const [pilotsForm, setPilotsForm] = useState(pilotsInfo);
  const [slotPicker, setSlotPicker] = useState(null); // 'mid' | 'roam' | 'exp'

  // Get orders currently in the 3 VIP slots
  const slotOrders = {
    mid: orders.find(o => o.id === roomParty.mid),
    roam: orders.find(o => o.id === roomParty.roam),
    exp: orders.find(o => o.id === roomParty.exp),
  };

  const occupiedCount = Object.values(slotOrders).filter(Boolean).length;
  const expiredPlayers = Object.entries(slotOrders)
    .filter(([_, order]) => order && order.matchesRemaining <= 0)
    .map(([slotKey, order]) => ({ slotKey, order }));

  const handlePilotsSave = (e) => {
    e.preventDefault();
    onUpdatePilots(pilotsForm);
    setEditingPilots(false);
  };

  return (
    <div className="space-y-6">
      {/* Alert if any player in room has 0 matches remaining */}
      {expiredPlayers.length > 0 && (
        <div className="bg-amber-500/10 border-2 border-amber-500/60 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-glow-gold animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-extrabold text-amber-300 text-sm sm:text-base">
                KUOTA MATCH SELESAI ({expiredPlayers.length} VIP)
              </h4>
              <p className="text-xs text-slate-300">
                {expiredPlayers.map(p => `@${p.order.username} (${ROLE_DETAILS[p.order.role]?.short || p.slotKey})`).join(', ')} telah menyelesaikan semua match pesanan!
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {waitingOrders.length > 0 && (
              <button
                onClick={() => onAutoRotate(expiredPlayers[0].slotKey)}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-4 py-2 rounded-lg text-xs transition-all shadow-md"
              >
                🔄 Gantikan dengan Antrean #{waitingOrders[0]?.username}
              </button>
            )}
            <button
              onClick={() => onTopUpOrder(expiredPlayers[0].order)}
              className="bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 font-bold px-3 py-2 rounded-lg text-xs"
            >
              + Top Up Match
            </button>
          </div>
        </div>
      )}

      {/* Main Room Lobby Header & Action Center */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden">
        {/* Glow */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-400 text-xs font-black tracking-wide border border-amber-500/40">
                <Crown className="w-3.5 h-3.5 fill-current" /> LOBBY MABAR 5v5
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30">
                2 Pilot Carry (Mainin Akun)
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                3 Slot VIP (Mid, Roam, Exp)
              </span>
              <span className="text-xs font-bold text-slate-400">
                VIP Terisi: <strong className="text-white">{occupiedCount} / 3 Slot</strong>
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white mt-1.5 tracking-tight">
              Party Mabar Mobile Legends
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Gold Lane & Jungler dimainkan tim Pilot (mainin akun). Slot berbayar VIP dibuka khusus untuk <strong>Mid Lane (Myth)</strong>, <strong>Roamer (Room)</strong>, dan <strong>Exp Lane (Exp)</strong>.
            </p>
          </div>

          {/* Action Center: Finish Match Controls */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => onFinishMatch('WIN')}
              disabled={occupiedCount === 0}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 disabled:opacity-30 disabled:cursor-not-allowed text-white font-extrabold px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm shadow-glow-emerald transition-all transform active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Selesai 1 Match (VICTORY 🏆)</span>
            </button>

            <button
              onClick={() => onFinishMatch('LOSE')}
              disabled={occupiedCount === 0}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-gradient-to-r from-rose-700 to-red-600 hover:from-rose-600 hover:to-red-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-extrabold px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm shadow-md transition-all transform active:scale-95"
            >
              <XCircle className="w-4 h-4" />
              <span>Selesai 1 Match (DEFEAT 💀)</span>
            </button>
          </div>
        </div>

        {/* 5 Player Layout: 2 Pilots (Gold + Jungle) + 3 VIPs (Mid, Roam, Exp) */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5 mt-5">
          {/* ================= PILOT 1: GOLD LANE ================= */}
          <div className="bg-gradient-to-b from-amber-500/15 via-slate-900 to-slate-950 border-2 border-amber-500/50 rounded-xl p-3.5 relative flex flex-col justify-between shadow-lg">
            <div className="absolute top-2.5 right-2.5">
              <span className="bg-amber-500 text-slate-950 text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider">
                PILOT 1
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-xl shadow-glow-gold">
                  🏹
                </div>
                <div>
                  <span className="text-[10px] uppercase font-black tracking-wider text-amber-400 block">
                    GOLD LANE
                  </span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-extrabold border border-amber-500/30">
                    MAININ AKUN
                  </span>
                </div>
              </div>

              {!editingPilots ? (
                <>
                  <h3 className="font-extrabold text-white text-sm truncate">{pilotsInfo.gold.name}</h3>
                  <div className="text-[11px] text-amber-300 font-semibold mt-0.5">
                    {pilotsInfo.gold.hero}
                  </div>
                  <div className="mt-2 text-[10px] px-2 py-1 bg-amber-500/10 text-amber-300 rounded border border-amber-500/20 inline-block font-medium">
                    Carry / Marksman Core
                  </div>
                </>
              ) : (
                <div className="space-y-1.5 mt-2">
                  <input
                    type="text"
                    value={pilotsForm.gold.name}
                    onChange={e => setPilotsForm({ ...pilotsForm, gold: { ...pilotsForm.gold, name: e.target.value } })}
                    className="w-full bg-slate-800 border border-slate-700 text-xs px-2 py-1 rounded text-white"
                    placeholder="Nama Pilot Gold"
                  />
                  <input
                    type="text"
                    value={pilotsForm.gold.hero}
                    onChange={e => setPilotsForm({ ...pilotsForm, gold: { ...pilotsForm.gold, hero: e.target.value } })}
                    className="w-full bg-slate-800 border border-slate-700 text-xs px-2 py-1 rounded text-white"
                    placeholder="Hero / Catatan"
                  />
                </div>
              )}
            </div>

            {!editingPilots && (
              <button
                onClick={() => setEditingPilots(true)}
                className="mt-3 text-[10px] text-slate-400 hover:text-amber-400 underline text-left"
              >
                Edit Pilot
              </button>
            )}
          </div>

          {/* ================= PILOT 2: JUNGLER ================= */}
          <div className="bg-gradient-to-b from-blue-500/15 via-slate-900 to-slate-950 border-2 border-blue-500/50 rounded-xl p-3.5 relative flex flex-col justify-between shadow-lg">
            <div className="absolute top-2.5 right-2.5">
              <span className="bg-blue-500 text-slate-950 text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider">
                PILOT 2
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-xl shadow-glow-blue">
                  ⚡
                </div>
                <div>
                  <span className="text-[10px] uppercase font-black tracking-wider text-blue-400 block">
                    JUNGLER
                  </span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 font-extrabold border border-blue-500/30">
                    MAININ AKUN
                  </span>
                </div>
              </div>

              {!editingPilots ? (
                <>
                  <h3 className="font-extrabold text-white text-sm truncate">{pilotsInfo.jungler.name}</h3>
                  <div className="text-[11px] text-blue-300 font-semibold mt-0.5">
                    {pilotsInfo.jungler.hero}
                  </div>
                  <div className="mt-2 text-[10px] px-2 py-1 bg-blue-500/10 text-blue-300 rounded border border-blue-500/20 inline-block font-medium">
                    Teman / Hyper Core
                  </div>
                </>
              ) : (
                <div className="space-y-1.5 mt-2">
                  <input
                    type="text"
                    value={pilotsForm.jungler.name}
                    onChange={e => setPilotsForm({ ...pilotsForm, jungler: { ...pilotsForm.jungler, name: e.target.value } })}
                    className="w-full bg-slate-800 border border-slate-700 text-xs px-2 py-1 rounded text-white"
                    placeholder="Nama Teman Jungler"
                  />
                  <input
                    type="text"
                    value={pilotsForm.jungler.hero}
                    onChange={e => setPilotsForm({ ...pilotsForm, jungler: { ...pilotsForm.jungler, hero: e.target.value } })}
                    className="w-full bg-slate-800 border border-slate-700 text-xs px-2 py-1 rounded text-white"
                    placeholder="Hero / Catatan"
                  />
                  <div className="flex gap-1 pt-1">
                    <button onClick={handlePilotsSave} className="text-[10px] bg-amber-500 text-black font-bold px-2 py-0.5 rounded">
                      Simpan
                    </button>
                    <button onClick={() => setEditingPilots(false)} className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded">
                      Batal
                    </button>
                  </div>
                </div>
              )}
            </div>

            {!editingPilots && (
              <button
                onClick={() => setEditingPilots(true)}
                className="mt-3 text-[10px] text-slate-400 hover:text-blue-400 underline text-left"
              >
                Edit Pilot
              </button>
            )}
          </div>

          {/* ================= 3 VIP SLOTS (MID, ROAM, EXP) ================= */}
          {VIP_SLOT_DEFS.map((slotDef) => {
            const slotKey = slotDef.key;
            const order = slotOrders[slotKey];

            if (order) {
              const isExpired = order.matchesRemaining <= 0;
              const playedMatches = Math.max(0, order.matchesOrdered - order.matchesRemaining);
              const progressPct = Math.min(100, Math.round((playedMatches / order.matchesOrdered) * 100));

              return (
                <div
                  key={slotKey}
                  className={`relative rounded-xl p-3.5 flex flex-col justify-between border-2 transition-all ${
                    isExpired
                      ? 'bg-rose-950/20 border-rose-500/70 shadow-glow-rose'
                      : 'bg-slate-950/80 border-slate-700/80 hover:border-amber-400/60 shadow-md'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      VIP {slotDef.role.toUpperCase()}
                    </span>
                    <span
                      className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                        order.paymentStatus === 'LUNAS'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      }`}
                    >
                      {order.paymentStatus}
                    </span>
                  </div>

                  <div className="my-2.5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl" title={order.role}>
                        {slotDef.icon}
                      </span>
                      <div className="min-w-0">
                        <h4 className="font-extrabold text-white text-sm truncate" title={order.username}>
                          {order.username}
                        </h4>
                        <p className="text-[10px] text-slate-400 truncate">
                          {order.userId || 'No Server ID'}
                        </p>
                      </div>
                    </div>

                    {/* Match Quota Visual Progress */}
                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-2 mt-2">
                      <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                        <span className="text-slate-400">Sisa Match:</span>
                        <span className={isExpired ? 'text-rose-400 font-black' : 'text-amber-400 font-black'}>
                          {order.matchesRemaining} / {order.matchesOrdered} Match
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            isExpired ? 'bg-rose-500' : 'bg-gradient-to-r from-amber-500 to-yellow-300'
                          }`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[9px] text-slate-400 mt-1">
                        <span>Main: {playedMatches}x</span>
                        <span className="text-amber-300 font-semibold">{slotDef.name}</span>
                      </div>
                    </div>
                  </div>

                  {/* Slot Actions */}
                  <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-800/80">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onTopUpOrder(order)}
                        className="flex-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold py-1 rounded transition-colors"
                      >
                        + Top Up
                      </button>
                      <button
                        onClick={() => setSlotPicker(slotKey)}
                        title="Ganti dengan player dari antrean"
                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] p-1 rounded transition-colors flex items-center justify-center"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <button
                      onClick={() => onRemoveFromSlot(slotKey)}
                      className="w-full bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 text-[10px] py-1 rounded transition-colors"
                    >
                      Keluarkan ke Antrean
                    </button>
                  </div>
                </div>
              );
            }

            // Empty Slot State for this specific VIP Role
            // Prioritize waiting orders that match this role or 'Any'
            const matchingQueue = waitingOrders.filter(
              wo => wo.role === slotDef.role || wo.role === 'Any'
            );
            const bestCandidate = matchingQueue[0] || waitingOrders[0];

            return (
              <div
                key={slotKey}
                className="border-2 border-dashed border-slate-800/80 hover:border-slate-700 bg-slate-950/40 rounded-xl p-3.5 flex flex-col items-center justify-center text-center min-h-[220px] transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-xl mb-1.5 shadow-sm">
                  {slotDef.icon}
                </div>
                <span className="text-[11px] font-black uppercase text-amber-400">
                  SLOT VIP {slotDef.name.toUpperCase()}
                </span>
                <span className="text-[10px] text-slate-400 font-medium mb-2">
                  {slotDef.desc}
                </span>

                {waitingOrders.length > 0 ? (
                  <>
                    <p className="text-[10px] text-slate-400 mb-2">
                      {matchingQueue.length > 0
                        ? `${matchingQueue.length} antrean ${slotDef.role} menunggu`
                        : `${waitingOrders.length} antrean menunggu`}
                    </p>
                    <button
                      onClick={() => onFillSlot(slotKey, bestCandidate.id)}
                      className="w-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1 shadow-sm"
                    >
                      <span>Masuk #{bestCandidate.username}</span>
                    </button>
                    {waitingOrders.length > 1 && (
                      <button
                        onClick={() => setSlotPicker(slotKey)}
                        className="text-[10px] text-slate-400 hover:text-white mt-2 underline"
                      >
                        Pilih VIP lain ({waitingOrders.length})
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-[10px] text-slate-500 mb-3">
                      Slot VIP {slotDef.role} kosong
                    </p>
                    <button
                      onClick={onOpenNewOrder}
                      className="w-full bg-slate-900 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 border border-slate-800 hover:border-amber-500/30 text-xs font-bold py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Isi VIP {slotDef.role}</span>
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                <span>Pilih VIP untuk Slot</span>
                <span className="text-amber-400 uppercase">
                  {VIP_SLOT_DEFS.find(s => s.key === slotPicker)?.name || slotPicker}
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
                  Tidak ada pemain di antrean. Silakan tambah Order VIP baru.
                </p>
              ) : (
                waitingOrders.map((wo, idx) => (
                  <div
                    key={wo.id}
                    onClick={() => {
                      onFillSlot(slotPicker, wo.id);
                      setSlotPicker(null);
                    }}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 hover:bg-amber-500/10 border border-slate-800 hover:border-amber-500/40 cursor-pointer transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-slate-800 text-[10px] font-black flex items-center justify-center text-amber-400">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="font-bold text-xs text-white flex items-center gap-1.5">
                          <span>{wo.username}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-amber-300 font-semibold">
                            {wo.role}
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
