import logger from '../utils/logger.js';

/**
 * Scrape BrickEconomy for price/value data on a set.
 * BrickEconomy tracks retail, resale, and investment value of Lego sets.
 *
 * @param {string} setNumber - e.g. "75192"
 * @returns {Promise<Array<{source, condition, price, currency, shipping, seller, url, meta}>>}
 */
export async function search(setNumber) {
  try {
    const url = `https://www.brickeconomy.com/set/${setNumber}-1`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'BrickHunter/0.1',
        Accept: 'text/html',
      },
    });

    if (!res.ok) {
      if (res.status === 404) {
        logger.debug({ setNumber }, 'Set not found on BrickEconomy');
        return [];
      }
      logger.error({ status: res.status, setNumber }, 'BrickEconomy request failed');
      return [];
    }

    const html = await res.text();
    const results = [];

    // Extract new price
    const newPriceMatch = html.match(/New:.*?\$([\d,.]+)/);
    if (newPriceMatch) {
      results.push({
        source: 'brickeconomy',
        condition: 'new',
        price: parseFloat(newPriceMatch[1].replace(',', '')),
        currency: 'USD',
        shipping: null,
        seller: null,
        url,
      });
    }

    // Extract used price
    const usedPriceMatch = html.match(/Used:.*?\$([\d,.]+)/);
    if (usedPriceMatch) {
      results.push({
        source: 'brickeconomy',
        condition: 'used',
        price: parseFloat(usedPriceMatch[1].replace(',', '')),
        currency: 'USD',
        shipping: null,
        seller: null,
        url,
      });
    }

    // Extract retail price
    const retailMatch = html.match(/Retail Price:.*?\$([\d,.]+)/);
    if (retailMatch) {
      results.push({
        source: 'brickeconomy',
        condition: 'new',
        price: parseFloat(retailMatch[1].replace(',', '')),
        currency: 'USD',
        shipping: null,
        seller: 'Retail',
        url,
        meta: { type: 'retail_price' },
      });
    }

    return results;
  } catch (err) {
    logger.error({ err, setNumber }, 'BrickEconomy search error');
    return [];
  }
}

export default { search };
