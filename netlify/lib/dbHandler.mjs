// Logika API database MLBB VIP (GET/POST /api/data) di atas Netlify Blobs.
// Dipisah dari function supaya bisa diuji dengan store palsu (lihat tests/).
//
// Prinsip hemat kuota (paket Free Netlify = 300 kredit/bulan, batas keras):
// - Tidak ada polling, tidak ada loop, tidak ada operasi list() di jalur normal.
// - POST yang isinya sama dengan data tersimpan tidak menulis apa pun.
// - Jeda minimal antar penulisan di server (hentikan loop liar dari klien mana pun).
// - Payload dibatasi ukurannya.
//
// Konsistensi antar perangkat (optimistic concurrency):
// - Server menyimpan `rev` (nomor revisi). Klien mengirim `baseRev` = revisi yang menjadi dasar datanya.
// - baseRev == rev server  -> kiriman klien diterima apa adanya (rev + 1).
// - baseRev berbeda/tidak ada (perangkat lain sudah menulis) -> data DIGABUNG (lihat merge.mjs), bukan ditimpa;
//   hasil gabungan dikembalikan ke klien (`merged: true`).
// - `force: true` (reset / restore yang disengaja) -> ditimpa, snapshot harian tetap menyimpan versi sebelumnya.

import { mergeSnapshots, mergeTombstones } from './merge.mjs';

export const DB_KEY = 'mlbb-live-db.json';
const BACKUP_PREFIX = 'backups/';
const BACKUP_KEEP = 14; // simpan 14 snapshot harian terakhir
const MAX_BODY_BYTES = 1_000_000;
const MIN_WRITE_GAP_MS = 2000;
const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;
const DB_VERSION = 3;

const reply = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });

const revOf = (db) => Number(db && db.rev) || 0;

// Bentuk data yang disimpan
export function normalize(payload, nowIso) {
  return {
    orders: Array.isArray(payload.orders) ? payload.orders : [],
    roomParty: payload.roomParty || { jokiGold: null, jokiJungle: null, mid: null, roam: null, exp: null },
    matchHistory: Array.isArray(payload.matchHistory) ? payload.matchHistory : [],
    payouts: Array.isArray(payload.payouts) ? payload.payouts : [],
    myWallet: payload.myWallet && typeof payload.myWallet === 'object' ? payload.myWallet : { balance: 0, history: [] },
    settledOrderIds: Array.isArray(payload.settledOrderIds) ? payload.settledOrderIds : [],
    lastSettledAt: payload.lastSettledAt || null,
    tombstones: Array.isArray(payload.tombstones) ? payload.tombstones : [],
    historyClearedAt: payload.historyClearedAt || null,
    updatedAt: nowIso,
    version: Math.max(Number(payload.version) || 0, DB_VERSION)
  };
}

// Sidik isi data untuk mendeteksi "tidak ada perubahan". Dibuat kanonik: tidak bergantung pada urutan
// kunci, rev, updatedAt, maupun versi (data lama dari versi sebelumnya harus sama dengan hasil gabungan identik).
const SLOT_ORDER = ['jokiGold', 'jokiJungle', 'mid', 'roam', 'exp'];
export function fingerprint(data) {
  const room = data.roomParty && typeof data.roomParty === 'object' ? data.roomParty : {};
  const wallet = data.myWallet && typeof data.myWallet === 'object' ? data.myWallet : {};
  return JSON.stringify({
    orders: Array.isArray(data.orders) ? data.orders : [],
    roomParty: SLOT_ORDER.map((k) => room[k] || null),
    matchHistory: Array.isArray(data.matchHistory) ? data.matchHistory : [],
    payouts: Array.isArray(data.payouts) ? data.payouts : [],
    myWallet: { balance: Number(wallet.balance) || 0, history: Array.isArray(wallet.history) ? wallet.history : [] },
    settledOrderIds: Array.isArray(data.settledOrderIds) ? data.settledOrderIds : [],
    lastSettledAt: data.lastSettledAt || null,
    tombstones: Array.isArray(data.tombstones) ? data.tombstones : [],
    historyClearedAt: data.historyClearedAt || null
  });
}

async function readDb(store) {
  try {
    return (await store.get(DB_KEY, { type: 'json' })) || null;
  } catch {
    return null;
  }
}

