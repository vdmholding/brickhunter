import config from '../config.js';
import logger from '../utils/logger.js';

const EBAY_API_BASE = 'https://api.ebay.com';

let accessToken = null;
let tokenExpiresAt = 0;

async function authenticate() {
  if (accessToken && Date.now() < tokenExpiresAt) return accessToken;

  const credentials = Buffer.from(`${config.ebay.appId}:${config.ebay.certId}`).toString('base64');
  const res = await fetch(`${EBAY_API_BASE}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`eBay auth failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  accessToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
  return accessToken;
}

/**
 * Search eBay for a Lego set.
 * @param {string} setNumber - e.g. "75192"
 * @param {object} [opts]
 * @param {string} [opts.condition] - 'new' | 'used'
 * @returns {Promise<Array<{source, condition, price, currency, shipping, seller, url}>>}
 */
export async function search(setNumber, opts = {}) {
  if (!config.ebay.appId) {
    logger.warn('eBay API credentials not configured, skipping');
    return [];
  }

  const token = await authenticate();

  const params = new URLSearchParams({
    q: `LEGO ${setNumber}`,
    category_ids: '19006',         // LEGO category on eBay
    limit: '25',
    sort: 'price',
  });

  if (opts.condition === 'new') {
    params.set('filter', 'conditionIds:{1000}');
  } else if (opts.condition === 'used') {
    params.set('filter', 'conditionIds:{3000}');
  }

  const res = await fetch(`${EBAY_API_BASE}/buy/browse/v1/item_summary/search?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    logger.error({ status: res.status }, 'eBay search failed');
    return [];
  }

  const data = await res.json();
  const items = data.itemSummaries || [];

  return items.map((item) => ({
    source: 'ebay',
    condition: item.condition === 'New' ? 'new' : 'used',
    price: parseFloat(item.price?.value || 0),
    currency: item.price?.currency || 'USD',
    shipping: parseFloat(item.shippingOptions?.[0]?.shippingCost?.value || 0),
    seller: item.seller?.username || null,
    url: item.itemWebUrl || null,
  }));
}

export default { search };
