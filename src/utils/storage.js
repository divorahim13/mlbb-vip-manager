// LocalStorage management - Clean production state without dummy data

export const STORAGE_KEYS = {
  ORDERS: 'mlbb_vip_orders_v2',
  ROOM_PARTY: 'mlbb_vip_room_v2',
  MATCH_HISTORY: 'mlbb_vip_history_v2',
  HOST_INFO: 'mlbb_vip_host_v2',
};

export const INITIAL_HOST = {
  name: 'Host / Admin',
  role: 'Carry / All Role',
  rank: 'Mythic Immortal',
  note: 'Slot Party VIP MLBB'
};

// Clean default states (No dummy / fake data)
export const INITIAL_ORDERS = [];

export const INITIAL_ROOM = {
  1: null,
  2: null,
  3: null,
  4: null
};

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
