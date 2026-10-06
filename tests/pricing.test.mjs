import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePricing, RATE_GLORY, isGloryOrder } from '../src/utils/pricing.js';

test('tarif Standar tidak berubah (7k satuan, 5 match = 30k, kelipatan)', () => {
  assert.equal(calculatePricing(1).total, 7000);
  assert.equal(calculatePricing(3).total, 21000);
  assert.equal(calculatePricing(5).total, 30000);
  assert.equal(calculatePricing(10).total, 60000);
  assert.equal(calculatePricing(7).total, 30000 + 14000);
  assert.equal(calculatePricing(5, null, false, 'STANDARD').total, 30000);
});

test('Glory: Rp 10.000 per match, flat tanpa paket', () => {
  assert.equal(RATE_GLORY, 10000);
  for (const n of [1, 3, 5, 10, 13]) {
    const p = calculatePricing(n, null, false, 'GLORY');
    assert.equal(p.total, n * 10000, `${n} match`);
    assert.equal(p.bundleCount, 0);
    assert.equal(p.remainder, 0);
    assert.equal(p.savings, 0);
    assert.equal(p.isGlory, true);
  }
  assert.equal(calculatePricing(1, null, false, 'GLORY').effectivePerMatch, 10000);
});

test('Gratis dan Custom tetap menang atas Glory', () => {
  assert.equal(calculatePricing(5, null, true, 'GLORY').total, 0);
  assert.equal(calculatePricing(5, '12345', false, 'GLORY').total, 12345);
  assert.equal(calculatePricing(5, '', false, 'GLORY').total, 50000);
});

test('input aneh tidak merusak hitungan', () => {
  assert.equal(calculatePricing(0, null, false, 'GLORY').total, 0);
  assert.equal(calculatePricing('abc', null, false, 'GLORY').total, 0);
  assert.equal(calculatePricing(-3, null, false, 'GLORY').total, 0);
  assert.equal(calculatePricing('2', null, false, 'GLORY').total, 20000);
});

test('isGloryOrder', () => {
  assert.equal(isGloryOrder({ priceType: 'GLORY' }), true);
  assert.equal(isGloryOrder({ priceType: 'STANDARD' }), false);
  assert.equal(isGloryOrder({}), false);
  assert.equal(isGloryOrder(null), false);
});
