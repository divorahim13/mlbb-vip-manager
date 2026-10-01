import { put, list } from '@vercel/blob';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const DATA_KEY = 'mlbb-live-db.json';

  try {
    if (req.method === 'GET') {
      const { blobs } = await list({ prefix: DATA_KEY });
      if (!blobs || blobs.length === 0) {
        return res.status(200).json({
          success: true,
          exists: false,
          data: null
        });
      }

      // Fetch the latest blob content with cache busting
      const latestBlob = blobs[0];
      const fetchRes = await fetch(`${latestBlob.url}?t=${Date.now()}`, {
        cache: 'no-store'
      });

      if (!fetchRes.ok) {
        return res.status(200).json({
          success: true,
          exists: false,
          data: null
        });
      }

      const data = await fetchRes.json();
      return res.status(200).json({
        success: true,
        exists: true,
        data,
        updatedAt: data.updatedAt || latestBlob.uploadedAt
      });
    }

    if (req.method === 'POST') {
      const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!payload || typeof payload !== 'object') {
        return res.status(400).json({ success: false, error: 'Invalid payload' });
      }

      const savePayload = {
        orders: Array.isArray(payload.orders) ? payload.orders : [],
        roomParty: payload.roomParty || { jokiGold: null, jokiJungle: null, mid: null, roam: null, exp: null },
        matchHistory: Array.isArray(payload.matchHistory) ? payload.matchHistory : [],
        updatedAt: new Date().toISOString(),
        version: payload.version || 1
      };

      const blob = await put(DATA_KEY, JSON.stringify(savePayload), {
        access: 'public',
        addRandomSuffix: false,
        contentType: 'application/json',
        cacheControlMaxAge: 0
      });

      return res.status(200).json({
        success: true,
        blobUrl: blob.url,
        updatedAt: savePayload.updatedAt
      });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error) {
    console.error('API /api/data error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
