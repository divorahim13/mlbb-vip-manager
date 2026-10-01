// LocalStorage management - Clean production state for 2 Pilots + 3 VIPs

export const STORAGE_KEYS = {
  ORDERS: 'mlbb_vip_orders_v3',
  ROOM_PARTY: 'mlbb_vip_room_v3',
  MATCH_HISTORY: 'mlbb_vip_history_v3',
  PILOTS_INFO: 'mlbb_vip_pilots_v3',
};

export const INITIAL_PILOTS = {
  gold: {
    name: 'Saya (Admin)',
    role: 'Gold Lane',
    type: 'Mainin Akun',
    hero: 'Marksman Carry'
  },
  jungler: {
    name: 'Teman (Partner)',
    role: 'Jungler',
    type: 'Mainin Akun',
    hero: 'Assassin / Fighter Core'
  }
};

// 3 VIP Slots: Mid Lane (Myth), Roamer (Room), Exp Lane (Exp)
export const INITIAL_ROOM = {
  mid: null,
  roam: null,
  exp: null
};

export const INITIAL_ORDERS = [];
export const INITIAL_MATCH_HISTORY = [];

export function loadData(key, fallback) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
}

export function saveData(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error('Storage error', e);
  }
}
