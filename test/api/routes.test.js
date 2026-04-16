import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import app from '../../src/api/index.js';
import db from '../../src/db/index.js';
import { upsertSet } from '../../src/db/queries/sets.js';

describe('API routes', () => {
  let server;
  let baseUrl;

  before(async () => {
    // Seed test data
    await db.query("DELETE FROM listings WHERE set_id IN (SELECT id FROM sets WHERE set_number LIKE 'TEST-API%')");
    await db.query("DELETE FROM sets WHERE set_number LIKE 'TEST-API%'");

    const set = await upsertSet({
      setNumber: 'TEST-API001',
      name: 'Test API Set',
      theme: 'Test',
      year: 2024,
      pieceCount: 500,
    });

    await db.query(
      `INSERT INTO listings (set_id, source, condition, price, currency, shipping, seller, url)
       VALUES ($1, 'ebay', 'new', 79.99, 'USD', 5.99, 'testseller', 'https://example.com/1')`,
      [set.id]
    );

    server = app.listen(0);
    const addr = server.address();
    baseUrl = `http://localhost:${addr.port}`;
  });

  after(async () => {
    server.close();
    await db.query("DELETE FROM listings WHERE set_id IN (SELECT id FROM sets WHERE set_number LIKE 'TEST-API%')");
    await db.query("DELETE FROM sets WHERE set_number LIKE 'TEST-API%'");
    await db.close();
  });

  it('GET /health should return ok', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
  });

  it('GET /api/sets/:setNumber should return a set', async () => {
    const res = await fetch(`${baseUrl}/api/sets/TEST-API001`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.set.set_number, 'TEST-API001');
    assert.equal(body.set.name, 'Test API Set');
  });

  it('GET /api/sets/:setNumber should return 404 for unknown set', async () => {
    const res = await fetch(`${baseUrl}/api/sets/NONEXISTENT-999`);
    assert.equal(res.status, 404);
  });

  it('GET /api/sets/:setNumber/listings should return listings', async () => {
    const res = await fetch(`${baseUrl}/api/sets/TEST-API001/listings`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.listings.length >= 1);
    assert.ok(body.bestDeal);
  });

  it('POST /api/search should reject missing query', async () => {
    const res = await fetch(`${baseUrl}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
  });

  it('GET /api/search/history should return searches', async () => {
    const res = await fetch(`${baseUrl}/api/search/history`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.searches));
  });

  it('POST /api/monitors should create a monitor', async () => {
    const res = await fetch(`${baseUrl}/api/monitors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setNumber: 'TEST-API001', targetPrice: 70 }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.monitor.set_number, 'TEST-API001');
    assert.equal(body.monitor.active, true);

    // Clean up
    await db.query('DELETE FROM monitors WHERE id = $1', [body.monitor.id]);
  });

  it('POST /api/monitors should reject missing fields', async () => {
    const res = await fetch(`${baseUrl}/api/monitors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setNumber: 'TEST-API001' }),
    });
    assert.equal(res.status, 400);
  });
});
