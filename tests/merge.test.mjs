import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  mergeOrders, mergeTombstones, mergeWallet, deriveRoom, mergeSnapshots, TOMBSTONE_TTL_MS
} from '../netlify/lib/merge.mjs';

const T = (n) => new Date(Date.UTC(2026, 9, 6, 10, 0, n)).toISOString(); // detik ke-n
const ord = (id, over = {}) => ({ id, username: id, status: 'WAITING', roomSlot: null, matchesRemaining: 5, amountPaid: 30000, ...over });

test('mergeOrders: order dari dua sisi digabung, yang hanya ada di server dipertahankan', () => {
  const existing = [ord('a'), ord('b')];
  const incoming = [ord('a'), ord('c')];
  const ids = mergeOrders(existing, incoming, []).map((o) => o.id).sort();
  assert.deepEqual(ids, ['a', 'b', 'c']);
});

test('mergeOrders: updatedAt lebih baru menang; seri -> kiriman klien', () => {
  const e = [ord('a', { matchesRemaining: 3, updatedAt: T(10) })];
  const i = [ord('a', { matchesRemaining: 4, updatedAt: T(5) })];
  assert.equal(mergeOrders(e, i, [])[0].matchesRemaining, 3, 'server lebih baru');
  const i2 = [ord('a', { matchesRemaining: 9, updatedAt: T(20) })];
  assert.equal(mergeOrders(e, i2, [])[0].matchesRemaining, 9, 'klien lebih baru');
  const i3 = [ord('a', { matchesRemaining: 7, updatedAt: T(10) })];
  assert.equal(mergeOrders(e, i3, [])[0].matchesRemaining, 7, 'seri -> klien');
});

test('mergeOrders: order tanpa updatedAt (data lama) tidak menimpa yang sudah punya cap waktu', () => {
  const e = [ord('a', { matchesRemaining: 2, updatedAt: T(10) })];
  const i = [ord('a', { matchesRemaining: 5 })]; // klien lama: tanpa updatedAt
  assert.equal(mergeOrders(e, i, [])[0].matchesRemaining, 2);
});

test('mergeOrders: settledAmount selalu diambil yang terbesar walau sisi lain menang', () => {
  const e = [ord('a', { amountPaid: 100000, settledAmount: 100000, updatedAt: T(10) })];
  const i = [ord('a', { amountPaid: 130000, settledAmount: 0, updatedAt: T(20) })]; // top up dari perangkat basi
  const m = mergeOrders(e, i, [])[0];
  assert.equal(m.amountPaid, 130000);
  assert.equal(m.settledAmount, 100000, 'uang yang sudah dibagi tidak boleh turun');
});

test('mergeOrders: tombstone menghapus order yang tidak diedit sesudahnya, tapi tidak yang diedit sesudahnya', () => {
  const tomb = [{ id: 'x', at: T(10) }];
  const kept = mergeOrders([ord('x', { updatedAt: T(5) })], [], tomb);
  assert.equal(kept.length, 0, 'dihapus');
  const edited = mergeOrders([ord('x', { updatedAt: T(5) })], [ord('x', { updatedAt: T(15) })], tomb);
  assert.equal(edited.length, 1, 'diedit setelah dihapus -> tetap ada');
});

test('mergeTombstones: gabung, ambil yang terbaru, buang yang kedaluwarsa', () => {
  const now = Date.parse(T(0));
  const old = new Date(now - TOMBSTONE_TTL_MS - 1000).toISOString();
  const m = mergeTombstones([{ id: 'a', at: T(1) }, { id: 'old', at: old }], [{ id: 'a', at: T(9) }, { id: 'b', at: T(2) }], now);
  assert.deepEqual(m.map((t) => t.id).sort(), ['a', 'b']);
  assert.equal(m.find((t) => t.id === 'a').at, T(9));
});

test('deriveRoom: dibangun dari roomSlot order; konflik slot -> yang terbaru menang, yang kalah dikeluarkan', () => {
  const orders = [
    ord('p', { status: 'IN_ROOM', roomSlot: 'mid', updatedAt: T(5) }),
    ord('q', { status: 'IN_ROOM', roomSlot: 'mid', updatedAt: T(9) }),
    ord('r', { status: 'COMPLETED', roomSlot: 'exp', matchesRemaining: 0, updatedAt: T(1) }), // kuota habis tapi masih di slot
    ord('s')
  ];
  const { room, orders: fixed } = deriveRoom(orders, T(30));
  assert.equal(room.mid, 'q');
  assert.equal(room.exp, 'r', 'pemain berkuota 0 yang masih di slot tetap dihitung');
  assert.equal(room.jokiGold, null);
  const p = fixed.find((o) => o.id === 'p');
  assert.equal(p.roomSlot, null);
  assert.equal(p.status, 'WAITING');
  assert.equal(fixed.find((o) => o.id === 'q').roomSlot, 'mid');
});

