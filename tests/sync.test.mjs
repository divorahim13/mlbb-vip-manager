import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest, DB_KEY } from '../netlify/lib/dbHandler.mjs';

function fakeStore() {
  const data = new Map();
  return {
    data,
    async get(key) { return data.has(key) ? structuredClone(data.get(key)) : null; },
    async setJSON(key, value) { data.set(key, structuredClone(value)); },
    async getMetadata(key) { return data.has(key) ? { etag: 'x' } : null; },
    async list({ prefix }) { return { blobs: [...data.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) }; },
    async delete(key) { data.delete(key); }
  };
}
const t0 = Date.UTC(2026, 9, 6, 10, 0, 0);
const at = (s) => new Date(t0 + s * 1000);
const iso = (s) => at(s).toISOString();
const post = (body) => new Request('http://x/api/data', { method: 'POST', body: JSON.stringify(body) });
const send = async (store, body, s) => { const r = await handleRequest(post(body), store, at(s)); return { status: r.status, ...(await r.json()) }; };
const ord = (id, over = {}) => ({ id, username: id, orderType: 'VIP_MABAR', role: 'Mid Lane', status: 'WAITING', roomSlot: null, matchesOrdered: 5, matchesRemaining: 5, priceTotal: 30000, amountPaid: 30000, createdAt: iso(0), updatedAt: iso(0), ...over });
const base = (over = {}) => ({ orders: [], roomParty: { jokiGold: null, jokiJungle: null, mid: null, roam: null, exp: null }, matchHistory: [], payouts: [], myWallet: { balance: 0, history: [] }, settledOrderIds: [], tombstones: [], ...over });

test('database kosong: kiriman pertama jadi rev 1; kiriman berbasis rev terbaru diterima (rev naik)', async () => {
  const s = fakeStore();
  const r1 = await send(s, { ...base({ orders: [ord('a')] }), baseRev: null }, 0);
  assert.equal(r1.rev, 1);
  const r2 = await send(s, { ...base({ orders: [ord('a'), ord('b')] }), baseRev: 1 }, 10);
  assert.equal(r2.status, 200);
  assert.equal(r2.rev, 2);
  assert.equal(r2.merged, undefined, 'tidak ada penggabungan bila basisnya terbaru');
  assert.equal((await s.get(DB_KEY)).orders.length, 2);
});

test('DUA PERANGKAT: order baru dari A tidak terhapus oleh simpanan B yang basi (digabung)', async () => {
  const s = fakeStore();
  await send(s, { ...base({ orders: [ord('o1')] }), baseRev: null }, 0);                                  // rev 1 (keduanya sinkron di sini)
  await send(s, { ...base({ orders: [ord('o2', { updatedAt: iso(5) }), ord('o1')] }), baseRev: 1 }, 10); // A tambah o2 -> rev 2
  // B (basi, basis rev 1) mencatat match
  const matchB = { id: 'mB', timestamp: iso(20), participants: ['@o1'] };
  const rb = await send(s, { ...base({ orders: [ord('o1', { matchesRemaining: 4, updatedAt: iso(20) })], matchHistory: [matchB] }), baseRev: 1 }, 20);
  assert.equal(rb.merged, true);
  assert.equal(rb.rev, 3);
  const ids = rb.data.orders.map((o) => o.id).sort();
  assert.deepEqual(ids, ['o1', 'o2'], 'o2 dari perangkat A tetap ada');
  assert.equal(rb.data.orders.find((o) => o.id === 'o1').matchesRemaining, 4, 'perubahan B terpakai');
  assert.equal(rb.data.matchHistory.length, 1);
  const stored = await s.get(DB_KEY);
  assert.equal(stored.rev, 3);
  assert.equal(stored.orders.length, 2);
});

test('hapus order di A tidak "hidup lagi" oleh simpanan B yang basi; tapi order yang diedit sesudah dihapus tetap ada', async () => {
  const s = fakeStore();
  await send(s, { ...base({ orders: [ord('x'), ord('y')] }), baseRev: null }, 0);           // rev 1
  await send(s, { ...base({ orders: [ord('y')], tombstones: [{ id: 'x', at: iso(10) }] }), baseRev: 1 }, 10); // A hapus x -> rev 2
  // B basi masih punya x; mengedit y
  const rb = await send(s, { ...base({ orders: [ord('x'), ord('y', { matchesRemaining: 1, updatedAt: iso(20) })] }), baseRev: 1 }, 20);
  assert.equal(rb.merged, true);
  assert.deepEqual(rb.data.orders.map((o) => o.id), ['y'], 'x tetap terhapus');
  assert.equal(rb.data.tombstones.length, 1);
  // C mengedit x SETELAH A menghapusnya -> x kembali (edit lebih baru dari hapus)
  const rc = await send(s, { ...base({ orders: [ord('x', { matchesRemaining: 2, updatedAt: iso(40) }), ord('y')] }), baseRev: 1 }, 40);
  assert.ok(rc.data.orders.some((o) => o.id === 'x'));
});

