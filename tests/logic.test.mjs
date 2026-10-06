import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { newId, randomToken } from '../src/utils/ids.js';
import {
  computeUnsettled, migrateLegacySettlement, applySettlement, unsettledAmountOf, isFullySettled, hasBeenSettled
} from '../src/utils/settlement.js';
import { recordMatch } from '../src/utils/matchLogic.js';
import { getCompletionInfo, stampCompletion } from '../src/utils/orderTime.js';

const NOW = '2026-10-06T10:00:00.000Z';
const ord = (id, over = {}) => ({ id, username: id, orderType: 'VIP_MABAR', role: 'Mid Lane', status: 'WAITING', roomSlot: null, matchesOrdered: 5, matchesRemaining: 5, priceTotal: 30000, amountPaid: 30000, ...over });
const room = (over = {}) => ({ jokiGold: null, jokiJungle: null, mid: null, roam: null, exp: null, ...over });

// ---------- ID ----------
test('ID baru unik (100.000 id tanpa bentrok) dan berformat awalan-12hex', () => {
  const seen = new Set();
  for (let i = 0; i < 100000; i++) seen.add(newId('ord'));
  assert.equal(seen.size, 100000);
  assert.match(newId('ord'), /^ord-[0-9a-f]{12}$/);
  assert.match(newId('match'), /^match-[0-9a-f]{12}$/);
  assert.equal(randomToken(8).length, 8);
});

test('ID tetap terbentuk tanpa crypto (konteks tidak aman)', () => {
  const real = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
  try {
    const a = newId('ord'); const b = newId('ord');
    assert.match(a, /^ord-.{12}$/);
    assert.notEqual(a, b);
  } finally {
    if (real) Object.defineProperty(globalThis, 'crypto', real);
  }
});

// ---------- Kas & bagi hasil ----------
test('kas berjalan: uang setelah bagi hasil (top up / pelunasan) TERHITUNG lagi', () => {
  let orders = [ord('a', { amountPaid: 30000 }), ord('b', { amountPaid: 23000, priceTotal: 30000 })];
  assert.equal(computeUnsettled(orders).revenue, 53000);

  orders = applySettlement(orders);                       // bagi hasil
  assert.equal(computeUnsettled(orders).revenue, 0);
  assert.equal(computeUnsettled(orders).count, 0);
  assert.ok(orders.every(isFullySettled));

  orders = orders.map((o) => (o.id === 'b' ? { ...o, amountPaid: 30000 } : o));   // b dilunasi 7rb
  orders = orders.map((o) => (o.id === 'a' ? { ...o, amountPaid: 60000, matchesRemaining: 10 } : o)); // a top up 30rb
  const u = computeUnsettled(orders);
  assert.equal(u.revenue, 37000);
  assert.equal(u.count, 2);
  assert.equal(unsettledAmountOf(orders[1]), 7000);
});

test('bagi hasil kedua hanya membagi uang baru (tidak ada yang dibagi dua kali)', () => {
  let orders = applySettlement([ord('a', { amountPaid: 30000 })]);
  orders = [{ ...orders[0], amountPaid: 50000 }, ord('n', { amountPaid: 7000 })];
  assert.equal(computeUnsettled(orders).revenue, 27000);
  orders = applySettlement(orders);
  assert.equal(computeUnsettled(orders).revenue, 0);
  assert.equal(orders[0].settledAmount, 50000);
});

test('order gratis / belum pernah di-settle dihitung sebagai "pesanan baru" walau uangnya 0', () => {
  const o = ord('g', { amountPaid: 0, paymentStatus: 'GRATIS' });
  assert.equal(hasBeenSettled(o), false);
  assert.deepEqual(computeUnsettled([o]), { revenue: 0, count: 1 });
  assert.deepEqual(computeUnsettled(applySettlement([o])), { revenue: 0, count: 0 });
});

test('koreksi turun setelah settle tidak membuat kas negatif / menghitung ulang', () => {
  const o = { ...ord('a', { amountPaid: 100000 }), settledAmount: 100000 };
  const edited = { ...o, amountPaid: 80000 };
  assert.equal(unsettledAmountOf(edited), 0);
  assert.equal(applySettlement([edited])[0].settledAmount, 100000, 'settledAmount tidak turun');
});

