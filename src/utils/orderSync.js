// Pendukung sinkron antar perangkat di sisi aplikasi.
//
// - stampChangedOrders: setiap order yang BERUBAH diberi `updatedAt` baru (dipakai server untuk memutuskan
//   versi mana yang menang saat menggabung). Order yang tidak berubah tidak disentuh.
// - order yang HILANG dibanding versi sebelumnya dicatat sebagai tombstone supaya penghapusan tidak "hidup lagi".

const TOMBSTONE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

function sameIgnoringUpdatedAt(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  keys.delete('updatedAt');
  for (const k of keys) {
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) return false;
  }
  return true;
}

export function stampChangedOrders(prevOrders = [], nextOrders = [], nowIso = new Date().toISOString()) {
  const prevById = new Map(prevOrders.map((o) => [o.id, o]));
  let anyChange = false;
  const orders = nextOrders.map((o) => {
    const prev = prevById.get(o.id);
    if (prev === o) return o;
    if (prev && sameIgnoringUpdatedAt(prev, o)) return o;
    anyChange = true;
    return { ...o, updatedAt: nowIso };
  });
  const nextIds = new Set(nextOrders.map((o) => o.id));
  const removedIds = prevOrders.filter((o) => !nextIds.has(o.id)).map((o) => o.id);
  return { orders: anyChange ? orders : nextOrders, removedIds };
}

export function updateTombstones(tombstones = [], removedIds = [], presentIds = [], nowIso = new Date().toISOString()) {
  const nowMs = Date.parse(nowIso);
  const present = new Set(presentIds);
  const map = new Map();
  for (const t of tombstones) {
    if (!t || !t.id || present.has(t.id)) continue; // order yang sudah ada lagi (mis. diurungkan) tidak perlu tombstone
    if (nowMs - Date.parse(t.at) > TOMBSTONE_TTL_MS) continue;
    map.set(t.id, t);
  }
  for (const id of removedIds) map.set(id, { id, at: nowIso });
  return [...map.values()];
}
