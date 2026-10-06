// ID acak untuk order / match / payout / transaksi dompet.
// Sebelumnya order memakai 6 digit terakhir jam (`ord-123456`) yang berulang tiap ~17 menit.
// ID lama tetap valid; hanya ID baru yang memakai format ini.

export function randomToken(length = 12) {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID().replace(/-/g, '').slice(0, length);
  }
  if (c && typeof c.getRandomValues === 'function') {
    const bytes = new Uint8Array(Math.ceil(length / 2));
    c.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').slice(0, length);
  }
  // Cadangan terakhir (konteks non-aman): waktu + acak
  return (Date.now().toString(36) + Math.random().toString(36).slice(2, 10)).slice(0, length).padEnd(length, '0');
}

export function newId(prefix) {
  const token = randomToken(12);
  return prefix ? `${prefix}-${token}` : token;
}
