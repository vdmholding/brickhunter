import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import db from '../../../src/db/index.js';
import { upsertSet, findBySetNumber, searchByName } from '../../../src/db/queries/sets.js';

describe('sets queries', () => {
  before(async () => {
    // Clean up test data
    await db.query("DELETE FROM listings WHERE set_id IN (SELECT id FROM sets WHERE set_number LIKE 'TEST-%')");
    await db.query("DELETE FROM sets WHERE set_number LIKE 'TEST-%'");
  });

  after(async () => {
    await db.query("DELETE FROM listings WHERE set_id IN (SELECT id FROM sets WHERE set_number LIKE 'TEST-%')");
    await db.query("DELETE FROM sets WHERE set_number LIKE 'TEST-%'");
    await db.close();
  });

  it('should upsert a new set', async () => {
    const set = await upsertSet({
      setNumber: 'TEST-001',
      name: 'Test Galaxy Explorer',
      theme: 'Icons',
      year: 2022,
      pieceCount: 1254,
      retailPrice: 99.99,
      imageUrl: null,
    });

    assert.equal(set.set_number, 'TEST-001');
    assert.equal(set.name, 'Test Galaxy Explorer');
    assert.equal(set.theme, 'Icons');
    assert.equal(set.year, 2022);
    assert.equal(set.piece_count, 1254);
  });

  it('should upsert an existing set without losing data', async () => {
    const updated = await upsertSet({
      setNumber: 'TEST-001',
      name: 'Test Galaxy Explorer Updated',
      // theme, year, etc. not provided — should keep existing
    });

    assert.equal(updated.name, 'Test Galaxy Explorer Updated');
    assert.equal(updated.theme, 'Icons');      // preserved
    assert.equal(updated.year, 2022);           // preserved
    assert.equal(updated.piece_count, 1254);    // preserved
  });

  it('should find a set by number', async () => {
    const set = await findBySetNumber('TEST-001');
    assert.ok(set);
    assert.equal(set.set_number, 'TEST-001');
  });

  it('should return null for unknown set number', async () => {
    const set = await findBySetNumber('NONEXISTENT-999');
    assert.equal(set, null);
  });

  it('should search by name', async () => {
    const results = await searchByName('Galaxy Explorer');
    assert.ok(results.length > 0);
    assert.ok(results.some((s) => s.set_number === 'TEST-001'));
  });

  it('should return empty for unmatched name search', async () => {
    const results = await searchByName('xyznonexistent123');
    assert.equal(results.length, 0);
  });
});
