// Cap waktu "selesai" untuk order.
//
// - completedAt dicatat saat order PINDAH ke status COMPLETED, dan dihapus bila keluar dari COMPLETED
//   (mis. Order Lagi / top up) sehingga selesai berikutnya mendapat waktu baru.
// - Order lama (sebelum fitur ini) tidak punya completedAt: waktunya diperkirakan dari match terakhir
//   pemain itu (pakai id order bila match mencatat `participantIds`, kalau tidak pakai nama), lalu
//   createdAt bila tidak ada.

export function stampCompletion(prev, next, nowIso = new Date().toISOString()) {
  if (next.status === 'COMPLETED') {
    if (prev && prev.status === 'COMPLETED') {
      // Sudah selesai sebelumnya: pertahankan cap yang ada (atau biarkan kosong untuk data lama)
      return prev.completedAt ? { ...next, completedAt: prev.completedAt } : next;
    }
    return { ...next, completedAt: nowIso };
  }
  if ('completedAt' in next) {
    const rest = { ...next };
    delete rest.completedAt;
    return rest;
  }
  return next;
}

const hasName = (m, username) =>
  Array.isArray(m.participants) && m.participants.some((p) => p === `@${username}` || p.startsWith(`@${username} `));

// matchHistory terbaru di depan. Match yang dimainkan di luar kuota tidak dihitung sebagai waktu selesai.
function lastMatchTimeOf(order, matchHistory) {
  if (!Array.isArray(matchHistory)) return null;
  const m = matchHistory.find((x) => {
    if (Array.isArray(x.participantIds)) {
      return x.participantIds.includes(order.id) && !(x.overQuotaIds || []).includes(order.id);
    }
    return order.username ? hasName(x, order.username) : false; // data lama: hanya ada nama
  });
  return m ? m.timestamp : null;
}

// { iso, exact } - exact=false berarti perkiraan (bukan cap waktu asli)
export function getCompletionInfo(order, matchHistory) {
  if (order.completedAt) return { iso: order.completedAt, exact: true };
  const m = lastMatchTimeOf(order, matchHistory);
  if (m) return { iso: m, exact: false };
  return { iso: order.createdAt || null, exact: false };
}

export function getCompletionTime(order, matchHistory) {
  return getCompletionInfo(order, matchHistory).iso;
}

export function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const date = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  return `${date}, ${time}`;
}
