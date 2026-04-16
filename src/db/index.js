import pg from 'pg';
import config from '../config.js';
import logger from '../utils/logger.js';

const pool = new pg.Pool({
  connectionString: config.db.connectionString,
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected database pool error');
});

/** Run a single query. */
export function query(text, params) {
  return pool.query(text, params);
}

/** Get a client from the pool (for transactions). */
export function getClient() {
  return pool.connect();
}

export async function close() {
  await pool.end();
}

export default { query, getClient, close };
