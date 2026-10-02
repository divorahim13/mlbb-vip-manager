import React, { useMemo } from 'react';
import { Trophy, Swords, Calendar, Clock, Award, Trash2 } from 'lucide-react';

function MatchHistoryView({ matchHistory = [], onClearHistory }) {
  const { total, wins, losses, wr } = useMemo(() => {
    const t = matchHistory.length;
    let w = 0;
    for (let i = 0; i < t; i++) {
      if (matchHistory[i].result === 'WIN') w++;
    }
    const l = t - w;
    const rate = t > 0 ? Math.round((w / t) * 100) : 0;
    return { total: t, wins: w, losses: l, wr: rate };
  }, [matchHistory]);

  return (
    <div className="space-y-6">
      {/* WR Summary Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-sm">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white">Statistik Match & Performa Tim VIP</h3>
            <p className="text-xs text-slate-400">Rekap kemenangan dan hasil pertandingan room mabar</p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
          <div className="text-center px-2">
            <div className="text-[9px] uppercase font-bold text-slate-400">Total Match</div>
            <div className="text-sm sm:text-base font-black text-white">{total}</div>
          </div>
          <div className="text-center border-l border-slate-800 px-2">
            <div className="text-[9px] uppercase font-bold text-emerald-400">Victory</div>
            <div className="text-sm sm:text-base font-black text-emerald-400">{wins}</div>
          </div>
          <div className="text-center border-l border-slate-800 px-2">
            <div className="text-[9px] uppercase font-bold text-rose-400">Defeat</div>
            <div className="text-sm sm:text-base font-black text-rose-400">{losses}</div>
          </div>
          <div className="text-center border-l border-slate-800 px-2">
            <div className="text-[9px] uppercase font-bold text-amber-400">Win Rate</div>
            <div className="text-sm sm:text-base font-black text-amber-400">{wr}%</div>
          </div>
        </div>
      </div>

      {/* History List */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <h4 className="font-extrabold text-white text-base">Riwayat Pertandingan</h4>
          {matchHistory.length > 0 && (
            <button
              onClick={onClearHistory}
              className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Bersihkan Riwayat</span>
            </button>
          )}
        </div>

        {matchHistory.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-xs italic">
            Belum ada match yang selesai dimainkan.
          </div>
        ) : (
          <div className="mt-3.5 space-y-2.5">
            {matchHistory.map((m, idx) => {
              const isWin = m.result === 'WIN';

              return (
                <div
                  key={m.id || idx}
                  className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors perf-contain ${
                    isWin
                      ? 'bg-emerald-950/20 border-emerald-500/30'
                      : 'bg-rose-950/20 border-rose-500/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-black tracking-wide uppercase ${
                        isWin
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-rose-600 text-white'
                      }`}
                    >
                      {isWin ? 'VICTORY 🏆' : 'DEFEAT 💀'}
                    </span>

                    <div>
                      <div className="font-black text-white text-sm">
                        Match #{m.matchNumber || matchHistory.length - idx}
                      </div>
                      <div className="flex items-center gap-2.5 text-[11px] text-slate-400 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span>•</span>
                        <span>{new Date(m.timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Player Accounts in Match */}
                  {m.participants && m.participants.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-slate-400">Akun:</span>
                      {m.participants.map((p, pIdx) => (
                        <span
                          key={pIdx}
                          className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300"
                        >
                          {p.role ? `${p.role}: ` : ''}@{p.username}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(MatchHistoryView);
