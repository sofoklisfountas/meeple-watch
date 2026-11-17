import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickPrice, saving } from '../../shared/prices.js';

const offer = (product, country, stock = 'Y') => ({ product, country, stock, price: product + 10, shipping: '10.00' });
const answer = (prices, id = '42') => ({ items: [{ external_id: id, url: 'https://boardgameprices.co.uk/item/show/1/x?utm_source=a', prices }] });

test('pickPrice: Greek shop in stock wins, product price only', () => {
  const r = pickPrice('42', answer([offer(20, 'RO'), offer(40, 'GR', 'N'), offer(35, 'GR'), offer(36, 'GR')]));
  assert.deepEqual(r, { bgg_id: '42', price: 35, country: 'GR', in_stock: true, url: 'https://boardgameprices.co.uk/item/show/1/x', shops: 4, gr_shops: 3 });
});

test('pickPrice: Greek out of stock beats foreign', () => {
  assert.equal(pickPrice('42', answer([offer(20, 'RO'), offer(50, 'GR', 'N')])).price, 50);
});

test('pickPrice: no Greek shop → cheapest in stock elsewhere, then any', () => {
  assert.equal(pickPrice('42', answer([offer(20, 'RO', 'N'), offer(30, 'DE')])).country, 'DE');
  const r = pickPrice('42', answer([offer(25, 'CA', 'N')]));
  assert.equal(r.price, 25);
  assert.equal(r.in_stock, false);
});

test('pickPrice: nothing found / other game ignored', () => {
  assert.equal(pickPrice('42', { items: [] }).price, null);
  assert.equal(pickPrice('42', answer([offer(20, 'GR')], '99')).price, null);
  assert.equal(pickPrice('42', null).shops, 0);
});

test('saving', () => {
  assert.equal(saving(30, 40), 0.25);
  assert.equal(saving(30, null), null);
  assert.equal(saving(0, 40), null);
});
