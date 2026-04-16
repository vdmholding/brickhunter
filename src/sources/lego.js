import logger from '../utils/logger.js';

const LEGO_API_BASE = 'https://www.lego.com/api/graphql/ContentPageQuery';

/**
 * Search LEGO.com for a set's retail availability and price.
 * Uses the public product page to extract pricing info.
 * @param {string} setNumber - e.g. "75192"
 * @returns {Promise<Array<{source, condition, price, currency, shipping, seller, url}>>}
 */
export async function search(setNumber) {
  try {
    // Use LEGO's product page and parse the JSON-LD structured data
    const url = `https://www.lego.com/en-us/product/${setNumber}`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'BrickHunter/0.1',
        Accept: 'text/html',
      },
    });

    if (!res.ok) {
      if (res.status === 404) {
        logger.debug({ setNumber }, 'Set not found on LEGO.com');
        return [];
      }
      logger.error({ status: res.status, setNumber }, 'LEGO.com request failed');
      return [];
    }

    const html = await res.text();

    // Extract JSON-LD product data
    const ldMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    if (!ldMatch) return [];

    const ld = JSON.parse(ldMatch[1]);
    const offers = Array.isArray(ld.offers) ? ld.offers : ld.offers ? [ld.offers] : [];

    return offers
      .filter((o) => o.price)
      .map((offer) => ({
        source: 'lego',
        condition: 'new',
        price: parseFloat(offer.price),
        currency: offer.priceCurrency || 'USD',
        shipping: 0,  // LEGO.com often has free shipping over threshold
        seller: 'LEGO',
        url,
        availability: offer.availability?.includes('InStock') ? 'in_stock' : 'out_of_stock',
      }));
  } catch (err) {
    logger.error({ err, setNumber }, 'LEGO.com search error');
    return [];
  }
}

export default { search };
