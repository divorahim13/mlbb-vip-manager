// Kas berjalan & bagi hasil.
//
// Dulu: order yang sudah "di-settle" ditandai dengan id di `settledOrderIds`, sehingga uang yang masuk
// SETELAH bagi hasil (top up / pelunasan pada order yang sama) tidak pernah dihitung lagi.
// Sekarang: tiap order mencatat `settledAmount` (jumlah uang yang sudah dibagi).
//   kas belum dibagi = amountPaid - settledAmount   (tidak pernah negatif)
// `settledOrderIds` tetap diisi sebagai penanda kompatibilitas dengan versi lama.

const num = (v) => Number(v) || 0;

export const hasBeenSettled = (order) => order.settledAmount !== undefined && order.settledAmount !== null;
export const settledAmountOf = (order) => num(order.settledAmount);
export const unsettledAmountOf = (order) => Math.max(0, num(order.amountPaid) - settledAmountOf(order));
export const isFullySettled = (order) => hasBeenSettled(order) && unsettledAmountOf(order) === 0;

// Jumlah uang kas yang siap dibagi + jumlah pesanan "baru" (belum pernah di-settle atau ada uang baru)
export function computeUnsettled(orders = []) {
  let revenue = 0;
  let count = 0;
  for (const o of orders) {
    const u = unsettledAmountOf(o);
    revenue += u;
    if (u > 0 || !hasBeenSettled(o)) count++;
  }
  return { revenue, count };
}

// Data lama: order yang idnya ada di settledOrderIds dianggap sudah dibagi sebesar amountPaid saat ini
export function migrateLegacySettlement(orders = [], settledIds = []) {
  const set = new Set(settledIds || []);
  let changed = false;
  const next = orders.map((o) => {
    if (!hasBeenSettled(o) && set.has(o.id)) {
      changed = true;
      return { ...o, settledAmount: num(o.amountPaid) };
    }
    return o;
  });
  return { orders: changed ? next : orders, changed };
}

// Dipanggil saat bagi hasil dijalankan: semua uang yang sudah diterima dianggap dibagi
export function applySettlement(orders = []) {
  return orders.map((o) => {
    const target = Math.max(settledAmountOf(o), num(o.amountPaid));
    return hasBeenSettled(o) && target === settledAmountOf(o) ? o : { ...o, settledAmount: target };
  });
}