test('migrasi data lama: order di settledOrderIds dianggap sudah dibagi sebesar amountPaid; sisanya tidak', () => {
  const orders = [ord('s', { amountPaid: 30000 }), ord('t', { amountPaid: 14000 })];
  const { orders: m, changed } = migrateLegacySettlement(orders, ['s']);
  assert.equal(changed, true);
  assert.equal(m[0].settledAmount, 30000);
  assert.equal(m[1].settledAmount, undefined);
  assert.equal(computeUnsettled(m).revenue, 14000);
  const again = migrateLegacySettlement(m, ['s']);
  assert.equal(again.changed, false, 'idempoten');
  assert.equal(again.orders, m);
});

test('data asli: kas belum dibagi tetap Rp 522.000, dan ndr (kurang 7rb) yang dilunasi nanti masuk kas', () => {
  const p = process.env.MLBB_BACKUP;
  if (!p || !fs.existsSync(p)) return;
  const db = JSON.parse(fs.readFileSync(p, 'utf8'));
  const { orders } = migrateLegacySettlement(db.orders, db.settledOrderIds);
  const u = computeUnsettled(orders);
  assert.equal(u.revenue, 522000, 'sama dengan yang tampil di aplikasi sekarang');
  assert.equal(u.count, 11);
  const ndr = orders.find((o) => o.id && o.settledAmount !== undefined && o.priceTotal > o.amountPaid);
  assert.ok(ndr, 'ada order settled yang kurang bayar');
  const paid = orders.map((o) => (o.id === ndr.id ? { ...o, amountPaid: o.priceTotal } : o));
  assert.equal(computeUnsettled(paid).revenue, 522000 + (ndr.priceTotal - ndr.amountPaid));
});

// ---------- Match ----------
test('recordMatch: potong 1 kuota semua pemain di room, tandai yang selesai, catat id peserta', () => {
  const orders = [
    ord('a', { status: 'IN_ROOM', roomSlot: 'mid', matchesRemaining: 3 }),
    ord('b', { status: 'IN_ROOM', roomSlot: 'exp', matchesRemaining: 1 }),
    ord('w', { status: 'WAITING' })
  ];
  const r = recordMatch({ orders, roomParty: room({ mid: 'a', exp: 'b' }), result: 'WIN', nowIso: NOW, idFn: (p) => `${p}-X` });
  assert.equal(r.updatedOrders.find((o) => o.id === 'a').matchesRemaining, 2);
  const b = r.updatedOrders.find((o) => o.id === 'b');
  assert.equal(b.matchesRemaining, 0);
  assert.equal(b.status, 'COMPLETED');
  assert.equal(b.completedAt, NOW);
  assert.equal(r.updatedOrders.find((o) => o.id === 'w').matchesRemaining, 5, 'yang di antrean tidak berubah');
  assert.deepEqual(r.match.participantIds, ['a', 'b']);
  assert.equal(r.match.participants.length, 2);
  assert.equal(r.match.overQuotaIds, undefined);
  assert.deepEqual(r.expiredNow, ['@b']);
  assert.equal(r.match.id, 'match-X');
  assert.equal(r.match.matchNumber, 1);
});

test('recordMatch: pemain berkuota 0 tidak dipotong, tapi TERCATAT di luar kuota', () => {
  const orders = [
    ord('a', { status: 'IN_ROOM', roomSlot: 'mid', matchesRemaining: 2 }),
    ord('z', { status: 'COMPLETED', roomSlot: 'exp', matchesRemaining: 0, completedAt: '2026-10-05T00:00:00.000Z' })
  ];
  const r = recordMatch({ orders, roomParty: room({ mid: 'a', exp: 'z' }), result: 'LOSE', nowIso: NOW });
  const z = r.updatedOrders.find((o) => o.id === 'z');
  assert.equal(z.matchesRemaining, 0, 'tidak negatif');
  assert.equal(z.completedAt, '2026-10-05T00:00:00.000Z', 'waktu selesai asli tidak berubah');
  assert.deepEqual(r.match.overQuotaIds, ['z']);
  assert.deepEqual(r.match.participantIds, ['a', 'z']);
  assert.equal(r.overQuotaCount, 1);
  assert.equal(r.match.mvp, null);
});

