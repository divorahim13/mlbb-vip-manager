import React, { useMemo } from 'react';
import { Crown, Swords, DollarSign, Flame, RefreshCw, PlusCircle, Share2, Trash2, Cloud, CloudOff } from 'lucide-react';
import { formatRupiah } from '../utils/pricing';

function Header({
  activeTab,
  setActiveTab,
  orders = [],
  roomParty = {},
  matchHistory = [],
  onOpenNewOrder,
  onResetData,
  onShareWhatsApp,
  cloudStatus = 'ONLINE', // 'ONLINE' | 'SYNCING' | 'OFFLINE'
  isSyncing = false,
  onForceSync
}) {
  // Single-pass computation for Header stats
  const { totalRevenue, totalDue, waitingCount, inRoomCount, totalMatches, winCount, winRate } = useMemo(() => {
    let rev = 0;
    let due = 0;
    let wait = 0;

    for (let i = 0; i < orders.length; i++) {
      const o = orders[i];
      rev += Number(o.amountPaid) || 0;
      if (o.paymentStatus !== 'GRATIS') {
        due += Math.max(0, (Number(o.priceTotal) || 0) - (Number(o.amountPaid) || 0));
      }
      if (o.status === 'WAITING') {
        wait++;
      }
    }

    let inRoom = 0;
    const roomKeys = ['jokiGold', 'jokiJungle', 'mid', 'roam', 'exp'];
    for (let i = 0; i < roomKeys.length; i++) {
      if (roomParty[roomKeys[i]]) inRoom++;
    }

    const tMatches = matchHistory.length;
    let wins = 0;
    for (let i = 0; i < tMatches; i++) {
      if (matchHistory[i].result === 'WIN') wins++;
    }

    const wr = tMatches > 0 ? Math.round((wins / tMatches) * 100) : 0;

    return {
      totalRevenue: rev,
      totalDue: due,
      waitingCount: wait,
      inRoomCount: inRoom,
      totalMatches: tMatches,
      winCount: wins,
      winRate: wr
    };
  }, [orders, roomParty, matchHistory]);

  return (
    <header className="border-b border-slate-800 bg-[#0c1220] sticky top-0 z-30 gpu-layer">
      {/* Top Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Logo & Branding */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 via-amber-400 to-yellow-200 flex items-center justify-center shadow-md">
            <Crown className="w-5 h-5 text-slate-950 fill-current" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-white m-0 flex items-center gap-2">
                MLBB <span className="text-amber-400 font-extrabold">VIP MABAR</span>
              </h1>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                60 FPS
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Pencatatan Keuangan & Antrean Party Mobile Legends</p>
          </div>
        </div>

        {/* Quick Stats Ticker & Cloud Sync Badge */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
          {/* Cloud Database Status Badge */}
          {cloudStatus === 'ONLINE' && (
            <button
              onClick={onForceSync}
              title="Cloud Database Aktif & Tersinkron. Klik untuk cek pembaruan sekarang."
              className="flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors"
            >
              <span className="relative flex h-2 w-2">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
              </span>
              <Cloud className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cloud:</span>
              <span className="font-black">Online</span>
              <RefreshCw className={`w-3 h-3 text-emerald-400/80 ${isSyncing ? 'animate-spin' : ''}`} />
            </button>
          )}

          {cloudStatus === 'SYNCING' && (
            <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-300 px-2.5 py-1.5 rounded-lg text-xs font-bold">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
              <span className="hidden sm:inline">Menyimpan ke Cloud...</span>
              <span className="sm:hidden">Sinkron...</span>
            </div>
          )}

          {cloudStatus === 'OFFLINE' && (
            <button
              onClick={onForceSync}
              title="Mode Offline (Cache Lokal). Klik untuk mencoba menghubungkan kembali ke Cloud Database."
              className="flex items-center gap-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors"
            >
              <CloudOff className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Offline (Cache Lokal)</span>
              <RefreshCw className="w-3 h-3" />
            </button>
          )}

          {/* Omzet */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg px-2.5 py-1.5 flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-[9px] uppercase font-bold text-slate-400">Total Omzet</div>
              <div className="text-xs sm:text-sm font-black text-emerald-400 leading-tight">
                {formatRupiah(totalRevenue)}
              </div>
            </div>
          </div>

          {/* Sisa Piutang (jika ada) */}
          {totalDue > 0 && (
            <div className="bg-slate-900/90 border border-amber-900/40 rounded-lg px-2.5 py-1.5 flex items-center gap-2">
              <div className="w-7 h-7 rounded bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <Flame className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="text-[9px] uppercase font-bold text-amber-400">Kurang Bayar</div>
                <div className="text-xs sm:text-sm font-black text-amber-300 leading-tight">
                  {formatRupiah(totalDue)}
                </div>
              </div>
            </div>
          )}

          {/* Win Rate */}
          <div className="hidden sm:flex bg-slate-900/90 border border-slate-800 rounded-lg px-2.5 py-1.5 items-center gap-2">
            <div className="w-7 h-7 rounded bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Swords className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-[9px] uppercase font-bold text-slate-400">Win Rate</div>
              <div className="text-xs sm:text-sm font-black text-blue-400 leading-tight">
                {winRate}% {totalMatches > 0 && <span className="text-[10px] text-slate-400 font-normal">({winCount}/{totalMatches})</span>}
              </div>
            </div>
          </div>

          {/* Buttons: New Order & WA Share */}
          <button
            onClick={onOpenNewOrder}
            className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs sm:text-sm shadow-sm transition-transform active:scale-95"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>+ Order VIP</span>
          </button>

          <button
            onClick={onShareWhatsApp}
            title="Salin Antrean ke Format WhatsApp"
            className="flex items-center gap-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 font-semibold px-2.5 py-1.5 rounded-lg text-xs transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Salin WA</span>
          </button>

          {orders.length > 0 && (
            <button
              onClick={onResetData}
              title="Bersihkan Semua Data"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-2 overflow-x-auto border-t border-slate-800/60 pt-1">
        <button
          onClick={() => setActiveTab('room')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'room'
              ? 'border-amber-400 text-amber-400 bg-amber-400/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Swords className="w-3.5 h-3.5" />
          <span>🎮 Live Room & Antrean</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-800 text-amber-300 font-extrabold">
            {inRoomCount}/5 Akun • {waitingCount} Antre
          </span>
        </button>

        <button
          onClick={() => setActiveTab('finance')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'finance'
              ? 'border-emerald-400 text-emerald-400 bg-emerald-400/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          <span>💰 Kas & Rekap Keuangan</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-950 text-emerald-300 font-extrabold border border-emerald-800">
            {orders.length} Transaksi
          </span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'history'
              ? 'border-blue-400 text-blue-400 bg-blue-400/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Flame className="w-3.5 h-3.5" />
          <span>🏆 Riwayat Match ({totalMatches})</span>
        </button>
      </div>
    </header>
  );
}

export default React.memo(Header);
