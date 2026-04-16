import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import db from '../../../src/db/index.js';
import { upsertSet } from '../../../src/db/queries/sets.js';
import { insertListing, insertMany, findBySetId, bestPrice } from '../../../src/db/queries/listings.js';

describe('listings queries', () => {
  let testSet;

  before(async () => {
    await db.query("DELETE FROM listings WHERE set_id IN (SELECT id FROM sets WHERE set_number LIKE 'TEST-L%')");
    await db.query("DELETE FROM sets WHERE set_number LIKE 'TEST-L%'");

    testSet = await upsertSet({
      setNumber: 'TEST-L001',
      name: 'Test Listing Set',
    });
  });

  after(async () => {
    await db.query("DELETE FROM listings WHERE set_id IN (SELECT id FROM sets WHERE set_number LIKE 'TEST-L%')");
    await db.query("DELETE FROM sets WHERE set_number LIKE 'TEST-L%'");
    await db.close();
  });

  it('should insert a single listing', async () => {
    const listing = await insertListing({
      setId: testSet.id,
      source: 'ebay',
      condition: 'new',
      price: 89.99,
      currency: 'USD',
      shipping: 5.99,
      seller: 'testuser',
      url: 'https://example.com/1',
    });

    assert.equal(listing.source, 'ebay');
    assert.equal(parseFloat(listing.price), 89.99);
    assert.equal(parseFloat(listing.shipping), 5.99);
  });

  it('should insert many listings in a transaction', async () => {
    const listings = await insertMany([
      { setId: testSet.id, source: 'bricklink', condition: 'new', price: 92.00, currency: 'USD', shipping: null, seller: 'seller1', url: null },
      { setId: testSet.id, source: 'bricklink', condition: 'used', price: 55.00, currency: 'USD', shipping: null, seller: 'seller2', url: null },
      { setId: testSet.id, source: 'lego', condition: 'new', price: 99.99, currency: 'USD', shipping: 0, seller: 'LEGO', url: null },
    ]);

    assert.equal(listings.length, 3);
  });

  it('should find listings by set id sorted by price', async () => {
    const listings = await findBySetId(testSet.id);
    assert.ok(listings.length >= 4);

    // Verify sorted ascending by price
    for (let i = 1; i < listings.length; i++) {
      assert.ok(parseFloat(listings[i].price) >= parseFloat(listings[i - 1].price));
    }
  });

  it('should filter listings by source', async () => {
    const listings = await findBySetId(testSet.id, { source: 'bricklink' });
    assert.ok(listings.length >= 2);
    assert.ok(listings.every((l) => l.source === 'bricklink'));
  });

  it('should find the best price including shipping', async () => {
    const best = await bestPrice(testSet.id);
    assert.ok(best);
    // $55 used bricklink (no shipping) should be cheapest
    assert.equal(parseFloat(best.price), 55);
  });
});
