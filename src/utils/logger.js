import pino from 'pino';
import config from '../config.js';

const logger = pino({
  level: config.env === 'production' ? 'info' : 'debug',
  ...(config.env !== 'production' && {
    transport: { target: 'pino-pretty', options: { destination: 2 } },
  }),
}, config.env === 'production' ? pino.destination(2) : undefined);

export default logger;
