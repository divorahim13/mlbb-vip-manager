import { getStore } from '@netlify/blobs';
import { handleRequest } from '../lib/dbHandler.mjs';

// Strong consistency: perangkat lain langsung melihat data terbaru (tanpa jeda propagasi 60 dtk)
export default async (req) => handleRequest(req, getStore({ name: 'mlbb-db', consistency: 'strong' }));

export const config = {
  path: '/api/data',
  method: ['GET', 'POST'],
  // Batas laju per IP: melindungi kredit Netlify dari bot / loop (normalnya jauh di bawah ini)
  rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: ['ip', 'domain'] }
};
