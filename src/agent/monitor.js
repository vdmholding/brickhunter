import { searchAll } from '../sources/index.js';
import * as monitorsDb from '../db/queries/monitors.js';
import logger from '../utils/logger.js';

/**
 * Check a single monitor against live prices.
 * @returns {{ alert: object|null, bestListing: object|null }}
 */
export async function checkMonitor(monitor) {
  const listings = await searchAll(monitor.set_number, {
    condition: monitor.condition || undefined,
    only: monitor.sources || undefined,
  });

  if (!listings.length) {
    await monitorsDb.updateCheck(monitor.id, { price: null, source: null });
    return { alert: null, bestListing: null };
  }

  const best = listings[0]; // already sorted by total cost
  const totalCost = best.price + (best.shipping || 0);

  await monitorsDb.updateCheck(monitor.id, { price: totalCost, source: best.source });

  // Check if price hit the target
  if (monitor.target_price && totalCost <= parseFloat(monitor.target_price)) {
    const alert = await monitorsDb.recordAlert({
      monitorId: monitor.id,
      price: totalCost,
      source: best.source,
      url: best.url,
    });

    logger.info(
      { monitorId: monitor.id, setNumber: monitor.set_number, price: totalCost, target: monitor.target_price },
      'Price alert triggered'
    );

    return { alert, bestListing: best };
  }

  return { alert: null, bestListing: best };
}

/**
 * Run all active monitors. Returns triggered alerts.
 */
export async function runAll() {
  const monitors = await monitorsDb.listActive();
  logger.info({ count: monitors.length }, 'Running price monitors');

  const alerts = [];

  for (const m of monitors) {
    try {
      const result = await checkMonitor(m);
      if (result.alert) alerts.push({ monitor: m, ...result });
    } catch (err) {
      logger.error({ err, monitorId: m.id, setNumber: m.set_number }, 'Monitor check failed');
    }
  }

  logger.info({ checked: monitors.length, alerts: alerts.length }, 'Monitor run complete');
  return alerts;
}

let intervalId = null;

/**
 * Start the monitor scheduler.
 * @param {number} intervalMs - how often to check (default: 30 minutes)
 */
export function start(intervalMs = 30 * 60 * 1000) {
  if (intervalId) return;

  logger.info({ intervalMs }, 'Starting price monitor scheduler');

  // Run immediately, then on interval
  runAll().catch((err) => logger.error({ err }, 'Initial monitor run failed'));

  intervalId = setInterval(() => {
    runAll().catch((err) => logger.error({ err }, 'Scheduled monitor run failed'));
  }, intervalMs);
}

/**
 * Stop the monitor scheduler.
 */
export function stop() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('Price monitor scheduler stopped');
  }
}
