import db from '../index.js';

export async function recordSearch(search) {
  const { rows } = await db.query(
    `INSERT INTO searches (query, set_number, results_count, best_price, best_source)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [search.query, search.setNumber, search.resultsCount, search.bestPrice, search.bestSource]
  );
  return rows[0];
}

export async function recentSearches(limit = 20) {
  const { rows } = await db.query(
    'SELECT * FROM searches ORDER BY searched_at DESC LIMIT $1',
    [limit]
  );
  return rows;
}
