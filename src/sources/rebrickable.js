import config from '../config.js';
import logger from '../utils/logger.js';

const API_BASE = 'https://rebrickable.com/api/v3';

function headers() {
  return { Authorization: `key ${config.rebrickable.apiKey}` };
}

/** Respect Rebrickable's 1 req/sec rate limit. */
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Fetch a single page of sets.
 * @param {object} params - query params (page, page_size, search, theme_id, min_year, max_year, ordering)
 * @returns {Promise<{count: number, results: Array}>}
 */
export async function listSets(params = {}) {
  if (!config.rebrickable.apiKey) {
    throw new Error('REBRICKABLE_API_KEY not configured');
  }

  const qs = new URLSearchParams({ page_size: '1000', ...params });
  const url = `${API_BASE}/lego/sets/?${qs}`;

  const res = await fetch(url, { headers: headers() });
  if (res.status === 429) {
    logger.warn('Rebrickable rate limited, waiting 2s');
    await sleep(2000);
    return listSets(params);
  }
  if (!res.ok) {
    throw new Error(`Rebrickable listSets failed: ${res.status}`);
  }

  return res.json();
}

/**
 * Fetch a single set by set number.
 * @param {string} setNum - e.g. "75192-1"
 * @returns {Promise<object|null>}
 */
export async function getSet(setNum) {
  if (!config.rebrickable.apiKey) return null;

  const num = setNum.includes('-') ? setNum : `${setNum}-1`;
  const res = await fetch(`${API_BASE}/lego/sets/${num}/`, { headers: headers() });

  if (res.status === 404) return null;
  if (res.status === 429) {
    await sleep(2000);
    return getSet(setNum);
  }
  if (!res.ok) {
    throw new Error(`Rebrickable getSet failed: ${res.status}`);
  }

  return res.json();
}

/**
 * Fetch all themes (for resolving theme_id → name).
 * @returns {Promise<Map<number, string>>}
 */
export async function getThemes() {
  if (!config.rebrickable.apiKey) return new Map();

  const themes = new Map();
  let page = 1;

  while (true) {
    const res = await fetch(`${API_BASE}/lego/themes/?page=${page}&page_size=1000`, {
      headers: headers(),
    });

    if (res.status === 429) {
      await sleep(2000);
      continue;
    }
    if (!res.ok) throw new Error(`Rebrickable themes failed: ${res.status}`);

    const data = await res.json();
    for (const t of data.results) {
      themes.set(t.id, t.name);
    }

    if (!data.next) break;
    page++;
    await sleep(1100);
  }

  return themes;
}

/**
 * Iterate through all sets, yielding pages. Handles pagination and rate limiting.
 * @param {object} [params] - extra query params (min_year, max_year, theme_id, search)
 * @yields {Array} page of set objects
 */
export async function* allSets(params = {}) {
  let page = 1;

  while (true) {
    const data = await listSets({ ...params, page: String(page) });
    yield data.results;

    if (!data.next) break;
    page++;
    await sleep(1100);
  }
}

export default { listSets, getSet, getThemes, allSets };
