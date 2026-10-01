// Utilitas Perhitungan Harga Mabar VIP Mobile Legends
// Aturan:
// - Per match satuan: Rp 7.000
// - Per lima (5) match: Rp 6.000 / match = Rp 30.000 per 5 match (berlaku kelipatan)
// - Mendukung Harga Khusus / Custom Price & Harga Gratis (Rp 0 untuk Pacar/Promo)

export const RATE_SINGLE = 7000;
export const RATE_BUNDLE_PER_MATCH = 6000;
export const BUNDLE_SIZE = 5;
export const RATE_BUNDLE_5 = RATE_BUNDLE_PER_MATCH * BUNDLE_SIZE; // Rp 30.000

export function calculatePricing(matches, customPrice = null, isFree = false) {
  const count = Math.max(0, parseInt(matches, 10) || 0);
  const bundleCount = Math.floor(count / BUNDLE_SIZE);
  const remainder = count % BUNDLE_SIZE;

  const bundleTotal = bundleCount * RATE_BUNDLE_5;
  const remainderTotal = remainder * RATE_SINGLE;
  const standardTotal = bundleTotal + remainderTotal;

  // Normal price without discount
  const normalPrice = count * RATE_SINGLE;

  let total = standardTotal;
  let isCustom = false;

  if (isFree) {
    total = 0;
    isCustom = true;
  } else if (customPrice !== null && customPrice !== undefined && customPrice !== '') {
    total = Math.max(0, parseInt(customPrice, 10) || 0);
    isCustom = true;
  }

  const savings = Math.max(0, normalPrice - total);
  const effectivePerMatch = count > 0 ? Math.round(total / count) : 0;

  return {
    count,
    bundleCount,
    remainder,
    bundleTotal,
    remainderTotal,
    standardTotal,
    total,
    savings,
    effectivePerMatch,
    normalPrice,
    isCustom,
    isFree
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
