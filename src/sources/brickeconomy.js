import { fetchRendered } from '../utils/browser.js';
import logger from '../utils/logger.js';

/**
 * Scrape BrickEconomy for price/value data on a set.
 * Uses Puppeteer to render the page (BrickEconomy blocks non-browser requests).
 *
 * @param {string} setNumber - e.g. "75192"
 * @returns {Promise<Array<{source, condition, price, currency, shipping, seller, url}>>}
 */
export async function search(setNumber) {
  const url = `https://www.brickeconomy.com/set/${setNumber}-1`;

  try {
    const { page, html } = await fetchRendered(url);

    try {
      // Check if we hit an error page
      if (html.includes('Yikes...') || html.includes('icon-exclamation')) {
        logger.debug({ setNumber }, 'Set not found on BrickEconomy');
        return [];
      }

      const results = await page.evaluate(() => {
        const listings = [];
        const text = document.body.innerText;

        // Extract prices from the rendered page
        // BrickEconomy shows: New, Used, Retail prices in various sections
        const patterns = [
          { regex: /New\s*:?\s*\$([\d,.]+)/i, condition: 'new' },
          { regex: /Used\s*:?\s*\$([\d,.]+)/i, condition: 'used' },
          { regex: /Sealed\s*:?\s*\$([\d,.]+)/i, condition: 'sealed' },
        ];

        for (const { regex, condition } of patterns) {
          const match = text.match(regex);
          if (match) {
            listings.push({
              condition,
              price: parseFloat(match[1].replace(',', '')),
            });
          }
        }

        // Also try extracting from structured elements
        const valueCells = document.querySelectorAll('.val-lg, .val-md, .val-sm, [class*="value"]');
        for (const cell of valueCells) {
          const priceMatch = cell.textContent.match(/\$([\d,.]+)/);
          const label = cell.previousElementSibling?.textContent || cell.parentElement?.textContent || '';

          if (priceMatch && !listings.some((l) => l.price === parseFloat(priceMatch[1].replace(',', '')))) {
            let condition = 'new';
            if (/used/i.test(label)) condition = 'used';
            if (/retail|msrp/i.test(label)) condition = 'new';

            listings.push({
              condition,
              price: parseFloat(priceMatch[1].replace(',', '')),
              meta: label.trim().substring(0, 50),
            });
          }
        }

        return listings;
      });

      return results.map((r) => ({
        source: 'brickeconomy',
        condition: r.condition,
        price: r.price,
        currency: 'USD',
        shipping: null,
        seller: null,
        url,
        ...(r.meta && { meta: r.meta }),
      }));
    } finally {
      await page.close();
    }
  } catch (err) {
    if (err.message?.includes('net::ERR') || err.message?.includes('Navigation timeout')) {
      logger.debug({ setNumber }, 'BrickEconomy page not reachable');
    } else {
      logger.error({ err, setNumber }, 'BrickEconomy search error');
    }
    return [];
  }
}

export default { search };
