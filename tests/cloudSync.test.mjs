import test from 'node:test';
import assert from 'node:assert/strict';
import { createCloudSync } from '../src/utils/cloudSync.js';
import { handleRequest, DB_KEY } from '../netlify/lib/dbHandler.mjs';

// ---- lingkungan: satu server (handler asli + store palsu), jam palsu, timer palsu, beberapa klien ----
const timers = [];
let timerId = 0;
globalThis.setTimeout = (fn, ms) => { timers.push({ id: ++timerId, fn, ms }); return timerId; };
globalThis.clearTimeout = (id) => { const i = timers.findIndex((t) => t.id === id); if (i >= 0) timers.splice(i, 1); };
const settle = () => new Promise((r) => setImmediate(r));
async function fireAll() {
  for (let guard = 0; guard < 50 && timers.length; guard++) {
    const t = timers.shift();
    await t.fn();
    await settle();
  }
}

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

function makeEnv() {
  const store = fakeStore();
  let clock = Date.UTC(2026, 9, 6, 10, 0, 0);
  const stats = { posts: 0, gets: 0 };
  const server = async (url, opts) => {
    if ((opts.method || 'GET') === 'POST') stats.posts++; else stats.gets++;
    return handleRequest(new Request('http://x' + url, { method: opts.method, headers: opts.headers, body: opts.body }), store, new Date(clock));
  };
  function makeClient(sharedStorage) {
    const mem = sharedStorage || new Map();
    const storage = { get: (k) => (mem.has(k) ? mem.get(k) : null), set: (k, v) => mem.set(k, v), remove: (k) => mem.delete(k) };
    const gate = { hold: null }; // untuk menahan respons server (mensimulasikan upload yang lambat)
    const fetchImpl = async (url, opts) => {
      const res = await server(url, opts);
      if (gate.hold && (opts.method === 'POST')) { const h = gate.hold; gate.hold = null; await h; }
      return res;
    };
    const sync = createCloudSync({ fetchImpl, storage, now: () => clock });
    const events = [];
    sync.onCloudSaved((e) => events.push(e));
    return { sync, mem, gate, events };
  }
  return { store, stats, makeClient, advance: (s) => { clock += s * 1000; }, now: () => new Date(clock).toISOString() };
}

const ord = (id, over = {}) => ({ id, username: id, orderType: 'VIP_MABAR', role: 'Mid Lane', status: 'WAITING', roomSlot: null, matchesOrdered: 5, matchesRemaining: 5, priceTotal: 30000, amountPaid: 30000, createdAt: '2026-10-06T10:00:00.000Z', updatedAt: '2026-10-06T10:00:00.000Z', ...over });
const payload = (env, orders, extra = {}) => ({
  orders, roomParty: { jokiGold: null, jokiJungle: null, mid: null, roam: null, exp: null }, matchHistory: [], payouts: [],
  myWallet: { balance: 0, history: [] }, settledOrderIds: [], tombstones: [], updatedAt: env.now(), ...extra
});

test('simpan langsung: rev dicatat di klien, dirty dibersihkan', async () => {
  const env = makeEnv();
  const A = env.makeClient();
  assert.equal(A.sync.getSyncState().baseRev, null);
  await A.sync.saveCloudData(payload(env, [ord('o1')]), { immediate: true });
  const st = A.sync.getSyncState();
  assert.equal(st.baseRev, 1);
  assert.equal(st.dirty, false);
  assert.equal(st.hasPending, false);
  assert.equal(env.stats.posts, 1);
});

test('dirty tersimpan permanen sampai upload berhasil (bertahan walau halaman ditutup)', async () => {
  const env = makeEnv();
  const A = env.makeClient();
  await A.sync.saveCloudData(payload(env, [ord('o1')])); // antre saja, belum terkirim
  assert.equal(A.mem.get('mlbb_cloud_dirty_v1'), '1');
  const reloaded = env.makeClient(A.mem).sync; // "buka ulang halaman": storage sama, memori baru
  assert.equal(reloaded.getSyncState().dirty, true);
  await fireAll();
  assert.equal(A.sync.getSyncState().dirty, false);
  assert.equal(env.stats.posts, 1);
});