// Snapshot harian (WIB) dari kondisi sebelum penulisan pertama hari itu. Aman bila terjadi salah timpa.
async function snapshotBeforeOverwrite(store, existing, now) {
  const day = new Date(now.getTime() + JAKARTA_OFFSET_MS).toISOString().slice(0, 10);
  const key = `${BACKUP_PREFIX}${day}.json`;
  if (await store.getMetadata(key)) return;
  await store.setJSON(key, existing);

  const { blobs } = await store.list({ prefix: BACKUP_PREFIX });
  const old = blobs.map((b) => b.key).sort().slice(0, Math.max(0, blobs.length - BACKUP_KEEP));
  for (const k of old) await store.delete(k);
}

export async function handleRequest(req, store, now = new Date()) {
  try {
    if (req.method === 'GET' || req.method === 'HEAD') {
      const data = await readDb(store);
      if (!data) return reply(200, { success: true, exists: false, data: null });
      return reply(200, { success: true, exists: true, data, updatedAt: data.updatedAt, rev: revOf(data) });
    }

    if (req.method === 'POST') {
      const declared = Number(req.headers.get('content-length') || 0);
      if (declared > MAX_BODY_BYTES) return reply(413, { success: false, error: 'Payload too large' });

      const text = await req.text();
      if (text.length > MAX_BODY_BYTES) return reply(413, { success: false, error: 'Payload too large' });

      let payload;
      try {
        payload = JSON.parse(text);
      } catch {
        return reply(400, { success: false, error: 'Invalid JSON' });
      }
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return reply(400, { success: false, error: 'Invalid payload' });
      }

      const nowIso = now.toISOString();
      const force = payload.force === true;
      const baseRev = payload.baseRev; // undefined (klien lama) | null (belum pernah sinkron) | angka
      const next = normalize(payload, nowIso);
      const existing = await readDb(store);

      // Database masih kosong: simpan sebagai revisi 1
      if (!existing) {
        await store.setJSON(DB_KEY, { ...next, rev: 1 });
        return reply(200, { success: true, updatedAt: nowIso, rev: 1 });
      }

      const existingRev = revOf(existing);

      // Isi sama -> tidak perlu menulis (klien kini sama dengan server pada revisi ini)
      if (!force && fingerprint(existing) === fingerprint(next)) {
        return reply(200, { success: true, unchanged: true, updatedAt: existing.updatedAt, rev: existingRev });
      }

      // Rem darurat: tolak penulisan beruntun yang terlalu rapat (mencegah loop dari klien mana pun)
      const gap = now.getTime() - Date.parse(existing.updatedAt || 0);
      if (gap >= 0 && gap < MIN_WRITE_GAP_MS) {
        return reply(429, { success: false, error: 'Too many writes, retry shortly', retryAfterMs: MIN_WRITE_GAP_MS - gap });
      }

      await snapshotBeforeOverwrite(store, existing, now);

      // Klien berbasis revisi terbaru (atau reset yang disengaja): terima apa adanya
      if (force || baseRev === existingRev) {
        const tombstones = force ? next.tombstones : mergeTombstones(existing.tombstones, next.tombstones, now.getTime());
        const saved = { ...next, tombstones, rev: existingRev + 1 };
        await store.setJSON(DB_KEY, saved);
        return reply(200, { success: true, updatedAt: nowIso, rev: saved.rev });
      }

      // Perangkat lain sudah menulis sejak klien terakhir sinkron: GABUNGKAN
      const merged = { ...mergeSnapshots(existing, next, nowIso), rev: existingRev + 1 };
      if (fingerprint(merged) === fingerprint(existing)) {
        // kiriman klien tidak menambah apa pun di luar yang sudah ada di server
        return reply(200, { success: true, merged: true, unchanged: true, data: existing, updatedAt: existing.updatedAt, rev: existingRev });
      }
      await store.setJSON(DB_KEY, merged);
      return reply(200, { success: true, merged: true, data: merged, updatedAt: nowIso, rev: merged.rev });
    }

    return reply(405, { success: false, error: 'Method not allowed' });
  } catch (error) {
    console.error('API /api/data error:', error);
    return reply(500, { success: false, error: error.message });
  }
}
