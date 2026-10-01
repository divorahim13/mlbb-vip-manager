import React from 'react';
import { Trophy, Swords, Calendar, Clock, Award, Trash2 } from 'lucide-react';

export default function MatchHistoryView({ matchHistory, onClearHistory }) {
  const total = matchHistory.length;
  const wins = matchHistory.filter(m => m.result === 'WIN').length;
  const losses = total - wins;
  const wr = total > 0 ? Math.round((wins / total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* WR Summary Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-glow-blue">
            <Trophy className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-xl font-black text-white">Statistik Match & Performa Tim VIP</h3>
            <p className="text-xs text-slate-400">Rekap kemenangan dan hasil pertandingan room mabar</p>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-slate-950 p-3 rounded-xl border border-slate-800">
          <div className="text-center px-2">
            <div className="text-[10px] uppercase font-bold text-slate-400">Total Match</div>
            <div className="text-base font-black text-white">{total}</div>
          </div>
          <div className="text-center border-l border-slate-800 px-2">
            <div className="text-[10px] uppercase font-bold text-emerald-400">Victory</div>
            <div className="text-base font-black text-emerald-400">{wins}</div>
          </div>
          <div className="text-center border-l border-slate-800 px-2">
            <div className="text-[10px] uppercase font-bold text-rose-400">Defeat</div>
            <div className="text-base font-black text-rose-400">{losses}</div>
          </div>
          <div className="text-center border-l border-slate-800 px-2">
            <div className="text-[10px] uppercase font-bold text-amber-400">Win Rate</div>
            <div className="text-base font-black text-amber-400">{wr}%</div>
          </div>
        </div>
      </div>

      {/* History List */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl">
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
          <div className="text-center py-12 text-slate-400 text-xs italic">
            Belum ada match yang selesai dimainkan.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {matchHistory.map((m, idx) => {
              const isWin = m.result === 'WIN';

              return (
                <div
                  key={m.id || idx}
                  className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                    isWin
                      ? 'bg-emerald-950/20 border-emerald-500/30 shadow-sm'
                      : 'bg-rose-950/20 border-rose-500/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-3 py-1.5 rounded-lg text-xs font-black tracking-wide uppercase ${
                        isWin
                          ? 'bg-emerald-500 text-slate-950 shadow-glow-emerald'
                          : 'bg-rose-600 text-white'
                      }`}
                    >
                      {isWin ? 'VICTORY 🏆' : 'DEFEAT 💀'}
                    </span>

                    <div>
                      <div className="font-black text-white text-sm">
                        Match #{m.matchNumber || matchHistory.length - idx}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span>•</span>
                        <span>{new Date(m.timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Players participated */}
                  <div className="flex flex-col sm:items-end text-xs">
                    <div className="text-slate-300 font-semibold">
                      VIP Party: {m.participants ? m.participants.join(', ') : 'Host + Team'}
                    </div>
                    {m.mvp && (
                      <div className="text-amber-300 text-[11px] font-bold mt-0.5 flex items-center gap-1">
                        <Award className="w-3.5 h-3.5" /> MVP: {m.mvp}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
