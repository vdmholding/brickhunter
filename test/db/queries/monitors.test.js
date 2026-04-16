import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import db from '../../../src/db/index.js';
import { create, findById, listActive, listAll, updateCheck, deactivate, recordAlert, getAlerts, recentAlerts } from '../../../src/db/queries/monitors.js';

describe('monitors queries', () => {
  let monitorId;

  before(async () => {
    await db.query('DELETE FROM alerts');
    await db.query('DELETE FROM monitors');
  });

  after(async () => {
    await db.query('DELETE FROM alerts');
    await db.query('DELETE FROM monitors');
    await db.close();
  });

  it('should create a monitor', async () => {
    const monitor = await create({
      setNumber: '75192',
      condition: 'new',
      targetPrice: 500,
      sources: ['ebay', 'bricklink'],
    });

    assert.ok(monitor.id);
    assert.equal(monitor.set_number, '75192');
    assert.equal(parseFloat(monitor.target_price), 500);
    assert.equal(monitor.active, true);
    assert.deepEqual(monitor.sources, ['ebay', 'bricklink']);
    monitorId = monitor.id;
  });

  it('should find monitor by id', async () => {
    const monitor = await findById(monitorId);
    assert.ok(monitor);
    assert.equal(monitor.set_number, '75192');
  });

  it('should list active monitors', async () => {
    const monitors = await listActive();
    assert.ok(monitors.length >= 1);
    assert.ok(monitors.every((m) => m.active));
  });

  it('should update check results', async () => {
    const updated = await updateCheck(monitorId, { price: 520, source: 'ebay' });
    assert.ok(updated.last_checked);
    assert.equal(parseFloat(updated.last_price), 520);
    assert.equal(updated.last_source, 'ebay');
  });

  it('should record an alert', async () => {
    const alert = await recordAlert({
      monitorId,
      price: 480,
      source: 'bricklink',
      url: 'https://example.com/deal',
    });

    assert.ok(alert.id);
    assert.equal(parseFloat(alert.price), 480);
  });

  it('should get alerts for a monitor', async () => {
    const alerts = await getAlerts(monitorId);
    assert.equal(alerts.length, 1);
    assert.equal(parseFloat(alerts[0].price), 480);
  });

  it('should get recent alerts with monitor info', async () => {
    const alerts = await recentAlerts();
    assert.ok(alerts.length >= 1);
    assert.equal(alerts[0].set_number, '75192');
  });

  it('should deactivate a monitor', async () => {
    const monitor = await deactivate(monitorId);
    assert.equal(monitor.active, false);

    const active = await listActive();
    assert.ok(!active.some((m) => m.id === monitorId));
  });
});
