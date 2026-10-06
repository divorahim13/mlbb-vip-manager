// Utilitas Sinkronisasi Cloud Database (Netlify Function + Netlify Blobs)
// READ (GET) dan WRITE (POST) sama-sama lewat /api/data.
//
// PENTING (paket Free Netlify = 300 kredit/bulan, batas keras; semua situs akun berhenti jika habis):
// setiap panggilan ke /api/data = 1 request + sedikit compute. Karena itu:
// - penyimpanan ke cloud DIGABUNG (debounce + max-wait) dan dilewati jika isinya sama dengan cloud
// - ada pembatas lokal jumlah baca/tulis per jam (rem darurat terhadap loop/bug)
// Data lokal tetap tersimpan langsung di localStorage, jadi tidak ada data hilang saat cloud ditahan.
//
// KONSISTENSI ANTAR PERANGKAT:
// - Klien mengingat `baseRev` (revisi server yang menjadi dasar datanya) di localStorage.
// - Setiap kiriman membawa baseRev. Jika perangkat lain sudah menulis, server menggabungkan data dan
//   mengembalikan hasilnya (`merged: true`) -> aplikasi memakainya (lihat listener onCloudSaved).
// - `dirty` = ada perubahan lokal yang belum terkirim (bertahan walau halaman ditutup).

const DEFAULTS = {
  apiUrl: '/api/data',
  debounceMs: 20000, // tunggu 20 dtk tanpa aksi baru sebelum upload
  maxWaitMs: 180000, // paling lama 3 menit sejak perubahan pertama
  leaveFlushMinGapMs: 30000, // flush saat tab disembunyikan, maks 1x per 30 dtk
  retryBaseMs: 60000,
  retryMaxMs: 600000,
  keepaliveLimitBytes: 60000,
  maxReadsPerHour: 120,
  maxWritesPerHour: 40 // normalnya <= 20/jam (debounce 20 dtk, max-wait 3 mnt)
};

const REV_KEY = 'mlbb_cloud_rev_v1';
const DIRTY_KEY = 'mlbb_cloud_dirty_v1';
const HOUR_MS = 3600000;

function browserStorage() {
  return {
    get(key) {
      try {
        return globalThis.localStorage ? globalThis.localStorage.getItem(key) : null;
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        globalThis.localStorage && globalThis.localStorage.setItem(key, value);
      } catch {
        /* penyimpanan penuh / diblokir: abaikan */
      }
    },
    remove(key) {
      try {
        globalThis.localStorage && globalThis.localStorage.removeItem(key);
      } catch {
        /* abaikan */
      }
    }
  };
}

// Hash isi data (tanpa updatedAt/rev) untuk mendeteksi "tidak ada perubahan".
function hashData(data) {
  if (!data || typeof data !== 'object') return null;
  const normalized = {
    orders: Array.isArray(data.orders) ? data.orders : [],
    roomParty: data.roomParty || null,
    matchHistory: Array.isArray(data.matchHistory) ? data.matchHistory : [],
    payouts: Array.isArray(data.payouts) ? data.payouts : [],
    myWallet: data.myWallet && typeof data.myWallet === 'object' ? data.myWallet : null,
    settledOrderIds: Array.isArray(data.settledOrderIds) ? data.settledOrderIds : [],
    lastSettledAt: data.lastSettledAt || null,
    tombstones: Array.isArray(data.tombstones) ? data.tombstones : [],
    historyClearedAt: data.historyClearedAt || null
  };
  const str = JSON.stringify(normalized);
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  }
  return `${str.length}:${h}`;
}