test('uang yang sudah dibagi (settledAmount) tidak bisa turun walau perangkat basi menang', async () => {
  const s = fakeStore();
  await send(s, { ...base({ orders: [ord('a', { amountPaid: 100000 })] }), baseRev: null }, 0);                         // rev 1
  await send(s, { ...base({ orders: [ord('a', { amountPaid: 100000, settledAmount: 100000, updatedAt: iso(10) })] }), baseRev: 1 }, 10); // A bagi hasil
  // B (basi) top up 30rb pada order yang sama; updatedAt B lebih baru
  const rb = await send(s, { ...base({ orders: [ord('a', { amountPaid: 130000, updatedAt: iso(20) })] }), baseRev: 1 }, 20);
  const a = rb.data.orders[0];
  assert.equal(a.amountPaid, 130000);
  assert.equal(a.settledAmount, 100000);
});

test('dompet: bagi hasil di A + pengeluaran di B -> saldo gabungan benar', async () => {
  const s = fakeStore();
  const w0 = { id: 'w0', timestamp: iso(0), type: 'PAYOUT_SHARE', amount: 100000, balanceAfter: 100000 };
  await send(s, { ...base({ myWallet: { balance: 100000, history: [w0] } }), baseRev: null }, 0);
  await send(s, { ...base({ myWallet: { balance: 160000, history: [{ id: 'wa', timestamp: iso(10), type: 'PAYOUT_SHARE', amount: 60000, balanceAfter: 160000 }, w0] } }), baseRev: 1 }, 10);
  const rb = await send(s, { ...base({ myWallet: { balance: 70000, history: [{ id: 'wb', timestamp: iso(20), type: 'EXPENSE', amount: 30000, balanceAfter: 70000 }, w0] } }), baseRev: 1 }, 20);
  assert.equal(rb.data.myWallet.balance, 130000);
  assert.equal(rb.data.myWallet.history.length, 3);
});

test('klien lama (tanpa baseRev) menggabung, tidak menimpa data baru', async () => {
  const s = fakeStore();
  await send(s, { ...base({ orders: [ord('o1')] }), baseRev: null }, 0);
  await send(s, { ...base({ orders: [ord('o2', { updatedAt: iso(5) }), ord('o1')] }), baseRev: 1 }, 10);
  const old = await send(s, { orders: [ord('o1', { updatedAt: undefined })], roomParty: {}, matchHistory: [{ id: 'm', timestamp: iso(15), participants: [] }], payouts: [], myWallet: { balance: 0, history: [] }, settledOrderIds: [] }, 20);
  assert.equal(old.merged, true);
  assert.equal(old.data.orders.length, 2, 'o2 tidak hilang');
});

test('force: reset yang disengaja menimpa (snapshot harian menyimpan versi sebelumnya)', async () => {
  const s = fakeStore();
  await send(s, { ...base({ orders: [ord('a'), ord('b')], matchHistory: [{ id: 'm', timestamp: iso(1), participants: [] }] }), baseRev: null }, 0);
  const r = await send(s, { ...base({ orders: [], tombstones: [{ id: 'a', at: iso(10) }, { id: 'b', at: iso(10) }] }), baseRev: 1, force: true }, 10);
  assert.equal(r.status, 200);
  assert.equal(r.merged, undefined);
  const stored = await s.get(DB_KEY);
  assert.equal(stored.orders.length, 0);
  assert.equal(stored.matchHistory.length, 0);
  assert.equal(stored.rev, 2);
  const snap = [...s.data.keys()].find((k) => k.startsWith('backups/'));
  assert.equal(s.data.get(snap).orders.length, 2, 'snapshot menyimpan kondisi sebelum reset');
});

test('isi sama dengan server walau basisnya basi -> unchanged (tanpa menulis), rev tetap', async () => {
  const s = fakeStore();
  await send(s, { ...base({ orders: [ord('a')] }), baseRev: null }, 0);
  await send(s, { ...base({ orders: [ord('a'), ord('b')] }), baseRev: 1 }, 10);
  const sameAsServer = await send(s, { ...base({ orders: [ord('a'), ord('b')] }), baseRev: 1 }, 20);
  assert.equal(sameAsServer.unchanged, true);
  assert.equal(sameAsServer.rev, 2);
});

