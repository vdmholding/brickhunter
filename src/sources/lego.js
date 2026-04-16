import { fetchRendered } from '../utils/browser.js';
import logger from '../utils/logger.js';

/**
 * Search LEGO.com for a set's retail availability and price.
 * Uses Puppeteer to render the page and extract pricing from the DOM.
 *
 * @param {string} setNumber - e.g. "75192"
 * @returns {Promise<Array<{source, condition, price, currency, shipping, seller, url}>>}
 */
export async function search(setNumber) {
  const url = `https://www.lego.com/en-us/product/${setNumber}`;

  try {
    const { page, html } = await fetchRendered(url, { waitFor: '[data-test="product-price"]' });

    try {
      // Try structured data first (JSON-LD Product)
      const ldBlocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
      for (const match of ldBlocks) {
        try {
          const ld = JSON.parse(match[1]);
          if (ld['@type'] === 'Product' && ld.offers) {
            const offers = Array.isArray(ld.offers) ? ld.offers : [ld.offers];
            const results = offers
              .filter((o) => o.price)
              .map((offer) => ({
                source: 'lego',
                condition: 'new',
                price: parseFloat(offer.price),
                currency: offer.priceCurrency || 'USD',
                shipping: 0,
                seller: 'LEGO',
                url,
                availability: offer.availability?.includes('InStock') ? 'in_stock' : 'out_of_stock',
              }));
            if (results.length) return results;
          }
        } catch { /* try next block */ }
      }

      // Fallback: extract price from rendered DOM
      const priceData = await page.evaluate(() => {
        // Common LEGO.com price selectors
        const priceEl =
          document.querySelector('[data-test="product-price"]') ||
          document.querySelector('[class*="ProductPrice"]') ||
          document.querySelector('[class*="product-price"]');

        if (!priceEl) return null;

        const text = priceEl.textContent.trim();
        const match = text.match(/[\$€£]([\d,.]+)/);
        if (!match) return null;

        const currency = text.startsWith('€') ? 'EUR' : text.startsWith('£') ? 'GBP' : 'USD';
        return { price: match[1].replace(',', ''), currency };
      });

      if (priceData) {
        // Check availability
        const availability = await page.evaluate(() => {
          const btn = document.querySelector('[data-test="add-to-bag"]');
          const soldOut = document.querySelector('[data-test="product-overview-sold-out"]');
          if (soldOut) return 'out_of_stock';
          if (btn) return 'in_stock';
          return 'unknown';
        });

        return [{
          source: 'lego',
          condition: 'new',
          price: parseFloat(priceData.price),
          currency: priceData.currency,
          shipping: 0,
          seller: 'LEGO',
          url,
          availability,
        }];
      }

      logger.debug({ setNumber }, 'No price found on LEGO.com');
      return [];
    } finally {
      await page.close();
    }
  } catch (err) {
    if (err.message?.includes('net::ERR') || err.message?.includes('Navigation timeout')) {
      logger.debug({ setNumber }, 'LEGO.com page not reachable');
    } else {
      logger.error({ err, setNumber }, 'LEGO.com search error');
    }
    return [];
  }
}

export default { search };
