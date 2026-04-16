import config from './config.js';
import app from './api/index.js';
import { start as startMonitor, stop as stopMonitor } from './agent/monitor.js';
import logger from './utils/logger.js';

const server = app.listen(config.port, () => {
  logger.info({ port: config.port, env: config.env }, 'BrickHunter API started');
  startMonitor();
});

// Graceful shutdown
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    logger.info({ signal }, 'Shutting down');
    server.close();
    stopMonitor();
    const { close } = await import('./db/index.js');
    const { closeBrowser } = await import('./utils/browser.js');
    await closeBrowser();
    await close();
    process.exit(0);
  });
}
