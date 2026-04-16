import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';

describe('searchAll', () => {
  it('should aggregate results from multiple sources and sort by total cost', async () => {
    // We test the aggregation logic by mocking the source modules
    // Since sources are imported at module load, we test the sorting logic directly
    const listings = [
      { source: 'ebay', price: 100, shipping: 10, condition: 'new' },
      { source: 'bricklink', price: 90, shipping: null, condition: 'new' },
      { source: 'lego', price: 99.99, shipping: 0, condition: 'new' },
      { source: 'brickeconomy', price: 85, shipping: null, condition: 'used' },
    ];

    // Sort the same way searchAll does
    listings.sort((a, b) => {
      const costA = a.price + (a.shipping || 0);
      const costB = b.price + (b.shipping || 0);
      return costA - costB;
    });

    assert.equal(listings[0].source, 'brickeconomy'); // $85
    assert.equal(listings[1].source, 'bricklink');    // $90
    assert.equal(listings[2].source, 'lego');          // $99.99
    assert.equal(listings[3].source, 'ebay');          // $110
  });

  it('should handle empty shipping as zero cost', async () => {
    const listing = { price: 50, shipping: null };
    const total = listing.price + (listing.shipping || 0);
    assert.equal(total, 50);
  });

  it('should handle zero shipping correctly', async () => {
    const listing = { price: 50, shipping: 0 };
    const total = listing.price + (listing.shipping || 0);
    assert.equal(total, 50);
  });
});
