import { Router } from 'express';
import * as setsDb from '../../db/queries/sets.js';
import * as listingsDb from '../../db/queries/listings.js';

const router = Router();

/**
 * GET /api/sets?q=galaxy+explorer
 * Search sets by name (falls back to Rebrickable if local DB has no matches).
 */
router.get('/', async (req, res, next) => {
  try {
    const q = req.query.q;
    if (!q) return res.status(400).json({ error: 'Missing "q" query parameter' });
    const sets = await setsDb.searchByNameWithFallback(q);
    res.json({ sets });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/sets/:setNumber
 */
router.get('/:setNumber', async (req, res, next) => {
  try {
    const set = await setsDb.findBySetNumber(req.params.setNumber);
    if (!set) {
      return res.status(404).json({ error: 'Set not found' });
    }
    res.json({ set });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/sets/:setNumber/listings
 */
router.get('/:setNumber/listings', async (req, res, next) => {
  try {
    const set = await setsDb.findBySetNumber(req.params.setNumber);
    if (!set) {
      return res.status(404).json({ error: 'Set not found' });
    }

    const { source, limit } = req.query;
    const listings = await listingsDb.findBySetId(set.id, {
      source,
      limit: Math.min(parseInt(limit, 10) || 50, 200),
    });

    const best = await listingsDb.bestPrice(set.id);
    res.json({ set, listings, bestDeal: best });
  } catch (err) {
    next(err);
  }
});

export default router;
