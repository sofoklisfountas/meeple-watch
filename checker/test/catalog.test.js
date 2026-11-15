import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRanksCsv, buildCatalog, findInLine, bodyLines } from '../../shared/catalog.js';

const csv = `id,name,yearpublished,rank,bayesaverage,average,usersrated,is_expansion
224517,"Brass: Birmingham",2018,1,8.4,8.6,50000,0
30549,Pandemic,2008,120,7.5,7.6,120000,0
1,Patchwork,2014,150,7.4,7.6,80000,0
2,Patchwork Express,2017,2500,6.5,6.9,5000,0
3,Sold,2000,0,0,5.5,40,0
4,"Wingspan: European Expansion",2019,0,0,8.1,9000,1
5,Wingspan,2019,30,8,8.1,100000,0
6,Root,2018,40,8,8.1,60000,0
7,Obscure Thing,2020,0,0,6,3,0
8,Flash Point,1990,10533,5,6.8,60,0
9,"Flash Point: Fire Rescue",2011,900,7,7.1,40000,0
10,Great Western Trail,2016,21,8,8.1,50000,0
11,"Great Western Trail: Argentina",2022,200,7.8,8.2,9000,0`;

const cat = buildCatalog(parseRanksCsv(csv));
const id = (line) => findInLine(line, cat)?.id ?? null;

test('finds games in sale lines', () => {
  assert.equal(id('1) Brass Birmingham Deluxe - 85€'), '224517');
  assert.equal(id('Pandemic 20€'), '30549');
  assert.equal(id('Patchwork Ελληνικό 10€ (ΠΟΥΛΗΘΗΚΕ)'), '1');
});

test('prefers the longest title', () => {
  assert.equal(id('Patchwork Express σαν καινούργιο'), '2');
  assert.equal(id('Wingspan European Expansion 25€'), '4');
  assert.equal(id('Wingspan 30€'), '5');
});

test('short form picks the well-known game', () => {
  assert.equal(id('16. Flash point - 30€'), '9');
  assert.equal(id('Great Western Trail μαζί με expansion 35€'), '10');
  assert.equal(id('Great Western Trail Argentina 25€'), '11');
});

test('ignores common words and obscure titles', () => {
  assert.equal(id('Πωλείται, SOLD'), null);
  assert.equal(id('Obscure Thing 5€'), null);
  assert.equal(id('Παράδοση Αθήνα ή αποστολή'), null);
});

test('bodyLines drops the seller line', () => {
  assert.deepEqual(bodyLines('Nikos\n\n Root 20€ \nWingspan'), ['Root 20€', 'Wingspan']);
});