test('DUA PERANGKAT: B yang basi menyimpan -> digabung, B menerima perubahan A, tidak ada yang hilang', async () => {
  const env = makeEnv();
  const A = env.makeClient();
  const B = env.makeClient();
  await A.sync.saveCloudData(payload(env, [ord('o1')]), { immediate: true });           // rev 1
  const first = await B.sync.fetchCloudData();
  B.sync.adoptCloudState(first.rev, first.data);                                          // B sinkron di rev 1
  env.advance(10);
  await A.sync.saveCloudData(payload(env, [ord('o2', { updatedAt: env.now() }), ord('o1')]), { immediate: true }); // A tambah o2 -> rev 2
  env.advance(10);
  // B (basi) mencatat match pada o1
  const match = { id: 'mB', timestamp: env.now(), participants: ['@o1'] };
  await B.sync.saveCloudData(payload(env, [ord('o1', { matchesRemaining: 4, updatedAt: env.now() })], { matchHistory: [match] }), { immediate: true });
  const last = B.events.at(-1);
  assert.equal(last.merged, true);
  assert.deepEqual(last.data.orders.map((o) => o.id).sort(), ['o1', 'o2'], 'B kini melihat o2 dari A');
  assert.equal(B.sync.getSyncState().baseRev, 3);
  assert.equal(B.sync.getSyncState().dirty, false);
  const stored = await env.store.get(DB_KEY);
  assert.equal(stored.orders.length, 2);
  assert.equal(stored.matchHistory.length, 1);
  assert.equal(stored.orders.find((o) => o.id === 'o1').matchesRemaining, 4);
});

test('EDIT SAAT UPLOAD BERJALAN: hasil gabungan tidak menimpa edit baru; kiriman berikutnya menggabung lagi', async () => {
  const env = makeEnv();
  const A = env.makeClient();
  const B = env.makeClient();
  await A.sync.saveCloudData(payload(env, [ord('o1')]), { immediate: true });           // rev 1
  const f = await B.sync.fetchCloudData(); B.sync.adoptCloudState(f.rev, f.data);
  env.advance(10);
  await A.sync.saveCloudData(payload(env, [ord('oA', { updatedAt: env.now() }), ord('o1')]), { immediate: true }); // rev 2 (A)
  env.advance(10);

  // B mulai upload P1 (basi -> akan digabung) tapi respons server ditahan
  let release; B.gate.hold = new Promise((r) => { release = r; });
  const p1 = payload(env, [ord('o1', { matchesRemaining: 4, updatedAt: env.now() })]);
  const inflight = B.sync.saveCloudData(p1, { immediate: true });
  await settle();
  // selama upload, pengguna B mengedit lagi (P2)
  env.advance(1);
  const p2 = payload(env, [ord('o1', { matchesRemaining: 3, updatedAt: env.now() }), ord('oB', { updatedAt: env.now() })]);
  await B.sync.saveCloudData(p2);
  release();
  await inflight;

  const deferred = B.events.at(-1);
  assert.equal(deferred.merged, true);
  assert.equal(deferred.deferred, true, 'hasil gabungan tidak dipakai karena ada edit lokal yang lebih baru');
  assert.equal(deferred.data, undefined);
  assert.equal(B.sync.getSyncState().baseRev, 1, 'baseRev TIDAK maju, supaya kiriman berikutnya digabung lagi');
  assert.equal(B.sync.getSyncState().dirty, true);

  env.advance(10);
  await fireAll(); // kiriman P2
  const done = B.events.at(-1);
  assert.equal(done.merged, true);
  assert.ok(!done.deferred);
  const ids = done.data.orders.map((o) => o.id).sort();
  assert.deepEqual(ids, ['o1', 'oA', 'oB'], 'edit A, P1 dan P2 semuanya ada');
  assert.equal(done.data.orders.find((o) => o.id === 'o1').matchesRemaining, 3, 'edit terbaru B menang');
  assert.equal(B.sync.getSyncState().dirty, false);
});

