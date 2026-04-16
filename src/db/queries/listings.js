import db from '../index.js';

export async function insertListing(listing) {
  const { rows } = await db.query(
    `INSERT INTO listings (set_id, source, condition, price, currency, shipping, seller, url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      listing.setId, listing.source, listing.condition, listing.price,
      listing.currency, listing.shipping, listing.seller, listing.url,
    ]
  );
  return rows[0];
}

export async function insertMany(listings) {
  if (!listings.length) return [];
  const client = await (await import('../index.js')).default.getClient();
  try {
    await client.query('BEGIN');
    const results = [];
    for (const l of listings) {
      const { rows } = await client.query(
        `INSERT INTO listings (set_id, source, condition, price, currency, shipping, seller, url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [l.setId, l.source, l.condition, l.price, l.currency, l.shipping, l.seller, l.url]
      );
      results.push(rows[0]);
    }
    await client.query('COMMIT');
    return results;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function findBySetId(setId, { source, limit = 50 } = {}) {
  let sql = 'SELECT * FROM listings WHERE set_id = $1';
  const params = [setId];
  if (source) {
    params.push(source);
    sql += ` AND source = $${params.length}`;
  }
  sql += ' ORDER BY price ASC LIMIT $' + (params.length + 1);
  params.push(limit);
  const { rows } = await db.query(sql, params);
  return rows;
}

export async function bestPrice(setId) {
  const { rows } = await db.query(
    `SELECT * FROM listings
     WHERE set_id = $1
     ORDER BY (price + COALESCE(shipping, 0)) ASC
     LIMIT 1`,
    [setId]
  );
  return rows[0] || null;
}
