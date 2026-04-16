import { Router } from 'express';
import * as monitorsDb from '../../db/queries/monitors.js';
import { checkMonitor } from '../../agent/monitor.js';

const router = Router();

/**
 * GET /api/monitors — list all monitors
 */
router.get('/', async (req, res, next) => {
  try {
    const monitors = await monitorsDb.listAll();
    res.json({ monitors });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/monitors — create a new price monitor
 * Body: { setNumber, condition?, targetPrice, sources? }
 */
router.post('/', async (req, res, next) => {
  try {
    const { setNumber, condition, targetPrice, sources } = req.body;

    if (!setNumber) {
      return res.status(400).json({ error: 'Missing "setNumber"' });
    }
    if (!targetPrice || isNaN(targetPrice)) {
      return res.status(400).json({ error: 'Missing or invalid "targetPrice"' });
    }

    const monitor = await monitorsDb.create({
      setNumber,
      condition,
      targetPrice: parseFloat(targetPrice),
      sources,
    });

    res.status(201).json({ monitor });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/monitors/:id — get a monitor with its alerts
 */
router.get('/:id', async (req, res, next) => {
  try {
    const monitor = await monitorsDb.findById(req.params.id);
    if (!monitor) return res.status(404).json({ error: 'Monitor not found' });

    const alerts = await monitorsDb.getAlerts(monitor.id);
    res.json({ monitor, alerts });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/monitors/:id/check — manually trigger a check
 */
router.post('/:id/check', async (req, res, next) => {
  try {
    const monitor = await monitorsDb.findById(req.params.id);
    if (!monitor) return res.status(404).json({ error: 'Monitor not found' });

    const result = await checkMonitor(monitor);
    res.json({
      monitor: await monitorsDb.findById(monitor.id),
      alert: result.alert,
      bestListing: result.bestListing,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/monitors/:id — deactivate a monitor
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const monitor = await monitorsDb.deactivate(req.params.id);
    if (!monitor) return res.status(404).json({ error: 'Monitor not found' });
    res.json({ monitor });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/alerts — recent alerts across all monitors
 */
router.get('/alerts/recent', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const alerts = await monitorsDb.recentAlerts(limit);
    res.json({ alerts });
  } catch (err) {
    next(err);
  }
});

export default router;
