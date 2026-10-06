// Penggabungan dua versi database (versi tersimpan di server + kiriman klien yang berbasis data lama).
// Dipakai saat dua perangkat menyimpan bergantian: tidak ada perubahan yang boleh saling menimpa.
//
// Aturan:
// - order        : gabungan per id; yang `updatedAt`-nya lebih baru menang (seri: kiriman klien).
//                  `settledAmount` selalu diambil yang terbesar (uang yang sudah dibagi tidak boleh turun).
// - hapus order  : lewat `tombstones` ({id, at}); order hilang jika at >= updatedAt order tsb.
// - roomParty    : DIBANGUN ULANG dari order (roomSlot), jadi selalu konsisten dengan order.
// - matchHistory / payouts : gabungan per id, terbaru di depan. Riwayat match yang lebih tua dari
//                  `historyClearedAt` (dibersihkan sengaja) tidak dihidupkan kembali oleh perangkat basi.
// - myWallet     : riwayat digabung per id; saldo dihitung ulang dari riwayat bila konsisten.

export const SLOT_KEYS = ['jokiGold', 'jokiJungle', 'mid', 'roam', 'exp'];
export const TOMBSTONE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

const ts = (v) => {
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : 0;
};
const num = (v) => Number(v) || 0;

function unionById(a = [], b = [], keyOf = (x) => x.id) {
  const map = new Map();
  for (const x of [...a, ...b]) {
    if (!x) continue;
    const k = keyOf(x);
    if (k === undefined || k === null) continue;
    if (!map.has(k)) map.set(k, x);
  }
  return [...map.values()];
}

export function mergeTombstones(a = [], b = [], nowMs = Date.now()) {
  const map = new Map();
  for (const t of [...(a || []), ...(b || [])]) {
    if (!t || !t.id) continue;
    const cur = map.get(t.id);
    if (!cur || ts(t.at) > ts(cur.at)) map.set(t.id, { id: t.id, at: t.at });
  }
  return [...map.values()].filter((t) => nowMs - ts(t.at) <= TOMBSTONE_TTL_MS);
}

function pickOrder(existing, incoming) {
  const win = ts(incoming.updatedAt) >= ts(existing.updatedAt) ? incoming : existing;
  const hasSettled = existing.settledAmount != null || incoming.settledAmount != null;
  if (!hasSettled) return win;
  return { ...win, settledAmount: Math.max(num(existing.settledAmount), num(incoming.settledAmount)) };
}

export function mergeOrders(existingOrders = [], incomingOrders = [], tombstones = []) {
  const incomingIds = new Set(incomingOrders.map((o) => o.id));
  const existingById = new Map(existingOrders.map((o) => [o.id, o]));

  // order yang hanya ada di server (mis. dibuat perangkat lain) ditaruh di depan, lalu urutan klien
  const onlyExisting = existingOrders.filter((o) => !incomingIds.has(o.id));
  const fromIncoming = incomingOrders.map((o) => (existingById.has(o.id) ? pickOrder(existingById.get(o.id), o) : o));
  const all = [...onlyExisting, ...fromIncoming];

  const tomb = new Map(tombstones.map((t) => [t.id, ts(t.at)]));
  return all.filter((o) => !(tomb.has(o.id) && tomb.get(o.id) >= ts(o.updatedAt)));
}

// roomParty selalu diturunkan dari order. Dua order di slot yang sama -> yang terbaru menang,
// yang kalah dikeluarkan dari slot (kembali ke antrean bila kuota masih ada).
export function deriveRoom(orders, nowIso) {
  const room = Object.fromEntries(SLOT_KEYS.map((k) => [k, null]));
  const claimants = orders
    .filter((o) => o.roomSlot && SLOT_KEYS.includes(o.roomSlot))
    .sort((x, y) => ts(y.updatedAt) - ts(x.updatedAt));
  const demote = new Set();
  for (const o of claimants) {
    if (!room[o.roomSlot]) room[o.roomSlot] = o.id;
    else demote.add(o.id);
  }
  const fixed = orders.map((o) => {
    if (!demote.has(o.id)) return o;
    return { ...o, roomSlot: null, status: num(o.matchesRemaining) > 0 ? 'WAITING' : 'COMPLETED', updatedAt: nowIso };
  });
  return { room, orders: fixed };
}

const EFFECT = { INCOME: 1, PAYOUT_SHARE: 1, ADJUST_UP: 1, EXPENSE: -1, ADJUST_DOWN: -1 };
function effectOf(h) {
  if (h.type === 'ADJUST') return num(h.amount); // data lama: bertanda
  const sign = EFFECT[h.type];
  return sign === undefined ? null : sign * Math.abs(num(h.amount));
}
function balanceFromHistory(history = []) {
  let sum = 0;
  for (const h of history) {
    const e = effectOf(h);
    if (e === null) return null;
    sum += e;
  }
  return sum;
}

export function mergeWallet(a, b) {
  const wa = a && typeof a === 'object' ? a : { balance: 0, history: [] };
  const wb = b && typeof b === 'object' ? b : { balance: 0, history: [] };
  const ha = Array.isArray(wa.history) ? wa.history : [];
  const hb = Array.isArray(wb.history) ? wb.history : [];
  const history = unionById(hb, ha).sort((x, y) => ts(y.timestamp) - ts(x.timestamp));

  const ra = balanceFromHistory(ha);
  const rb = balanceFromHistory(hb);
  const consistent = ra !== null && rb !== null && ra === num(wa.balance) && rb === num(wb.balance);
  if (consistent) {
    const rm = balanceFromHistory(history);
    if (rm !== null) return { balance: rm, history };
  }
  // Riwayat tidak bisa dijadikan sumber kebenaran: dompet dengan transaksi terbaru menang
  const newest = (h) => h.reduce((m, x) => Math.max(m, ts(x.timestamp)), 0);
  const win = newest(hb) >= newest(ha) ? wb : wa;
  return { balance: num(win.balance), history };
}

export function mergeSnapshots(existing, incoming, nowIso = new Date().toISOString()) {
  const nowMs = Date.parse(nowIso);
  const tombstones = mergeTombstones(existing.tombstones, incoming.tombstones, nowMs);
  const mergedOrders = mergeOrders(existing.orders || [], incoming.orders || [], tombstones);
  const { room, orders } = deriveRoom(mergedOrders, nowIso);

  const byTimeDesc = (x, y) => ts(y.timestamp) - ts(x.timestamp);
  const historyClearedAt = ts(incoming.historyClearedAt) >= ts(existing.historyClearedAt) ? incoming.historyClearedAt || null : existing.historyClearedAt || null;
  const matchKey = (m) => m.id ?? `${m.timestamp}|${(m.participants || []).join(',')}`;

  return {
    orders,
    roomParty: room,
    matchHistory: unionById(incoming.matchHistory || [], existing.matchHistory || [], matchKey)
      .filter((m) => !historyClearedAt || ts(m.timestamp) > ts(historyClearedAt))
      .sort(byTimeDesc),
    historyClearedAt,
    payouts: unionById(incoming.payouts || [], existing.payouts || []).sort(byTimeDesc),
    myWallet: mergeWallet(existing.myWallet, incoming.myWallet),
    settledOrderIds: [...new Set([...(existing.settledOrderIds || []), ...(incoming.settledOrderIds || [])])],
    lastSettledAt: ts(incoming.lastSettledAt) >= ts(existing.lastSettledAt) ? incoming.lastSettledAt || existing.lastSettledAt || null : existing.lastSettledAt || null,
    tombstones,
    version: Math.max(num(existing.version), num(incoming.version), 3),
    updatedAt: nowIso
  };
}
