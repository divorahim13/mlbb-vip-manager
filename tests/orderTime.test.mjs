import test from 'node:test';
import assert from 'node:assert/strict';
import { stampCompletion, getCompletionTime, formatDateTime } from '../src/utils/orderTime.js';

const NOW = '2026-10-06T10:00:00.000Z';

test('pindah ke COMPLETED -> dapat completedAt baru', () => {
  const r = stampCompletion({ status: 'IN_ROOM' }, { status: 'COMPLETED', matchesRemaining: 0 }, NOW);
  assert.equal(r.completedAt, NOW);
});

test('sudah COMPLETED dengan cap -> cap lama dipertahankan, tidak diganti', () => {
  const r = stampCompletion({ status: 'COMPLETED', completedAt: 'lama' }, { status: 'COMPLETED' }, NOW);
  assert.equal(r.completedAt, 'lama');
});

test('data lama COMPLETED tanpa cap -> tetap tanpa cap (tidak dipalsukan jadi "sekarang")', () => {
  const r = stampCompletion({ status: 'COMPLETED' }, { status: 'COMPLETED', username: 'x' }, NOW);
  assert.equal('completedAt' in r, false);
});

test('keluar dari COMPLETED (order lagi) -> cap dihapus, selesai berikutnya dapat cap baru', () => {
  const back = stampCompletion({ status: 'COMPLETED', completedAt: 'lama' }, { status: 'WAITING', completedAt: 'lama' }, NOW);
  assert.equal('completedAt' in back, false);
  const done = stampCompletion(back, { ...back, status: 'COMPLETED' }, '2026-10-07T01:00:00.000Z');
  assert.equal(done.completedAt, '2026-10-07T01:00:00.000Z');
});

test('stamp tidak mengubah objek asli (immutability)', () => {
  const next = { status: 'WAITING', completedAt: 'x' };
  stampCompletion({ status: 'COMPLETED' }, next, NOW);
  assert.equal(next.completedAt, 'x');
});

test('getCompletionTime: completedAt > match terakhir pemain > createdAt', () => {
  const history = [
    { timestamp: '2026-10-05T12:00:00.000Z', participants: ['@meil (VIP Mid Lane)', '@redha (VIP Exp Lane)'] },
    { timestamp: '2026-10-04T12:00:00.000Z', participants: ['@meil (VIP Mid Lane)'] }
  ];
  assert.equal(getCompletionTime({ username: 'meil', completedAt: 'C', createdAt: 'X' }, history), 'C');
  assert.equal(getCompletionTime({ username: 'meil', createdAt: 'X' }, history), '2026-10-05T12:00:00.000Z');
  assert.equal(getCompletionTime({ username: 'redha', createdAt: 'X' }, history), '2026-10-05T12:00:00.000Z');
  assert.equal(getCompletionTime({ username: 'ADI', createdAt: 'X' }, history), 'X');
  // "@mei" tidak boleh cocok dengan "@meil"
  assert.equal(getCompletionTime({ username: 'mei', createdAt: 'X' }, history), 'X');
});

test('formatDateTime', () => {
  assert.equal(formatDateTime(null), '');
  assert.equal(formatDateTime('bukan tanggal'), '');
  assert.match(formatDateTime('2026-10-06T10:00:00.000Z'), /2026/);
});
