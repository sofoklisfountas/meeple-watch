import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, buildIndex, findMatches, snippet, textKey } from '../../shared/match.js';
import { parseGroupInput, resolvePost } from '../../shared/facebook.js';
import { parseImportFile } from '../../shared/importList.js';

const games = [
  { id: '1', name: 'Brass: Birmingham' },
  { id: '2', name: 'Twilight Imperium: Fourth Edition' },
  { id: '3', name: 'Root' },
  { id: '4', name: "Tzolk'in: The Mayan Calendar" },
  { id: '5', name: 'Wingspan', aliases: ['Φτερούγες'] },
  { id: '6', name: 'Ark Nova', enabled: false },
];
const index = buildIndex(games);
const names = (t) => findMatches(t, index).map((h) => h.game.name);

test('normalize strips accents, case, punctuation', () => {
  assert.equal(normalize('Brass: Birmingham!'), 'brass birmingham');
  assert.equal(normalize('Φτερούγες'), 'φτερουγες');
});

test('matches names with different punctuation', () => {
  assert.deepEqual(names('Πωλείται brass birmingham 60€'), ['Brass: Birmingham']);
  assert.deepEqual(names('Selling TWILIGHT IMPERIUM 4th ed'), ['Twilight Imperium: Fourth Edition']);
  assert.deepEqual(names('tzolkin the mayan calendar like new'), ["Tzolk'in: The Mayan Calendar"]);
});

test('matches aliases incl. Greek', () => {
  assert.deepEqual(names('Πουλάω τις φτερούγες σφραγισμένο'), ['Wingspan']);
});

test('whole words only, disabled games ignored', () => {
  assert.deepEqual(names('Brassica cards'), []);
  assert.deepEqual(names('Ark Nova for sale'), []);
  assert.deepEqual(names('Root + Riverfolk expansion'), ['Root']);
});

test('snippet and textKey', () => {
  const t = 'Nikos\n2h\nSelling Brass Birmingham, like new\n50 euro\nLike Comment';
  assert.match(snippet(t, 'brass birmingham'), /Brass Birmingham/);
  assert.equal(textKey(t), textKey(t.replace('2h', '3h')));
});

test('parseGroupInput', () => {
  assert.deepEqual(parseGroupInput('https://www.facebook.com/groups/123456/?ref=share'), {
    fbId: '123456', url: 'https://www.facebook.com/groups/123456/',
  });
  assert.equal(parseGroupInput('m.facebook.com/groups/bgsale').fbId, 'bgsale');
  assert.equal(parseGroupInput('https://google.com'), null);
});

test('resolvePost finds post links', () => {
  assert.equal(resolvePost(['https://www.facebook.com/groups/9/posts/777/?__cft__=x'], '9').url,
    'https://www.facebook.com/groups/9/posts/777/');
  assert.equal(resolvePost(['https://www.facebook.com/photo/?fbid=1&set=pcb.555'], '9').key, 'post:555');
  assert.equal(resolvePost(['https://www.facebook.com/commerce/listing/42/?ref=x'], '9').key, 'listing:42');
  assert.equal(resolvePost(['https://www.facebook.com/groups/9/user/1/'], '9'), null);
});

test('parseImportFile: BGG CSV and plain list', () => {
  const csv = 'objectname,objectid,wishlist,wishlistpriority,yearpublished\n"Brass: Birmingham",224517,1,1,2018\nCatan,13,0,0,1995\n"Bad, Game",1,1,5,2000\n';
  assert.deepEqual(parseImportFile(csv), [{ name: 'Brass: Birmingham', bggId: '224517', year: '2018', priority: 1 }]);
  assert.deepEqual(parseImportFile('Root\n\nWingspan\r\n'), [{ name: 'Root' }, { name: 'Wingspan' }]);
  const full = 'objectname,objectid,wishlist,average,avgweight,rank,minplayers,maxplayers,bggbestplayers,bggrecplayers,minplaytime,maxplaytime,numowned\n' +
    'Abyss,155987,1,7.31702,2.3207,454,2,4,4,"2,3,4",30,60,22280\n';
  assert.deepEqual(parseImportFile(full)[0].stats, {
    rating: 7.32, weight: 2.32, bgg_rank: 454, min_players: 2, max_players: 4,
    best_players: [4], rec_players: [2, 3, 4], min_time: 30, max_time: 60, owned: 22280,
  });
});
