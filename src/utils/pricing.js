// Utilitas Perhitungan Harga Mabar VIP Mobile Legends
// Aturan:
// - Per match satuan: Rp 7.000
// - Per lima (5) match: Rp 6.000 / match = Rp 30.000 per 5 match (berlaku kelipatan)
// - Contoh:
//   * 1 match = Rp 7.000
//   * 4 match = 4 x 7.000 = Rp 28.000
//   * 5 match = 1 x 30.000 = Rp 30.000 (Hemat Rp 5.000)
//   * 7 match = 1x paket 5 (30.000) + 2x satuan (14.000) = Rp 44.000
//   * 10 match = 2 x 30.000 = Rp 60.000 (Hemat Rp 10.000)

export const RATE_SINGLE = 7000;
export const RATE_BUNDLE_PER_MATCH = 6000;
export const BUNDLE_SIZE = 5;
export const RATE_BUNDLE_5 = RATE_BUNDLE_PER_MATCH * BUNDLE_SIZE; // Rp 30.000

export function calculatePricing(matches) {
  const count = Math.max(0, parseInt(matches, 10) || 0);
  const bundleCount = Math.floor(count / BUNDLE_SIZE);
  const remainder = count % BUNDLE_SIZE;

  const bundleTotal = bundleCount * RATE_BUNDLE_5;
  const remainderTotal = remainder * RATE_SINGLE;
  const total = bundleTotal + remainderTotal;

  // Normal price without discount
  const normalPrice = count * RATE_SINGLE;
  const savings = Math.max(0, normalPrice - total);
  const effectivePerMatch = count > 0 ? Math.round(total / count) : RATE_SINGLE;

  return {
    count,
    bundleCount,
    remainder,
    bundleTotal,
    remainderTotal,
    total,
    savings,
    effectivePerMatch,
    normalPrice
  };
}

export function formatRupiah(amount) {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(num);
}