test('mergeWallet: transaksi dari dua perangkat digabung, saldo dihitung ulang dari riwayat', () => {
  const base = { id: 'w0', timestamp: T(1), type: 'PAYOUT_SHARE', amount: 100000, balanceAfter: 100000 };
  const a = { balance: 150000, history: [{ id: 'wa', timestamp: T(5), type: 'INCOME', amount: 50000, balanceAfter: 150000 }, base] };
  const b = { balance: 70000, history: [{ id: 'wb', timestamp: T(7), type: 'EXPENSE', amount: 30000, balanceAfter: 70000 }, base] };
  const m = mergeWallet(a, b);
  assert.equal(m.balance, 120000);
  assert.deepEqual(m.history.map((h) => h.id), ['wb', 'wa', 'w0']);
});

test('mergeWallet: riwayat tidak konsisten dengan saldo -> dompet dengan transaksi terbaru menang (riwayat tetap digabung)', () => {
  const a = { balance: 999, history: [{ id: '1', timestamp: T(1), type: 'INCOME', amount: 100, balanceAfter: 999 }] }; // saldo tak cocok
  const b = { balance: 500, history: [{ id: '2', timestamp: T(9), type: 'INCOME', amount: 500, balanceAfter: 500 }] };
  const m = mergeWallet(a, b);
  assert.equal(m.balance, 500);
  assert.equal(m.history.length, 2);
});

test('mergeSnapshots: match & payout digabung per id, terbaru di depan; room konsisten dengan order', () => {
  const existing = {
    orders: [ord('a', { status: 'IN_ROOM', roomSlot: 'mid', updatedAt: T(3) })],
    matchHistory: [{ id: 'm1', timestamp: T(3), participants: ['@a'] }],
    payouts: [{ id: 'p1', timestamp: T(2) }], myWallet: { balance: 0, history: [] }, settledOrderIds: ['a'], tombstones: [], version: 3
  };
  const incoming = {
    orders: [ord('a', { status: 'IN_ROOM', roomSlot: 'mid', updatedAt: T(3) }), ord('b', { updatedAt: T(4) })],
    matchHistory: [{ id: 'm2', timestamp: T(8), participants: ['@b'] }],
    payouts: [], myWallet: { balance: 0, history: [] }, settledOrderIds: ['b'], tombstones: [], version: 2
  };
  const m = mergeSnapshots(existing, incoming, T(30));
  assert.deepEqual(m.matchHistory.map((x) => x.id), ['m2', 'm1']);
  assert.equal(m.payouts.length, 1);
  assert.deepEqual([...m.settledOrderIds].sort(), ['a', 'b']);
  assert.equal(m.roomParty.mid, 'a');
  assert.equal(m.version, 3);
  assert.equal(m.updatedAt, T(30));
});

test('data asli: roomParty tersimpan == roomParty yang diturunkan dari order (aman dipakai saat merge)', () => {
  const path = process.env.MLBB_BACKUP;
  if (!path || !fs.existsSync(path)) return;
  const db = JSON.parse(fs.readFileSync(path, 'utf8'));
  const { room } = deriveRoom(db.orders, T(0));
  assert.deepEqual(room, db.roomParty);
  // dan penggabungan data asli dengan dirinya sendiri tidak mengubah apa pun yang penting
  const m = mergeSnapshots(db, db, T(0));
  assert.deepEqual(m.orders.map((o) => o.id).sort(), db.orders.map((o) => o.id).sort());
  assert.equal(m.myWallet.balance, db.myWallet.balance);
  assert.equal(m.matchHistory.length, db.matchHistory.length);
  assert.equal(m.payouts.length, db.payouts.length);
});

test('historyClearedAt: riwayat match lama dari perangkat basi tidak hidup kembali, match baru tetap ada', () => {
  const existing = { orders: [], matchHistory: [{ id: 'm-new', timestamp: T(50), participants: [] }], payouts: [], myWallet: { balance: 0, history: [] }, settledOrderIds: [], tombstones: [], historyClearedAt: T(40), version: 3 };
  const incoming = { orders: [], matchHistory: [{ id: 'm-old1', timestamp: T(10), participants: [] }, { id: 'm-old2', timestamp: T(30), participants: [] }], payouts: [], myWallet: { balance: 0, history: [] }, settledOrderIds: [], tombstones: [], version: 3 };
  const m = mergeSnapshots(existing, incoming, T(60));
  assert.deepEqual(m.matchHistory.map((x) => x.id), ['m-new']);
  assert.equal(m.historyClearedAt, T(40));
  // sebaliknya: perangkat yang melakukan pembersihan membawa penandanya
  const m2 = mergeSnapshots({ ...existing, matchHistory: [{ id: 'm-old1', timestamp: T(10), participants: [] }], historyClearedAt: null }, { ...incoming, matchHistory: [], historyClearedAt: T(20) }, T(60));
  assert.deepEqual(m2.matchHistory.map((x) => x.id), [], 'm-old1 (T10) lebih tua dari pembersihan T20');
});
