// LocalStorage management - Clean production state for 2 Joki Accounts + 3 VIP Mabar

export const STORAGE_KEYS = {
  ORDERS: 'mlbb_vip_orders_v4',
  ROOM_PARTY: 'mlbb_vip_room_v4',
  MATCH_HISTORY: 'mlbb_vip_history_v4',
  PILOT_SETTINGS: 'mlbb_vip_pilot_settings_v4',
  PAYOUTS: 'mlbb_vip_payouts_v4',
  MY_WALLET: 'mlbb_vip_my_wallet_v4',
  SETTLED_ORDER_IDS: 'mlbb_vip_settled_order_ids_v4'
};

export const INITIAL_PILOT_SETTINGS = {
  pilotGoldName: 'Saya (Admin)',
  pilotJungleName: 'Teman (Partner)'
};

// 5 Slots Total:
// - 2 Joki Slots (Dimainin Pilot): jokiGold (Saya), jokiJungle (Teman)
// - 3 VIP Mabar Slots (Customer Main Sendiri): mid, roam, exp
export const INITIAL_ROOM = {
  jokiGold: null,
  jokiJungle: null,
  mid: null,
  roam: null,
  exp: null
};

export const INITIAL_ORDERS = [];
export const INITIAL_MATCH_HISTORY = [];
export const INITIAL_PAYOUTS = [];
// Saldo awal selalu Rp 0. Saldo sebenarnya datang dari data cloud / catatan transaksi, bukan angka tertanam di kode.
export const INITIAL_MY_WALLET = {
  balance: 0,
  history: []
};
export const INITIAL_SETTLED_ORDER_IDS = [];

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
