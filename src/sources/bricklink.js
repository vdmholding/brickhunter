import { createHmac } from 'node:crypto';
import config from '../config.js';
import logger from '../utils/logger.js';

const BL_API_BASE = 'https://api.bricklink.com/api/store/v1';

/**
 * Build OAuth 1.0a Authorization header for BrickLink.
 */
function oauthHeader(method, url) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = Math.random().toString(36).slice(2);

  const params = {
    oauth_consumer_key: config.bricklink.consumerKey,
    oauth_token: config.bricklink.token,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_nonce: nonce,
    oauth_version: '1.0',
  };

  const baseString = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(
      Object.keys(params)
        .sort()
        .map((k) => `${k}=${params[k]}`)
        .join('&')
    ),
  ].join('&');

  const signingKey = `${encodeURIComponent(config.bricklink.consumerSecret)}&${encodeURIComponent(config.bricklink.tokenSecret)}`;
  const signature = createHmac('sha1', signingKey).update(baseString).digest('base64');

  params.oauth_signature = signature;

  const header = Object.entries(params)
    .map(([k, v]) => `${k}="${encodeURIComponent(v)}"`)
    .join(', ');

  return `OAuth ${header}`;
}

/**
 * Search BrickLink for price guide data on a set.
 * @param {string} setNumber - e.g. "75192-1"
 * @param {object} [opts]
 * @param {string} [opts.condition] - 'new' | 'used'
 * @returns {Promise<Array<{source, condition, price, currency, shipping, seller, url}>>}
 */
export async function search(setNumber, opts = {}) {
  if (!config.bricklink.consumerKey) {
    logger.warn('BrickLink API credentials not configured, skipping');
    return [];
  }

  // Ensure set number has the "-1" suffix BrickLink expects
  const blNumber = setNumber.includes('-') ? setNumber : `${setNumber}-1`;
  const newUsed = opts.condition === 'used' ? 'U' : 'N';

  const url = `${BL_API_BASE}/items/SET/${blNumber}/price`;
  const fullUrl = `${url}?new_or_used=${newUsed}&guide_type=sold&country_code=US&currency_code=USD`;

  const res = await fetch(fullUrl, {
    headers: { Authorization: oauthHeader('GET', url) },
  });

  if (!res.ok) {
    logger.error({ status: res.status, setNumber }, 'BrickLink price guide request failed');
    return [];
  }

  const body = await res.json();
  const guide = body.data;

  if (!guide || !guide.price_detail?.length) return [];

  return guide.price_detail.map((entry) => ({
    source: 'bricklink',
    condition: newUsed === 'N' ? 'new' : 'used',
    price: parseFloat(entry.unit_price || 0),
    currency: guide.currency_code || 'USD',
    shipping: null,  // BrickLink price guide doesn't include shipping
    seller: entry.seller_name || null,
    url: `https://www.bricklink.com/v2/catalog/catalogitem.page?S=${blNumber}`,
  }));
}

export default { search };
