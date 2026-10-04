import { put } from '@vercel/blob';

// In-memory module cache for warm serverless instances
let cachedBlobUrl = null;
let cachedData = null;
let lastFetchTime = 0;
const IN_MEMORY_CACHE_TTL = 30000; // 30 seconds in-memory cache for warm lambdas

const DATA_KEY = 'mlbb-live-db.json';

// Helper to get deterministic public CDN URL without calling list()
// This completely avoids Vercel Blob Advanced Operations (quota limit: 2,000/mo)
function getPublicBlobUrl(filename = DATA_KEY) {
  if (process.env.BLOB_PUBLIC_URL) {
    return process.env.BLOB_PUBLIC_URL;
  }
  const storeId = process.env.BLOB_STORE_ID;
  if (storeId) {
    const cleanId = storeId.replace(/^store_/, '').toLowerCase();
    return `https://${cleanId}.public.blob.vercel-storage.com/${filename}`;
  }
  const token = process.env.BLOB_READ_WRITE_TOKEN || '';
  const match = token.match(/vercel_blob_rw_([A-Za-z0-9]+)_/);
  if (match && match[1]) {
    const cleanId = match[1].toLowerCase();
    return `https://${cleanId}.public.blob.vercel-storage.com/${filename}`;
  }
  // Fallback to verified store CDN
  return `https://jgi9lwivzsm9oyrp.public.blob.vercel-storage.com/${filename}`;
}

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

  try {
    if (req.method === 'GET') {
      const now = Date.now();

      // 1. Return in-memory cache if still fresh
      if (cachedData && (now - lastFetchTime < IN_MEMORY_CACHE_TTL)) {
        return res.status(200).json({
          success: true,
          exists: true,
          data: cachedData,
          updatedAt: cachedData.updatedAt || new Date(lastFetchTime).toISOString(),
          cached: true
        });
      }

      // 2. Direct public CDN fetch (Zero Blob Advanced Operations)
      const targetUrl = cachedBlobUrl || getPublicBlobUrl();
      try {
        const fetchRes = await fetch(`${targetUrl}?t=${now}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        });

        if (fetchRes.ok) {
          const data = await fetchRes.json();
          cachedData = data;
          cachedBlobUrl = targetUrl;
          lastFetchTime = now;
          return res.status(200).json({
            success: true,
            exists: true,
            data,
            updatedAt: data.updatedAt || new Date(lastFetchTime).toISOString()
          });
        }

        if (fetchRes.status === 404) {
          return res.status(200).json({
            success: true,
            exists: false,
            data: null
          });
        }
      } catch (fetchErr) {
        console.warn('Direct CDN fetch warning:', fetchErr.message);
      }

      // If network fetch failed, return in-memory cache if available
      if (cachedData) {
        return res.status(200).json({
          success: true,
          exists: true,
          data: cachedData,
          updatedAt: cachedData.updatedAt || new Date(lastFetchTime).toISOString(),
          stale: true
        });
      }

      return res.status(200).json({
        success: true,
        exists: false,
        data: null
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
        payouts: Array.isArray(payload.payouts) ? payload.payouts : [],
        myWallet: payload.myWallet && typeof payload.myWallet === 'object' ? payload.myWallet : { balance: 0, history: [] },
        settledOrderIds: Array.isArray(payload.settledOrderIds) ? payload.settledOrderIds : [],
        lastSettledAt: payload.lastSettledAt || null,
        updatedAt: now,
        version: payload.version || 2
      };

      // Simple Operation: put() with allowOverwrite
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
