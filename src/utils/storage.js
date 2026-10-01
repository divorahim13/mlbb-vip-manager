// LocalStorage management and initial starter data for MLBB VIP Mabar

export const STORAGE_KEYS = {
  ORDERS: 'mlbb_vip_orders_v1',
  ROOM_PARTY: 'mlbb_vip_room_v1',
  MATCH_HISTORY: 'mlbb_vip_history_v1',
  HOST_INFO: 'mlbb_vip_host_v1',
};

export const INITIAL_HOST = {
  name: 'Admin / Carry (Host)',
  role: 'Jungler / Core',
  rank: 'Mythical Immortal ⭐120',
  note: 'Jaminan Carry High WR'
};

export const INITIAL_ORDERS = [
  {
    id: 'ord-101',
    username: 'SkyWalker_ML',
    userId: '48291039 (2041)',
    phone: '081234567890',
    role: 'Gold Lane',
    matchesOrdered: 5,
    matchesRemaining: 3,
    priceTotal: 30000,
    amountPaid: 30000,
    paymentMethod: 'DANA',
    paymentStatus: 'LUNAS',
    transferNote: 'a/n Rizky DANA',
    status: 'IN_ROOM', // IN_ROOM, WAITING, COMPLETED
    roomSlot: 1,
    createdAt: new Date(Date.now() - 3600000 * 3).toISOString()
  },
  {
    id: 'ord-102',
    username: 'Valkyrie_99',
    userId: '99210452 (2104)',
    phone: '085712349999',
    role: 'Roamer',
    matchesOrdered: 10,
    matchesRemaining: 7,
    priceTotal: 60000,
    amountPaid: 60000,
    paymentMethod: 'BCA',
    paymentStatus: 'LUNAS',
    transferNote: 'a/n Steven BCA',
    status: 'IN_ROOM',
    roomSlot: 2,
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString()
  },
  {
    id: 'ord-103',
    username: 'ShadowNinja',
    userId: '11029482 (2012)',
    phone: '087811223344',
    role: 'Exp Lane',
    matchesOrdered: 1,
    matchesRemaining: 1,
    priceTotal: 7000,
    amountPaid: 7000,
    paymentMethod: 'GoPay',
    paymentStatus: 'LUNAS',
    transferNote: 'GoPay Dimas',
    status: 'IN_ROOM',
    roomSlot: 3,
    createdAt: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: 'ord-104',
    username: 'KaguraQueen',
    userId: '77218392 (2289)',
    phone: '089699887766',
    role: 'Mid Lane',
    matchesOrdered: 5,
    matchesRemaining: 5,
    priceTotal: 30000,
    amountPaid: 30000,
    paymentMethod: 'QRIS',
    paymentStatus: 'LUNAS',
    transferNote: 'QRIS a/n Putri',
    status: 'WAITING',
    roomSlot: null,
    createdAt: new Date(Date.now() - 1800000).toISOString()
  },
  {
    id: 'ord-105',
    username: 'Lord_Lingg',
    userId: '33910294 (2083)',
    phone: '081399881122',
    role: 'Gold Lane',
    matchesOrdered: 6,
    matchesRemaining: 6,
    priceTotal: 37000, // 30.000 (5 match) + 7.000 (1 match) = 37.000
    amountPaid: 20000, // DP
    paymentMethod: 'ShopeePay',
    paymentStatus: 'DP',
    transferNote: 'Transfer DP 20rb',
    status: 'WAITING',
    roomSlot: null,
    createdAt: new Date(Date.now() - 900000).toISOString()
  },
  {
    id: 'ord-100',
    username: 'AlucardGod',
    userId: '12849102 (2001)',
    phone: '081299990000',
    role: 'Exp Lane',
    matchesOrdered: 5,
    matchesRemaining: 0,
    priceTotal: 30000,
    amountPaid: 30000,
    paymentMethod: 'BCA',
    paymentStatus: 'LUNAS',
    transferNote: 'BCA Andre',
    status: 'COMPLETED',
    roomSlot: null,
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString()
  }
];

export const INITIAL_ROOM = {
  1: 'ord-101',
  2: 'ord-102',
  3: 'ord-103',
  4: null // Slot 4 kosong, siap diisi dari antrian
};

export const INITIAL_MATCH_HISTORY = [
  {
    id: 'match-1',
    matchNumber: 1,
    result: 'WIN',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    participants: ['SkyWalker_ML', 'Valkyrie_99', 'AlucardGod'],
    mvp: 'Host Carry (Fanny 14/1/6)',
    durationMinutes: 14
  },
  {
    id: 'match-2',
    matchNumber: 2,
    result: 'WIN',
    timestamp: new Date(Date.now() - 3600000 * 1.2).toISOString(),
    participants: ['SkyWalker_ML', 'Valkyrie_99', 'AlucardGod'],
    mvp: 'SkyWalker_ML (Beatrix 10/2/8)',
    durationMinutes: 16
  }
];

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
