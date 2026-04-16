import { allSets, getThemes } from '../sources/rebrickable.js';
import { upsertSet } from './queries/sets.js';
import db from './index.js';
import logger from '../utils/logger.js';

/**
 * Seed the sets catalogue from Rebrickable.
 *
 * Usage:
 *   npm run seed                     # sync all sets
 *   npm run seed -- --year 2024      # sync only 2024 sets
 *   npm run seed -- --theme 158      # sync only Star Wars (theme_id 158)
 */
async function seed() {
  const args = process.argv.slice(2);
  const params = {};

  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i]?.replace(/^--/, '');
    const value = args[i + 1];
    if (flag && value) {
      if (flag === 'year') {
        params.min_year = value;
        params.max_year = value;
      } else if (flag === 'min-year') {
        params.min_year = value;
      } else if (flag === 'max-year') {
        params.max_year = value;
      } else if (flag === 'theme') {
        params.theme_id = value;
      } else if (flag === 'search') {
        params.search = value;
      }
    }
  }

  logger.info({ params }, 'Starting catalogue seed from Rebrickable');

  // Load themes map for resolving theme_id → name
  logger.info('Fetching themes');
  const themes = await getThemes();
  logger.info({ count: themes.size }, 'Themes loaded');

  let total = 0;

  for await (const page of allSets(params)) {
    for (const s of page) {
      // Strip the "-1" suffix for our set_number (keep it simple)
      const setNumber = s.set_num.replace(/-1$/, '');

      await upsertSet({
        setNumber,
        name: s.name,
        theme: themes.get(s.theme_id) || null,
        year: s.year,
        pieceCount: s.num_parts,
        retailPrice: null,   // Rebrickable doesn't provide retail price
        imageUrl: s.set_img_url || null,
      });

      total++;
    }

    logger.info({ total }, 'Progress');
  }

  logger.info({ total }, 'Catalogue seed complete');
  await db.close();
}

seed().catch((err) => {
  logger.error({ err }, 'Seed failed');
  process.exit(1);
});
