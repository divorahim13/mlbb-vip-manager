import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Header from './components/Header';
import RoomParty, { ROLE_DETAILS, ALL_5_SLOTS } from './components/RoomParty';
import WaitingQueue from './components/WaitingQueue';
import OrderModal from './components/OrderModal';
import TopUpModal from './components/TopUpModal';
import EditOrderModal from './components/EditOrderModal';
import FinancialView from './components/FinancialView';
import MatchHistoryView from './components/MatchHistoryView';
import WalletModal from './components/WalletModal';
import PayoutModal from './components/PayoutModal';
import { playSound } from './utils/sound';
import { formatRupiah } from './utils/pricing';
import { fetchCloudData, saveCloudData, adoptCloudState, getSyncState, onCloudSaved } from './utils/cloudSync';
import { stampCompletion } from './utils/orderTime';
import { newId } from './utils/ids';
import { computeUnsettled, migrateLegacySettlement, applySettlement, unsettledAmountOf } from './utils/settlement';
import { recordMatch } from './utils/matchLogic';
import { stampChangedOrders, updateTombstones } from './utils/orderSync';
import {
  STORAGE_KEYS,
  INITIAL_ORDERS,
  INITIAL_ROOM,
  INITIAL_MATCH_HISTORY,
  INITIAL_PAYOUTS,
  INITIAL_MY_WALLET,
  INITIAL_SETTLED_ORDER_IDS,
  loadData,
  saveData
} from './utils/storage';
import { Check, AlertCircle, Copy, Swords } from 'lucide-react';

const LOCAL_WRITE_KEY = 'mlbb_last_local_write_v1';
const TOMBSTONES_KEY = 'mlbb_vip_tombstones_v1';
const HISTORY_CLEARED_KEY = 'mlbb_vip_history_cleared_at_v1';

// Bentuk data dari cloud -> bentuk state aplikasi (sekaligus memigrasi data lama: settledAmount per order)
function snapshotFromCloud(data) {
  const settledIds = Array.isArray(data.settledOrderIds) ? data.settledOrderIds : [];
  const rawOrders = Array.isArray(data.orders) ? data.orders : [];
  return {
    orders: migrateLegacySettlement(rawOrders, settledIds).orders,
    roomParty: data.roomParty || INITIAL_ROOM,
    matchHistory: Array.isArray(data.matchHistory) ? data.matchHistory : [],
    payouts: Array.isArray(data.payouts) ? data.payouts : [],
    myWallet: data.myWallet && typeof data.myWallet === 'object' ? data.myWallet : INITIAL_MY_WALLET,
    settledOrderIds: settledIds,
    tombstones: Array.isArray(data.tombstones) ? data.tombstones : [],
    historyClearedAt: data.historyClearedAt || null
  };
}