test('server menahan penulisan terlalu rapat (429): klien mencoba lagi sendiri tanpa kehilangan data', async () => {
  const env = makeEnv();
  const A = env.makeClient();
  const B = env.makeClient();
  await A.sync.saveCloudData(payload(env, [ord('o1')]), { immediate: true });
  const f = await B.sync.fetchCloudData(); B.sync.adoptCloudState(f.rev, f.data);
  // A dan B menulis dalam selisih < 2 detik
  env.advance(5);
  await A.sync.saveCloudData(payload(env, [ord('o1'), ord('oA', { updatedAt: env.now() })]), { immediate: true });
  env.advance(1);
  const r = await B.sync.saveCloudData(payload(env, [ord('o1'), ord('oB', { updatedAt: env.now() })]), { immediate: true });
  assert.equal(r.success, false);
  assert.equal(B.sync.getSyncState().dirty, true, 'masih menunggu terkirim');
  assert.ok(timers.length > 0, 'retry sudah dijadwalkan');
  env.advance(10);
  await fireAll();
  assert.equal(B.sync.getSyncState().dirty, false);
  const stored = await env.store.get(DB_KEY);
  assert.deepEqual(stored.orders.map((o) => o.id).sort(), ['o1', 'oA', 'oB']);
});

test('isi sama dengan cloud: tidak ada POST sama sekali', async () => {
  const env = makeEnv();
  const A = env.makeClient();
  const base = payload(env, [ord('o1')]);
  await A.sync.saveCloudData(base, { immediate: true });
  const before = env.stats.posts;
  env.advance(30);
  await A.sync.saveCloudData({ ...base, updatedAt: env.now() }, { immediate: true });
  assert.equal(env.stats.posts, before);
  assert.equal(A.sync.getSyncState().dirty, false);
});

test('adoptCloudState: membuang antrean lokal, mencatat rev, dan menghentikan timer', async () => {
  const env = makeEnv();
  const A = env.makeClient();
  await A.sync.saveCloudData(payload(env, [ord('o1')]));
  assert.equal(A.sync.getSyncState().hasPending, true);
  A.sync.adoptCloudState(7);
  const st = A.sync.getSyncState();
  assert.deepEqual({ baseRev: st.baseRev, dirty: st.dirty, hasPending: st.hasPending }, { baseRev: 7, dirty: false, hasPending: false });
  await fireAll();
  assert.equal(env.stats.posts, 0, 'tidak ada upload yang bocor setelah adopt');
});

test('force: reset yang disengaja menimpa data perangkat lain', async () => {
  const env = makeEnv();
  const A = env.makeClient();
  const B = env.makeClient();
  await A.sync.saveCloudData(payload(env, [ord('o1'), ord('o2')]), { immediate: true });
  const f = await B.sync.fetchCloudData(); B.sync.adoptCloudState(f.rev, f.data);
  env.advance(5);
  await A.sync.saveCloudData(payload(env, [ord('o1'), ord('o2'), ord('o3', { updatedAt: env.now() })]), { immediate: true }); // A tambah o3
  env.advance(5);
  const tomb = ['o1', 'o2'].map((id) => ({ id, at: env.now() }));
  await B.sync.saveCloudData(payload(env, [], { tombstones: tomb }), { immediate: true, force: true }); // B reset (basi, tapi disengaja)
  const stored = await env.store.get(DB_KEY);
  assert.equal(stored.orders.length, 0);
  assert.equal(B.sync.getSyncState().dirty, false);
});

test('data lama dari Vercel (tanpa rev): klien pertama sinkron di rev 0 lalu menyimpan tanpa konflik', async () => {
  const env = makeEnv();
  await env.store.setJSON(DB_KEY, { ...payload(env, [ord('o1')]), updatedAt: '2026-10-05T10:06:21.087Z', version: 2 }); // tanpa rev
  const A = env.makeClient();
  const f = await A.sync.fetchCloudData();
  assert.equal(f.rev, 0);
  A.sync.adoptCloudState(f.rev, f.data);
  await A.sync.saveCloudData(payload(env, [ord('o1'), ord('o2', { updatedAt: env.now() })]), { immediate: true });
  const last = A.events.at(-1);
  assert.equal(last.merged, false);
  assert.equal(last.rev, 1);
});
