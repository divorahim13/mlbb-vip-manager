import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest, DB_KEY } from '../netlify/lib/dbHandler.mjs';

// Store palsu di memori (meniru bagian dari API @netlify/blobs yang dipakai handler) + hitung operasi
function fakeStore() {
  const data = new Map();
  const ops = { get: 0, set: 0, list: 0, delete: 0, meta: 0 };
  return {
    data,
    ops,
    async get(key) { ops.get++; return data.has(key) ? structuredClone(data.get(key)) : null; },
    async setJSON(key, value) { ops.set++; data.set(key, structuredClone(value)); },
    async getMetadata(key) { ops.meta++; return data.has(key) ? { etag: 'x' } : null; },
    async list({ prefix }) { ops.list++; return { blobs: [...data.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) }; },
    async delete(key) { ops.delete++; data.delete(key); }
  };
}

const post = (body) => new Request('http://x/api/data', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) });
const get = () => new Request('http://x/api/data', { method: 'GET' });
const t0 = new Date('2026-10-06T10:00:00.000Z');
const at = (ms) => new Date(t0.getTime() + ms);
const sample = (n = 1) => ({ orders: [{ id: `o${n}`, amountPaid: 1000 * n }], matchHistory: [], payouts: [], myWallet: { balance: n, history: [] }, settledOrderIds: [], roomParty: { jokiGold: null } });

test('GET pada database kosong', async () => {
  const r = await handleRequest(get(), fakeStore(), t0);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { success: true, exists: false, data: null });
});

test('POST lalu GET mengembalikan data yang sama', async () => {
  const s = fakeStore();
  const w = await handleRequest(post(sample(3)), s, t0);
  assert.equal(w.status, 200);
  const r = await (await handleRequest(get(), s, at(60000))).json();
  assert.equal(r.exists, true);
  assert.equal(r.data.orders[0].id, 'o3');
  assert.equal(r.data.myWallet.balance, 3);
  assert.equal(r.updatedAt, t0.toISOString());
});

test('POST dengan isi sama tidak menulis apa pun (hemat operasi)', async () => {
  const s = fakeStore();
  await handleRequest(post(sample(1)), s, t0);
  const before = { ...s.ops };
  const r = await (await handleRequest(post(sample(1)), s, at(60000))).json();
  assert.equal(r.unchanged, true);
  assert.equal(s.ops.set, before.set, 'tidak boleh ada setJSON baru');
  assert.equal(s.ops.list, before.list);
});

test('rem darurat: penulisan berbeda dalam < 2 dtk ditolak 429, lalu lolos setelahnya', async () => {
  const s = fakeStore();
  const first = await (await handleRequest(post(sample(1)), s, t0)).json();
  const fast = await handleRequest(post({ ...sample(2), baseRev: first.rev }), s, at(500));
  assert.equal(fast.status, 429);
  assert.equal((await s.get(DB_KEY)).orders[0].id, 'o1', 'data lama tetap utuh');
  const ok = await handleRequest(post({ ...sample(2), baseRev: first.rev }), s, at(5000));
  assert.equal(ok.status, 200);
  assert.equal((await s.get(DB_KEY)).orders[0].id, 'o2');
});

test('snapshot harian dibuat sekali per hari (WIB) dan hanya 14 yang disimpan', async () => {
  const s = fakeStore();
  await handleRequest(post(sample(1)), s, t0); // belum ada data lama -> belum ada snapshot
  assert.equal([...s.data.keys()].filter((k) => k.startsWith('backups/')).length, 0);

  await handleRequest(post(sample(2)), s, at(10000)); // tulis pertama yang menimpa -> snapshot hari ini
  await handleRequest(post(sample(3)), s, at(20000)); // hari yang sama -> tidak ada snapshot baru
  assert.deepEqual([...s.data.keys()].filter((k) => k.startsWith('backups/')), ['backups/2026-10-06.json']);
  assert.equal(s.data.get('backups/2026-10-06.json').orders[0].id, 'o1', 'snapshot = kondisi sebelum perubahan hari itu');

  for (let d = 1; d <= 20; d++) { // 20 hari berikutnya
    await handleRequest(post(sample(100 + d)), s, new Date(t0.getTime() + d * 86400000));
  }
  const backups = [...s.data.keys()].filter((k) => k.startsWith('backups/')).sort();
  assert.equal(backups.length, 14);
  assert.equal(backups.at(-1), '2026-10-26.json'.replace(/^/, 'backups/'));
});

test('payload tidak valid ditolak', async () => {
  const s = fakeStore();
  assert.equal((await handleRequest(post('{bukan json'), s, t0)).status, 400);
  assert.equal((await handleRequest(post('[1,2,3]'), s, t0)).status, 400);
  assert.equal((await handleRequest(post('"teks"'), s, t0)).status, 400);
  assert.equal((await handleRequest(post('x'.repeat(1_000_001)), s, t0)).status, 413);
  assert.equal((await handleRequest(new Request('http://x/api/data', { method: 'DELETE' }), s, t0)).status, 405);
  assert.equal(s.ops.set, 0, 'tidak ada yang tertulis');
});

test('data asli (cadangan Vercel) lolos tanpa kehilangan satu pun data', async () => {
  const fs = await import('node:fs');
  const path = process.env.MLBB_BACKUP;
  if (!path || !fs.existsSync(path)) return; // opsional, hanya jika file cadangan diberikan
  const original = JSON.parse(fs.readFileSync(path, 'utf8'));
  const s = fakeStore();
  assert.equal((await handleRequest(post(original), s, t0)).status, 200);
  const saved = await s.get(DB_KEY);
  for (const k of ['orders', 'matchHistory', 'payouts', 'myWallet', 'settledOrderIds', 'roomParty']) {
    assert.deepEqual(saved[k], original[k], `field ${k} harus identik`);
  }
  assert.ok(saved.version >= original.version, 'versi data tidak boleh turun');
});
