import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import RoomParty from './components/RoomParty';
import WaitingQueue from './components/WaitingQueue';
import OrderModal from './components/OrderModal';
import TopUpModal from './components/TopUpModal';
import FinancialView from './components/FinancialView';
import MatchHistoryView from './components/MatchHistoryView';
import { playSound } from './utils/sound';
import { formatRupiah } from './utils/pricing';
import {
  STORAGE_KEYS,
  INITIAL_HOST,
  INITIAL_ORDERS,
  INITIAL_ROOM,
  INITIAL_MATCH_HISTORY,
  loadData,
  saveData
} from './utils/storage';
import { Check, AlertCircle, Copy, Swords } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('room'); // 'room' | 'finance' | 'history'
  const [orders, setOrders] = useState(() => loadData(STORAGE_KEYS.ORDERS, INITIAL_ORDERS));
  const [roomParty, setRoomParty] = useState(() => loadData(STORAGE_KEYS.ROOM_PARTY, INITIAL_ROOM));
  const [hostInfo, setHostInfo] = useState(() => loadData(STORAGE_KEYS.HOST_INFO, INITIAL_HOST));
  const [matchHistory, setMatchHistory] = useState(() => loadData(STORAGE_KEYS.MATCH_HISTORY, INITIAL_MATCH_HISTORY));

  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [topUpOrder, setTopUpOrder] = useState(null);
  const [toast, setToast] = useState(null);

  // Sync with LocalStorage
  useEffect(() => {
    saveData(STORAGE_KEYS.ORDERS, orders);
  }, [orders]);

  useEffect(() => {
    saveData(STORAGE_KEYS.ROOM_PARTY, roomParty);
  }, [roomParty]);

  useEffect(() => {
    saveData(STORAGE_KEYS.HOST_INFO, hostInfo);
  }, [hostInfo]);

  useEffect(() => {
    saveData(STORAGE_KEYS.MATCH_HISTORY, matchHistory);
  }, [matchHistory]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  // Filter orders by status
  const waitingOrders = orders.filter(o => o.status === 'WAITING');
  const completedOrders = orders.filter(o => o.status === 'COMPLETED');
  const hasEmptySlot = [1, 2, 3, 4].some(s => !roomParty[s]);

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
      const openSlot = [1, 2, 3, 4].find(s => !roomParty[s]);
      if (openSlot) {
        newOrder.status = 'IN_ROOM';
        newOrder.roomSlot = openSlot;
        updatedRoom[openSlot] = newId;
        showToast(`Pesanan VIP @${newOrder.username} berhasil dibuat & langsung masuk Slot ${openSlot}!`);
      } else {
        showToast(`Pesanan VIP @${newOrder.username} berhasil ditambahkan ke Antrean!`);
      }
    } else {
      showToast(`Pesanan VIP @${newOrder.username} berhasil ditambahkan ke Antrean!`);
    }

    setOrders(updatedOrders);
    setRoomParty(updatedRoom);
    playSound('click');
  };

  // Put player into a specific slot in room
  const handleFillSlot = (slotNum, orderId) => {
    const targetOrder = orders.find(o => o.id === orderId);
    if (!targetOrder) return;

    // If slot had an existing order, put old order back to waiting or completed
    const existingOrderId = roomParty[slotNum];
    let updatedOrders = orders.map(o => {
      if (o.id === existingOrderId) {
        return {
          ...o,
          status: o.matchesRemaining > 0 ? 'WAITING' : 'COMPLETED',
          roomSlot: null
        };
      }
      if (o.id === orderId) {
        return {
          ...o,
          status: 'IN_ROOM',
          roomSlot: slotNum
        };
      }
      return o;
    });

    setOrders(updatedOrders);
    setRoomParty(prev => ({ ...prev, [slotNum]: orderId }));
    playSound('click');
    showToast(`@${targetOrder.username} sekarang aktif di Room Slot ${slotNum}!`);
  };

  // Put next waiting order into next available slot
  const handleFillNextSlot = (orderId) => {
    const emptySlot = [1, 2, 3, 4].find(s => !roomParty[s]);
    if (emptySlot) {
      handleFillSlot(emptySlot, orderId);
    } else {
      // Prompt user or replace slot 1
      handleFillSlot(1, orderId);
    }
  };

  // Remove player from slot
  const handleRemoveFromSlot = (slotNum) => {
    const orderId = roomParty[slotNum];
    if (!orderId) return;

    const order = orders.find(o => o.id === orderId);
    const newStatus = order && order.matchesRemaining > 0 ? 'WAITING' : 'COMPLETED';

    setOrders(orders.map(o => (o.id === orderId ? { ...o, status: newStatus, roomSlot: null } : o)));
    setRoomParty(prev => ({ ...prev, [slotNum]: null }));
    playSound('click');
    showToast(order ? `@${order.username} dikeluarkan dari Slot ${slotNum} ke ${newStatus === 'WAITING' ? 'Antrean' : 'Selesai'}.` : 'Slot dikosongkan.');
  };

  // Auto rotate: replace expired player with #1 in waiting queue
  const handleAutoRotate = (slotNum) => {
    if (waitingOrders.length === 0) {
      showToast('Tidak ada antrean tunggu untuk rotasi.', 'error');
      return;
    }
    const nextPlayer = waitingOrders[0];
    handleFillSlot(slotNum, nextPlayer.id);
  };

  // Finish 1 match (Win or Lose)
  const handleFinishMatch = (result) => {
    const activeSlotPlayerIds = Object.values(roomParty).filter(Boolean);
    if (activeSlotPlayerIds.length === 0) {
      showToast('Tidak ada pemain VIP di dalam room.', 'error');
      return;
    }

    const participants = [];
    const expiredList = [];

    // Decrement matches remaining for all active room players
    const updatedOrders = orders.map(ord => {
      if (activeSlotPlayerIds.includes(ord.id)) {
        participants.push(ord.username);
        const newRemaining = Math.max(0, ord.matchesRemaining - 1);
        if (newRemaining === 0) {
          expiredList.push(ord.username);
        }
        return {
          ...ord,
          matchesRemaining: newRemaining,
          status: newRemaining === 0 ? 'COMPLETED' : 'IN_ROOM'
        };
      }
      return ord;
    });

    // Record in match history
    const newMatch = {
      id: `match-${Date.now()}`,
      matchNumber: matchHistory.length + 1,
      result, // 'WIN' | 'LOSE'
      timestamp: new Date().toISOString(),
      participants,
      mvp: result === 'WIN' ? `${hostInfo.name} / ${participants[0] || 'Team'}` : null,
      durationMinutes: 15
    };

    setOrders(updatedOrders);
    setMatchHistory([newMatch, ...matchHistory]);

    // Audio feedback
    if (result === 'WIN') {
      playSound('victory');
      showToast(`🏆 VICTORY! Kuota -1 untuk semua player di Room.`);
    } else {
      playSound('defeat');
      showToast(`💀 DEFEAT! Kuota -1 dicatat.`);
    }

    if (expiredList.length > 0) {
      setTimeout(() => {
        playSound('alert');
        showToast(`🚨 Perhatian: Kuota mabar ${expiredList.join(', ')} telah HABIS!`);
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

    // Rebuild full orders maintaining new waiting order
    const nonWaiting = orders.filter(o => o.status !== 'WAITING');
    setOrders([...newWaiting, ...nonWaiting]);
    playSound('click');
  };

  // Mark order as fully paid
  const handleMarkPaid = (orderId) => {
    setOrders(orders.map(o => {
      if (o.id === orderId) {
        return {
          ...o,
          amountPaid: o.priceTotal,
          paymentStatus: 'LUNAS'
        };
      }
      return o;
    }));
    playSound('click');
    showToast('Pembayaran berhasil ditandai LUNAS!');
  };

  // Confirm Top Up
  const handleTopUpConfirm = ({ orderId, addMatches, additionalPrice, additionalPaid, paymentMethod }) => {
    setOrders(orders.map(o => {
      if (o.id === orderId) {
        const newTotalMatches = o.matchesOrdered + addMatches;
        const newRemaining = o.matchesRemaining + addMatches;
        const newPriceTotal = o.priceTotal + additionalPrice;
        const newAmountPaid = o.amountPaid + additionalPaid;
        const newStatus = newRemaining > 0 ? (o.roomSlot ? 'IN_ROOM' : 'WAITING') : 'COMPLETED';
        const newPaymentStatus = newAmountPaid >= newPriceTotal ? 'LUNAS' : (newAmountPaid > 0 ? 'DP' : 'BELUM_BAYAR');

        return {
          ...o,
          matchesOrdered: newTotalMatches,
          matchesRemaining: newRemaining,
          priceTotal: newPriceTotal,
          amountPaid: newAmountPaid,
          paymentMethod: paymentMethod || o.paymentMethod,
          paymentStatus: newPaymentStatus,
          status: newStatus
        };
      }
      return o;
    }));
    playSound('victory');
    showToast(`Top Up +${addMatches} Match berhasil!`);
  };

  // Delete an order
  const handleDeleteOrder = (orderId) => {
    if (!window.confirm('Yakin ingin menghapus data pemain ini?')) return;

    // If it was in room, clear that slot
    const updatedRoom = { ...roomParty };
    [1, 2, 3, 4].forEach(s => {
      if (updatedRoom[s] === orderId) {
        updatedRoom[s] = null;
      }
    });

    setRoomParty(updatedRoom);
    setOrders(orders.filter(o => o.id !== orderId));
    showToast('Data berhasil dihapus.');
  };

  // Reset all data
  const handleResetData = () => {
    if (window.confirm('Bersihkan seluruh data (order, antrean, dan riwayat match)?')) {
      setOrders([]);
      setRoomParty({ 1: null, 2: null, 3: null, 4: null });
      setMatchHistory([]);
      showToast('Seluruh data berhasil dibersihkan.');
    }
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

    let text = `👑 *MLBB VIP MABAR - UPDATE PARTY & ANTREAN* 👑\n`;
    text += `📅 ${dateStr} • ⏰ ${timeStr} WIB\n\n`;

    text += `🎮 *IN-GAME PARTY (ROOM 5v5):*\n`;
    text += `👑 *Host:* ${hostInfo.name} (${hostInfo.role})\n`;

    [1, 2, 3, 4].forEach(slot => {
      const orderId = roomParty[slot];
      const ord = orders.find(o => o.id === orderId);
      if (ord) {
        text += `🔹 Slot ${slot}: *${ord.username}* (${ord.role}) | Sisa: *${ord.matchesRemaining} Match* [${ord.paymentStatus}]\n`;
      } else {
        text += `🔹 Slot ${slot}: _[KOSONG - BISA MASUK]_\n`;
      }
    });

    text += `\n⏳ *ANTREAN MENUNGGU (NEXT IN LINE):*\n`;
    if (waitingOrders.length === 0) {
      text += `_(Antrean kosong, slot siap diisi langsung!)_\n`;
    } else {
      waitingOrders.forEach((wo, idx) => {
        text += `${idx + 1}. *${wo.username}* (${wo.role}) - ${wo.matchesRemaining} Match [${wo.paymentStatus}]\n`;
      });
    }

    text += `\n💰 *DAFTAR TARIF VIP MABAR:*\n`;
    text += `• 1 Match: Rp 7.000\n`;
    text += `• 3 Match: Rp 21.000\n`;
    text += `• 5 Match: Rp 30.000 ⭐ _(Hemat Rp 5.000, cuma 6k/match!)_\n`;
    text += `• 10 Match: Rp 60.000 👑 _(Hemat Rp 10.000!)_\n`;
    text += `*(Berlaku kelipatan 5 match = 30.000)*\n\n`;
    text += `📲 Mau booking slot atau antrean? Langsung chat Admin ya! Gas Winrate Immortal! 🔥`;

    navigator.clipboard.writeText(text).then(() => {
      playSound('click');
      showToast('Format Antrean WhatsApp berhasil disalin ke Clipboard!');
    }).catch(() => {
      showToast('Gagal menyalin, periksa izin browser.', 'error');
    });
  };

  // Export CSV
  const handleExportCSV = () => {
    let csv = 'ID,Username,ID_Server,WhatsApp,Role,Match_Dipesan,Sisa_Match,Total_Tagihan,Nominal_Ditransfer,Metode_Bayar,Status_Bayar,Catatan_Transfer,Tanggal\n';
    orders.forEach(o => {
      csv += `"${o.id}","${o.username}","${o.userId || ''}","${o.phone || ''}","${o.role}","${o.matchesOrdered}","${o.matchesRemaining}","${o.priceTotal}","${o.amountPaid}","${o.paymentMethod}","${o.paymentStatus}","${(o.transferNote || '').replace(/"/g, '""')}","${o.createdAt}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `rekap-keuangan-mlbb-vip-${new Date().toISOString().slice(0, 10)}.csv`);
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
      hostInfo,
      matchHistory,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `mlbb-vip-backup-${new Date().toISOString().slice(0, 10)}.json`);
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
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (data.orders) setOrders(data.orders);
        if (data.roomParty) setRoomParty(data.roomParty);
        if (data.hostInfo) setHostInfo(data.hostInfo);
        if (data.matchHistory) setMatchHistory(data.matchHistory);
        showToast('Data berhasil direstore dari backup!');
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
        <div className="fixed bottom-6 right-6 z-50 animate-bounce">
          <div
            className={`px-4 py-3 rounded-xl border shadow-2xl flex items-center gap-2.5 text-xs sm:text-sm font-bold ${
              toast.type === 'error'
                ? 'bg-rose-950 border-rose-500 text-rose-200'
                : 'bg-slate-900 border-amber-500 text-amber-300 shadow-glow-gold'
            }`}
          >
            {toast.type === 'error' ? <AlertCircle className="w-4 h-4 text-rose-400" /> : <Check className="w-4 h-4 text-emerald-400" />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        orders={orders}
        roomParty={roomParty}
        matchHistory={matchHistory}
        onOpenNewOrder={() => setIsOrderModalOpen(true)}
        onResetData={handleResetData}
        onShareWhatsApp={handleShareWhatsApp}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'room' && (
          <div className="space-y-6">
            {/* Live Room 5v5 */}
            <RoomParty
              roomParty={roomParty}
              orders={orders}
              hostInfo={hostInfo}
              onUpdateHost={setHostInfo}
              onFillSlot={handleFillSlot}
              onRemoveFromSlot={handleRemoveFromSlot}
              onFinishMatch={handleFinishMatch}
              onTopUpOrder={(order) => setTopUpOrder(order)}
              onAutoRotate={handleAutoRotate}
              waitingOrders={waitingOrders}
              onOpenNewOrder={() => setIsOrderModalOpen(true)}
            />

            {/* Waiting Queue List */}
            <WaitingQueue
              waitingOrders={waitingOrders}
              completedOrders={completedOrders}
              roomParty={roomParty}
              onFillNextSlot={handleFillNextSlot}
              onMoveOrder={handleMoveOrder}
              onDeleteOrder={handleDeleteOrder}
              onTopUpOrder={(order) => setTopUpOrder(order)}
              onMarkPaid={handleMarkPaid}
              onOpenNewOrder={() => setIsOrderModalOpen(true)}
            />
          </div>
        )}

        {activeTab === 'finance' && (
          <FinancialView
            orders={orders}
            onMarkPaid={handleMarkPaid}
            onTopUpOrder={(order) => setTopUpOrder(order)}
            onDeleteOrder={handleDeleteOrder}
            onExportCSV={handleExportCSV}
            onExportJSON={handleExportJSON}
            onImportJSON={handleImportJSON}
            onOpenNewOrder={() => setIsOrderModalOpen(true)}
          />
        )}

        {activeTab === 'history' && (
          <MatchHistoryView
            matchHistory={matchHistory}
            onClearHistory={() => {
              if (window.confirm('Bersihkan semua catatan riwayat match?')) {
                setMatchHistory([]);
                showToast('Riwayat match dibersihkan.');
              }
            }}
          />
        )}
      </main>

      {/* Modals */}
      <OrderModal
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        onSave={handleSaveOrder}
        hasEmptySlot={hasEmptySlot}
      />

      <TopUpModal
        isOpen={!!topUpOrder}
        order={topUpOrder}
        onClose={() => setTopUpOrder(null)}
        onConfirm={handleTopUpConfirm}
      />

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-4 text-center text-xs text-slate-500">
        <p>MLBB VIP Mabar Pro • Khusus Manajemen Party & Keuangan Mobile Legends • Siap Pakai & Super Ringan</p>
      </footer>
    </div>
  );
}
