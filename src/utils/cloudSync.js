// Utilitas Sinkronisasi Cloud Database Vercel
// Menggunakan Direct Public Blob Edge CDN untuk READ (0 Serverless Invocations, 0 Advanced Operations, Sub-30ms)
// Dan Serverless API /api/data untuk WRITE (POST)
//
// PENTING: setiap WRITE = 1 put() = 1 "Blob Advanced Operation" (kuota Hobby: 2.000/bulan).
// Karena itu semua penyimpanan ke cloud DIGABUNG (debounce + max-wait) dan dilewati jika
// isinya sama dengan yang sudah ada di cloud. Data lokal tetap tersimpan langsung di localStorage.

const PUBLIC_CDN_URL = 'https://jgi9lwivzsm9oyrp.public.blob.vercel-storage.com/mlbb-live-db.json';
const API_URL = '/api/data';

const SAVE_DEBOUNCE_MS = 20000; // tunggu 20 dtk tanpa aksi baru sebelum upload
const SAVE_MAX_WAIT_MS = 180000; // paling lama 3 menit sejak perubahan pertama
const LEAVE_FLUSH_MIN_GAP_MS = 30000; // flush saat tab disembunyikan, maks 1x per 30 dtk
const RETRY_BASE_MS = 60000;
const RETRY_MAX_MS = 600000;
const KEEPALIVE_LIMIT_BYTES = 60000;

let pendingPayload = null;
let debounceTimer = null;
let maxWaitTimer = null;
let retryTimer = null;
let retryDelay = RETRY_BASE_MS;
let inFlight = null;
let lastKnownCloudHash = null;
let lastFlushAt = 0;
const savedListeners = new Set();

// Hash isi data (tanpa updatedAt) untuk mendeteksi "tidak ada perubahan".
function hashData(data) {
  if (!data || typeof data !== 'object') return null;
  const normalized = {
    orders: Array.isArray(data.orders) ? data.orders : [],
    roomParty: data.roomParty || null,
    matchHistory: Array.isArray(data.matchHistory) ? data.matchHistory : [],
    payouts: Array.isArray(data.payouts) ? data.payouts : [],
    myWallet: data.myWallet && typeof data.myWallet === 'object' ? data.myWallet : null,
    settledOrderIds: Array.isArray(data.settledOrderIds) ? data.settledOrderIds : [],
    lastSettledAt: data.lastSettledAt || null
  };
  const str = JSON.stringify(normalized);
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  }
  return `${str.length}:${h}`;
}

function rememberCloudData(data) {
  const h = hashData(data);
  if (h) lastKnownCloudHash = h;
}

export async function fetchCloudData() {
  const now = Date.now();

  // Jalur 1 (Utama): Baca langsung dari Edge CDN publik
  // Bebas kuota serverless execution & response super cepat dari Cloudflare/Vercel Edge (sin1)
  try {
    const cdnRes = await fetch(`${PUBLIC_CDN_URL}?t=${now}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      cache: 'no-store'
    });

    if (cdnRes.ok) {
      const data = await cdnRes.json();
      rememberCloudData(data);
      return {
        success: true,
        exists: true,
        data,
        updatedAt: data.updatedAt || new Date().toISOString()
      };
    } else if (cdnRes.status === 404) {
      return {
        success: true,
        exists: false,
        data: null
      };
    }
  } catch (cdnErr) {
    console.warn('Direct CDN read warning, falling back to API:', cdnErr.message);
  }

  // Jalur 2 (Cadangan): Fallback ke Serverless /api/data jika jalur CDN terkendala
  try {
    const res = await fetch(`${API_URL}?t=${now}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      },
      cache: 'no-store'
    });

    if (!res.ok) {
      throw new Error(`Cloud DB HTTP ${res.status}`);
    }

    const json = await res.json();
    if (json && json.exists && json.data) rememberCloudData(json.data);
    return json;
  } catch (err) {
    console.warn('Gagal mengambil data dari Cloud DB fallback:', err.message);
    return { success: false, error: err.message, data: null };
  }
}

function clearSaveTimers() {
  clearTimeout(debounceTimer);
  clearTimeout(maxWaitTimer);
  debounceTimer = null;
  maxWaitTimer = null;
}

function scheduleSave() {
  // Saat sedang menunggu retry (mis. kuota habis), retry yang akan membawa data terbaru.
  if (retryTimer) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => flushPending(), SAVE_DEBOUNCE_MS);
  if (!maxWaitTimer) {
    maxWaitTimer = setTimeout(() => flushPending(), SAVE_MAX_WAIT_MS);
  }
}

function scheduleRetry() {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    flushPending();
  }, retryDelay);
  retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS);
}

async function doFlush({ keepalive = false } = {}) {
  const payload = pendingPayload;
  if (!payload) return { success: true, skipped: true };

  // Tidak ada perubahan dibanding isi cloud -> jangan buang 1 operasi Blob.
  if (hashData(payload) === lastKnownCloudHash) {
    if (pendingPayload === payload) pendingPayload = null;
    return { success: true, skipped: true, updatedAt: payload.updatedAt };
  }

  try {
    const body = JSON.stringify(payload);
    lastFlushAt = Date.now();
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body,
      keepalive: keepalive && body.length < KEEPALIVE_LIMIT_BYTES
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Cloud DB Save HTTP ${res.status}: ${errText}`);
    }

    const json = await res.json();
    if (pendingPayload === payload) pendingPayload = null;
    lastKnownCloudHash = hashData(payload);
    retryDelay = RETRY_BASE_MS;
    savedListeners.forEach((cb) => cb(json.updatedAt));
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
// untuk sinkronisasi manual / push awal yang harus langsung dikirim.
export function saveCloudData(payload, { immediate = false } = {}) {
  if (!payload || typeof payload !== 'object') {
    return Promise.resolve({ success: false, error: 'Invalid payload' });
  }

  pendingPayload = payload;

  if (immediate) {
    return flushPending();
  }

  scheduleSave();
  return Promise.resolve({ success: true, queued: true, updatedAt: payload.updatedAt });
}

// Dipanggil saat data dari cloud diterapkan ke aplikasi, supaya data lokal lama yang masih
// antre tidak menimpa data cloud yang lebih baru.
export function discardPendingCloudSave() {
  pendingPayload = null;
  clearSaveTimers();
}

// Callback dipanggil setelah upload ke cloud benar-benar berhasil. Mengembalikan fungsi unsubscribe.
export function onCloudSaved(callback) {
  savedListeners.add(callback);
  return () => savedListeners.delete(callback);
}

// Kirim sisa perubahan saat halaman ditutup / tab disembunyikan.
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    if (pendingPayload) flushPending({ keepalive: true });
  });
  document.addEventListener('visibilitychange', () => {
    if (
      document.visibilityState === 'hidden' &&
      pendingPayload &&
      Date.now() - lastFlushAt > LEAVE_FLUSH_MIN_GAP_MS
    ) {
      flushPending({ keepalive: true });
    }
  });
}
