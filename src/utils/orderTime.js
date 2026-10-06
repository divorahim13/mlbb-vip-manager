// Cap waktu "selesai" untuk order.
//
// - completedAt dicatat saat order PINDAH ke status COMPLETED, dan dihapus bila keluar dari COMPLETED
//   (mis. Order Lagi / top up) sehingga selesai berikutnya mendapat waktu baru.
// - Order lama (sebelum fitur ini) tidak punya completedAt: waktunya dicari dari match terakhir yang
//   melibatkan pemain itu, atau createdAt bila tidak ada.

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

// matchHistory terbaru di depan; participants berbentuk "@username (VIP Mid Lane)"
function lastMatchTimeOf(username, matchHistory) {
  if (!username || !Array.isArray(matchHistory)) return null;
  const tag = `@${username}`;
  const m = matchHistory.find(
    (x) => Array.isArray(x.participants) && x.participants.some((p) => p === tag || p.startsWith(`${tag} `))
  );
  return m ? m.timestamp : null;
}

export function getCompletionTime(order, matchHistory) {
  return order.completedAt || lastMatchTimeOf(order.username, matchHistory) || order.createdAt || null;
}

export function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const date = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  return `${date}, ${time}`;
}
