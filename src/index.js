import config from './config.js';
import app from './api/index.js';
import logger from './utils/logger.js';

const server = app.listen(config.port, () => {
  logger.info({ port: config.port, env: config.env }, 'BrickHunter API started');
});

// Graceful shutdown
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    logger.info({ signal }, 'Shutting down');
    server.close();
    const { close } = await import('./db/index.js');
    await close();
    process.exit(0);
  });
}
