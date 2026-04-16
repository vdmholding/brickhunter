import * as ebay from './ebay.js';
import * as bricklink from './bricklink.js';
import * as lego from './lego.js';
import * as brickeconomy from './brickeconomy.js';
import logger from '../utils/logger.js';

const sources = { ebay, bricklink, lego, brickeconomy };

/**
 * Search all configured sources for a Lego set.
 * Runs all sources concurrently and aggregates results.
 *
 * @param {string} setNumber
 * @param {object} [opts]
 * @param {string} [opts.condition] - 'new' | 'used'
 * @param {string[]} [opts.only] - limit to specific sources
 * @returns {Promise<Array>} combined listings sorted by total price ascending
 */
export async function searchAll(setNumber, opts = {}) {
  const activeSourceNames = opts.only
    ? opts.only.filter((s) => sources[s])
    : Object.keys(sources);

  logger.info({ setNumber, sources: activeSourceNames }, 'Searching sources');

  const results = await Promise.allSettled(
    activeSourceNames.map((name) =>
      sources[name].search(setNumber, opts).then((listings) => {
        logger.info({ source: name, count: listings.length }, 'Source returned results');
        return listings;
      })
    )
  );

  const listings = results.flatMap((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    logger.error({ source: activeSourceNames[i], reason: r.reason }, 'Source search failed');
    return [];
  });

  // Sort by total cost (price + shipping)
  listings.sort((a, b) => {
    const costA = a.price + (a.shipping || 0);
    const costB = b.price + (b.shipping || 0);
    return costA - costB;
  });

  return listings;
}

export { sources };