export function createCloudSync(options = {}) {
  const cfg = { ...DEFAULTS, ...options };
  const fetchImpl = options.fetchImpl || ((...args) => globalThis.fetch(...args));
  const storage = options.storage || browserStorage();
  const nowMs = options.now || (() => Date.now());
  const setT = (fn, ms) => globalThis.setTimeout(fn, ms);
  const clearT = (id) => globalThis.clearTimeout(id);

  let pendingPayload = null;
  let pendingForce = false;
  let debounceTimer = null;
  let maxWaitTimer = null;
  let retryTimer = null;
  let retryDelay = cfg.retryBaseMs;
  let inFlight = null;
  let lastKnownCloudHash = null;
  let lastFlushAt = 0;
  const savedListeners = new Set();
  const readTimes = [];
  const writeTimes = [];

  // ---- state persisten ----
  const readRev = () => {
    const v = storage.get(REV_KEY);
    return v === null || v === undefined || v === '' ? null : Number(v);
  };
  const writeRev = (rev) => {
    if (rev === null || rev === undefined) storage.remove(REV_KEY);
    else storage.set(REV_KEY, String(rev));
  };
  const readDirty = () => storage.get(DIRTY_KEY) === '1';
  const writeDirty = (v) => (v ? storage.set(DIRTY_KEY, '1') : storage.remove(DIRTY_KEY));

  function underHourlyLimit(times, max) {
    const now = nowMs();
    while (times.length && now - times[0] > HOUR_MS) times.shift();
    if (times.length >= max) return false;
    times.push(now);
    return true;
  }

  const remember = (data) => {
    const h = hashData(data);
    if (h) lastKnownCloudHash = h;
  };

  // ---- baca ----
  async function fetchCloudData() {
    if (!underHourlyLimit(readTimes, cfg.maxReadsPerHour)) {
      console.warn('Batas baca cloud per jam tercapai, pakai data lokal dulu.');
      return { success: false, error: 'read-rate-limited-locally', data: null };
    }
    try {
      const res = await fetchImpl(cfg.apiUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store'
      });
      if (!res.ok) throw new Error(`Cloud DB HTTP ${res.status}`);
      const json = await res.json();
      if (json && json.exists && json.data) remember(json.data);
      return json;
    } catch (err) {
      console.warn('Gagal mengambil data dari Cloud DB:', err.message);
      return { success: false, error: err.message, data: null };
    }
  }

  // ---- tulis ----
  function clearSaveTimers() {
    clearT(debounceTimer);
    clearT(maxWaitTimer);
    debounceTimer = null;
    maxWaitTimer = null;
  }

  function scheduleSave() {
    // Saat menunggu retry (mis. kuota habis), retry yang akan membawa data terbaru.
    if (retryTimer) return;
    clearT(debounceTimer);
    debounceTimer = setT(() => flushPending(), cfg.debounceMs);
    if (!maxWaitTimer) maxWaitTimer = setT(() => flushPending(), cfg.maxWaitMs);
  }

  function scheduleRetry(delayMs) {
    if (retryTimer) return;
    const delay = delayMs ?? retryDelay;
    retryTimer = setT(() => {
      retryTimer = null;
      flushPending();
    }, delay);
    if (delayMs === undefined) retryDelay = Math.min(retryDelay * 2, cfg.retryMaxMs);
  }

  const notify = (info) => savedListeners.forEach((cb) => cb(info));

  async function doFlush({ keepalive = false } = {}) {
    const payload = pendingPayload;
    if (!payload) return { success: true, skipped: true };
    const force = pendingForce;

    // Tidak ada perubahan dibanding isi cloud -> jangan buang 1 operasi Blob.
    if (!force && hashData(payload) === lastKnownCloudHash) {
      if (pendingPayload === payload) {
        pendingPayload = null;
        writeDirty(false);
      }
      return { success: true, skipped: true, updatedAt: payload.updatedAt };
    }

    // Rem darurat: terlalu banyak upload dalam 1 jam -> tahan dulu (data tetap aman di localStorage)
    if (!underHourlyLimit(writeTimes, cfg.maxWritesPerHour)) {
      console.warn('Batas upload cloud per jam tercapai, upload ditahan dan dicoba lagi nanti.');
      scheduleRetry();
      return { success: false, error: 'write-rate-limited-locally' };
    }

    try {
      const body = JSON.stringify({ ...payload, baseRev: readRev(), ...(force ? { force: true } : {}) });
      lastFlushAt = nowMs();
      const res = await fetchImpl(cfg.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: keepalive && body.length < cfg.keepaliveLimitBytes
      });

      if (res.status === 429) {
        // Server menahan penulisan yang terlalu rapat: coba lagi sebentar lagi (bukan backoff panjang)
        let wait = 3000;
        try {
          const j = await res.json();
          wait = Math.max(3000, Number(j.retryAfterMs) + 1000 || 3000);
        } catch {
          /* pakai default */
        }
        scheduleRetry(wait);
        return { success: false, error: 'rate-limited-by-server' };
      }
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Cloud DB Save HTTP ${res.status}: ${errText}`);
      }

      const json = await res.json();
      retryDelay = cfg.retryBaseMs;
      const isLatest = pendingPayload === payload; // tidak ada perubahan lokal baru selama upload

      if (json.merged) {
        // Perangkat lain sudah menulis: server menggabungkan. Pakai hasilnya hanya bila tidak ada
        // perubahan lokal yang lebih baru (kalau ada, biarkan baseRev lama agar kiriman berikutnya
        // digabung lagi dan perubahan tidak hilang).
        if (json.data) remember(json.data);
        if (isLatest) {
          writeRev(json.rev);
          pendingPayload = null;
          pendingForce = false;
          writeDirty(false);
          notify({ merged: true, data: json.data, rev: json.rev, updatedAt: json.updatedAt });
        } else {
          notify({ merged: true, deferred: true, rev: json.rev, updatedAt: json.updatedAt });
        }
      } else {
        writeRev(json.rev);
        remember(payload);
        if (isLatest) {
          pendingPayload = null;
          pendingForce = false;
          writeDirty(false);
        }
        notify({ merged: false, rev: json.rev, updatedAt: json.updatedAt });
      }
      return json;
    } catch (err) {
      console.error('Gagal menyimpan data ke Cloud DB:', err);
      scheduleRetry();
      return { success: false, error: err.message };
    }
  }

  function flushPending(opts = {}) {
    clearSaveTimers();

    if (inFlight) {
      return inFlight.then(() => (pendingPayload ? flushPending(opts) : { success: true, skipped: true }));
    }

    inFlight = doFlush(opts).finally(() => {
      inFlight = null;
      // Ada perubahan baru yang masuk saat upload berjalan.
      if (pendingPayload && !retryTimer) scheduleSave();
    });
    return inFlight;
  }

  // Simpan ke cloud. Default: digabung & ditunda (hemat kuota Blob). Gunakan { immediate: true }
  // untuk sinkronisasi manual / push awal. { force: true } = timpa (reset / restore yang disengaja).
  function saveCloudData(payload, { immediate = false, force = false } = {}) {
    if (!payload || typeof payload !== 'object') {
      return Promise.resolve({ success: false, error: 'Invalid payload' });
    }
    pendingPayload = payload;
    if (force) pendingForce = true;
    writeDirty(true);

    if (immediate) return flushPending();

    scheduleSave();
    return Promise.resolve({ success: true, queued: true, updatedAt: payload.updatedAt });
  }

  // Dipanggil saat data dari cloud diterapkan ke aplikasi: antrean lokal dibuang, `rev` dicatat sebagai dasar
  function adoptCloudState(rev, data) {
    pendingPayload = null;
    pendingForce = false;
    clearSaveTimers();
    if (rev !== undefined && rev !== null) writeRev(rev);
    writeDirty(false);
    if (data) remember(data);
  }

  function getSyncState() {
    return { baseRev: readRev(), dirty: readDirty(), hasPending: !!pendingPayload || !!inFlight };
  }

  // Callback dipanggil setelah upload berhasil. Mengembalikan fungsi unsubscribe.
  function onCloudSaved(callback) {
    savedListeners.add(callback);
    return () => savedListeners.delete(callback);
  }

  // Kirim sisa perubahan saat halaman ditutup / tab disembunyikan.
  function installLifecycleHooks() {
    if (typeof window === 'undefined') return;
    window.addEventListener('pagehide', () => {
      if (pendingPayload) flushPending({ keepalive: true });
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && pendingPayload && nowMs() - lastFlushAt > cfg.leaveFlushMinGapMs) {
        flushPending({ keepalive: true });
      }
    });
  }

  return {
    fetchCloudData,
    saveCloudData,
    adoptCloudState,
    getSyncState,
    onCloudSaved,
    installLifecycleHooks,
    flushNow: flushPending
  };
}

// ---- instance bawaan untuk aplikasi ----
const defaultSync = createCloudSync();
defaultSync.installLifecycleHooks();

export const fetchCloudData = defaultSync.fetchCloudData;
export const saveCloudData = defaultSync.saveCloudData;
export const adoptCloudState = defaultSync.adoptCloudState;
export const getSyncState = defaultSync.getSyncState;
export const onCloudSaved = defaultSync.onCloudSaved;
