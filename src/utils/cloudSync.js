// Utilitas Sinkronisasi Cloud Database Vercel
// Menyimpan dan mengambil data dari Cloud DB (Vercel Blob Serverless)
// Memungkinkan akses realtime dari semua perangkat (HP, PC, Laptop, Tablet)

const API_URL = '/api/data';

export async function fetchCloudData() {
  try {
    const res = await fetch(`${API_URL}?t=${Date.now()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      cache: 'no-store'
    });

    if (!res.ok) {
      throw new Error(`Cloud DB HTTP ${res.status}`);
    }

    const json = await res.json();
    return json;
  } catch (err) {
    console.warn('Gagal mengambil data dari Cloud DB:', err.message);
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
      throw new Error(`Cloud DB Save HTTP ${res.status}`);
    }

    const json = await res.json();
    return json;
  } catch (err) {
    console.warn('Gagal menyimpan data ke Cloud DB:', err.message);
    return { success: false, error: err.message };
  }
}
