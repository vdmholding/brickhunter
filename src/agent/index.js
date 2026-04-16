import { searchAll } from '../sources/index.js';
import { extractSetNumber, chat } from './llm.js';
import * as setsDb from '../db/queries/sets.js';
import * as listingsDb from '../db/queries/listings.js';
import * as searchesDb from '../db/queries/searches.js';
import logger from '../utils/logger.js';

/**
 * Run a full search for a Lego set across all sources.
 *
 * @param {string} query - natural language or set number, e.g. "75192" or "UCS Millennium Falcon"
 * @param {object} [opts]
 * @param {string} [opts.condition] - 'new' | 'used'
 * @param {string[]} [opts.only] - limit to specific sources
 * @returns {Promise<{set: object|null, listings: Array, bestDeal: object|null, summary: string|null}>}
 */
export async function hunt(query, opts = {}) {
  logger.info({ query, opts }, 'Starting hunt');

  // 1. Resolve set number — try direct number first, fall back to LLM
  let setNumber = query.match(/^\d{4,6}(-\d)?$/) ? query : null;

  if (!setNumber) {
    setNumber = await extractSetNumber(query);
    logger.info({ query, resolved: setNumber }, 'LLM resolved set number');
  }

  if (!setNumber) {
    return { set: null, listings: [], bestDeal: null, summary: `Could not identify a Lego set from: "${query}"` };
  }

  // 2. Search all sources concurrently
  const listings = await searchAll(setNumber, opts);

  // 3. Upsert set if we got results
  let set = await setsDb.findBySetNumber(setNumber);
  if (!set && listings.length > 0) {
    set = await setsDb.upsertSet({ setNumber, name: query });
  }

  // 4. Store listings in DB
  if (set && listings.length > 0) {
    const dbListings = listings.map((l) => ({ ...l, setId: set.id }));
    await listingsDb.insertMany(dbListings);
  }

  // 5. Find best deal
  const bestDeal = listings[0] || null;  // already sorted by price ASC

  // 6. Record search
  await searchesDb.recordSearch({
    query,
    setNumber,
    resultsCount: listings.length,
    bestPrice: bestDeal?.price || null,
    bestSource: bestDeal?.source || null,
  }).catch((err) => logger.error({ err }, 'Failed to record search'));

  // 7. Generate summary via LLM (optional, gracefully degrades)
  let summary = null;
  if (listings.length > 0) {
    const top5 = listings.slice(0, 5);
    summary = await chat(
      'You are a helpful Lego deal analyst. Summarize the best deals found for a Lego set in 2-3 sentences. Be specific about prices and sources.',
      `Set ${setNumber} (query: "${query}"). Top listings:\n${JSON.stringify(top5, null, 2)}`
    );
  }

  return { set, listings, bestDeal, summary };
}

export default { hunt };
