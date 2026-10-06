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
import { fetchCloudData, saveCloudData, discardPendingCloudSave, onCloudSaved } from './utils/cloudSync';
import { stampCompletion } from './utils/orderTime';
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

export default function App() {
  const [activeTab, setActiveTab] = useState('room'); // 'room' | 'finance' | 'history'
  const [orders, setOrders] = useState(() => loadData(STORAGE_KEYS.ORDERS, INITIAL_ORDERS));
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
  const lastSyncedAtRef = useRef(null);
  const saveTimeoutRef = useRef(null);
  const isInitialLoadRef = useRef(true);

  const [orderModalConfig, setOrderModalConfig] = useState({ isOpen: false, defaultType: 'VIP_MABAR' });
  const [topUpOrder, setTopUpOrder] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  // Unsettled Cash & Order Count calculations (Single-pass)
  const settledSet = useMemo(() => new Set(settledOrderIds || []), [settledOrderIds]);
  const { unsettledRevenue, unsettledOrderCount } = useMemo(() => {
    let rev = 0;
    let count = 0;
    for (let i = 0; i < orders.length; i++) {
      const o = orders[i];
      if (!settledSet.has(o.id)) {
        rev += Number(o.amountPaid) || 0;
        count++;
      }
    }
    return { unsettledRevenue: rev, unsettledOrderCount: count };
  }, [orders, settledSet]);

  // Helper to directly persist and save to cloud immediately
  const directPersistAndSync = async (
    newOrders = orders,
    newRoom = roomParty,
    newHistory = matchHistory,
    newPayouts = payouts,
    newWallet = myWallet,
    newSettledIds = settledOrderIds
  ) => {
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();

    // 1. Immediately save to LocalStorage (synchronous)
    localStorage.setItem(LOCAL_WRITE_KEY, nowMs.toString());
    saveData(STORAGE_KEYS.ORDERS, newOrders);
    saveData(STORAGE_KEYS.ROOM_PARTY, newRoom);
    saveData(STORAGE_KEYS.MATCH_HISTORY, newHistory);
    saveData(STORAGE_KEYS.PAYOUTS, newPayouts);
    saveData(STORAGE_KEYS.MY_WALLET, newWallet);
    saveData(STORAGE_KEYS.SETTLED_ORDER_IDS, newSettledIds);

    // 2. Immediately launch Cloud DB save
    setCloudStatus('SYNCING');
    try {
      const res = await saveCloudData({
        orders: newOrders,
        roomParty: newRoom,
        matchHistory: newHistory,
        payouts: newPayouts,
        myWallet: newWallet,
        settledOrderIds: newSettledIds,
        updatedAt: nowIso
      });

      if (res && res.success) {
        lastSyncedAtRef.current = res.updatedAt || nowIso;
        setCloudStatus('ONLINE');
      } else {
        console.warn('Cloud save response:', res);
        setCloudStatus('ONLINE');
      }
    } catch (err) {
      console.error('Error saving to Cloud DB:', err);
      setCloudStatus('OFFLINE');
    }
  };

  // Initial Sync from Cloud Database on mount
  useEffect(() => {
    let isMounted = true;

    async function initialSync() {
      setIsSyncing(true);
      try {
        const cloud = await fetchCloudData();
        if (!isMounted) return;

        const localWriteTime = Number(localStorage.getItem(LOCAL_WRITE_KEY) || 0);

        if (cloud && cloud.success && cloud.exists && cloud.data) {
          const cloudWriteTime = cloud.data.updatedAt ? new Date(cloud.data.updatedAt).getTime() : 0;

          // Check if local has unsaved modifications newer than cloud
          if (localWriteTime > cloudWriteTime + 1000) {
            // Local is newer than cloud (e.g. user made changes right before refresh)
            // Push local to cloud so cloud gets updated
            const currentOrders = loadData(STORAGE_KEYS.ORDERS, INITIAL_ORDERS);
            const currentRoom = loadData(STORAGE_KEYS.ROOM_PARTY, INITIAL_ROOM);
            const currentHistory = loadData(STORAGE_KEYS.MATCH_HISTORY, INITIAL_MATCH_HISTORY);
            const currentPayouts = loadData(STORAGE_KEYS.PAYOUTS, INITIAL_PAYOUTS);
            const currentWallet = loadData(STORAGE_KEYS.MY_WALLET, INITIAL_MY_WALLET);
            const currentSettledIds = loadData(STORAGE_KEYS.SETTLED_ORDER_IDS, INITIAL_SETTLED_ORDER_IDS);

            setCloudStatus('SYNCING');
            const saveRes = await saveCloudData({
              orders: currentOrders,
              roomParty: currentRoom,
              matchHistory: currentHistory,
              payouts: currentPayouts,
              myWallet: currentWallet,
              settledOrderIds: currentSettledIds,
              updatedAt: new Date(localWriteTime).toISOString()
            }, { immediate: true });

            if (saveRes && saveRes.success) {
              lastSyncedAtRef.current = saveRes.updatedAt;
              setCloudStatus('ONLINE');
            } else {
              setCloudStatus('ONLINE');
            }
          } else {
            // Cloud is newer or equal -> safely load cloud data
            const cloudOrders = Array.isArray(cloud.data.orders) ? cloud.data.orders : [];
            const cloudRoom = cloud.data.roomParty || INITIAL_ROOM;
            const cloudHistory = Array.isArray(cloud.data.matchHistory) ? cloud.data.matchHistory : [];
            const cloudPayouts = Array.isArray(cloud.data.payouts) ? cloud.data.payouts : [];
            const cloudWallet = cloud.data.myWallet && typeof cloud.data.myWallet === 'object' ? cloud.data.myWallet : INITIAL_MY_WALLET;
            const cloudSettledIds = Array.isArray(cloud.data.settledOrderIds) ? cloud.data.settledOrderIds : [];

            discardPendingCloudSave();
            isApplyingRemoteRef.current = true;
            setOrders(cloudOrders);
            setRoomParty(cloudRoom);
            setMatchHistory(cloudHistory);
            setPayouts(cloudPayouts);
            setMyWallet(cloudWallet);
            setSettledOrderIds(cloudSettledIds);

            saveData(STORAGE_KEYS.ORDERS, cloudOrders);
            saveData(STORAGE_KEYS.ROOM_PARTY, cloudRoom);
            saveData(STORAGE_KEYS.MATCH_HISTORY, cloudHistory);
            saveData(STORAGE_KEYS.PAYOUTS, cloudPayouts);
            saveData(STORAGE_KEYS.MY_WALLET, cloudWallet);
            saveData(STORAGE_KEYS.SETTLED_ORDER_IDS, cloudSettledIds);

            lastSyncedAtRef.current = cloud.updatedAt || cloud.data.updatedAt;
            setCloudStatus('ONLINE');

            setTimeout(() => {
              isApplyingRemoteRef.current = false;
            }, 500);
          }
        } else if (cloud && cloud.success && !cloud.exists) {
          // Cloud DB is fresh/empty: push local data to cloud
          const currentOrders = loadData(STORAGE_KEYS.ORDERS, INITIAL_ORDERS);
          const currentRoom = loadData(STORAGE_KEYS.ROOM_PARTY, INITIAL_ROOM);
          const currentHistory = loadData(STORAGE_KEYS.MATCH_HISTORY, INITIAL_MATCH_HISTORY);
          const currentPayouts = loadData(STORAGE_KEYS.PAYOUTS, INITIAL_PAYOUTS);
          const currentWallet = loadData(STORAGE_KEYS.MY_WALLET, INITIAL_MY_WALLET);
          const currentSettledIds = loadData(STORAGE_KEYS.SETTLED_ORDER_IDS, INITIAL_SETTLED_ORDER_IDS);

          if (currentOrders.length > 0 || currentPayouts.length > 0) {
            setCloudStatus('SYNCING');
            const saveRes = await saveCloudData({
              orders: currentOrders,
              roomParty: currentRoom,
              matchHistory: currentHistory,
              payouts: currentPayouts,
              myWallet: currentWallet,
              settledOrderIds: currentSettledIds,
              updatedAt: new Date().toISOString()
            }, { immediate: true });
            if (saveRes && saveRes.success) {
              lastSyncedAtRef.current = saveRes.updatedAt;
              setCloudStatus('ONLINE');
            } else {
              setCloudStatus('ONLINE');
            }
          } else {
            setCloudStatus('ONLINE');
          }
        } else {
          setCloudStatus('OFFLINE');
        }
      } catch (err) {
        console.error('Initial sync error:', err);
        setCloudStatus('OFFLINE');
      } finally {
        if (isMounted) {
          setIsSyncing(false);
          isInitialLoadRef.current = false;
        }
      }
    }

    initialSync();

    return () => {
      isMounted = false;
    };
  }, []);

  // Simpan ke cloud digabung/ditunda (hemat kuota Blob); catat waktu sinkron saat upload benar-benar selesai
  useEffect(() => {
    return onCloudSaved((updatedAt) => {
      if (updatedAt) lastSyncedAtRef.current = updatedAt;
    });
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

        const remoteTime = res.updatedAt || res.data.updatedAt;
        if (remoteTime && remoteTime !== lastSyncedAtRef.current) {
          const localWriteTime = Number(localStorage.getItem(LOCAL_WRITE_KEY) || 0);
          const remoteWriteTime = new Date(remoteTime).getTime();

          // Only apply if remote is genuinely newer than our local write time
          if (remoteWriteTime > localWriteTime) {
            discardPendingCloudSave();
            isApplyingRemoteRef.current = true;
            const cloudOrders = Array.isArray(res.data.orders) ? res.data.orders : [];
            const cloudRoom = res.data.roomParty || INITIAL_ROOM;
            const cloudHistory = Array.isArray(res.data.matchHistory) ? res.data.matchHistory : [];
            const cloudPayouts = Array.isArray(res.data.payouts) ? res.data.payouts : [];
            const cloudWallet = res.data.myWallet && typeof res.data.myWallet === 'object' ? res.data.myWallet : INITIAL_MY_WALLET;
            const cloudSettledIds = Array.isArray(res.data.settledOrderIds) ? res.data.settledOrderIds : [];

            setOrders(cloudOrders);
            setRoomParty(cloudRoom);
            setMatchHistory(cloudHistory);
            setPayouts(cloudPayouts);
            setMyWallet(cloudWallet);
            setSettledOrderIds(cloudSettledIds);

            saveData(STORAGE_KEYS.ORDERS, cloudOrders);
            saveData(STORAGE_KEYS.ROOM_PARTY, cloudRoom);
            saveData(STORAGE_KEYS.MATCH_HISTORY, cloudHistory);
            saveData(STORAGE_KEYS.PAYOUTS, cloudPayouts);
            saveData(STORAGE_KEYS.MY_WALLET, cloudWallet);
            saveData(STORAGE_KEYS.SETTLED_ORDER_IDS, cloudSettledIds);

            lastSyncedAtRef.current = remoteTime;
            setCloudStatus('ONLINE');

            setTimeout(() => {
              isApplyingRemoteRef.current = false;
            }, 500);
          }
        }
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
  }, [cloudStatus]);

  // Force manual sync
  const handleForceSync = async () => {
    setIsSyncing(true);
    setCloudStatus('SYNCING');
    playSound('click');

    try {
      const res = await fetchCloudData();
      if (res && res.success && res.exists && res.data) {
        discardPendingCloudSave();
        isApplyingRemoteRef.current = true;
        const cloudOrders = Array.isArray(res.data.orders) ? res.data.orders : [];
        const cloudRoom = res.data.roomParty || INITIAL_ROOM;
        const cloudHistory = Array.isArray(res.data.matchHistory) ? res.data.matchHistory : [];
        const cloudPayouts = Array.isArray(res.data.payouts) ? res.data.payouts : [];
        const cloudWallet = res.data.myWallet && typeof res.data.myWallet === 'object' ? res.data.myWallet : INITIAL_MY_WALLET;
        const cloudSettledIds = Array.isArray(res.data.settledOrderIds) ? res.data.settledOrderIds : [];

        setOrders(cloudOrders);
        setRoomParty(cloudRoom);
        setMatchHistory(cloudHistory);
        setPayouts(cloudPayouts);
        setMyWallet(cloudWallet);
        setSettledOrderIds(cloudSettledIds);

        saveData(STORAGE_KEYS.ORDERS, cloudOrders);
        saveData(STORAGE_KEYS.ROOM_PARTY, cloudRoom);
        saveData(STORAGE_KEYS.MATCH_HISTORY, cloudHistory);
        saveData(STORAGE_KEYS.PAYOUTS, cloudPayouts);
        saveData(STORAGE_KEYS.MY_WALLET, cloudWallet);
        saveData(STORAGE_KEYS.SETTLED_ORDER_IDS, cloudSettledIds);

        lastSyncedAtRef.current = res.updatedAt || res.data.updatedAt;
        setCloudStatus('ONLINE');
        showToast('☁️ Data berhasil disinkronkan dari Cloud Database!');
        setTimeout(() => {
          isApplyingRemoteRef.current = false;
        }, 500);
      } else if (res && res.success && !res.exists) {
        // Push local to cloud
        const saveRes = await saveCloudData({ orders, roomParty, matchHistory, payouts, myWallet, settledOrderIds }, { immediate: true });
        if (saveRes && saveRes.success) {
          lastSyncedAtRef.current = saveRes.updatedAt;
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
    const newId = `ord-${Date.now().toString().slice(-6)}`;
    const newOrder = {
      ...newOrderData,
      id: newId,
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
        updatedRoom[targetSlot] = newId;
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

  // Finish 1 match (Win or Lose) - cuts quota for ALL active accounts in room
  const handleFinishMatch = (result) => {
    const activeSlotPlayerIds = [
      roomParty.jokiGold,
      roomParty.jokiJungle,
      roomParty.mid,
      roomParty.roam,
      roomParty.exp
    ].filter(Boolean);

    if (activeSlotPlayerIds.length === 0) {
      showToast('Tidak ada akun customer di dalam room.', 'error');
      return;
    }

    const participants = [];
    const expiredList = [];

    const updatedOrders = orders.map(ord => {
      if (activeSlotPlayerIds.includes(ord.id)) {
        participants.push(`@${ord.username} (${ord.orderType === 'JOKI' ? 'Joki ' + ord.role : 'VIP ' + ord.role})`);
        const newRemaining = Math.max(0, ord.matchesRemaining - 1);
        if (newRemaining === 0) {
          expiredList.push(`@${ord.username}`);
        }
        return stampCompletion(ord, {
          ...ord,
          matchesRemaining: newRemaining,
          status: newRemaining === 0 ? 'COMPLETED' : 'IN_ROOM'
        });
      }
      return ord;
    });

    const newMatch = {
      id: `match-${Date.now()}`,
      matchNumber: matchHistory.length + 1,
      result, // 'WIN' | 'LOSE'
      timestamp: new Date().toISOString(),
      participants,
      mvp: result === 'WIN' ? participants[0] || 'Team Carry' : null,
      durationMinutes: 15
    };

    const newHistory = [newMatch, ...matchHistory];

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

    if (expiredList.length > 0) {
      setTimeout(() => {
        playSound('alert');
        showToast(`🚨 Perhatian: Kuota mabar/joki ${expiredList.join(', ')} telah HABIS!`);
      }, 1200);
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
  const handleTopUpConfirm = ({ orderId, addMatches, additionalPrice, additionalPaid, paymentMethod, isFree }) => {
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
          isFree: isFree || o.isFree || false
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

  // Delete an order
  const handleDeleteOrder = (orderId) => {
    if (!window.confirm('Yakin ingin menghapus data customer ini?')) return;

    const updatedRoom = { ...roomParty };
    ['jokiGold', 'jokiJungle', 'mid', 'roam', 'exp'].forEach(k => {
      if (updatedRoom[k] === orderId) {
        updatedRoom[k] = null;
      }
    });

    const updatedOrders = orders.filter(o => o.id !== orderId);
    const updatedSettledIds = settledOrderIds.filter(id => id !== orderId);

    setRoomParty(updatedRoom);
    setOrders(updatedOrders);
    setSettledOrderIds(updatedSettledIds);
    showToast('Data berhasil dihapus.');

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

      await directPersistAndSync(emptyOrders, emptyRoom, emptyHistory, payouts, myWallet, emptySettledIds);
      showToast('Seluruh data order & antrean di Cloud Database berhasil dibersihkan.');
    }
  };

  // Execute Bagi Hasil 3:2 and reset active kas to Rp 0
  const handleExecutePayout = async (payoutData) => {
    const now = new Date().toISOString();
    const payoutId = `pay-${Date.now()}`;

    // 1. Gather all currently unsettled order IDs
    const currentSettledSet = new Set(settledOrderIds);
    const newSettledOrderIdsList = [...settledOrderIds];
    orders.forEach(o => {
      if (!currentSettledSet.has(o.id)) {
        newSettledOrderIdsList.push(o.id);
      }
    });

    // 2. Create payout history item
    const newPayoutRecord = {
      id: payoutId,
      timestamp: now,
      totalAmount: payoutData.totalAmount,
      ratioAdmin: payoutData.ratioAdmin,
      ratioPartner: payoutData.ratioPartner,
      myShare: payoutData.myShare,
      friendShare: payoutData.friendShare,
      ordersSettledCount: orders.length - settledOrderIds.length,
      note: payoutData.note
    };
    const updatedPayouts = [newPayoutRecord, ...payouts];

    // 3. Update wallet if user requested
    let updatedWallet = { ...myWallet };
    if (payoutData.addToWallet && payoutData.myShare > 0) {
      const newBal = (updatedWallet.balance || 0) + payoutData.myShare;
      const historyItem = {
        id: `tx-${Date.now()}`,
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

    setPayouts(updatedPayouts);
    setSettledOrderIds(newSettledOrderIdsList);

    playSound('victory');
    showToast(`✅ Berhasil bagi hasil! Uang Anda: ${formatRupiah(payoutData.myShare)}, Teman: ${formatRupiah(payoutData.friendShare)}. Saldo kas aktif di-reset ke Rp 0!`);

    await directPersistAndSync(orders, roomParty, matchHistory, updatedPayouts, updatedWallet, newSettledOrderIdsList);
  };

  // Adjust Wallet Balance manually
  const handleUpdateWalletBalance = async (newBalance, note) => {
    const now = new Date().toISOString();
    const oldBalance = myWallet.balance || 0;
    const diff = newBalance - oldBalance;
    const historyItem = {
      id: `tx-${Date.now()}`,
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
    const now = new Date().toISOString();
    const currentBalance = myWallet.balance || 0;
    const newBalance = tx.type === 'INCOME' ? currentBalance + tx.amount : Math.max(0, currentBalance - tx.amount);

    const historyItem = {
      id: `tx-${Date.now()}`,
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

  // Import JSON Restore
  const handleImportJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target.result);
        const newOrders = data.orders || orders;
        const newRoom = data.roomParty || roomParty;
        const newHistory = data.matchHistory || matchHistory;
        const newPayouts = data.payouts || payouts;
        const newWallet = data.myWallet || myWallet;
        const newSettledIds = data.settledOrderIds || settledOrderIds;

        setOrders(newOrders);
        setRoomParty(newRoom);
        setMatchHistory(newHistory);
        setPayouts(newPayouts);
        setMyWallet(newWallet);
        setSettledOrderIds(newSettledIds);
        showToast('Data berhasil direstore dari backup!');

        // Immediately sync restored data to cloud
        await directPersistAndSync(newOrders, newRoom, newHistory, newPayouts, newWallet, newSettledIds);
      } catch {
        showToast('Format file JSON tidak valid.', 'error');
      }
    };
    reader.readAsText(file);
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
                directPersistAndSync(orders, roomParty, []);
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
