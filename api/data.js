import { put, list } from '@vercel/blob';

// In-memory module cache to avoid redundant Vercel Blob Advanced Operations (list calls)
let cachedBlobUrl = null;
let cachedData = null;
let lastFetchTime = 0;
const IN_MEMORY_CACHE_TTL = 15000; // 15 seconds in-memory cache

export default async function handler(req, res) {
  // CORS & Strict No-Cache headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const DATA_KEY = 'mlbb-live-db.json';

  try {
    if (req.method === 'GET') {
      const now = Date.now();

      // 1. Return in-memory cache if still fresh (eliminates repetitive fetches & operations)
      if (cachedData && (now - lastFetchTime < IN_MEMORY_CACHE_TTL)) {
        return res.status(200).json({
          success: true,
          exists: true,
          data: cachedData,
          updatedAt: cachedData.updatedAt || new Date(lastFetchTime).toISOString(),
          cached: true
        });
      }

      // 2. Fetch directly from known CDN URL without calling list()
      if (cachedBlobUrl) {
        try {
          const fetchRes = await fetch(`${cachedBlobUrl}?t=${now}`, { cache: 'no-store' });
          if (fetchRes.ok) {
            const data = await fetchRes.json();
            cachedData = data;
            lastFetchTime = now;
            return res.status(200).json({
              success: true,
              exists: true,
              data,
              updatedAt: data.updatedAt || new Date(lastFetchTime).toISOString()
            });
          }
        } catch {
          // If direct fetch fails, invalidate cached url and fall through to discover it
          cachedBlobUrl = null;
        }
      }

      // 3. Fallback: discover URL using list() ONLY if cachedBlobUrl is unknown (once per cold start)
      const { blobs } = await list({ prefix: DATA_KEY, limit: 1 });
      if (!blobs || blobs.length === 0) {
        return res.status(200).json({
          success: true,
          exists: false,
          data: null
        });
      }

      const latestBlob = blobs[0];
      cachedBlobUrl = latestBlob.url;

      const fetchRes = await fetch(`${latestBlob.url}?t=${now}`, {
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
      cachedData = data;
      lastFetchTime = now;

      return res.status(200).json({
        success: true,
        exists: true,
        data,
        updatedAt: data.updatedAt || latestBlob.uploadedAt
      });
    }

    if (req.method === 'POST') {
      let payload = req.body;
      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload);
        } catch {
          // ignore
        }
      }

      if (!payload || typeof payload !== 'object') {
        return res.status(400).json({ success: false, error: 'Invalid payload' });
      }

      const now = new Date().toISOString();
      const savePayload = {
        orders: Array.isArray(payload.orders) ? payload.orders : [],
        roomParty: payload.roomParty || { jokiGold: null, jokiJungle: null, mid: null, roam: null, exp: null },
        matchHistory: Array.isArray(payload.matchHistory) ? payload.matchHistory : [],
        updatedAt: now,
        version: payload.version || 1
      };

      const blob = await put(DATA_KEY, JSON.stringify(savePayload), {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json',
        cacheControlMaxAge: 0
      });

      // Update in-memory cache immediately
      cachedBlobUrl = blob.url;
      cachedData = savePayload;
      lastFetchTime = Date.now();

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
