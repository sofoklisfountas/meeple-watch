import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCollectionXml } from '../src/bgg.js';

test('parses BGG wishlist XML, skips "don\'t buy"', () => {
  const xml = `<?xml version="1.0"?><items totalitems="2">
    <item objecttype="thing" objectid="224517" subtype="boardgame"><name sortindex="1">Brass: Birmingham</name>
      <yearpublished>2018</yearpublished><thumbnail>https://cf.geekdo-images.com/x.jpg</thumbnail>
      <status own="0" wishlist="1" wishlistpriority="1"/></item>
    <item objecttype="thing" objectid="1" subtype="boardgame"><name sortindex="1">Bad &amp; Game</name>
      <status wishlist="1" wishlistpriority="5"/></item>
    <item objecttype="thing" objectid="1830" subtype="boardgame"><name sortindex="1">1830</name>
      <status wishlist="1" wishlistpriority="3"/></item></items>`;
  assert.deepEqual(parseCollectionXml(xml), [
    { bggId: '224517', name: 'Brass: Birmingham', year: '2018', thumbnail: 'https://cf.geekdo-images.com/x.jpg', priority: 1 },
    { bggId: '1830', name: '1830', year: null, thumbnail: null, priority: 3 },
  ]);
});

test('throws on BGG error', () => {
  assert.throws(() => parseCollectionXml('<errors><error><message>Invalid username specified</message></error></errors>'), /Invalid username/);
});
