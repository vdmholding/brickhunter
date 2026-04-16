import puppeteer from 'puppeteer';
import logger from './logger.js';

let browser = null;

/**
 * Get a shared Puppeteer browser instance.
 * Reuses a single browser across all scraper calls to avoid startup overhead.
 */
export async function getBrowser() {
  if (browser && browser.connected) return browser;

  logger.debug('Launching headless browser');
  browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  browser.on('disconnected', () => {
    browser = null;
  });

  return browser;
}

/**
 * Navigate to a URL and return the page content after JS rendering.
 * @param {string} url
 * @param {object} [opts]
 * @param {number} [opts.timeout] - navigation timeout in ms (default 15000)
 * @param {string} [opts.waitFor] - CSS selector to wait for before extracting content
 * @returns {Promise<{page: import('puppeteer').Page, html: string}>}
 */
export async function fetchRendered(url, opts = {}) {
  const b = await getBrowser();
  const page = await b.newPage();

  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  try {
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: opts.timeout || 15000,
    });

    if (opts.waitFor) {
      await page.waitForSelector(opts.waitFor, { timeout: 5000 }).catch(() => {});
    }

    const html = await page.content();
    return { page, html };
  } catch (err) {
    await page.close();
    throw err;
  }
}

/**
 * Close the shared browser (call on shutdown).
 */
export async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
