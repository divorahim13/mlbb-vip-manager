import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import RoomParty, { ROLE_DETAILS, VIP_SLOT_DEFS } from './components/RoomParty';
import WaitingQueue from './components/WaitingQueue';
import OrderModal from './components/OrderModal';
import TopUpModal from './components/TopUpModal';
import FinancialView from './components/FinancialView';
import MatchHistoryView from './components/MatchHistoryView';
import { playSound } from './utils/sound';
import { formatRupiah } from './utils/pricing';
import {
  STORAGE_KEYS,
  INITIAL_PILOTS,
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
  const [pilotsInfo, setPilotsInfo] = useState(() => loadData(STORAGE_KEYS.PILOTS_INFO, INITIAL_PILOTS));
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
    saveData(STORAGE_KEYS.PILOTS_INFO, pilotsInfo);
  }, [pilotsInfo]);

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
  const hasEmptySlot = !roomParty.mid || !roomParty.roam || !roomParty.exp;

  // Determine slot key from role
  const getSlotKeyForRole = (role) => {
    if (role === 'Mid Lane') return 'mid';
    if (role === 'Roamer') return 'roam';
    if (role === 'Exp Lane') return 'exp';
    return null;
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
      let targetSlot = getSlotKeyForRole(newOrderData.role);
      if (!targetSlot || updatedRoom[targetSlot]) {
        // Fallback to any empty VIP slot
        targetSlot = ['mid', 'roam', 'exp'].find(k => !updatedRoom[k]);
      }

      if (targetSlot) {
        newOrder.status = 'IN_ROOM';
        newOrder.roomSlot = targetSlot;
        updatedRoom[targetSlot] = newId;
        const roleLabel = VIP_SLOT_DEFS.find(s => s.key === targetSlot)?.name || targetSlot;
        showToast(`Pesanan VIP @${newOrder.username} berhasil dibuat & langsung masuk Slot ${roleLabel}!`);
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

  // Put player into a specific slot ('mid' | 'roam' | 'exp')
  const handleFillSlot = (slotKey, orderId) => {
    const targetOrder = orders.find(o => o.id === orderId);
    if (!targetOrder) return;

    // If slot had an existing order, return it to waiting or completed
    const existingOrderId = roomParty[slotKey];
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
          roomSlot: slotKey
        };
      }
      return o;
    });

    setOrders(updatedOrders);
    setRoomParty(prev => ({ ...prev, [slotKey]: orderId }));
    playSound('click');
    const roleLabel = VIP_SLOT_DEFS.find(s => s.key === slotKey)?.name || slotKey;
    showToast(`@${targetOrder.username} sekarang aktif di Slot VIP ${roleLabel}!`);
  };

  // Put next waiting order into next available slot
  const handleFillNextSlot = (orderId) => {
    const targetOrder = orders.find(o => o.id === orderId);
    if (!targetOrder) return;

    let targetSlot = getSlotKeyForRole(targetOrder.role);
    if (!targetSlot || roomParty[targetSlot]) {
      targetSlot = ['mid', 'roam', 'exp'].find(k => !roomParty[k]);
    }

    if (targetSlot) {
      handleFillSlot(targetSlot, orderId);
    } else {
      // If all slots are full, swap into matching role slot or 'mid'
      const fallback = getSlotKeyForRole(targetOrder.role) || 'mid';
      handleFillSlot(fallback, orderId);
    }
  };

  // Remove player from slot
  const handleRemoveFromSlot = (slotKey) => {
    const orderId = roomParty[slotKey];
    if (!orderId) return;

    const order = orders.find(o => o.id === orderId);
    const newStatus = order && order.matchesRemaining > 0 ? 'WAITING' : 'COMPLETED';

    setOrders(orders.map(o => (o.id === orderId ? { ...o, status: newStatus, roomSlot: null } : o)));
    setRoomParty(prev => ({ ...prev, [slotKey]: null }));
    playSound('click');
    const roleLabel = VIP_SLOT_DEFS.find(s => s.key === slotKey)?.name || slotKey;
    showToast(order ? `@${order.username} dikeluarkan dari Slot ${roleLabel} ke ${newStatus === 'WAITING' ? 'Antrean' : 'Selesai'}.` : 'Slot dikosongkan.');
  };

  // Auto rotate: replace expired player with matching role waiting player or #1 in queue
  const handleAutoRotate = (slotKey) => {
    if (waitingOrders.length === 0) {
      showToast('Tidak ada antrean tunggu untuk rotasi.', 'error');
      return;
    }

    const slotDef = VIP_SLOT_DEFS.find(s => s.key === slotKey);
    const targetRole = slotDef?.role;

    // Find best match in queue
    const bestMatch = waitingOrders.find(o => o.role === targetRole || o.role === 'Any') || waitingOrders[0];
    handleFillSlot(slotKey, bestMatch.id);
  };

  // Finish 1 match (Win or Lose)
  const handleFinishMatch = (result) => {
    const activeSlotPlayerIds = [roomParty.mid, roomParty.roam, roomParty.exp].filter(Boolean);
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
      participants: [`Pilot Gold: ${pilotsInfo.gold.name}`, `Pilot Jungle: ${pilotsInfo.jungler.name}`, ...participants],
      mvp: result === 'WIN' ? `${pilotsInfo.gold.name} (Gold) / ${pilotsInfo.jungler.name} (Jungle)` : null,
      durationMinutes: 15
    };

    setOrders(updatedOrders);
    setMatchHistory([newMatch, ...matchHistory]);

    // Audio feedback
    if (result === 'WIN') {
      playSound('victory');
      showToast(`🏆 VICTORY! Kuota -1 untuk semua VIP di Room.`);
    } else {
      playSound('defeat');
      showToast(`💀 DEFEAT! Kuota -1 dicatat.`);
    }

    if (expiredList.length > 0) {
      setTimeout(() => {
        playSound('alert');
        showToast(`🚨 Perhatian: Kuota mabar VIP ${expiredList.join(', ')} telah HABIS!`);
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

    const updatedRoom = { ...roomParty };
    ['mid', 'roam', 'exp'].forEach(k => {
      if (updatedRoom[k] === orderId) {
        updatedRoom[k] = null;
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
      setRoomParty({ mid: null, roam: null, exp: null });
      setPilotsInfo(INITIAL_PILOTS);
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

    const midOrder = orders.find(o => o.id === roomParty.mid);
    const roamOrder = orders.find(o => o.id === roomParty.roam);
    const expOrder = orders.find(o => o.id === roomParty.exp);

    let text = `👑 *MLBB VIP MABAR - UPDATE PARTY & ANTREAN* 👑\n`;
    text += `📅 ${dateStr} • ⏰ ${timeStr} WIB\n\n`;

    text += `🎮 *TIM PILOT CARRY (MAININ AKUN):*\n`;
    text += `🏹 *Gold Lane:* ${pilotsInfo.gold.name} (${pilotsInfo.gold.hero})\n`;
    text += `⚡ *Jungler:* ${pilotsInfo.jungler.name} (${pilotsInfo.jungler.hero})\n\n`;

    text += `🌟 *SLOT VIP CLIENT AKTIF (3 SLOT):*\n`;
    text += `🔮 *Mid Lane (Myth):* ${midOrder ? `*${midOrder.username}* | Sisa: *${midOrder.matchesRemaining} Match* [${midOrder.paymentStatus}]` : '_[KOSONG - BISA MASUK]_'}\n`;
    text += `❤️ *Roamer (Room):* ${roamOrder ? `*${roamOrder.username}* | Sisa: *${roamOrder.matchesRemaining} Match* [${roamOrder.paymentStatus}]` : '_[KOSONG - BISA MASUK]_'}\n`;
    text += `🛡️ *Exp Lane (Exp):* ${expOrder ? `*${expOrder.username}* | Sisa: *${expOrder.matchesRemaining} Match* [${expOrder.paymentStatus}]` : '_[KOSONG - BISA MASUK]_'}\n`;

    text += `\n⏳ *ANTREAN MENUNGGU (MID / ROAM / EXP):*\n`;
    if (waitingOrders.length === 0) {
      text += `_(Antrean kosong, slot VIP siap diisi!)_\n`;
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
    text += `📲 Mau booking slot VIP Myth, Room, atau Exp? Langsung chat Admin ya! Gas Winrate Immortal! 🔥`;

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
      pilotsInfo,
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
        if (data.pilotsInfo) setPilotsInfo(data.pilotsInfo);
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
            {/* Live Room: 2 Pilots (Gold & Jungle) + 3 VIPs (Mid, Roam, Exp) */}
            <RoomParty
              roomParty={roomParty}
              orders={orders}
              pilotsInfo={pilotsInfo}
              onUpdatePilots={setPilotsInfo}
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
        <p>MLBB VIP Mabar Pro • 2 Pilot (Gold & Jungle) + 3 VIP (Mid, Roam, Exp) • Siap Pakai & Super Ringan</p>
      </footer>
    </div>
  );
}