export default function App() {
  const [activeTab, setActiveTab] = useState('room'); // 'room' | 'finance' | 'history'
  const [orders, setOrders] = useState(() =>
    migrateLegacySettlement(
      loadData(STORAGE_KEYS.ORDERS, INITIAL_ORDERS),
      loadData(STORAGE_KEYS.SETTLED_ORDER_IDS, INITIAL_SETTLED_ORDER_IDS)
    ).orders
  );
  const [roomParty, setRoomParty] = useState(() => loadData(STORAGE_KEYS.ROOM_PARTY, INITIAL_ROOM));
  const [matchHistory, setMatchHistory] = useState(() => loadData(STORAGE_KEYS.MATCH_HISTORY, INITIAL_MATCH_HISTORY));
  const [payouts, setPayouts] = useState(() => loadData(STORAGE_KEYS.PAYOUTS, INITIAL_PAYOUTS));
  const [myWallet, setMyWallet] = useState(() => loadData(STORAGE_KEYS.MY_WALLET, INITIAL_MY_WALLET));
  const [settledOrderIds, setSettledOrderIds] = useState(() => loadData(STORAGE_KEYS.SETTLED_ORDER_IDS, INITIAL_SETTLED_ORDER_IDS));

  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);

  // Cloud Database Sync States
  const [cloudStatus, setCloudStatus] = useState('ONLINE'); // 'ONLINE' | 'SYNCING' | 'OFFLINE'
  const [isSyncing, setIsSyncing] = useState(false);
  const isApplyingRemoteRef = useRef(false);

  // Versi terakhir order yang dikenal (untuk memberi cap waktu pada yang berubah) dan daftar order yang dihapus
  const ordersRef = useRef(null);
  if (ordersRef.current === null) ordersRef.current = orders;
  const tombstonesRef = useRef(null);
  if (tombstonesRef.current === null) tombstonesRef.current = loadData(TOMBSTONES_KEY, []);
  // Kapan riwayat match terakhir dibersihkan dengan sengaja (agar perangkat basi tidak menghidupkannya kembali)
  const historyClearedAtRef = useRef(undefined);
  if (historyClearedAtRef.current === undefined) historyClearedAtRef.current = loadData(HISTORY_CLEARED_KEY, null);
  // State terbaru untuk handler yang berjalan belakangan (mis. tombol "Urungkan")
  const stateRef = useRef({});
  stateRef.current = { orders, roomParty, matchHistory, payouts, myWallet, settledOrderIds };

  const [orderModalConfig, setOrderModalConfig] = useState({ isOpen: false, defaultType: 'VIP_MABAR' });
  const [topUpOrder, setTopUpOrder] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  // action (opsional): { label, onClick } -> tombol di toast, mis. "Urungkan"
  const showToast = useCallback((message, type = 'success', action = null) => {
    setToast({ message, type, action });
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, action ? 8000 : 3500);
  }, []);

  // Kas berjalan: uang yang diterima dikurangi yang sudah dibagi (settledAmount per order)
  const { unsettledRevenue, unsettledOrderCount } = useMemo(() => {
    const u = computeUnsettled(orders);
    return { unsettledRevenue: u.revenue, unsettledOrderCount: u.count };
  }, [orders]);

  const buildPayload = (o, r, h, p, w, s, nowIso) => ({
    orders: o,
    roomParty: r,
    matchHistory: h,
    payouts: p,
    myWallet: w,
    settledOrderIds: s,
    tombstones: tombstonesRef.current,
    historyClearedAt: historyClearedAtRef.current,
    updatedAt: nowIso
  });

  // Helper to directly persist locally and queue the cloud save.
  // opts.force = true -> timpa data cloud (reset / restore yang disengaja)
  // opts.historyClearedAt = 'now' (riwayat dibersihkan) | null (riwayat dipulihkan dari backup)
  const directPersistAndSync = async (
    newOrders = orders,
    newRoom = roomParty,
    newHistory = matchHistory,
    newPayouts = payouts,
    newWallet = myWallet,
    newSettledIds = settledOrderIds,
    opts = {}
  ) => {
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();

    // 0. Cap waktu per order yang berubah + catat order yang dihapus (agar penggabungan antar perangkat benar)
    const { orders: stamped, removedIds } = stampChangedOrders(ordersRef.current, newOrders, nowIso);
    const tombstones = updateTombstones(tombstonesRef.current, removedIds, stamped.map((o) => o.id), nowIso);
    ordersRef.current = stamped;
    tombstonesRef.current = tombstones;
    if (stamped !== newOrders) setOrders(stamped);
    if ('historyClearedAt' in opts) {
      historyClearedAtRef.current = opts.historyClearedAt === 'now' ? nowIso : opts.historyClearedAt;
      saveData(HISTORY_CLEARED_KEY, historyClearedAtRef.current);
    }

    // 1. Immediately save to LocalStorage (synchronous)
    localStorage.setItem(LOCAL_WRITE_KEY, nowMs.toString());
    saveData(STORAGE_KEYS.ORDERS, stamped);
    saveData(STORAGE_KEYS.ROOM_PARTY, newRoom);
    saveData(STORAGE_KEYS.MATCH_HISTORY, newHistory);
    saveData(STORAGE_KEYS.PAYOUTS, newPayouts);
    saveData(STORAGE_KEYS.MY_WALLET, newWallet);
    saveData(STORAGE_KEYS.SETTLED_ORDER_IDS, newSettledIds);
    saveData(TOMBSTONES_KEY, tombstones);

    // 2. Queue the Cloud DB save (digabung & ditunda; lihat utils/cloudSync.js)
    setCloudStatus('SYNCING');
    try {
      await saveCloudData(buildPayload(stamped, newRoom, newHistory, newPayouts, newWallet, newSettledIds, nowIso), { force: !!opts.force });
      setCloudStatus('ONLINE');
    } catch (err) {
      console.error('Error saving to Cloud DB:', err);
      setCloudStatus('OFFLINE');
    }
  };

  // Terapkan data dari cloud (muat awal / perangkat lain / hasil gabungan server) ke state + penyimpanan lokal.
  // Mengembalikan true bila ada yang berbeda dari tampilan saat ini.
  const applyCloudSnapshot = useCallback((data) => {
    const snap = snapshotFromCloud(data);
    const cur = stateRef.current;
    const changed =
      JSON.stringify(cur.orders) !== JSON.stringify(snap.orders) ||
      JSON.stringify(cur.roomParty) !== JSON.stringify(snap.roomParty) ||
      (cur.matchHistory || []).length !== snap.matchHistory.length ||
      (cur.payouts || []).length !== snap.payouts.length ||
      (cur.myWallet && cur.myWallet.balance) !== snap.myWallet.balance;

    isApplyingRemoteRef.current = true;
    ordersRef.current = snap.orders;
    tombstonesRef.current = snap.tombstones;
    historyClearedAtRef.current = snap.historyClearedAt;
    saveData(HISTORY_CLEARED_KEY, snap.historyClearedAt);
    setOrders(snap.orders);
    setRoomParty(snap.roomParty);
    setMatchHistory(snap.matchHistory);
    setPayouts(snap.payouts);
    setMyWallet(snap.myWallet);
    setSettledOrderIds(snap.settledOrderIds);

    saveData(STORAGE_KEYS.ORDERS, snap.orders);
    saveData(STORAGE_KEYS.ROOM_PARTY, snap.roomParty);
    saveData(STORAGE_KEYS.MATCH_HISTORY, snap.matchHistory);
    saveData(STORAGE_KEYS.PAYOUTS, snap.payouts);
    saveData(STORAGE_KEYS.MY_WALLET, snap.myWallet);
    saveData(STORAGE_KEYS.SETTLED_ORDER_IDS, snap.settledOrderIds);
    saveData(TOMBSTONES_KEY, snap.tombstones);

    setTimeout(() => {
      isApplyingRemoteRef.current = false;
    }, 500);
    return changed;
  }, []);

  // Server menggabungkan data kita dengan perubahan perangkat lain -> pakai hasil gabungannya
  useEffect(() => {
    return onCloudSaved((info) => {
      if (info.merged && info.data) {
        const changed = applyCloudSnapshot(info.data);
        setCloudStatus('ONLINE');
        if (changed) showToast('🔄 Perubahan dari perangkat lain digabung otomatis.');
      }
    });
  }, [applyCloudSnapshot, showToast]);

  // Initial Sync from Cloud Database on mount
  useEffect(() => {
    let isMounted = true;

    async function initialSync() {
      setIsSyncing(true);
      try {
        const cloud = await fetchCloudData();
        if (!isMounted) return;

        const s = stateRef.current;
        const sync = getSyncState();
        const localWriteTime = Number(localStorage.getItem(LOCAL_WRITE_KEY) || 0);

        if (cloud && cloud.success && cloud.exists && cloud.data) {
          const cloudWriteTime = cloud.data.updatedAt ? new Date(cloud.data.updatedAt).getTime() : 0;
          // Pertama kali memakai sistem revisi: pakai aturan waktu lama. Selanjutnya: penanda "dirty"
          // (perubahan lokal yang belum terkirim, bertahan walau halaman ditutup).
          const localHasUnsynced = sync.baseRev === null ? localWriteTime > cloudWriteTime + 1000 : sync.dirty;

          if (localHasUnsynced) {
            // Kirim data lokal. Jika perangkat lain sudah menulis, server menggabung dan
            // hasilnya diterapkan oleh listener onCloudSaved.
            setCloudStatus('SYNCING');
            await saveCloudData(
              buildPayload(s.orders, s.roomParty, s.matchHistory, s.payouts, s.myWallet, s.settledOrderIds, new Date().toISOString()),
              { immediate: true }
            );
          } else {
            // Cloud lebih baru atau sama -> pakai data cloud
            applyCloudSnapshot(cloud.data);
            adoptCloudState(cloud.rev ?? 0, cloud.data);
          }
          setCloudStatus('ONLINE');
        } else if (cloud && cloud.success && !cloud.exists) {
          // Cloud DB is fresh/empty: push local data to cloud
          if (s.orders.length > 0 || s.payouts.length > 0) {
            setCloudStatus('SYNCING');
            await saveCloudData(
              buildPayload(s.orders, s.roomParty, s.matchHistory, s.payouts, s.myWallet, s.settledOrderIds, new Date().toISOString()),
              { immediate: true }
            );
          }
          setCloudStatus('ONLINE');
        } else {
          setCloudStatus('OFFLINE');
        }
      } catch (err) {
        console.error('Initial sync error:', err);
        setCloudStatus('OFFLINE');
      } finally {
        if (isMounted) {
          setIsSyncing(false);
        }
      }
    }

    initialSync();

    return () => {
      isMounted = false;
    };
  }, []);

  // Smart, Quota-Safe Cloud Sync (Eliminates excessive polling loops)
  const lastSyncCheckTimeRef = useRef(0);

  useEffect(() => {
    let isCancelled = false;

    async function checkRemoteUpdates() {
      // Don't poll while tab is hidden, or already syncing / applying updates
      if (document.hidden || cloudStatus === 'SYNCING' || isApplyingRemoteRef.current) {
        return;
      }
      // Ada perubahan lokal yang belum terkirim: penyimpanan berikutnya yang akan menggabungkan
      const before = getSyncState();
      if (before.dirty || before.hasPending) return;

      // Throttle: don't sync more often than once every 60 seconds unless manually requested
      const now = Date.now();
      if (now - lastSyncCheckTimeRef.current < 60000) {
        return;
      }
      lastSyncCheckTimeRef.current = now;

      try {
        const res = await fetchCloudData();
        if (isCancelled || !res || !res.success || !res.exists || !res.data) {
          return;
        }
        // Berubah selama pengambilan data? Jangan timpa.
        const after = getSyncState();
        if (after.dirty || after.hasPending) return;
        if (res.rev !== undefined && res.rev === after.baseRev) return; // sudah sama dengan server

        applyCloudSnapshot(res.data);
        adoptCloudState(res.rev ?? 0, res.data);
        setCloudStatus('ONLINE');
      } catch (err) {
        console.warn('Sync check error:', err);
      }
    }

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        checkRemoteUpdates();
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      isCancelled = true;
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [cloudStatus, applyCloudSnapshot]);

  // Force manual sync
  const handleForceSync = async () => {
    setIsSyncing(true);
    setCloudStatus('SYNCING');
    playSound('click');

    try {
      const s = stateRef.current;
      const st = getSyncState();

      if (st.dirty || st.hasPending) {
        // Ada perubahan lokal yang belum terkirim: kirim sekarang (server menggabung bila perlu)
        const res = await saveCloudData(
          buildPayload(s.orders, s.roomParty, s.matchHistory, s.payouts, s.myWallet, s.settledOrderIds, new Date().toISOString()),
          { immediate: true }
        );
        if (res && res.success) {
          setCloudStatus('ONLINE');
          showToast('☁️ Perubahan lokal berhasil dikirim & digabung dengan Cloud Database!');
        } else {
          setCloudStatus('OFFLINE');
          showToast('Gagal mengirim ke Cloud DB. Data tetap aman di perangkat ini.', 'error');
        }
        return;
      }

      const res = await fetchCloudData();
      if (res && res.success && res.exists && res.data) {
        applyCloudSnapshot(res.data);
        adoptCloudState(res.rev ?? 0, res.data);
        setCloudStatus('ONLINE');
        showToast('☁️ Data berhasil disinkronkan dari Cloud Database!');
      } else if (res && res.success && !res.exists) {
        // Push local to cloud
        const saveRes = await saveCloudData(
          buildPayload(s.orders, s.roomParty, s.matchHistory, s.payouts, s.myWallet, s.settledOrderIds, new Date().toISOString()),
          { immediate: true }
        );
        if (saveRes && saveRes.success) {
          setCloudStatus('ONLINE');
          showToast('☁️ Data lokal berhasil diunggah ke Cloud Database!');
        }
      } else {
        setCloudStatus('OFFLINE');
        showToast('Tidak dapat terhubung ke Cloud DB. Mode offline aktif.', 'error');
      }
    } catch {
      setCloudStatus('OFFLINE');
      showToast('Gagal sinkronisasi cloud.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Memoized filter orders by status to prevent re-filtering on unrelated renders
  const waitingOrders = useMemo(() => orders.filter(o => o.status === 'WAITING'), [orders]);
  const completedOrders = useMemo(() => orders.filter(o => o.status === 'COMPLETED'), [orders]);
  const hasEmptySlot = useMemo(() => {
    return !roomParty.jokiGold || !roomParty.jokiJungle || !roomParty.mid || !roomParty.roam || !roomParty.exp;
  }, [roomParty]);

  // Stable handlers for modals and child components
  const handleOpenTopUp = useCallback((order) => setTopUpOrder(order), []);
  const handleCloseTopUp = useCallback(() => setTopUpOrder(null), []);
  const handleOpenEdit = useCallback((order) => setEditingOrder(order), []);
  const handleCloseEdit = useCallback(() => setEditingOrder(null), []);

  const handleOpenOrderModal = useCallback((type = 'VIP_MABAR') => {
    setOrderModalConfig({ isOpen: true, defaultType: type });
  }, []);

  const handleCloseOrderModal = useCallback(() => {
    setOrderModalConfig(prev => ({ ...prev, isOpen: false }));
  }, []);

  const handleOpenOrderModalVip = useCallback(() => {
    setOrderModalConfig({ isOpen: true, defaultType: 'VIP_MABAR' });
  }, []);

  const handleOpenOrderModalCategory = useCallback((category) => {
    setOrderModalConfig({ isOpen: true, defaultType: category === 'JOKI' ? 'JOKI' : 'VIP_MABAR' });
  }, []);

  // Determine slot key from role & orderType
  const getSlotKey = (role, orderType) => {
    if (orderType === 'JOKI') {
      if (role === 'Gold Lane') return 'jokiGold';
      if (role === 'Jungler') return 'jokiJungle';
    } else {
      if (role === 'Mid Lane') return 'mid';
      if (role === 'Roamer') return 'roam';
      if (role === 'Exp Lane') return 'exp';
    }
    return null;
  };

  const getSlotTitle = (slotKey) => {
    return ALL_5_SLOTS.find(s => s.key === slotKey)?.title || slotKey;
  };

  // Create new order
  const handleSaveOrder = (newOrderData) => {
    const newOrderId = newId('ord');
    const newOrder = {
      ...newOrderData,
      id: newOrderId,
      status: 'WAITING',
      roomSlot: null,
      createdAt: new Date().toISOString()
    };

    let updatedOrders = [newOrder, ...orders];
    let updatedRoom = { ...roomParty };

    // Direct into room if requested and slot available
    if (newOrderData.directToRoom) {
      let targetSlot = getSlotKey(newOrderData.role, newOrderData.orderType);
      if (!targetSlot || updatedRoom[targetSlot]) {
        // Fallback to any empty slot matching the category
        if (newOrderData.orderType === 'JOKI') {
          targetSlot = ['jokiGold', 'jokiJungle'].find(k => !updatedRoom[k]);
        } else {
          targetSlot = ['mid', 'roam', 'exp'].find(k => !updatedRoom[k]);
        }
      }

      if (targetSlot) {
        newOrder.status = 'IN_ROOM';
        newOrder.roomSlot = targetSlot;
        updatedRoom[targetSlot] = newOrderId;
        showToast(`Akun customer @${newOrder.username} berhasil didaftarkan & langsung masuk ke ${getSlotTitle(targetSlot)}!`);
      } else {
        showToast(`Pesanan @${newOrder.username} (${newOrder.orderType === 'JOKI' ? 'Joki' : 'VIP Mabar'}) berhasil masuk Antrean!`);
      }
    } else {
      showToast(`Pesanan @${newOrder.username} (${newOrder.orderType === 'JOKI' ? 'Joki' : 'VIP Mabar'}) berhasil masuk Antrean!`);
    }

    setOrders(updatedOrders);
    setRoomParty(updatedRoom);
    playSound('click');

    // Immediate persist & cloud save
    directPersistAndSync(updatedOrders, updatedRoom, matchHistory);
  };

  // Save edited customer order
  const handleSaveEditOrder = (updatedOrder) => {
    let updatedRoom = { ...roomParty };

    // Check if this order is currently in a room slot
    const currentSlotKey = Object.keys(updatedRoom).find(k => updatedRoom[k] === updatedOrder.id);

    if (currentSlotKey) {
      if (updatedOrder.matchesRemaining <= 0) {
        // Quota is 0, kick out from slot
        updatedRoom[currentSlotKey] = null;
        updatedOrder.status = 'COMPLETED';
        updatedOrder.roomSlot = null;
      } else {
        // Check if role or orderType changed
        const targetSlot = getSlotKey(updatedOrder.role, updatedOrder.orderType);
        if (targetSlot && targetSlot !== currentSlotKey) {
          if (!updatedRoom[targetSlot]) {
            // New slot is empty, move into it
            updatedRoom[currentSlotKey] = null;
            updatedRoom[targetSlot] = updatedOrder.id;
            updatedOrder.roomSlot = targetSlot;
          } else {
            // New slot is already occupied, move to waiting queue
            updatedRoom[currentSlotKey] = null;
            updatedOrder.status = 'WAITING';
            updatedOrder.roomSlot = null;
          }
        }
      }
    } else {
      // Order is in waiting or completed
      if (updatedOrder.matchesRemaining > 0 && updatedOrder.status === 'COMPLETED') {
        updatedOrder.status = 'WAITING';
      } else if (updatedOrder.matchesRemaining <= 0) {
        updatedOrder.status = 'COMPLETED';
      }
    }

    const updatedOrders = orders.map(o => (o.id === updatedOrder.id ? stampCompletion(o, updatedOrder) : o));

    setOrders(updatedOrders);
    setRoomParty(updatedRoom);
    playSound('click');
    showToast(`Data @${updatedOrder.username} berhasil diperbarui!`);

    // Immediate persist & cloud save
    directPersistAndSync(updatedOrders, updatedRoom, matchHistory);
  };

  // Put player into a specific slot in room
  const handleFillSlot = (slotKey, orderId) => {
    const targetOrder = orders.find(o => o.id === orderId);
    if (!targetOrder) return;

    const existingOrderId = roomParty[slotKey];
    const occupant = existingOrderId && existingOrderId !== orderId ? orders.find(o => o.id === existingOrderId) : null;
    if (
      occupant &&
      occupant.matchesRemaining > 0 &&
      !window.confirm(`Slot ${getSlotTitle(slotKey)} sedang dipakai @${occupant.username} (sisa ${occupant.matchesRemaining} match).\n\nGanti dengan @${targetOrder.username}? @${occupant.username} akan dikembalikan ke antrean.`)
    ) {
      return;
    }
    let updatedOrders = orders.map(o => {
      if (o.id === existingOrderId) {
        return stampCompletion(o, {
          ...o,
          status: o.matchesRemaining > 0 ? 'WAITING' : 'COMPLETED',
          roomSlot: null
        });
      }
      if (o.id === orderId) {
        return stampCompletion(o, {
          ...o,
          status: 'IN_ROOM',
          roomSlot: slotKey
        });
      }
      return o;
    });

    const updatedRoom = { ...roomParty, [slotKey]: orderId };

    setOrders(updatedOrders);
    setRoomParty(updatedRoom);
    playSound('click');
    showToast(`@${targetOrder.username} sekarang aktif di ${getSlotTitle(slotKey)}!`);

    // Immediate persist & cloud save
    directPersistAndSync(updatedOrders, updatedRoom, matchHistory);
  };

  // Put next waiting order into next available slot
  const handleFillNextSlot = (orderId) => {
    const targetOrder = orders.find(o => o.id === orderId);
    if (!targetOrder) return;

    let targetSlot = getSlotKey(targetOrder.role, targetOrder.orderType);
    if (!targetSlot || roomParty[targetSlot]) {
      if (targetOrder.orderType === 'JOKI') {
        targetSlot = ['jokiGold', 'jokiJungle'].find(k => !roomParty[k]) || 'jokiGold';
      } else {
        targetSlot = ['mid', 'roam', 'exp'].find(k => !roomParty[k]) || 'mid';
      }
    }

    handleFillSlot(targetSlot, orderId);
  };

  // Remove player from slot
  const handleRemoveFromSlot = (slotKey) => {
    const orderId = roomParty[slotKey];
    if (!orderId) return;

    const order = orders.find(o => o.id === orderId);
    const newStatus = order && order.matchesRemaining > 0 ? 'WAITING' : 'COMPLETED';

    const updatedOrders = orders.map(o => (o.id === orderId ? stampCompletion(o, { ...o, status: newStatus, roomSlot: null }) : o));
    const updatedRoom = { ...roomParty, [slotKey]: null };

    setOrders(updatedOrders);
    setRoomParty(updatedRoom);
    playSound('click');
    showToast(order ? `Akun @${order.username} dikeluarkan dari ${getSlotTitle(slotKey)} ke ${newStatus === 'WAITING' ? 'Antrean' : 'Selesai'}.` : 'Slot dikosongkan.');

    // Immediate persist & cloud save
    directPersistAndSync(updatedOrders, updatedRoom, matchHistory);
  };

  // Keluarkan semua akun berkuota 0 dari room sekaligus (pindah ke "Selesai")
  const handleRemoveExpired = () => {
    const expired = Object.entries(roomParty).filter(([, id]) => {
      const o = id && orders.find(x => x.id === id);
      return o && o.matchesRemaining <= 0;
    });
    if (expired.length === 0) return;

    const ids = new Set(expired.map(([, id]) => id));
    const updatedRoom = { ...roomParty };
    expired.forEach(([slotKey]) => { updatedRoom[slotKey] = null; });
    const updatedOrders = orders.map(o => (ids.has(o.id) ? stampCompletion(o, { ...o, status: 'COMPLETED', roomSlot: null }) : o));

    setOrders(updatedOrders);
    setRoomParty(updatedRoom);
    playSound('click');
    showToast(`${ids.size} akun yang kuotanya habis dikeluarkan dari room.`);
    directPersistAndSync(updatedOrders, updatedRoom, matchHistory);
  };

  // Auto rotate: replace expired player with matching waiting player or #1 in queue
  const handleAutoRotate = (slotKey) => {
    if (waitingOrders.length === 0) {
      showToast('Tidak ada antrean tunggu untuk rotasi.', 'error');
      return;
    }

    const slotDef = ALL_5_SLOTS.find(s => s.key === slotKey);
    const targetRole = slotDef?.role;

    const bestMatch = waitingOrders.find(
      o => o.role === targetRole || (o.orderType === slotDef?.category && o.role === 'Any')
    ) || (slotDef?.category === 'JOKI' ? waitingOrders.find(o => o.orderType === 'JOKI') : waitingOrders[0]);

    if (bestMatch) {
      handleFillSlot(slotKey, bestMatch.id);
    } else {
      showToast(`Tidak ada antrean yang cocok untuk ${slotDef?.title}.`, 'error');
    }
  };

  // Finish 1 match (Win or Lose) - cuts quota for ALL active accounts in room.
  // Akun yang kuotanya sudah 0 tidak dipotong, tapi match-nya ditandai "di luar kuota".
  const handleFinishMatch = (result) => {
    const { updatedOrders, match, expiredNow, overQuotaCount, participantCount } = recordMatch({
      orders,
      roomParty,
      matchHistory,
      result
    });

    if (participantCount === 0) {
      showToast('Tidak ada akun customer di dalam room.', 'error');
      return;
    }

    const newHistory = [match, ...matchHistory];

    setOrders(updatedOrders);
    setMatchHistory(newHistory);

    // Immediate persist to LocalStorage and Cloud DB!
    directPersistAndSync(updatedOrders, roomParty, newHistory);

    if (result === 'WIN') {
      playSound('victory');
      showToast(`🏆 VICTORY! Kuota -1 untuk semua akun customer (Joki & VIP) di Room.`);
    } else {
      playSound('defeat');
      showToast(`💀 DEFEAT! Kuota -1 dicatat.`);
    }

    if (overQuotaCount > 0) {
      setTimeout(() => {
        showToast(`⚠️ ${overQuotaCount} akun berkuota 0 masih di room: ikut match ini TANPA dipotong (ditandai "di luar kuota"). Keluarkan dari room atau top up.`, 'error');
      }, 700);
    }

    if (expiredNow.length > 0) {
      setTimeout(() => {
        playSound('alert');
        showToast(`🚨 Perhatian: Kuota mabar/joki ${expiredNow.join(', ')} telah HABIS!`);
      }, overQuotaCount > 0 ? 4400 : 1200);
    }
  };

  // Move queue order up or down
  const handleMoveOrder = (index, direction) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= waitingOrders.length) return;

    const newWaiting = [...waitingOrders];
    const temp = newWaiting[index];
    newWaiting[index] = newWaiting[targetIdx];
    newWaiting[targetIdx] = temp;

    const nonWaiting = orders.filter(o => o.status !== 'WAITING');
    const updatedOrders = [...newWaiting, ...nonWaiting];

    setOrders(updatedOrders);
    playSound('click');

    // Immediate persist & cloud save
    directPersistAndSync(updatedOrders, roomParty, matchHistory);
  };

  // Mark order as fully paid
  const handleMarkPaid = (orderId) => {
    const updatedOrders = orders.map(o => {
      if (o.id === orderId) {
        return {
          ...o,
          amountPaid: o.priceTotal,
          paymentStatus: 'LUNAS'
        };
      }
      return o;
    });

    setOrders(updatedOrders);
    playSound('click');
    showToast('Pembayaran berhasil ditandai LUNAS!');

    // Immediate persist & cloud save
    directPersistAndSync(updatedOrders, roomParty, matchHistory);
  };

  // Confirm Top Up
  const handleTopUpConfirm = ({ orderId, addMatches, additionalPrice, additionalPaid, paymentMethod, isFree, tier }) => {
    const updatedOrders = orders.map(o => {
      if (o.id === orderId) {
        const newTotalMatches = o.matchesOrdered + addMatches;
        const newRemaining = o.matchesRemaining + addMatches;
        const newPriceTotal = o.priceTotal + additionalPrice;
        const newAmountPaid = o.amountPaid + additionalPaid;
        const newStatus = newRemaining > 0 ? (o.roomSlot ? 'IN_ROOM' : 'WAITING') : 'COMPLETED';
        
        let newPaymentStatus = 'LUNAS';
        if (isFree || o.paymentStatus === 'GRATIS' || o.isFree) {
          newPaymentStatus = 'GRATIS';
        } else if (newAmountPaid >= newPriceTotal) {
          newPaymentStatus = 'LUNAS';
        } else if (newAmountPaid > 0) {
          newPaymentStatus = 'DP';
        } else {
          newPaymentStatus = 'BELUM_BAYAR';
        }

        return stampCompletion(o, {
          ...o,
          matchesOrdered: newTotalMatches,
          matchesRemaining: newRemaining,
          priceTotal: newPriceTotal,
          amountPaid: newAmountPaid,
          paymentMethod: paymentMethod || o.paymentMethod,
          paymentStatus: newPaymentStatus,
          status: newStatus,
          isFree: isFree || o.isFree || false,
          // Tarif terakhir yang dipakai menentukan lencana Glory (top up gratis tidak mengubahnya)
          priceType: isFree ? o.priceType : (tier === 'GLORY' ? 'GLORY' : (o.priceType === 'GLORY' ? 'STANDARD' : o.priceType))
        });
      }
      return o;
    });

    setOrders(updatedOrders);
    playSound('victory');
    showToast(`Top Up +${addMatches} Match berhasil!`);

    // Immediate persist & cloud save
    directPersistAndSync(updatedOrders, roomParty, matchHistory);
  };

  // Kembalikan order yang baru dihapus (tombol "Urungkan" di toast). Memakai state terbaru, bukan yang basi.
  const restoreDeletedOrder = (target, wasSettledId) => {
    const cur = stateRef.current;
    if (cur.orders.some(o => o.id === target.id)) return;

    const room = { ...cur.roomParty };
    const restored = { ...target };
    if (restored.roomSlot && !room[restored.roomSlot]) {
      room[restored.roomSlot] = restored.id;
    } else if (restored.roomSlot) {
      restored.roomSlot = null; // slotnya sudah dipakai orang lain
      restored.status = restored.matchesRemaining > 0 ? 'WAITING' : 'COMPLETED';
    }

    const newOrders = [restored, ...cur.orders];
    const newSettled = wasSettledId && !cur.settledOrderIds.includes(restored.id)
      ? [...cur.settledOrderIds, restored.id]
      : cur.settledOrderIds;

    setOrders(newOrders);
    setRoomParty(room);
    setSettledOrderIds(newSettled);
    showToast(`Data @${restored.username} dikembalikan.`);
    directPersistAndSync(newOrders, room, cur.matchHistory, cur.payouts, cur.myWallet, newSettled);
  };

  // Delete an order (bisa diurungkan selama 8 detik)
  const handleDeleteOrder = (orderId) => {
    const target = orders.find(o => o.id === orderId);
    if (!target) return;

    const unsettled = unsettledAmountOf(target);
    const message = unsettled > 0
      ? `Yakin menghapus @${target.username}?\n\nUang ${formatRupiah(unsettled)} dari order ini yang belum dibagi hasil juga akan hilang dari kas.`
      : 'Yakin ingin menghapus data customer ini?';
    if (!window.confirm(message)) return;

    const updatedRoom = { ...roomParty };
    ['jokiGold', 'jokiJungle', 'mid', 'roam', 'exp'].forEach(k => {
      if (updatedRoom[k] === orderId) {
        updatedRoom[k] = null;
      }
    });

    const wasSettledId = settledOrderIds.includes(orderId);
    const updatedOrders = orders.filter(o => o.id !== orderId);
    const updatedSettledIds = settledOrderIds.filter(id => id !== orderId);

    setRoomParty(updatedRoom);
    setOrders(updatedOrders);
    setSettledOrderIds(updatedSettledIds);
    showToast(`Data @${target.username} dihapus.`, 'success', {
      label: '↩ Urungkan',
      onClick: () => restoreDeletedOrder(target, wasSettledId)
    });

    // Immediate persist & cloud save
    directPersistAndSync(updatedOrders, updatedRoom, matchHistory, payouts, myWallet, updatedSettledIds);
  };

  // Reset all data
  const handleResetData = async () => {
    if (window.confirm('Bersihkan seluruh data order, antrean, dan riwayat di Cloud & Lokal?')) {
      const emptyOrders = [];
      const emptyRoom = { jokiGold: null, jokiJungle: null, mid: null, roam: null, exp: null };
      const emptyHistory = [];
      const emptySettledIds = [];

      setOrders(emptyOrders);
      setRoomParty(emptyRoom);
      setMatchHistory(emptyHistory);
      setSettledOrderIds(emptySettledIds);

      await directPersistAndSync(emptyOrders, emptyRoom, emptyHistory, payouts, myWallet, emptySettledIds, { force: true, historyClearedAt: 'now' });
      showToast('Seluruh data order & antrean di Cloud Database berhasil dibersihkan.');
    }
  };

  // Execute Bagi Hasil 3:2 and reset active kas to Rp 0
  const handleExecutePayout = async (payoutData) => {
    const now = new Date().toISOString();
    const payoutId = newId('pay');

    // 1. Semua uang yang sudah diterima dianggap dibagi (settledAmount = amountPaid per order).
    //    Uang yang masuk SETELAH ini (top up / pelunasan) otomatis masuk kas berjalan berikutnya.
    const { count: settledCount } = computeUnsettled(orders);
    const settledOrders = applySettlement(orders);
    const newSettledOrderIdsList = [...new Set([...settledOrderIds, ...orders.map(o => o.id)])]; // penanda kompatibilitas

    // 2. Create payout history item
    const newPayoutRecord = {
      id: payoutId,
      timestamp: now,
      totalAmount: payoutData.totalAmount,
      ratioAdmin: payoutData.ratioAdmin,
      ratioPartner: payoutData.ratioPartner,
      myShare: payoutData.myShare,
      friendShare: payoutData.friendShare,
      ordersSettledCount: settledCount,
      note: payoutData.note
    };
    const updatedPayouts = [newPayoutRecord, ...payouts];

    // 3. Update wallet if user requested
    let updatedWallet = { ...myWallet };
    if (payoutData.addToWallet && payoutData.myShare > 0) {
      const newBal = (updatedWallet.balance || 0) + payoutData.myShare;
      const historyItem = {
        id: newId('tx'),
        timestamp: now,
        type: 'PAYOUT_SHARE',
        amount: payoutData.myShare,
        description: `Bagi hasil party (${payoutData.ratioAdmin}:${payoutData.ratioPartner})`,
        balanceAfter: newBal
      };
      updatedWallet = {
        balance: newBal,
        history: [historyItem, ...(updatedWallet.history || [])]
      };
      setMyWallet(updatedWallet);
    }

    setOrders(settledOrders);
    setPayouts(updatedPayouts);
    setSettledOrderIds(newSettledOrderIdsList);

    playSound('victory');
    showToast(`✅ Berhasil bagi hasil! Uang Anda: ${formatRupiah(payoutData.myShare)}, Teman: ${formatRupiah(payoutData.friendShare)}. Saldo kas aktif di-reset ke Rp 0!`);

    await directPersistAndSync(settledOrders, roomParty, matchHistory, updatedPayouts, updatedWallet, newSettledOrderIdsList);
  };

  // Adjust Wallet Balance manually
  const handleUpdateWalletBalance = async (newBalance, note) => {
    const now = new Date().toISOString();
    const oldBalance = myWallet.balance || 0;
    const diff = newBalance - oldBalance;
    const historyItem = {
      id: newId('tx'),
      timestamp: now,
      type: diff >= 0 ? 'ADJUST_UP' : 'ADJUST_DOWN',
      amount: Math.abs(diff),
      description: note || 'Penyesuaian saldo manual',
      balanceAfter: newBalance
    };

    const updatedWallet = {
      balance: newBalance,
      history: [historyItem, ...(myWallet.history || [])]
    };

    setMyWallet(updatedWallet);
    playSound('victory');
    showToast(`Saldo Dompet Uang Saya diperbarui: ${formatRupiah(newBalance)}`);

    await directPersistAndSync(orders, roomParty, matchHistory, payouts, updatedWallet, settledOrderIds);
  };

  // Add Income or Expense to Wallet
  const handleAddWalletTransaction = async (tx) => {
    if (tx.type !== 'INCOME' && tx.amount > (myWallet.balance || 0)) {
      showToast(`Saldo tidak cukup. Saldo ${formatRupiah(myWallet.balance || 0)}, pengeluaran ${formatRupiah(tx.amount)}.`, 'error');
      return;
    }
    const now = new Date().toISOString();
    const currentBalance = myWallet.balance || 0;
    const newBalance = tx.type === 'INCOME' ? currentBalance + tx.amount : currentBalance - tx.amount;

    const historyItem = {
      id: newId('tx'),
      timestamp: now,
      type: tx.type,
      amount: tx.amount,
      description: tx.description,
      balanceAfter: newBalance
    };

    const updatedWallet = {
      balance: newBalance,
      history: [historyItem, ...(myWallet.history || [])]
    };

    setMyWallet(updatedWallet);
    playSound('victory');
    showToast(`Transaksi dompet dicatat: ${tx.type === 'INCOME' ? '+' : '-'}${formatRupiah(tx.amount)}`);

    await directPersistAndSync(orders, roomParty, matchHistory, payouts, updatedWallet, settledOrderIds);
  };

  // Generate WhatsApp Share Format
  const handleShareWhatsApp = () => {
    const dateStr = new Date().toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const jGold = orders.find(o => o.id === roomParty.jokiGold);
    const jJungle = orders.find(o => o.id === roomParty.jokiJungle);
    const midOrder = orders.find(o => o.id === roomParty.mid);
    const roamOrder = orders.find(o => o.id === roomParty.roam);
    const expOrder = orders.find(o => o.id === roomParty.exp);

    const formatStatusBadge = (p) => {
      if (!p) return '';
      return p.paymentStatus === 'GRATIS' ? '💖 GRATIS' : p.paymentStatus;
    };

    let text = `👑 *MLBB VIP MABAR & JOKI - UPDATE PARTY 5v5* 👑\n`;
    text += `📅 ${dateStr} • ⏰ ${timeStr} WIB\n\n`;

    text += `🎮 *AKUN JOKI YANG SEDANG DIMAINKAN (PILOT):*\n`;
    text += `🏹 Gold Lane (Dimainin Saya): ${jGold ? `*${jGold.username}* | Sisa: *${jGold.matchesRemaining} Match* [${formatStatusBadge(jGold)}]` : '_[SLOT JOKI KOSONG - BISA MASUK]_'}\n`;
    text += `⚡ Jungler (Dimainin Teman): ${jJungle ? `*${jJungle.username}* | Sisa: *${jJungle.matchesRemaining} Match* [${formatStatusBadge(jJungle)}]` : '_[SLOT JOKI KOSONG - BISA MASUK]_'}\n\n`;

    text += `🌟 *AKUN VIP MABAR IN-GAME (MAIN SENDIRI):*\n`;
    text += `🔮 Mid Lane (Myth): ${midOrder ? `*${midOrder.username}* | Sisa: *${midOrder.matchesRemaining} Match* [${formatStatusBadge(midOrder)}]` : '_[SLOT VIP KOSONG - BISA MASUK]_'}\n`;
    text += `❤️ Roamer (Room): ${roamOrder ? `*${roamOrder.username}* | Sisa: *${roamOrder.matchesRemaining} Match* [${formatStatusBadge(roamOrder)}]` : '_[SLOT VIP KOSONG - BISA MASUK]_'}\n`;
    text += `🛡️ Exp Lane (Exp): ${expOrder ? `*${expOrder.username}* | Sisa: *${expOrder.matchesRemaining} Match* [${formatStatusBadge(expOrder)}]` : '_[SLOT VIP KOSONG - BISA MASUK]_'}\n`;

    text += `\n⏳ *ANTREAN MENUNGGU (JOKI & VIP MABAR):*\n`;
    if (waitingOrders.length === 0) {
      text += `_(Antrean kosong, slot siap diisi sekarang!)_\n`;
    } else {
      waitingOrders.forEach((wo, idx) => {
        text += `${idx + 1}. *${wo.username}* (${wo.orderType === 'JOKI' ? 'Joki ' + wo.role : 'VIP ' + wo.role}) - ${wo.matchesRemaining} Match [${formatStatusBadge(wo)}]\n`;
      });
    }

    text += `\n💰 *TARIF JOKI & VIP MABAR:*\n`;
    text += `• 1 Match: Rp 7.000\n`;
    text += `• 3 Match: Rp 21.000\n`;
    text += `• 5 Match: Rp 30.000 ⭐ _(Hemat Rp 5.000, cuma 6k/match!)_\n`;
    text += `• 10 Match: Rp 60.000 👑 _(Hemat Rp 10.000!)_\n`;
    text += `• 👑 Glory: Rp 10.000 / match (tanpa paket)\n`;
    text += `*(Berlaku kelipatan 5 match = 30.000)*\n\n`;
    text += `📲 Mau titip akun joki atau ikut mabar VIP? Langsung chat Admin ya! Gas Winrate Immortal! 🔥`;

    navigator.clipboard.writeText(text).then(() => {
      playSound('click');
      showToast('Format WhatsApp berhasil disalin ke Clipboard!');
    }).catch(() => {
      showToast('Gagal menyalin, periksa izin browser.', 'error');
    });
  };

  // Export CSV
  const handleExportCSV = () => {
    let csv = 'ID,Tipe_Layanan,Username,ID_Server,WhatsApp,Role,Catatan_Login,Match_Dipesan,Sisa_Match,Total_Tagihan,Nominal_Ditransfer,Metode_Bayar,Status_Bayar,Catatan_Transfer,Tanggal\n';
    orders.forEach(o => {
      csv += `"${o.id}","${o.orderType || 'VIP_MABAR'}","${o.username}","${o.userId || ''}","${o.phone || ''}","${o.role}","${(o.accountLogin || '').replace(/"/g, '""')}","${o.matchesOrdered}","${o.matchesRemaining}","${o.priceTotal}","${o.amountPaid}","${o.paymentMethod}","${o.paymentStatus}","${(o.transferNote || '').replace(/"/g, '""')}","${o.createdAt}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `rekap-keuangan-mlbb-joki-vip-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('File CSV Keuangan berhasil diunduh!');
  };

  // Export JSON Backup
  const handleExportJSON = () => {
    const backupData = {
      orders,
      roomParty,
      matchHistory,
      payouts,
      myWallet,
      settledOrderIds,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `mlbb-vip-joki-backup-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('File backup JSON berhasil diunduh!');
  };

  // Import JSON Restore (menimpa data cloud secara sengaja; snapshot harian di server menyimpan versi sebelumnya)
  const handleImportJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target.result);
        const snap = snapshotFromCloud({
          orders: data.orders || orders,
          roomParty: data.roomParty || roomParty,
          matchHistory: data.matchHistory || matchHistory,
          payouts: data.payouts || payouts,
          myWallet: data.myWallet || myWallet,
          settledOrderIds: data.settledOrderIds || settledOrderIds,
          tombstones: []
        });

        setOrders(snap.orders);
        setRoomParty(snap.roomParty);
        setMatchHistory(snap.matchHistory);
        setPayouts(snap.payouts);
        setMyWallet(snap.myWallet);
        setSettledOrderIds(snap.settledOrderIds);
        showToast('Data berhasil direstore dari backup!');

        // Immediately sync restored data to cloud
        await directPersistAndSync(snap.orders, snap.roomParty, snap.matchHistory, snap.payouts, snap.myWallet, snap.settledOrderIds, { force: true, historyClearedAt: null });
      } catch {
        showToast('Format file JSON tidak valid.', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // izinkan memilih file yang sama lagi
  };

  return (
    <div className="min-h-screen bg-[#070a12] text-slate-100 flex flex-col font-sans">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 gpu-layer">
          <div
            className={`px-4 py-3 rounded-xl border shadow-xl flex items-center gap-2.5 text-xs sm:text-sm font-bold ${
              toast.type === 'error'
                ? 'bg-rose-950 border-rose-500 text-rose-200'
                : 'bg-slate-900 border-amber-500 text-amber-300 shadow-md'
            }`}
          >
            {toast.type === 'error' ? <AlertCircle className="w-4 h-4 text-rose-400" /> : <Check className="w-4 h-4 text-emerald-400" />}
            <span>{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  const act = toast.action;
                  setToast(null);
                  act.onClick();
                }}
                className="ml-1 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-colors"
              >
                {toast.action.label}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Header with Cloud DB Status */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        orders={orders}
        roomParty={roomParty}
        matchHistory={matchHistory}
        myWallet={myWallet}
        unsettledRevenue={unsettledRevenue}
        onOpenWalletModal={() => setIsWalletModalOpen(true)}
        onOpenPayoutModal={() => setIsPayoutModalOpen(true)}
        onOpenNewOrder={handleOpenOrderModalVip}
        onResetData={handleResetData}
        onShareWhatsApp={handleShareWhatsApp}
        cloudStatus={cloudStatus}
        isSyncing={isSyncing}
        onForceSync={handleForceSync}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
        {activeTab === 'room' && (
          <div className="space-y-5">
            {/* Live Room: 2 Joki Customer Accounts + 3 VIP Mabar Customer Accounts */}
            <RoomParty
              roomParty={roomParty}
              orders={orders}
              onFillSlot={handleFillSlot}
              onRemoveFromSlot={handleRemoveFromSlot}
              onFinishMatch={handleFinishMatch}
              onTopUpOrder={handleOpenTopUp}
              onEditOrder={handleOpenEdit}
              onAutoRotate={handleAutoRotate}
              onRemoveExpired={handleRemoveExpired}
              waitingOrders={waitingOrders}
              onOpenNewOrder={handleOpenOrderModalCategory}
            />

            {/* Waiting Queue List */}
            <WaitingQueue
              waitingOrders={waitingOrders}
              completedOrders={completedOrders}
              matchHistory={matchHistory}
              roomParty={roomParty}
              onFillNextSlot={handleFillNextSlot}
              onMoveOrder={handleMoveOrder}
              onDeleteOrder={handleDeleteOrder}
              onTopUpOrder={handleOpenTopUp}
              onEditOrder={handleOpenEdit}
              onMarkPaid={handleMarkPaid}
              onOpenNewOrder={handleOpenOrderModalVip}
            />
          </div>
        )}

        {activeTab === 'finance' && (
          <FinancialView
            orders={orders}
            payouts={payouts}
            myWallet={myWallet}
            settledOrderIds={settledOrderIds}
            unsettledRevenue={unsettledRevenue}
            unsettledOrderCount={unsettledOrderCount}
            onOpenWalletModal={() => setIsWalletModalOpen(true)}
            onOpenPayoutModal={() => setIsPayoutModalOpen(true)}
            onMarkPaid={handleMarkPaid}
            onTopUpOrder={handleOpenTopUp}
            onEditOrder={handleOpenEdit}
            onDeleteOrder={handleDeleteOrder}
            onExportCSV={handleExportCSV}
            onExportJSON={handleExportJSON}
            onImportJSON={handleImportJSON}
            onOpenNewOrder={handleOpenOrderModalVip}
          />
        )}

        {activeTab === 'history' && (
          <MatchHistoryView
            matchHistory={matchHistory}
            onClearHistory={() => {
              if (window.confirm('Bersihkan semua catatan riwayat match?')) {
                setMatchHistory([]);
                showToast('Riwayat match dibersihkan.');
                directPersistAndSync(orders, roomParty, [], undefined, undefined, undefined, { force: true, historyClearedAt: 'now' });
              }
            }}
          />
        )}
      </main>

      {/* Modals */}
      <WalletModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        myWallet={myWallet}
        onUpdateBalance={handleUpdateWalletBalance}
        onAddTransaction={handleAddWalletTransaction}
      />

      <PayoutModal
        isOpen={isPayoutModalOpen}
        onClose={() => setIsPayoutModalOpen(false)}
        unsettledRevenue={unsettledRevenue}
        unsettledOrderCount={unsettledOrderCount}
        onConfirmPayout={handleExecutePayout}
      />

      <OrderModal
        isOpen={orderModalConfig.isOpen}
        defaultOrderType={orderModalConfig.defaultType}
        onClose={handleCloseOrderModal}
        onSave={handleSaveOrder}
        hasEmptySlot={hasEmptySlot}
      />

      <TopUpModal
        isOpen={!!topUpOrder}
        order={topUpOrder}
        onClose={handleCloseTopUp}
        onConfirm={handleTopUpConfirm}
      />

      <EditOrderModal
        isOpen={!!editingOrder}
        order={editingOrder}
        onClose={handleCloseEdit}
        onSave={handleSaveEditOrder}
      />

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-4 text-center text-xs text-slate-500">
        <p>MLBB VIP & Joki Mabar Pro • Cloud Database Sync Online • Siap Diakses dari Semua Perangkat (HP / Laptop)</p>
      </footer>
    </div>
  );
}