test('GET mengembalikan rev; data lama tanpa rev dianggap rev 0 dan kiriman basis 0 diterima', async () => {
  const s = fakeStore();
  s.data.set(DB_KEY, { ...base({ orders: [ord('a')] }), updatedAt: iso(-100), version: 2 }); // data lama dari Vercel
  const g = await (await handleRequest(new Request('http://x/api/data'), s, at(0))).json();
  assert.equal(g.rev, 0);
  const r = await send(s, { ...base({ orders: [ord('a'), ord('b')] }), baseRev: 0 }, 5);
  assert.equal(r.rev, 1);
  assert.equal(r.merged, undefined);
});

test('reset + pembersihan riwayat: perangkat basi tidak menghidupkan kembali order maupun riwayat match', async () => {
  const s = fakeStore();
  const m1 = { id: 'm1', timestamp: iso(1), participants: ['@a'] };
  await send(s, { ...base({ orders: [ord('a')], matchHistory: [m1] }), baseRev: null }, 0);                                   // rev 1
  await send(s, { ...base({ orders: [], matchHistory: [], tombstones: [{ id: 'a', at: iso(10) }], historyClearedAt: iso(10) }), baseRev: 1, force: true }, 10); // A reset (force) -> rev 2
  const rb = await send(s, { ...base({ orders: [ord('a')], matchHistory: [m1] }), baseRev: 1 }, 20);                         // B basi menyimpan data lama
  assert.equal(rb.merged, true);
  assert.equal(rb.data.orders.length, 0, 'order tidak hidup kembali');
  assert.equal(rb.data.matchHistory.length, 0, 'riwayat match tidak hidup kembali');
  // match baru setelah pembersihan tetap tersimpan
  const rc = await send(s, { ...base({ matchHistory: [{ id: 'm2', timestamp: iso(30), participants: [] }], historyClearedAt: iso(10) }), baseRev: rb.rev }, 40);
  assert.equal(rc.status, 200);
  assert.equal((await s.get(DB_KEY)).matchHistory.length, 1);
});

test('pembanding "isi sama" tidak peka urutan kunci / versi lama / nilai null vs kosong', async () => {
  const { fingerprint } = await import('../netlify/lib/dbHandler.mjs');
  const legacy = { orders: [ord('a')], roomParty: { exp: null, jokiGold: 'a', jokiJungle: null, mid: null, roam: null }, matchHistory: [], payouts: [], myWallet: { history: [], balance: 5 }, settledOrderIds: [], version: 2, updatedAt: 'x' };
  const modern = { version: 3, tombstones: [], historyClearedAt: null, lastSettledAt: null, rev: 9, updatedAt: 'y', settledOrderIds: [], payouts: [], matchHistory: [], orders: [ord('a')], myWallet: { balance: 5, history: [] }, roomParty: { jokiGold: 'a', jokiJungle: null, mid: null, roam: null, exp: null } };
  assert.equal(fingerprint(legacy), fingerprint(modern));
  assert.notEqual(fingerprint(legacy), fingerprint({ ...modern, myWallet: { balance: 6, history: [] } }));
  assert.notEqual(fingerprint(legacy), fingerprint({ ...modern, tombstones: [{ id: 'z', at: 'q' }] }));
});

test('klien pertama setelah deploy dengan data identik (baseRev null) -> unchanged, TANPA menulis ulang database', async () => {
  const s = fakeStore();
  const prod = { ...base({ orders: [ord('a'), ord('b')], matchHistory: [{ id: 'm1', timestamp: iso(1), participants: ['@a'] }] }), roomParty: { exp: null, jokiGold: null, jokiJungle: null, mid: null, roam: null }, version: 2, updatedAt: iso(-3600) };
  delete prod.tombstones;
  s.data.set(DB_KEY, prod);
  const before = JSON.stringify(s.data.get(DB_KEY));
  const r = await send(s, { ...base({ orders: [ord('a'), ord('b')], matchHistory: [{ id: 'm1', timestamp: iso(1), participants: ['@a'] }] }), baseRev: null }, 0);
  assert.equal(r.unchanged, true);
  assert.equal(JSON.stringify(s.data.get(DB_KEY)), before, 'database tidak disentuh');
  assert.equal([...s.data.keys()].filter((k) => k.startsWith('backups/')).length, 0, 'tidak ada snapshot/penulisan yang tidak perlu');
});
