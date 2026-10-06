// Pencatatan hasil match.
//
// - Kuota semua pemain di room dipotong 1 (batas bawah 0), seperti sebelumnya.
// - Pemain yang kuotanya SUDAH 0 tetap tercatat sebagai peserta tetapi ditandai `overQuotaIds`
//   (main di luar kuota), supaya tidak ada match "gratis" yang tidak terlihat.
// - `participantIds` menyimpan id order peserta, sejajar dengan `participants` (nama), sehingga
//   riwayat tidak tertukar saat ada username kembar.

import { stampCompletion } from './orderTime.js';
import { newId } from './ids.js';

export const ROOM_SLOT_KEYS = ['jokiGold', 'jokiJungle', 'mid', 'roam', 'exp'];

const label = (o) => `@${o.username} (${o.orderType === 'JOKI' ? 'Joki ' + o.role : 'VIP ' + o.role})`;

export function recordMatch({ orders, roomParty, matchHistory = [], result, nowIso = new Date().toISOString(), idFn = newId }) {
  const inRoom = ROOM_SLOT_KEYS.map((k) => roomParty[k]).filter(Boolean);
  const inRoomSet = new Set(inRoom);

  const participants = [];
  const participantIds = [];
  const overQuotaIds = [];
  const expiredNow = [];

  const updatedOrders = orders.map((ord) => {
    if (!inRoomSet.has(ord.id)) return ord;
    participants.push(label(ord));
    participantIds.push(ord.id);

    if (ord.matchesRemaining <= 0) {
      overQuotaIds.push(ord.id);
      return ord; // kuota sudah habis: tidak ada yang dipotong
    }

    const remaining = ord.matchesRemaining - 1;
    if (remaining === 0) expiredNow.push(`@${ord.username}`);
    return stampCompletion(ord, {
      ...ord,
      matchesRemaining: remaining,
      status: remaining === 0 ? 'COMPLETED' : 'IN_ROOM'
    }, nowIso);
  });

  const match = {
    id: idFn('match'),
    matchNumber: matchHistory.length + 1,
    result, // 'WIN' | 'LOSE'
    timestamp: nowIso,
    participants,
    participantIds,
    mvp: result === 'WIN' ? participants[0] || 'Team Carry' : null,
    durationMinutes: 15
  };
  if (overQuotaIds.length > 0) match.overQuotaIds = overQuotaIds;

  return { updatedOrders, match, expiredNow, overQuotaCount: overQuotaIds.length, participantCount: participants.length };
}
