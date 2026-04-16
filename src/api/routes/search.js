import { Router } from 'express';
import { hunt } from '../../agent/index.js';
import * as searchesDb from '../../db/queries/searches.js';

const router = Router();

/**
 * POST /api/search
 * Body: { query: "75192" | "UCS Millennium Falcon", condition?: "new"|"used", sources?: ["ebay","bricklink"] }
 */
router.post('/', async (req, res, next) => {
  try {
    const { query, condition, sources } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid "query" field' });
    }

    const result = await hunt(query, {
      condition,
      only: sources,
    });

    res.json({
      set: result.set,
      bestDeal: result.bestDeal,
      totalListings: result.listings.length,
      listings: result.listings,
      summary: result.summary,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/search/history
 */
router.get('/history', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const searches = await searchesDb.recentSearches(limit);
    res.json({ searches });
  } catch (err) {
    next(err);
  }
});

export default router;
