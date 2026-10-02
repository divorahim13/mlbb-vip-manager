// Utilitas Sinkronisasi Cloud Database Vercel
// Menggunakan Direct Public Blob Edge CDN untuk READ (0 Serverless Invocations, 0 Advanced Operations, Sub-30ms)
// Dan Serverless API /api/data untuk WRITE (POST)

const PUBLIC_CDN_URL = 'https://jgi9lwivzsm9oyrp.public.blob.vercel-storage.com/mlbb-live-db.json';
const API_URL = '/api/data';

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
    return json;
  } catch (err) {
    console.warn('Gagal mengambil data dari Cloud DB fallback:', err.message);
    return { success: false, error: err.message, data: null };
  }
}

export async function saveCloudData(payload) {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Cloud DB Save HTTP ${res.status}: ${errText}`);
    }

    const json = await res.json();
    return json;
  } catch (err) {
    console.error('Gagal menyimpan data ke Cloud DB:', err);
    return { success: false, error: err.message };
  }
}
