import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseThingXml } from '../src/bgg.js';

test('parses BGG thing XML with player poll', () => {
  const xml = `<items><item type="boardgame" id="174430">
    <name type="primary" sortindex="1" value="Gloomhaven"/><name type="alternate" value="Gloom"/>
    <yearpublished value="2017"/><minplayers value="1"/><maxplayers value="4"/>
    <poll name="suggested_numplayers" title="x" totalvotes="100">
      <results numplayers="1"><result value="Best" numvotes="10"/><result value="Recommended" numvotes="50"/><result value="Not Recommended" numvotes="20"/></results>
      <results numplayers="2"><result value="Best" numvotes="60"/><result value="Recommended" numvotes="30"/><result value="Not Recommended" numvotes="5"/></results>
      <results numplayers="3"><result value="Best" numvotes="100"/><result value="Recommended" numvotes="20"/><result value="Not Recommended" numvotes="2"/></results>
      <results numplayers="4+"><result value="Best" numvotes="1"/><result value="Recommended" numvotes="1"/><result value="Not Recommended" numvotes="50"/></results>
    </poll>
    <playingtime value="120"/><minplaytime value="60"/><maxplaytime value="120"/>
    <statistics page="1"><ratings><usersrated value="60000"/><average value="8.53412"/>
      <ranks><rank type="subtype" id="1" name="boardgame" value="4"/><rank type="family" name="thematic" value="2"/></ranks>
      <owned value="105000"/><averageweight value="3.9171"/></ratings></statistics>
  </item></items>`;
  const [g] = parseThingXml(xml);
  assert.equal(g.bgg_id, '174430');
  assert.equal(g.name, 'Gloomhaven');
  assert.equal(g.bgg_rank, 4);
  assert.equal(g.rating, 8.53);
  assert.equal(g.weight, 3.92);
  assert.equal(g.votes, 60000);
  assert.deepEqual(g.best_players, [3]);
  assert.deepEqual(g.rec_players, [1, 2, 3]);
  assert.equal(g.min_time, 60);
  assert.equal(g.max_time, 120);
});
