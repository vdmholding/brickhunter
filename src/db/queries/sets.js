import db from '../index.js';

export async function upsertSet(set) {
  const { rows } = await db.query(
    `INSERT INTO sets (set_number, name, theme, year, piece_count, retail_price, image_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (set_number) DO UPDATE SET
       name = EXCLUDED.name,
       theme = COALESCE(EXCLUDED.theme, sets.theme),
       year = COALESCE(EXCLUDED.year, sets.year),
       piece_count = COALESCE(EXCLUDED.piece_count, sets.piece_count),
       retail_price = COALESCE(EXCLUDED.retail_price, sets.retail_price),
       image_url = COALESCE(EXCLUDED.image_url, sets.image_url),
       updated_at = now()
     RETURNING *`,
    [set.setNumber, set.name, set.theme, set.year, set.pieceCount, set.retailPrice, set.imageUrl]
  );
  return rows[0];
}

export async function findBySetNumber(setNumber) {
  const { rows } = await db.query('SELECT * FROM sets WHERE set_number = $1', [setNumber]);
  return rows[0] || null;
}

export async function searchByName(name) {
  const { rows } = await db.query(
    "SELECT * FROM sets WHERE name ILIKE '%' || $1 || '%' ORDER BY year DESC LIMIT 20",
    [name]
  );
  return rows;
}