test('recordMatch: room kosong -> tidak ada peserta; urutan peserta mengikuti urutan order', () => {
  const r = recordMatch({ orders: [ord('a')], roomParty: room(), result: 'WIN', nowIso: NOW });
  assert.equal(r.participantCount, 0);
  assert.equal(r.match.mvp, 'Team Carry');
});

// ---------- Waktu selesai ----------
test('waktu selesai: pakai id peserta (anti username kembar) dan abaikan match di luar kuota', () => {
  const history = [
    { id: 'm3', timestamp: '2026-10-05T12:00:00.000Z', participants: ['@deat (VIP Mid Lane)'], participantIds: ['d2'], overQuotaIds: [] },
    { id: 'm2', timestamp: '2026-10-05T11:00:00.000Z', participants: ['@deat (VIP Mid Lane)'], participantIds: ['d1'], overQuotaIds: ['d1'] }, // d1 sudah lewat kuota
    { id: 'm1', timestamp: '2026-10-05T10:00:00.000Z', participants: ['@deat (VIP Mid Lane)'], participantIds: ['d1'] }
  ];
  const d1 = ord('d1', { username: 'deat' });
  const d2 = ord('d2', { username: 'deat' });
  assert.deepEqual(getCompletionInfo(d1, history), { iso: '2026-10-05T10:00:00.000Z', exact: false });
  assert.deepEqual(getCompletionInfo(d2, history), { iso: '2026-10-05T12:00:00.000Z', exact: false });
  assert.deepEqual(getCompletionInfo({ ...d1, completedAt: 'X' }, history), { iso: 'X', exact: true });
});

test('stampCompletion tetap berfungsi bersama recordMatch (keluar dari COMPLETED menghapus cap)', () => {
  const done = { ...ord('a'), status: 'COMPLETED', completedAt: NOW };
  const back = stampCompletion(done, { ...done, status: 'WAITING', matchesRemaining: 5 }, NOW);
  assert.equal('completedAt' in back, false);
});

// ---------- Pendukung sinkron di aplikasi ----------
import { stampChangedOrders, updateTombstones } from '../src/utils/orderSync.js';

test('stampChangedOrders: hanya order yang berubah yang diberi updatedAt baru', () => {
  const prev = [ord('a', { updatedAt: '2026-10-01T00:00:00.000Z' }), ord('b', { updatedAt: '2026-10-01T00:00:00.000Z' })];
  const next = [prev[0], { ...prev[1], matchesRemaining: 2 }, ord('c')];
  const { orders, removedIds } = stampChangedOrders(prev, next, NOW);
  assert.equal(orders[0], prev[0], 'tidak berubah -> objek sama');
  assert.equal(orders[1].updatedAt, NOW);
  assert.equal(orders[2].updatedAt, NOW, 'order baru juga diberi cap');
  assert.deepEqual(removedIds, []);
});

test('stampChangedOrders: perubahan hanya pada updatedAt dianggap tidak berubah; order hilang -> removedIds', () => {
  const prev = [ord('a', { updatedAt: 'X' }), ord('b')];
  const { orders, removedIds } = stampChangedOrders(prev, [{ ...prev[0], updatedAt: 'Y' }], NOW);
  assert.equal(orders[0].updatedAt, 'Y');
  assert.deepEqual(removedIds, ['b']);
});

test('updateTombstones: catat yang dihapus, buang yang sudah ada lagi dan yang kedaluwarsa', () => {
  const old = new Date(Date.parse(NOW) - 91 * 86400000).toISOString();
  const t = updateTombstones([{ id: 'x', at: '2026-10-01T00:00:00.000Z' }, { id: 'old', at: old }, { id: 'back', at: '2026-10-02T00:00:00.000Z' }], ['y'], ['back'], NOW);
  assert.deepEqual(t.map((x) => x.id).sort(), ['x', 'y']);
  assert.equal(t.find((x) => x.id === 'y').at, NOW);
});
