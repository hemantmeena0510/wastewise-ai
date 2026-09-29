import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, validateCsv } from './csv.js';

const headers = 'date,attendance,menu,food_item,category,planned_quantity,actual_consumption,leftover,weather,holiday,event';

test('CSV parser supports quoted commas and escaped quotes', () => {
  assert.deepEqual(parseCsv('item,note\nRice,"served, chilled"\nSalad,"said ""fresh"""'), [
    ['item', 'note'],
    ['Rice', 'served, chilled'],
    ['Salad', 'said "fresh"'],
  ]);
});

test('CSV import validates columns and maps a coherent record', () => {
  const [record] = validateCsv(`\uFEFF${headers}\n2026-09-28,800,"Rajma, Rice",Rice,Grains,300,270,30,Sunny,false,`, 12);
  assert.equal(record.id.startsWith('upload-'), true);
  assert.equal(record.menu, 'Rajma, Rice');
  assert.equal(record.leftover, 30);
  assert.equal(record.category, 'Grains');
});

test('CSV import reports missing columns, malformed dates, and invalid quantities', () => {
  assert.throws(() => validateCsv('date,attendance\n2026-09-28,800'), /Missing required columns/);
  assert.throws(() => validateCsv(`${headers}\n2026-02-30,800,Menu,Rice,Grains,300,270,30,Sunny,false,`), /valid date/);
  assert.throws(() => validateCsv(`${headers}\n2026-09-28,nope,Menu,Rice,Grains,300,270,30,Sunny,false,`), /attendance must be a non-negative number/);
  assert.throws(() => validateCsv(`${headers}\n2026-09-28,800,Menu,Rice,Grains,300,270,20,Sunny,false,`), /leftover must equal/);
});
